# fork 维护台账（个人定制分支）

本文件是 `feat/mobile-tablet-hardware-keyboard` 分支上自定义补丁的**唯一台账**。
方法论已迁移到 `~/.agents/skills`（技能集合 `gwf`，仓库 `MyAgentConfig`）：

- 同步官方：`gwf-sync`（审计 → 官方优先裁决 → 死资产清理 → 单调递减核验）
- 打包交付：`gwf-release`（版本/构建号、产物+sha256、latest 清单、装机核对、`--force-with-lease` 推送）
- 工作树布局与冲突预警：`gwf-init` / `gwf-new` / `gwf-scan` / `gwf-archive`

本文件只记录**本项目的**事实与结论，不重复方法论。

## 背景约定

- `origin` = `OuYang-HX/orca`，`upstream` = `stablyai/orca`。
- 自定义提交 subject 统一 `[oyhx] ` 前缀。
- `mobile/android/` 是忽略的 prebuild 生成物；原生键盘逻辑以
  `mobile/plugins/with-terminal-hwkeys.js` 与 `mobile/modules/expo-terminal-hwkeys/` 为准。
- 设备地址、配对信息、SDK/JDK 路径只放本机配置，**不写入本文件**。
- Node 用仓库要求的 24；pnpm 版本取 `packageManager`。本机 pnpm 包装器失效时用
  `npx --yes pnpm@<packageManager 版本>`，不要改仓库依赖去迁就环境。

## 自定义功能台账

最近核对：2026-11-06，官方基线 `c94caf66e0c`，较旧基线 `1783cf58b19` 新增 740 个提交。
官方将 Android 版本升至 0.0.64 / versionCode 28，并在 `8a4dd3a7bb9` 改为单一实时输入；
键盘门控、切换后聚焦和失焦恢复已接入该结构，官方的双模式输入删除保持不变。
分支备份：`backup/mobile-tablet-hardware-keyboard-20261106-130105`（本地）。

| 功能                                                   | 当前增量                                                                                             | 官方覆盖情况与处置                                                                           | 判据                                                                        |
| ------------------------------------------------------ | ---------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| Android 硬件方向键、ESC、Tab、翻页、Home/End、Ctrl/Alt | 原生模块、MainActivity prebuild 插件、JS 事件接入                                                    | 官方未实现，保留                                                                             | `git grep -l 'dispatchKeyEvent\|onKeyPreIme' upstream/main -- mobile/` 为空 |
| 未聚焦 Enter/NumpadEnter/DPAD_CENTER                   | 原生 EditText 焦点判定、路由焦点门控、JS submit 接入                                                 | 官方未覆盖，保留（防 Android 焦点搜索误点离开会话）                                          | 同上 + `KEYCODE_DPAD_CENTER`                                                |
| 硬键盘探测与切标签/工作区后聚焦                        | 原生设备探测、成功门控后记录 handle、官方聚焦调度器                                                  | 官方未覆盖，保留                                                                             | `git grep -l 'isHardwareKeyboardConnected' upstream/main -- mobile/`        |
| 防止自然失焦打断硬键盘输入                             | 官方聚焦 hook 的 Android blur 接入、主动关闭时短暂抑制                                               | 官方未覆盖，保留（iOS 不自动重开键盘）                                                       | 同上                                                                        |
| xterm / addon 升级与 esbuild 钉版                      | **已移除**                                                                                           | 官方已升 `@xterm/xterm` 6.1.0-beta.336，无需自钉                                             | `git grep '@xterm/xterm' upstream/main -- mobile/package.json`              |
| colorSchemeQuery 关闭                                  | `terminal-init.ts` 的 vtExtensions 选项                                                              | 官方仍会答复颜色查询，保留（避免远程延迟回复回显）                                           | 上游 `terminal-init.ts` 无该开关                                            |
| Nerd Font 图标与首次绘制等待                           | **已全部删除**（TTF、base64 模块、@font-face、帧门控提交）                                           | **官方已覆盖**：`0cba9f2e08` 自带 woff2 + `terminal-nerd-font-css` + message-bridge 首绘门控 | 上游含 `TERMINAL_SYMBOLS_FONT_CSS`                                          |
| 平台门控                                               | 无                                                                                                   | 沿用官方 `hostOs()` 接口，不自建平台判断                                                     | —                                                                           |
| route-parity 等源码指纹测试                            | **已移除**                                                                                           | 官方已删除该类测试，不恢复已删文件、不保留旧重录提交                                         | 上游已无该测试                                                              |
| 依赖锁文件                                             | 仅增插件直接依赖索引（`@expo/config-plugins`）                                                       | 其他依赖保持官方版本；**不用 `--lockfile-only` 重解**                                        | —                                                                           |
| Android 定制包版本与官方更新提醒                       | `mobile/app.json` 的版本/构建标签（当前 `0.0.64` / `oyhx.8` / versionCode 29）、首页与设置页重建说明 | 沿用官方更新来源与缓存；官方新版提醒后同步源码并保留定制重建                                 | 见 `gwf-release`                                                            |

判定原则：**实现 + 资产/门控齐全**才算"官方覆盖"；只有符号名不算。

## 每轮同步的检查序（摘要，细节走 `gwf-sync`）

1. 工作区干净 → 建带日期的备份分支并推 origin。
2. 同分支被其它工作树检出时：建临时迁移分支，验证后 `update-ref` 原子更新，不碰其它工作树文件。
3. `git fetch --no-tags upstream +refs/heads/main:refs/remotes/upstream/main`。
4. 逐项核对上方台账判据；`git grep -l` 限定 `mobile/`，不输出生成的字体/引擎数据。
5. 重放 `[oyhx]` 提交：官方完全覆盖的 drop，部分覆盖的以官方结构为基底改写；
   上一轮机械性锁文件/pin 提交丢弃，最后统一更新本文件。
6. 验证（顺序执行）：根 `pnpm tc`；mobile `pnpm exec tsc --noEmit`、`pnpm run check:tests-typecheck`、
   `pnpm exec vitest run src/ scripts/`；根 `pnpm run check:code-quality:changed -- upstream/main`。
   所有测试与 app 启动设置 `ORCA_BACKGROUND_LAUNCH=1`。
7. 打包交付按 `gwf-release`：版本对齐已纳入的官方版本、versionCode 递增、
   `expo prebuild --platform android --clean --no-install` 后 `./gradlew :expo-terminal-hwkeys:testReleaseUnitTest :app:assembleRelease`，
   只交付 arm64 时可加 `-PreactNativeArchitectures=arm64-v8a`。
8. 装机 `adb -s <sn> install -r`（不卸载、不删配对数据），核对版本/构建号/签名；
   共享盘只留一份 `orca-latest.apk` + `.sha256` + `.txt`。
9. 推送用 `git push --force-with-lease=<ref>:<旧SHA>`。

## 关键教训（避免重复踩）

- **字体**：Nerd Font 已由官方自带 woff2，自建字体/首绘门控全部弃用——不要恢复。
- **WebView 化**：本代会话页改为 WebView 加载桌面 bundle，RN 侧硬件键逻辑仅在 `.web.tsx` 生效；
  只能在原生 `MainActivity` 拦截并通过 sink 发送（纯 APK 方案，无需重启桌面）。
- **桌面 bundle 缓存**：桌面端 mobile web bundle 是进程级缓存，仓库 `out/mobile-web` 可能从未被读取
  （打包版从 `app.asar.unpacked` 提供），改页面代码需重打桌面 app 才生效。
- **锁文件**：缺插件索引时手补 importer 条目 + `pnpm install` 验证 "Lockfile is up to date"，
  不要 `--lockfile-only`（会偷偷升官方 pin）。
- **会话 URL**：`/session/${repoId}::${path}` 的 path 段是 worktree id，不是 terminal handle；
  发送终端输入必须从快照取 `term_…` handle。
- **质量门**：首轮报的问题多半是自己引入的，按规则改代码，不加 disable、不移除测试。

## 最近验证摘要

- 2026-11-06：基线 `c94caf66e0c`（+740 提交），保留硬件键、WebView 路由、焦点恢复、颜色查询与官方更新提醒；
  适配官方单一实时输入，干净 prebuild 后 arm64 release APK / code 29 构建及两个原生模块 release 单测通过。
  APK SHA-256：`e29add4d9567cf87c57b4b3cdb9047f0fb8f85202018c12405eb709feea59acf`。
  根类型检查、mobile 类型检查、变更质量门通过；mobile 测试 7929 通过、4 跳过。
  单调递减检查未通过：排除本台账后，定制差异由 +1770/-54 变为 +1911/-42。
  官方删除旧测试文件后，保留焦点与定制更新提示的测试分别增加 103 和 68 行；其余文件合计减少 42 行。
  已移除旧路由测试的纯 mock 变更，未为缩减行数丢弃这两项针对定制行为的测试。
  未进行本轮设备安装和实机验证；旧备份保留以供复核。
- 2026-11-02：基线 `1783cf58b19`（+200 提交/43 触及 `mobile/`），官方 bump 0.0.62 / code 26，
  重写输入框接入；`oyhx.7` / versionCode 28 交付。
- 2026-11-01：基线 `e5b87cb8e61`（+2944 提交），丢弃 Symbols Nerd Font 自建补丁（官方已覆盖），
  code 27 交付。
- 更早的逐轮记录见 git 历史中的 `.zcode/skills/port-custom-commits/SKILL.md`（已迁移，勿再新增同类技能文件）。
