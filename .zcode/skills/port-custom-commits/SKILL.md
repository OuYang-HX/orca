---
name: port-custom-commits
description: 把 orca 个人仓（OuYang-HX）的自定义提交移植到官方最新代码的完整流程 — 备份、rebase、官方优先冲突策略、棘轮重录、验证与交付
---

# 移植自定义提交到官方最新代码

维护 `feat/mobile-tablet-hardware-keyboard` 分支（以及后续自定义分支）与官方
`upstream/main` 的同步。目标：官方每前进一步，我们的自定义补丁要么被官方实现
覆盖（删除），要么重写到官方新结构之上（重录）。**自定义代码量应随官方更新
单调递减。**

## 背景约定

- 远端：`origin` = git@github.com:OuYang-HX/orca.git（个人仓），`upstream` = git@github.com:stablyai/orca.git（官方）
- 我们自己的提交 subject 一律以 `[oyhx] ` 开头（仓库已配 commit.template）
- 仓库本地 git 身份 `oyhx <oyhx@users.noreply.github.com>`
- `mobile/android/` 是 prebuild 生成物（gitignore），原生逻辑的唯一事实来源是
  `mobile/plugins/with-terminal-hwkeys.js` + `mobile/modules/expo-terminal-hwkeys/`

## 自定义提交台账（每次同步前核对，被官方覆盖即删；最近核对 2026-09-25 @ upstream bf40d35b0b）

| 提交内容 | 对应提交 | 官方是否覆盖 | 处置 |
| --- | --- | --- | --- |
| Android 硬件键盘输入（expo-terminal-hwkeys 模块：方向键/ESC/Tab/PgUp/PgDn/Home/End/Ctrl+字母/Ctrl+标点/Alt+字母 → 终端字节；MainActivity dispatchKeyEvent 拦截；with-terminal-hwkeys prebuild 插件） | ff4be07283 + 0798ff6e89 | ❌ 无任何 dispatchKeyEvent/onKeyPreIme 层实现 | 保留 |
| 提交类按键拦截（Enter/NumpadEnter/DPAD_CENTER 未聚焦时编码 \r 走 submit 路径；`submitInterceptEnabled` 挂路由 useFocusEffect；焦点判定用 MainActivity `currentFocus is EditText` 实时真值） | 1ee3866fbb + 0b10802c38 + b5fa20829f | ❌ | 保留 |
| 硬件键盘连接探测 + 切换工作区/标签自动聚焦（isHardwareKeyboardConnected；切换 effect 门控 keyboardHeight>0 \|\| 硬键盘；previousHandle 赋值在成功分支内保证异步标签条重试） | a266de6ff1 + c3b2a558d4 | ❌ | 保留 |
| xterm 6.1.0-beta.304 + esbuild 0.28.2（修 requestMode `(void 0\|\|(i={}))` 未声明全局崩溃 + esbuild 0.25.4 minify 降级 bug；官方仍钉 beta.303/0.25.4） | 3e29859c26 | ❌ 截至 2026-09-25 官方 package.json 未动 | 保留 |
| 关闭 xterm colorSchemeQuery（kitty/Contour 996n 查询与 DECSET 2031 推送 → 远程链路应答竞态回显字面 `997;1n`；官方 terminal-init.ts 无此选项） | d99e44b615 | ❌ | 保留 |
| 终端字体门（document-shell 等 @font-face 解码完 Symbols Nerd Font Mono 才放行首帧，3s 上限） | 6077c275b2 | ❌ | 保留 |
| 棘轮 pin 与 lockfile 重录（route-parity/payload-hash/ratchet 记录随 rebase 更新） | 742cb943a9 | —（随每次 rebase 机械重录） | 机械重录 |
| port-custom-commits 技能文档本身 | 03187f73b4 | — | 保留 |

判断"官方是否覆盖"的方法：`git grep -l "dispatchKeyEvent\|onKeyPreIme\|KEYCODE_DPAD" upstream/main -- mobile/`，
并读官方 mobile 提交的 commit message（`git log --oneline caa465d1da..upstream/main -- mobile/`）。

## 流程

1. **备份**：`git branch backup/<branch>-<YYYYMMDD> && git push origin backup/<branch>-<YYYYMMDD>`
2. **取官方**：`git fetch upstream main`（注意：upstream 的 fetch refspec 必须是
   `+refs/heads/*:refs/remotes/upstream/*`，remote rename 被中断过会残留旧的 origin/* refspec）
3. **Rebase**：`git rebase upstream/main`
4. **冲突策略（官方优先）**：
   - 官方实现了且**完全覆盖**我们的实现 → 丢弃我们的补丁（`git rm` / 取官方版本），
     并在台账标记"已覆盖"
   - 官方实现**不能完全覆盖** → 以官方新结构为基底，把我们的实现**重写**进去
     （例：2026-09 rebase 时官方把 terminal webview 的注入脚本重构进 `document/`
     子目录并删除了 `payload-hash.test.ts`，我们的字体注入就从 document-shell 的
     旧位置重放到官方新 shell 上，死代码路径直接放弃）
   - 棘轮测试（route-parity / payload-hash）**永远重录，不手工凑数**
5. **重装依赖**：`cd mobile && npx pnpm install`（官方 lockfile 不含我们的
   `@expo/config-plugins`，install 会补上；本机 corepack 缓存损坏，用 npx 调 pnpm）
6. **棘轮重录**：跑 `mobile-session-route-parity.test.ts`，按失败信息改长度；
   哈希被断言截断拿不全时，复制测试为 `zz-print.test.ts`，把 `hash()` 换成打印版、
   `expect(` 换成空操作 `expectSoft(`，一次跑出全部真值再回填。给被重录的 pin
   加 `[oyhx] refresh:` 注释说明我们的增量
7. **验证**：`npx tsc --noEmit` 零错误；`npx vitest run src/` 全绿；
   `mobile/android` 下 `JAVA_HOME="$HOME/android-tools/jdk-17.0.13+11/Contents/Home"
   ANDROID_HOME="$HOME/android-tools/sdk" ./gradlew :expo-terminal-hwkeys:testReleaseUnitTest`
   （按键编码的 JVM 单测）与 `assembleRelease`
8. **真机回归**：无线 adb（串号 `adb-03089470099C3540-6QA2Jp._adb-tls-connect._tcp.`）：
   `input keyevent --source 769 19`（↑ 单发）、`input keycombination 113 31`（Ctrl+C，
   **CTRL_LEFT=113**，59 是 SHIFT_LEFT）、`input keyevent --source 769 31`（普通字母不拦截）
9. **推送**：rebase 改写历史，用 `git push --force-with-lease origin <branch>`；
   APK 同步到 `~/Desktop` 与 `/Volumes/移动硬盘/安装包/apk/`

## 退出条件

台账中所有条目变为"官方已覆盖"→ 删除对应提交，分支只剩官方代码 +
`[oyhx]` 锚点提交（此时可把分支归档）。除非有新的自定义需求，否则不再新增补丁。
