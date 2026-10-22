import { getTerminalLiveSpecialKeyBytes } from './terminal-live-input'

/**
 * The page half of the Android shell's hardware-key routing.
 *
 * The shell's WebView spends DPAD keys on its own focus traversal before the page sees a keydown,
 * so the activity swallows them and hands them to React Native, which owns the terminal's input
 * channel. This maps the key code it sends onto the bytes the shell expects.
 */
const SHELL_KEY_NAMES: Record<number, string> = {
  19: 'ArrowUp',
  20: 'ArrowDown',
  21: 'ArrowLeft',
  22: 'ArrowRight',
  122: 'Home',
  123: 'End',
  92: 'PageUp',
  93: 'PageDown',
  61: 'Tab'
}

/**
 * Android key codes a Ctrl chord turns into a control byte. The letters run contiguously
 * (`KEYCODE_A` = 29), so only the ends are needed.
 */
const CTRL_LETTER_FIRST = 29
const CTRL_LETTER_LAST = 54
const CTRL_SPECIAL: Record<number, string> = {
  62: '\u0000', // Space
  71: '\u001b', // [
  72: '\u001d', // ]
  73: '\u001c' // backslash
}

/** The bytes a routed hardware key stands for, or null for a key the page keeps. */
export function shellHardwareKeyBytes(keyCode: number, control = false): string | null {
  if (control) {
    if (keyCode >= CTRL_LETTER_FIRST && keyCode <= CTRL_LETTER_LAST) {
      return String.fromCharCode(keyCode - CTRL_LETTER_FIRST + 1)
    }
    return CTRL_SPECIAL[keyCode] ?? null
  }
  const key = SHELL_KEY_NAMES[keyCode]
  return key === undefined ? null : getTerminalLiveSpecialKeyBytes(key)
}
