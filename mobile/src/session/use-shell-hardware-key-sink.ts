import { useEffect, type RefObject } from 'react'
import {
  registerShellHardwareKeySink,
  shellHardwareKeyBytes
} from '../terminal/shell-hardware-key-sink'
import type { TerminalLiveInputSender } from '../terminal/terminal-live-input-sender'
import type { MobileSessionTabType } from './mobile-session-route-types'

/**
 * Publishes the page sink the Android shell calls for hardware navigation keys.
 *
 * The session screen is a WebView page there, and WebView spends DPAD keys on its own focus
 * traversal before the page sees a `keydown`; the activity swallows those keys and calls this sink,
 * whose bytes go straight to the terminal's input channel (xterm ignores synthetic key events).
 */
export function useShellHardwareKeySink(
  activeHandleRef: RefObject<string | null>,
  activeSessionTabTypeRef: RefObject<MobileSessionTabType | null>,
  sendLiveTerminalInputRef: RefObject<TerminalLiveInputSender>
): void {
  // Why: the sink reads the live refs, so its lifetime is the route's, not a render's.
  useEffect(
    () =>
      registerShellHardwareKeySink((keyCode) => {
        const handle = activeHandleRef.current
        const bytes = shellHardwareKeyBytes(keyCode)
        if (!handle || bytes === null || activeSessionTabTypeRef.current !== 'terminal') {
          return
        }
        void sendLiveTerminalInputRef.current(handle, bytes)
      }),
    [activeHandleRef, activeSessionTabTypeRef, sendLiveTerminalInputRef]
  )
}
