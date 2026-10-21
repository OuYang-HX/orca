---
name: port-custom-commits
description: 把 orca 个人仓的自定义提交移植到官方最新代码：备份、官方覆盖审查、重放、验证与 APK 交付
---

# 移植自定义提交到官方最新代码

维护 `feat/mobile-tablet-hardware-keyboard` 与官方 `upstream/main` 的同步。
官方完全覆盖的功能删除自定义补丁；未覆盖的功能复用官方结构，只保留必要增量。

## 背景约定

- `origin` 是 OuYang-HX/orca，`upstream` 是 stablyai/orca。
- 自定义提交 subject 使用 `[oyhx] ` 前缀。
- `mobile/android/` 是忽略的 prebuild 生成物；原生键盘逻辑以
  `mobile/plugins/with-terminal-hwkeys.js` 与 `mobile/modules/expo-terminal-hwkeys/` 为准。
- 设备地址、配对信息与 SDK/JDK 路径只放本机配置，不写入本技能或共享记忆。
- Node 使用仓库要求的 24；pnpm 版本取 `packageManager`。本机 pnpm 包装器失效时，
  使用 `npx --yes pnpm@<packageManager 的版本>`（当前 12.14.0），不要改仓库依赖来绕过环境问题。

## 自定义功能台账

最近核对：2026-10-22，官方基线 `de7a2d24f9`，较旧基线 `dc146c09e2` 新增 1449 个提交
（其中 134 个触及 `mobile/`）。本代官方新增 `0cba9f2e08`（自带 woff2 字体资产 + 首绘门控），
我们的字体补丁因此全部作废。
旧分支备份：`backup/mobile-tablet-hardware-keyboard-20261022`（本地与 origin）。

| 功能                                                          | 当前增量                                                                                      | 官方覆盖情况与处置                                                                                                                        |
| ------------------------------------------------------------- | --------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Android 硬件方向键、ESC、Tab、翻页、Home/End、Ctrl/Alt 组合键 | 原生模块、MainActivity prebuild 插件、JS 事件接入                                             | 官方没有 dispatchKeyEvent/onKeyPreIme 拦截，保留                                                                                          |
| 未聚焦 Enter/NumpadEnter/DPAD_CENTER                          | 原生实时 EditText 焦点判定、路由焦点门控、JS submit 接入                                      | 官方未覆盖，保留，防止 Android 焦点搜索误点离开会话                                                                                       |
| 硬键盘探测与切换标签/工作区后聚焦                             | 原生设备探测、成功门控后记录 handle、官方聚焦调度器                                           | 官方未覆盖，保留；连接与标签条异步稳定前允许重试                                                                                          |
| 防止自然失焦打断硬键盘输入                                    | 官方聚焦 hook 的 Android blur 接入、主动关闭时短暂抑制                                        | 官方未覆盖，保留；iOS 不自动重开键盘                                                                                                      |
| xterm / addon 升级与 esbuild 钉版                             | 已移除自定义版本差异                                                                          | 官方已钉 `@xterm/xterm` 6.1.0-beta.304、esbuild 0.28.2、acorn 8.18.0，本代无需再钉                                                        |
| colorSchemeQuery 关闭                                         | `terminal-init.ts` 的 vtExtensions 选项                                                       | 官方仍会答复颜色查询，保留以避免远程延迟回复回显                                                                                          |
| Nerd Font 图标与首次绘制等待                                  | 已全部删除（字体 TTF、base64 模块、@font-face、帧门控提交）                                   | **官方已覆盖**（`0cba9f2e08` 自带 woff2 资产 + `terminal-nerd-font-css` + message-bridge 首绘门控）；本代把自建字体与两个字体提交一并丢弃 |
| 平台门控                                                      | 官方 `hostOs()` 接口                                                                          | 沿用官方封口，避免自建平台判断                                                                                                            |
| route-parity 等源码指纹测试                                   | 已移除旧自定义 pin                                                                            | 官方已删除这类测试，不恢复已删除文件，也不保留旧重录提交                                                                                  |
| 依赖锁文件                                                    | 仅增加插件的直接依赖索引                                                                      | 原生插件仍需要 `@expo/config-plugins`，其他依赖保持官方版本                                                                               |
| Android 定制包版本与官方更新提醒                              | app.json 的版本/构建标签（当前 `0.0.58` / `oyhx.5` / versionCode 24）、首页与设置页的重建说明 | 沿用官方更新来源和缓存；发现官方新版本后同步源码并保留自定义功能重建，不要求个人仓发布 APK                                                |

## 同步流程

1. 检查当前工作区未提交修改，创建带日期的本地备份并推 origin。
2. 同一分支被其他工作树检出时，先在当前工作树创建临时迁移分支，
   不读取或改动另一工作树的文件。验证完再原子更新目标分支，要求旧 SHA 匹配。
3. 只取命名的官方分支：
   `git fetch --no-tags upstream +refs/heads/main:refs/remotes/upstream/main`。
4. 审查旧官方基线到新基线的 mobile 日志及相关源码，逐项核对台账。
   例如使用 `git grep -l` 搜 `dispatchKeyEvent|onKeyPreIme|KEYCODE_DPAD`，
   限定 `mobile/` 路径；不要输出生成的字体/引擎数据。
5. 重放自定义提交。官方完全覆盖则 drop；部分覆盖则以官方结构为基底改写。
   删除上一轮机械锁文件/pin 重录与过期台账更新提交，最后统一更新本文件。
6. 安装根与 mobile 的独立依赖，执行 mobile 的 postinstall 生成终端脚本。
   删除官方已废弃的测试，不靠放宽 max-lines 或类型断言来绕过质量门。
7. 验证：
   - 根目录 `pnpm tc`。
   - mobile `pnpm exec tsc --noEmit`、`pnpm run check:tests-typecheck`。
   - mobile `pnpm exec vitest run src/ scripts/`。
   - 根目录 `pnpm run check:code-quality:changed -- upstream/main`。
   - 所有测试及 app 启动设置 `ORCA_BACKGROUND_LAUNCH=1`；桌面渲染验证遵循项目的后台规则。
8. 打包前检查官方 `mobile-android-v*` 发布标签及其 app.json；不能仅凭 main 的版本号
   判断发布版本。版本号至少对齐已纳入代码的官方发布，versionCode 大于平板旧包与该官方包，
   每次定制交付递增。递增 app.json extra 的 `androidBuildLabel`（如 `oyhx.2`）；
   它只用于显示，比较仍使用已纳入的官方数字版本。必须保留 `stablyai/orca` 官方更新来源，
   不改成个人仓检查，也不按 APK 构建时间判断官方源码新旧。
   提醒应说明“官方有新版本，需要重建定制 APK”，点击查看发布说明。
   用户收到提醒后再按本流程同步最新官方源码、移除已被官方覆盖的补丁、打包并覆盖安装。
   在 mobile 用 `expo prebuild --platform android --no-install` 生成工程。
   使用本机 JDK 17 与 SDK，执行
   `./gradlew :expo-terminal-hwkeys:testReleaseUnitTest :app:assembleRelease`。
   仅交付 arm64 平板时可带 `-PreactNativeArchitectures=arm64-v8a`。
9. 核对目标设备型号、APK 包名/版本/签名/摘要，用指定串号 `adb -s ... install -r` 更新，
   不卸载应用或删除配对数据。构建产物复制到桌面；NAS/共享磁盘已挂载时也交付一份。
   NAS 的安装包目录每次只保留一个 Orca APK，固定命名为 `orca-latest.apk`，
   附带 `orca-latest.apk.sha256` 与记录版本、构建号、架构、源码提交的 `orca-latest.txt`。
   先写临时文件并核对摘要，再替换最新包，最后清理旧 Orca APK 与对应旧校验文件。
   不保留日期名、测试名或其他版本的重复 Orca 包；清理范围按包名
   `com.stably.orca.mobile` 核对，其他应用的安装包保留。挂载地址只留在本机配置。
10. 真机冒烟：先记 PID，再注入方向键、Ctrl+C 与普通字母，确认 PID 未变且无本次崩溃。
    方向键用 `input keyevent --source 769 19`；Ctrl+C 用 `input keycombination 113 31`。
    只向空闲测试终端注入组合键，避免打断用户正在运行的任务；实际终端语义需单独回归。
11. 完成后使用保存的远程旧 SHA 进行 `git push --force-with-lease`，
    防止覆盖迁移期间别人推送的修改；保存具体验证结果与项目交接并同步共享记忆。

## 最近验证与交付

2026-10-22：官方基线 `dc146c09e2` → `de7a2d24f9`（+1449 提交，134 个触及 `mobile/`）。
18 个 `[oyhx]` 提交流中丢弃 2 个字体提交，净增量 28 文件 / +1067 −32。
冲突：`mobile/package.json`（官方 `@types/*` 与我们 `@expo/config-plugins` 并存）、
`use-mobile-session-terminal-runtime.ts` 的 react-native 导入（合并官方 `Alert` 与我们的 `hostOs`，
去掉不再使用的 `Platform`）、`document-shell.ts`（字体 CSS 全取官方）、`mobile/app.json`（取定制版本值）。
lockfile 缺插件索引：手补 3 行 importer 条目后用 `pnpm install` 验证 "Lockfile is up to date"——
**不要用 `--lockfile-only` 重新解析**，它会把官方 pin 升到更新的小版本。

验证：mobile `tsc --noEmit` 0 错误；`check:tests-typecheck` 棘轮通过（1074 个测试文件，沿用官方 119 个例外）；
mobile 全量 1078 个文件 / 11173 项通过 / 6 跳过；根 `pnpm tc` 0 错误（四个 TS 工程）；
`check:code-quality:changed -- upstream/main` 0 新增问题（19 个改动文件）；Kotlin 按键编码单测 13 项通过。
质量门首轮报了 2 条我们引入的问题（多余 `eslint-disable`、测试里的类型断言），修掉后单提交 `8e3f18f738`。

版本策略：官方 main 的 app.json 为 `0.0.58`、versionCode `22`，`mobile-android-v*` 最新发布标签仍是 `0.0.52`；
定制包对齐 `0.0.58`，`androidBuildLabel` 递增 `oyhx.4`，versionCode `23`。更新来源与缓存仍走官方
`stablyai/orca`，只保留定制显示与重建说明。

打包：`expo prebuild --platform android --clean --no-install` 重建工程（插件注入 MainActivity 已确认）；
arm64-v8a `com.stably.orca.mobile` `0.0.58 (oyhx.4)` / versionCode `23`，59886896 字节，
签名与平板旧包同一证书（`fac61745…`），DEX 含 `terminalhwkeys`、bundle 含 `TerminalHwKeys`。
本代体积下降是本轮官方删除不可达原生屏（`86f6258d54`）所致。

交付：桌面 `orca-mobile-0.0.58-oyhx.4-code23-20261022-arm64.apk` + `.sha256`；
NAS 安装包目录只保留 `orca-latest.apk` + `orca-latest.apk.sha256` + `orca-latest.txt`，两处摘要一致。
装机：平板无线 adb 的配对在设备端丢失（且 `adb connect` 报 `EHOSTUNREACH`），改用 USB 后
`adb install -r` 返回 Success，包管理器确认 `0.0.58` / `23`，原配对数据保留（首页仍显示
`Connected · Direct · LAN` 与 DESKTOPS 列表）。首页（无终端）注入 ↑/Ctrl+C/字母：PID 22376 前后未变、
`TerminalHwKeys` 无 dispatch（无终端时拦截关闭，符合设计）、`AndroidRuntime:E`/`ReactNativeJS:E` 为空。
拦截路径的 `dispatch keyCode=…` 证据仍需在会话终端页取（2026-10-15 那组记录了同样行为与判据）。

同日热修（`oyhx.5` / code 24）：平板上按方向键会"像按 Tab 一样切换 UI 框"。根因：拦截开关要求
`liveInputEnabled`（直连输入模式），而本代上游把保存的输入模式偏好提前到会话挂载时生效
（`251bbf7bb0`），buffered 终端下开关一直为 false → `MainActivity.dispatchKeyEvent` 落回系统 →
Android 的 DPAD 焦点导航。修复：原生新增 `navigationInterceptEnabled`——终端标签页 + 已连接 +
**当前无编辑框聚焦**时接管映射键（有编辑框时方向键仍归输入框）；JS 在 `activeSessionTab.type === 'terminal'`
时开启。验证：mobile `tsc` 0 错误、session/terminal 359 文件 3381 项通过、质量门 0 新增问题、Kotlin 单测
14 项通过（新增 1 项覆盖新开关：无编辑框聚焦 → 拦截；编辑框聚焦 → 放行；未映射键 → 放行）。
装机：`install -r` 成功 → `0.0.58`/`24`；首页注入 ↑、↓、Ctrl+C、`c`（`--source 769` 硬键盘源）
前后 PID 31290 不变，`logcat -s TerminalHwKeys` 无 dispatch，无 `AndroidRuntime`/`ReactNativeJS` 错误。
终端页行为回归需在真实会话里按一次确认（`logcat -s TerminalHwKeys` 应出现 `dispatch keyCode=19`）。

评审补充（已修）：两个原生开关原先用 `useEffect`，会话路由 blur 后仍挂载 → 标志残留 `true` 会全局
吞键；已改为 `useFocusEffect` + cleanup（与 submit 拦截同构），失焦即关。

APK SHA-256（`oyhx.5` 现行）：`f2b2fe1586d5d5a3db86f4fb51c905edd51c2557043e3a331c38e54358d3ec3c`。
历史：初版 `oyhx.5` `517ac17fe73e7f3f306864160d7e50752a1aa1f0b25c0e0ed152b917a588f9e1`（未含失焦清理，
已被取代）；`oyhx.4` `23a5f20979e3667972d6124e395aeee15d189899bdab19699b5b927b25ff3f05`。

## 退出条件

台账中所有功能均被官方完全覆盖时，删除对应补丁；没有新增自定义需求就不新增实现。
