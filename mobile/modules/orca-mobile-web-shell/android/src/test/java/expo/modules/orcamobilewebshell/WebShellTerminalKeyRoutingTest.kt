package expo.modules.orcamobilewebshell

import android.view.KeyEvent
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class WebShellTerminalKeyRoutingTest {
  @Test
  fun `only a session route owns a terminal`() {
    assertTrue(
      WebShellTerminalKeyRouting.isSessionRoute(
        "https://x.orca-mobile-web.invalid/h/host-1/session/wt%3A%3A%2Ftmp"
      )
    )
    assertFalse(WebShellTerminalKeyRouting.isSessionRoute("https://x.orca-mobile-web.invalid/"))
    assertFalse(WebShellTerminalKeyRouting.isSessionRoute(null))
  }

  @Test
  fun `a Ctrl chord turns a letter into a control byte`() {
    for (code in
      intArrayOf(
        KeyEvent.KEYCODE_A,
        KeyEvent.KEYCODE_U,
        KeyEvent.KEYCODE_Z,
        KeyEvent.KEYCODE_SPACE,
        KeyEvent.KEYCODE_LEFT_BRACKET,
        KeyEvent.KEYCODE_RIGHT_BRACKET,
        KeyEvent.KEYCODE_BACKSLASH
      )) {
      assertTrue("key $code", WebShellTerminalKeyRouting.isControlKey(code))
    }
  }

  @Test
  fun `a letter without Ctrl stays with the page and its input method`() {
    assertFalse(WebShellTerminalKeyRouting.isRoutedKey(KeyEvent.KEYCODE_U))
  }

  @Test
  fun `routes navigation keys and leaves the rest to the page`() {
    for (code in
      intArrayOf(
        KeyEvent.KEYCODE_DPAD_UP,
        KeyEvent.KEYCODE_DPAD_DOWN,
        KeyEvent.KEYCODE_DPAD_LEFT,
        KeyEvent.KEYCODE_DPAD_RIGHT,
        KeyEvent.KEYCODE_MOVE_HOME,
        KeyEvent.KEYCODE_MOVE_END,
        KeyEvent.KEYCODE_PAGE_UP,
        KeyEvent.KEYCODE_PAGE_DOWN,
        KeyEvent.KEYCODE_TAB
      )) {
      assertTrue("keyCode $code", WebShellTerminalKeyRouting.isRoutedKey(code))
    }
    for (code in
      intArrayOf(
        KeyEvent.KEYCODE_ENTER,
        KeyEvent.KEYCODE_DEL,
        KeyEvent.KEYCODE_BACK,
        KeyEvent.KEYCODE_A
      )) {
      assertFalse("keyCode $code", WebShellTerminalKeyRouting.isRoutedKey(code))
    }
  }
}
