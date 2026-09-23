package expo.modules.terminalhwkeys

import android.view.KeyEvent
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class TerminalHwKeysModuleTest {
  private fun bytes(
    keyCode: Int,
    ctrl: Boolean = false,
    alt: Boolean = false,
    shift: Boolean = false
  ): String? = TerminalHwKeysModule.bytesFor(keyCode, ctrl, alt, shift)

  @Test
  fun `ctrl letters encode as C0 control bytes`() {
    assertEquals("\u0003", bytes(KeyEvent.KEYCODE_C, ctrl = true))
    assertEquals("\u0004", bytes(KeyEvent.KEYCODE_D, ctrl = true))
    assertEquals("\u000c", bytes(KeyEvent.KEYCODE_L, ctrl = true))
    assertEquals("\u0001", bytes(KeyEvent.KEYCODE_A, ctrl = true))
    assertEquals("\u001a", bytes(KeyEvent.KEYCODE_Z, ctrl = true))
    assertEquals("\u0015", bytes(KeyEvent.KEYCODE_U, ctrl = true))
    // Shift is ignored for Ctrl+letter.
    assertEquals("\u0003", bytes(KeyEvent.KEYCODE_C, ctrl = true, shift = true))
  }

  @Test
  fun `alt letters encode as esc prefix plus lowercase letter`() {
    assertEquals("\u001bx", bytes(KeyEvent.KEYCODE_X, alt = true))
    assertEquals("\u001bc", bytes(KeyEvent.KEYCODE_C, alt = true))
  }

  @Test
  fun `ctrl plus alt letters encode as esc prefix plus control byte`() {
    assertEquals("\u001b\u0003", bytes(KeyEvent.KEYCODE_C, ctrl = true, alt = true))
  }

  @Test
  fun `plain and shift-only letters are never intercepted`() {
    assertEquals(null, bytes(KeyEvent.KEYCODE_C))
    assertEquals(null, bytes(KeyEvent.KEYCODE_A, shift = true))
    assertEquals(null, bytes(KeyEvent.KEYCODE_Z))
  }

  @Test
  fun `ctrl punctuation covers the remaining C0 controls`() {
    assertEquals("\u001b", bytes(KeyEvent.KEYCODE_LEFT_BRACKET, ctrl = true))
    assertEquals("\u001c", bytes(KeyEvent.KEYCODE_BACKSLASH, ctrl = true))
    assertEquals("\u001d", bytes(KeyEvent.KEYCODE_RIGHT_BRACKET, ctrl = true))
    assertEquals("\u001e", bytes(KeyEvent.KEYCODE_6, ctrl = true))
    assertEquals("\u001f", bytes(KeyEvent.KEYCODE_MINUS, ctrl = true))
    assertEquals("\u0000", bytes(KeyEvent.KEYCODE_SPACE, ctrl = true))
    assertEquals("\u0000", bytes(KeyEvent.KEYCODE_2, ctrl = true))
  }

  @Test
  fun `navigation keys encode with modifier variants`() {
    assertEquals("\u001b[A", bytes(KeyEvent.KEYCODE_DPAD_UP))
    assertEquals("\u001b[1;5A", bytes(KeyEvent.KEYCODE_DPAD_UP, ctrl = true))
    assertEquals("\u001b[1;2B", bytes(KeyEvent.KEYCODE_DPAD_DOWN, shift = true))
    assertEquals("\u001b[1;6D", bytes(KeyEvent.KEYCODE_DPAD_LEFT, ctrl = true, shift = true))
    assertEquals("\u001b[1;3C", bytes(KeyEvent.KEYCODE_DPAD_RIGHT, alt = true))
  }

  @Test
  fun `escape tab and page keys encode`() {
    assertEquals("\u001b", bytes(KeyEvent.KEYCODE_ESCAPE))
    assertEquals("\t", bytes(KeyEvent.KEYCODE_TAB))
    assertEquals("\u001b[Z", bytes(KeyEvent.KEYCODE_TAB, shift = true))
    assertEquals(null, bytes(KeyEvent.KEYCODE_TAB, ctrl = true))
    assertEquals("\u001b[5~", bytes(KeyEvent.KEYCODE_PAGE_UP))
    assertEquals("\u001b[6~", bytes(KeyEvent.KEYCODE_PAGE_DOWN))
    assertEquals("\u001b[H", bytes(KeyEvent.KEYCODE_MOVE_HOME))
    assertEquals("\u001b[F", bytes(KeyEvent.KEYCODE_MOVE_END))
    // Modified ESC/page/home/end have no binding and must fall through.
    assertEquals(null, bytes(KeyEvent.KEYCODE_ESCAPE, ctrl = true))
    assertEquals(null, bytes(KeyEvent.KEYCODE_PAGE_UP, alt = true))
  }

  @Test
  fun `unmapped keys stay unmapped`() {
    assertEquals(null, bytes(KeyEvent.KEYCODE_SPACE))
    assertEquals(null, bytes(KeyEvent.KEYCODE_9))
  }

  @Test
  fun `submit keys encode carriage return unless modified`() {
    assertEquals("\r", bytes(KeyEvent.KEYCODE_ENTER))
    assertEquals("\r", bytes(KeyEvent.KEYCODE_NUMPAD_ENTER))
    assertEquals("\r", bytes(KeyEvent.KEYCODE_DPAD_CENTER))
    // Modified submit keys have no binding and must fall through.
    assertEquals(null, bytes(KeyEvent.KEYCODE_ENTER, ctrl = true))
    assertEquals(null, bytes(KeyEvent.KEYCODE_NUMPAD_ENTER, alt = true))
    assertEquals(null, bytes(KeyEvent.KEYCODE_DPAD_CENTER, shift = true))
  }

  @Test
  fun `submit keys are gated on live input focus`() {
    // Focused: the field/IME owns the key, so it must fall through.
    assertFalse(
      TerminalHwKeysModule.isMappedKeyEvent(
        KeyEvent.KEYCODE_ENTER,
        ctrl = false,
        alt = false,
        shift = false,
        liveInputFocused = true
      )
    )
    // Unfocused: intercepted so the shell gets the return instead of Android
    // focus-search clicking whatever Pressable gains focus.
    assertTrue(
      TerminalHwKeysModule.isMappedKeyEvent(
        KeyEvent.KEYCODE_ENTER,
        ctrl = false,
        alt = false,
        shift = false,
        liveInputFocused = false
      )
    )
    assertTrue(
      TerminalHwKeysModule.isMappedKeyEvent(
        KeyEvent.KEYCODE_NUMPAD_ENTER,
        ctrl = false,
        alt = false,
        shift = false,
        liveInputFocused = false
      )
    )
    // Modified Enter stays unmapped either way.
    assertFalse(
      TerminalHwKeysModule.isMappedKeyEvent(
        KeyEvent.KEYCODE_ENTER,
        ctrl = true,
        alt = false,
        shift = false,
        liveInputFocused = false
      )
    )
    // Navigation keys keep their mapping regardless of focus.
    assertTrue(
      TerminalHwKeysModule.isMappedKeyEvent(
        KeyEvent.KEYCODE_DPAD_UP,
        ctrl = false,
        alt = false,
        shift = false,
        liveInputFocused = true
      )
    )
  }

  @Test
  fun `isMapped agrees with encoding for every key and modifier combination`() {
    for (keyCode in 0..300) {
      for (ctrl in listOf(false, true)) {
        for (alt in listOf(false, true)) {
          for (shift in listOf(false, true)) {
            val encoded = bytes(keyCode, ctrl, alt, shift)
            val mapped = TerminalHwKeysModule.bytesFor(keyCode, ctrl, alt, shift) != null
            assertEquals("keyCode=$keyCode ctrl=$ctrl alt=$alt shift=$shift", mapped, encoded != null)
          }
        }
      }
    }
  }

  @Test
  fun `letters always map while a modifier is held`() {
    for (keyCode in KeyEvent.KEYCODE_A..KeyEvent.KEYCODE_Z) {
      assertTrue(bytes(keyCode, ctrl = true) != null)
      assertTrue(bytes(keyCode, alt = true) != null)
    }
  }
}
