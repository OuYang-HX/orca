package expo.modules.terminalhwkeys

import android.util.Log
import android.view.KeyEvent
import android.os.Bundle
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class TerminalHwKeysModule : Module() {
  companion object {
    private const val TAG = "TerminalHwKeys"
    @Volatile
    @JvmField
    var interceptEnabled: Boolean = false

    @Volatile
    private var instance: TerminalHwKeysModule? = null

    @JvmStatic
    fun maybeDispatchKeyEvent(event: KeyEvent): Boolean {
      if (!interceptEnabled) {
        return false
      }
      val module = instance ?: return false
      return module.dispatchKeyEvent(event)
    }

    // Why: consumption and encoding must agree exactly, so a claimed key is
    // never swallowed without bytes reaching the shell.
    @JvmStatic
    fun isMappedKeyEvent(event: KeyEvent): Boolean = bytesForKey(event) != null

    @JvmStatic
    fun bytesForKey(event: KeyEvent): String? {
      val ctrl = event.isCtrlPressed
      val alt = event.isAltPressed
      val shift = event.isShiftPressed
      fun arrow(suffix: Char): String = when {
        ctrl && shift -> "\u001b[1;6$suffix"
        ctrl -> "\u001b[1;5$suffix"
        alt -> "\u001b\u001b$suffix"
        shift -> "\u001b[1;2$suffix"
        else -> "\u001b[$suffix"
      }
      val keyCode = event.keyCode
      // Why: plain letters must keep composing text in the live input field;
      // only modifier combinations leave the field for the shell.
      if (keyCode in KeyEvent.KEYCODE_A..KeyEvent.KEYCODE_Z) {
        if (!ctrl && !alt) {
          return null
        }
        val body = if (ctrl) {
          (keyCode - KeyEvent.KEYCODE_A + 1).toChar().toString()
        } else {
          ('a' + keyCode - KeyEvent.KEYCODE_A).toString()
        }
        return if (alt) "\u001b$body" else body
      }
      if (ctrl) {
        val control = when (keyCode) {
          KeyEvent.KEYCODE_LEFT_BRACKET -> '\u001b'
          KeyEvent.KEYCODE_BACKSLASH -> '\u001c'
          KeyEvent.KEYCODE_RIGHT_BRACKET -> '\u001d'
          KeyEvent.KEYCODE_6 -> '\u001e'
          KeyEvent.KEYCODE_MINUS -> '\u001f'
          KeyEvent.KEYCODE_SPACE, KeyEvent.KEYCODE_2 -> '\u0000'
          else -> null
        }
        if (control != null) {
          return control.toString()
        }
      }
      return when (keyCode) {
        KeyEvent.KEYCODE_DPAD_UP -> arrow('A')
        KeyEvent.KEYCODE_DPAD_DOWN -> arrow('B')
        KeyEvent.KEYCODE_DPAD_RIGHT -> arrow('C')
        KeyEvent.KEYCODE_DPAD_LEFT -> arrow('D')
        KeyEvent.KEYCODE_ESCAPE -> if (ctrl || alt || shift) null else "\u001b"
        KeyEvent.KEYCODE_TAB -> when {
          shift && !ctrl -> "\u001b[Z"
          ctrl || alt -> null
          else -> "\t"
        }
        KeyEvent.KEYCODE_PAGE_UP -> if (ctrl || alt || shift) null else "\u001b[5~"
        KeyEvent.KEYCODE_PAGE_DOWN -> if (ctrl || alt || shift) null else "\u001b[6~"
        KeyEvent.KEYCODE_MOVE_HOME -> if (ctrl || alt || shift) null else "\u001b[H"
        KeyEvent.KEYCODE_MOVE_END -> if (ctrl || alt || shift) null else "\u001b[F"
        else -> null
      }
    }
  }

  override fun definition() = ModuleDefinition {
    Name("TerminalHwKeys")
    Events("onTerminalHardwareKey")

    OnCreate { instance = this@TerminalHwKeysModule }
    OnDestroy { if (instance === this@TerminalHwKeysModule) instance = null }

    Function("setEnabled") { enabled: Boolean ->
      interceptEnabled = enabled
    }
  }

  fun dispatchKeyEvent(event: KeyEvent): Boolean {
    // Why: Android dispatches ACTION_DOWN then ACTION_UP for one physical
    // press — forwarding both duplicates every keystroke. Auto-repeat arrives
    // as more ACTION_DOWNs and must keep reaching the shell.
    if (event.action != KeyEvent.ACTION_DOWN) {
      Log.d(TAG, "swallowed non-DOWN action=${event.action} keyCode=${event.keyCode}")
      return false
    }
    val bytes = bytesForKey(event)
    Log.d(TAG, "dispatch keyCode=${event.keyCode} ctrl=${event.isCtrlPressed} alt=${event.isAltPressed} bytes=${bytes != null}")
    if (bytes == null) {
      return false
    }
    val payload = Bundle()
    payload.putString("bytes", bytes)
    sendEvent("onTerminalHardwareKey", payload)
    return true
  }
}
