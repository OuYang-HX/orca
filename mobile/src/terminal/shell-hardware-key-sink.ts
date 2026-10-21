import { getTerminalLiveSpecialKeyBytes } from './terminal-live-input'

/**
 * The page half of the Android shell's hardware-key routing.
 *
 * The shell's WebView (a web page, not a native terminal) spends DPAD keys on its own focus
 * traversal before the page sees a `keydown`, so a physical arrow never reaches the terminal; once
 * focus sits on a page control the traversal reads as Tab jumps. The activity therefore swallows
 * those keys and calls the sink registered below, and the sink writes the bytes straight to the
 * terminal's input channel — xterm ignores synthetic key events, so it cannot be the receiver.
 */

/** Android `KeyEvent` codes the shell routes, paired with the xterm key name they stand for. */
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

/** The bytes a routed hardware key stands for, or null for a key the page keeps. */
export function shellHardwareKeyBytes(keyCode: number): string | null {
  const key = SHELL_KEY_NAMES[keyCode]
  return key === undefined ? null : getTerminalLiveSpecialKeyBytes(key)
}

declare global {
  interface Window {
    /** Set while a session screen is mounted; the Android shell calls it for navigation keys. */
    __orcaSendTerminalKey?: (keyCode: number) => void
  }
}

/**
 * Registers the sink the native shell calls. No-op where there is no page (React Native), and the
 * returned disposer only removes the sink it installed.
 */
export function registerShellHardwareKeySink(sink: (keyCode: number) => void): () => void {
  if (typeof window === 'undefined') {
    return () => {}
  }
  window.__orcaSendTerminalKey = sink
  return () => {
    if (window.__orcaSendTerminalKey === sink) {
      delete window.__orcaSendTerminalKey
    }
  }
}
