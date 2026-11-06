package expo.modules.orcamobilewebshell

import android.view.KeyEvent

/**
 * Hardware navigation keys the shell owns while a session page is on screen.
 *
 * Why: the session screen is a WebView page, and WebView spends DPAD keys on its own focus
 * traversal before the page sees a `keydown` — the terminal never receives an arrow, and once
 * focus sits on a control the traversal moves it on, which reads as Tab jumps. A focused
 * `textarea` fares no better: the key is consumed with no DOM event and no caret movement.
 *
 * The activity therefore swallows those keys and hands them to the view's `onHardwareKey` event.
 * React Native writes the bytes into the terminal's input channel — the page cannot be told to do
 * it: xterm ignores untrusted keyboard events, and the shipped page is the desktop app's bundle.
 */
object WebShellTerminalKeyRouting {
  /** Android key codes the session page takes: arrows plus the motion keys the terminal maps. */
  private val ROUTED_KEY_CODES =
    setOf(
      KeyEvent.KEYCODE_DPAD_UP,
      KeyEvent.KEYCODE_DPAD_DOWN,
      KeyEvent.KEYCODE_DPAD_LEFT,
      KeyEvent.KEYCODE_DPAD_RIGHT,
      KeyEvent.KEYCODE_MOVE_HOME,
      KeyEvent.KEYCODE_MOVE_END,
      KeyEvent.KEYCODE_PAGE_UP,
      KeyEvent.KEYCODE_PAGE_DOWN,
      KeyEvent.KEYCODE_TAB
    )

  /** Whether the page is showing a terminal tab; false until React Native has said it is. */
  @Volatile private var terminalTabActive: Boolean = false

  @JvmStatic
  fun setTerminalTabActive(active: Boolean) {
    terminalTabActive = active
  }

  /** True for a session route, the only page that owns a terminal. */
  @JvmStatic
  internal fun isSessionRoute(url: String?): Boolean = url != null && url.contains("/session/")

  @JvmStatic
  internal fun isRoutedKey(keyCode: Int): Boolean = keyCode in ROUTED_KEY_CODES

  /**
   * Keys a Ctrl chord turns into a control byte: the letters, Space, the brackets and the
   * backslash. The page keeps everything else, chords included (Ctrl+V is paste there).
   */
  @JvmStatic
  internal fun isControlKey(keyCode: Int): Boolean =
    keyCode in KeyEvent.KEYCODE_A..KeyEvent.KEYCODE_Z ||
      keyCode == KeyEvent.KEYCODE_SPACE ||
      keyCode == KeyEvent.KEYCODE_LEFT_BRACKET ||
      keyCode == KeyEvent.KEYCODE_RIGHT_BRACKET ||
      keyCode == KeyEvent.KEYCODE_BACKSLASH

  /**
   * Consumes a navigation key for the session page on screen. False leaves the key to the app: no
   * shell on screen, a route without a terminal, or a key the page keeps.
   */
  @JvmStatic
  fun dispatch(event: KeyEvent): Boolean {
    val view = OrcaMobileWebShellView.active ?: return false
    if (!isSessionRoute(view.webViewForKeys()?.url)) return false
    // Why: a chat, markdown or file tab has nowhere to put an arrow, so the page keeps its own
    // focus navigation there instead of losing the key to this route's terminal.
    if (!terminalTabActive) return false
    // Why Ctrl chords: WebView has no binding for them, so the page drops Ctrl+U instead of the
    // shell's clear-line, and the terminal never sees the byte. Chords are never IME input, so
    // routing them cannot take typing away from the input method.
    val chord = event.isCtrlPressed && isControlKey(event.keyCode)
    if (!chord && !isRoutedKey(event.keyCode)) return false
    // Down only: forwarding the up event too would double every sequence. The up is still
    // swallowed so traversal never acts on a key the page did not see.
    if (event.action == KeyEvent.ACTION_DOWN) {
      view.emitHardwareKey(event.keyCode, chord)
    }
    return true
  }
}
