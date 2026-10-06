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

最近核对：2026-10-07，官方基线 `7e52bed4e0`，较旧基线 `b482b4d3b4` 新增 842 个提交。
旧分支备份：`backup/mobile-tablet-hardware-keyboard-20261007`（本地与 origin）。

| 功能 | 当前增量 | 官方覆盖情况与处置 |
| --- | --- | --- |
| Android 硬件方向键、ESC、Tab、翻页、Home/End、Ctrl/Alt 组合键 | 原生模块、MainActivity prebuild 插件、JS 事件接入 | 官方没有 dispatchKeyEvent/onKeyPreIme 拦截，保留 |
| 未聚焦 Enter/NumpadEnter/DPAD_CENTER | 原生实时 EditText 焦点判定、路由焦点门控、JS submit 接入 | 官方未覆盖，保留，防止 Android 焦点搜索误点离开会话 |
| 硬键盘探测与切换标签/工作区后聚焦 | 原生设备探测、成功门控后记录 handle、官方聚焦调度器 | 官方未覆盖，保留；连接与标签条异步稳定前允许重试 |
| 防止自然失焦打断硬键盘输入 | 官方聚焦 hook 的 Android blur 接入、主动关闭时短暂抑制 | 官方未覆盖，保留；iOS 不自动重开键盘 |
| xterm beta.304 / addon 升级与 esbuild 0.28.2 钉版 | 已移除自定义版本差异 | 官方已采用 esbuild 0.28.2，并在 `8186ded0bd` 禁用 syntax minification 修复查询变量丢失，使用官方 beta.303 与 addon 版本 |
| colorSchemeQuery 关闭 | `terminal-init.ts` 的 vtExtensions 选项 | 官方仍会答复颜色查询，保留以避免远程延迟回复回显 |
| Nerd Font 图标与首次绘制等待 | 字体资产、HTML @font-face、native-document-entry 启动等待 | 官方未覆盖字体；改用官方 web-ready 门控，删除独立消息队列；失败或 3 秒超时仍启动 |
| 平台门控 | 官方 `hostOs()` 接口 | 沿用官方封口，避免自建平台判断 |
| route-parity 等源码指纹测试 | 已移除旧自定义 pin | 官方已删除这类测试，不恢复已删除文件，也不保留旧重录提交 |
| 依赖锁文件 | 仅增加插件的直接依赖索引 | 原生插件仍需要 `@expo/config-plugins`，其他依赖保持官方版本 |
| Android 定制包版本与更新来源 | app.json 的版本/构建标签/仓库配置、官方更新来源工厂与缓存的可选参数 | main 的版本可能落后于发布标签；沿用官方检查器，定制包只检查个人仓，缓存按仓库隔离 |

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
   每次定制交付递增。保留 app.json extra 中的 `androidUpdateRepository: OuYang-HX/orca`，
   递增 `androidBuildLabel`（如 `oyhx.1`）；它只用于显示，比较仍使用数字版本。
   官方包与定制包的检查时间、最新版本和忽略状态按仓库隔离，不复用旧官方缓存。
   在 mobile 用 `expo prebuild --platform android --no-install` 生成工程。
   使用本机 JDK 17 与 SDK，执行
   `./gradlew :expo-terminal-hwkeys:testReleaseUnitTest :app:assembleRelease`。
   仅交付 arm64 平板时可带 `-PreactNativeArchitectures=arm64-v8a`。
9. 核对目标设备型号、APK 包名/版本/签名/摘要，用指定串号 `adb -s ... install -r` 更新，
   不卸载应用或删除配对数据。构建产物复制到桌面；移动硬盘已挂载时也复制一份。
10. 真机冒烟：先记 PID，再注入方向键、Ctrl+C 与普通字母，确认 PID 未变且无本次崩溃。
    方向键用 `input keyevent --source 769 19`；Ctrl+C 用 `input keycombination 113 31`。
    只向空闲测试终端注入组合键，避免打断用户正在运行的任务；实际终端语义需单独回归。
11. 完成后使用保存的远程旧 SHA 进行 `git push --force-with-lease`，
    防止覆盖迁移期间别人推送的修改；保存具体验证结果与项目交接并同步共享记忆。

## 最近验证与交付

2026-10-07：根目录 `pnpm tc`、mobile `tsc --noEmit`、测试类型检查均通过；
测试类型检查包含 928 个文件，沿用官方 123 个历史例外。
最终 mobile 全量测试 10072 项通过、6 项跳过；终端专项 650 项通过；
Kotlin 按键编码单测 13 项通过；针对官方基线的新增代码质量检查全部通过。

同日修复版本与更新渠道：官方 Android `0.0.52` 发布标签仅比共同基线多一个版本递增提交，
而本次 main 有其后的 827 个提交，app.json 却仍是 `0.0.51` / `18`。
现对齐 `0.0.52`，设置 `androidBuildLabel: oyhx.1` 与个人仓更新来源，
复用官方工厂/检查器并按仓库隔离缓存；相关回归 48 项、mobile 类型及测试类型检查通过，
新增代码质量检查通过。

arm64 release 构建成功：`com.stably.orca.mobile`，版本 `0.0.52` / versionCode `20`，
大小 63575558 字节；签名与平板旧包一致，`adb install -r` 成功；
安装后启动存活、主机连接与原有数据保留、无本次 AndroidRuntime/ReactNativeJS 错误。
真机设置页显示 `Version 0.0.52 (oyhx.1)`，手动检查显示 `Up to date`，
首页没有官方升级提示。
本次未向用户正在运行的终端发送 Ctrl+C，按键语义由 Kotlin 单测和 JS 回归覆盖。
实际硬件按键手感、终端内完整交互仍需在空闲会话里确认。

APK SHA-256：`bec806d6af3a1c5b53457d69305dd4d950f119197cec9f62297f5896f1941c09`。

## 退出条件

台账中所有功能均被官方完全覆盖时，删除对应补丁；没有新增自定义需求就不新增实现。
