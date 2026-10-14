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
  使用 `npx --yes pnpm@12.8.1`，不要改仓库依赖来绕过环境问题。

## 自定义功能台账

最近核对：2026-10-15，官方基线 `dc146c09e2`，较旧基线 `7e52bed4e0` 新增 1209 个提交
（其中 92 个触及 `mobile/`，唯一落在我们文件上的是 `50b3d2e34c` 终端快照修复）。
旧分支备份：`backup/mobile-tablet-hardware-keyboard-20261015`（本地与 origin）。

| 功能 | 当前增量 | 官方覆盖情况与处置 |
| --- | --- | --- |
| Android 硬件方向键、ESC、Tab、翻页、Home/End、Ctrl/Alt 组合键 | 原生模块、MainActivity prebuild 插件、JS 事件接入 | 官方没有 dispatchKeyEvent/onKeyPreIme 拦截，保留 |
| 未聚焦 Enter/NumpadEnter/DPAD_CENTER | 原生实时 EditText 焦点判定、路由焦点门控、JS submit 接入 | 官方未覆盖，保留，防止 Android 焦点搜索误点离开会话 |
| 硬键盘探测与切换标签/工作区后聚焦 | 原生设备探测、成功门控后记录 handle、官方聚焦调度器 | 官方未覆盖，保留；连接与标签条异步稳定前允许重试 |
| 防止自然失焦打断硬键盘输入 | 官方聚焦 hook 的 Android blur 接入、主动关闭时短暂抑制 | 官方未覆盖，保留；iOS 不自动重开键盘 |
| xterm / addon 升级与 esbuild 钉版 | 已移除自定义版本差异 | 官方已钉 `@xterm/xterm` 6.1.0-beta.304、esbuild 0.28.2、acorn 8.18.0，本代无需再钉 |
| colorSchemeQuery 关闭 | `terminal-init.ts` 的 vtExtensions 选项 | 官方仍会答复颜色查询，保留以避免远程延迟回复回显 |
| Nerd Font 图标与首次绘制等待 | 字体资产、HTML @font-face、native-document-entry 启动等待 | 官方字体栈已列出 `Symbols Nerd Font Mono` 但不带资产；保留字体与官方 web-ready 门控，失败或 3 秒超时仍启动 |
| 平台门控 | 官方 `hostOs()` 接口 | 沿用官方封口，避免自建平台判断 |
| route-parity 等源码指纹测试 | 已移除旧自定义 pin | 官方已删除这类测试，不恢复已删除文件，也不保留旧重录提交 |
| 依赖锁文件 | 仅增加插件的直接依赖索引 | 原生插件仍需要 `@expo/config-plugins`，其他依赖保持官方版本 |
| Android 定制包版本与官方更新提醒 | app.json 的版本/构建标签（当前 `0.0.55` / `oyhx.3` / versionCode 22）、首页与设置页的重建说明 | 沿用官方更新来源和缓存；发现官方新版本后同步源码并保留自定义功能重建，不要求个人仓发布 APK |

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

2026-10-15：官方基线 `7e52bed4e0` → `dc146c09e2`（+1209 提交），16 个 `[oyhx]` 提交全部重放。
`git grep` 复核 `mobile/` 无 `dispatchKeyEvent`/`onKeyPreIme`/`KEYCODE_DPAD`/`colorSchemeQuery`，
route-parity 类指纹测试官方已删除；冲突只有 4 处：`mobile/package.json`、`mobile/pnpm-lock.yaml`
（官方 `@orca/process-host` 与我们的 `@expo/config-plugins` 并存）和 `mobile/app.json`
的 `version`/`extra`/`android`（取定制值：`0.0.55` / `oyhx.3` / `22`）。

验证：根目录 `pnpm tc` 通过；mobile `tsc --noEmit` 0 错误；`check:tests-typecheck` 棘轮通过
（1009 个测试文件入程序，沿用官方 122 个历史例外）；mobile 全量测试 1011 个文件、
10647 项通过、6 项跳过；`check:code-quality:changed -- upstream/main` 0 新增问题（23 个改动文件）；
Kotlin 按键编码单测 13 项通过。

版本策略：官方 main 的 app.json 为 `0.0.55`，`mobile-android-v*` 最新发布标签仍是 `0.0.52`；
定制包版本对齐到已纳入源码的 `0.0.55`，`androidBuildLabel` 递增为 `oyhx.3`，versionCode `22`
（大于平板旧包 21 与官方包 20）。更新来源与缓存仍走官方 `stablyai/orca`，只保留定制显示与
重建说明；官方发布新 Android 版本时首页/设置提醒重建，不再走个人仓。

打包：`expo prebuild --platform android --clean --no-install` 重新生成工程
（`with-terminal-hwkeys` 注入 MainActivity 已确认，生成物 versionCode 22 / versionName 0.0.55）；
arm64-v8a release 构建成功：`com.stably.orca.mobile` `0.0.55 (oyhx.3)` / versionCode `22`，
大小 63853430 字节，签名与平板旧包一致（Android Debug 证书 `fac61745…`），
DEX 内含 `terminalhwkeys`、JS bundle 含 `TerminalHwKeys`/`setSubmitInterceptEnabled`。
`adb install -r` 返回 Success，包管理器确认 `0.0.55` / `22`（原配对数据保留）；
启动后进程存活、`AndroidRuntime:E` 与 `ReactNativeJS:E` 均为空。
平板本代处于图案锁屏，方向键/Ctrl+C/字母三组注入探针未执行，解锁后需补跑；
按键编码语义由 Kotlin 单测覆盖。

交付：桌面 `orca-mobile-0.0.55-oyhx.3-code22-20261015-arm64.apk` + `.sha256`；
NAS 安装包目录只保留 `orca-latest.apk` + `orca-latest.apk.sha256` + `orca-latest.txt`，
其他应用安装包未动，两处副本摘要一致。

APK SHA-256：`5dd0b3b7700cacd2bc224eef450f6a8a14902d830d1212fc11884f13cb140a62`。

## 退出条件

台账中所有功能均被官方完全覆盖时，删除对应补丁；没有新增自定义需求就不新增实现。
