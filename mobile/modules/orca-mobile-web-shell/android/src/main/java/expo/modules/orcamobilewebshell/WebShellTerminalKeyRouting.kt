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
 * The activity therefore swallows those keys and calls the page sink the session screen registers
 * (`__orcaSendTerminalKey`), which writes the bytes into the terminal's input channel. It is not a
 * synthetic `keydown`: xterm ignores untrusted keyboard events.
 *
 * The sink only exists once the page that knows about it is loaded, so a missing sink leaves the
 * key to the app instead of black-holing it.
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

  private const val SINK_PROBE = "typeof window.__orcaSendTerminalKey === 'function'"

  // Only a found sink is remembered: a page that lacks it may gain it on the next render, and a
  // remembered false would keep routing off until the next document load.
  @Volatile private var pageHasSink: Boolean? = null

  /** True for a session route, the only page that owns a terminal. */
  @JvmStatic
  internal fun isSessionRoute(url: String?): Boolean = url != null && url.contains("/session/")

  @JvmStatic
  internal fun isRoutedKey(keyCode: Int): Boolean = keyCode in ROUTED_KEY_CODES

  /** Calls the page sink; false from the page when the terminal could not take the key. */
  @JvmStatic
  internal fun sendScript(keyCode: Int): String =
    "(function(){var f=window.__orcaSendTerminalKey;" +
      "if(typeof f!=='function')return false;f($keyCode);return true;})()"

  /** A new document cannot have the sink yet, so whatever we learned about the old one is stale. */
  @JvmStatic
  fun resetPageSink() {
    pageHasSink = null
  }

  @JvmStatic
  fun probePageSink(webView: android.webkit.WebView) {
    webView.evaluateJavascript(SINK_PROBE) { answer ->
      pageHasSink = if (answer?.trim() == "true") true else null
    }
  }

  /**
   * Consumes a navigation key for the session page on screen. False leaves the key to the app: no
   * shell, a route without a terminal, a key the page keeps, or a page whose sink is not known yet
   * (the probe runs now and the next press is routed).
   */
  @JvmStatic
  fun dispatch(event: KeyEvent): Boolean {
    val webView = OrcaMobileWebShellView.active?.webViewForKeys() ?: return false
    val url = webView.url
    if (!isSessionRoute(url)) {
      resetPageSink()
      return false
    }
    if (!isRoutedKey(event.keyCode)) return false
    if (pageHasSink != true) {
      // Sink not known yet: ask the page and leave this key alone. A page that never gains one (an
      // older bundle) keeps every key, which is the behaviour before routing existed.
      if (event.action == KeyEvent.ACTION_DOWN) {
        probePageSink(webView)
      }
      return false
    }
    // Down only: forwarding the up event too would double every sequence. The up is still
    // swallowed so traversal never acts on a key the page did not see.
    if (event.action == KeyEvent.ACTION_DOWN) {
      webView.evaluateJavascript(sendScript(event.keyCode), null)
    }
    return true
  }
}
