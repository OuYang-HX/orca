import { useCallback, useEffect, useRef } from 'react'
import { sendTerminalLiveAccessoryRawBytes } from '../terminal/terminal-live-accessory-raw-send'
import { shellHardwareKeyBytes } from '../terminal/shell-hardware-key-sink'
import { useHostClient } from '../transport/host-client-hooks'
import { activeTerminalHandle } from './active-terminal-handle'
import { sessionHandleFromPathname } from './session-handle-from-route'

/**
 * Sends a hardware navigation key the activity took from the WebView to the session's terminal.
 *
 * Why: the session screen is a web document, so the terminal never sees DPAD keys — the WebView
 * spends them on its focus traversal first. The RPC channel belongs to React Native, so the key
 * arrives here and the bytes go out the same path the dock's arrow buttons use.
 *
 * The route names a worktree, not a terminal, so the active terminal handle comes from the host's
 * tab snapshot: the page owns which tab is showing, and this side only reads it. Without a snapshot
 * the key is dropped rather than sent to a guess.
 */
export function useShellHardwareKeySend(
  hostId: string | undefined,
  pathname: string
): (keyCode: number) => void {
  const { client, state } = useHostClient(hostId)
  const worktree = sessionHandleFromPathname(pathname)
  const activeTerminalRef = useRef<string | null>(null)

  useEffect(() => {
    activeTerminalRef.current = null
    if (!client || worktree === null) {
      return
    }
    const unsubscribe = client.subscribe('session.tabs.subscribe', { worktree }, (payload) => {
      activeTerminalRef.current = activeTerminalHandle(payload)
    })
    return unsubscribe
  }, [client, worktree])

  return useCallback(
    (keyCode: number) => {
      const bytes = shellHardwareKeyBytes(keyCode)
      const terminal = activeTerminalRef.current
      if (bytes === null || !client || terminal === null || state !== 'connected') {
        return
      }
      void sendTerminalLiveAccessoryRawBytes({
        client,
        targetHandle: terminal,
        activeHandle: terminal,
        activeSessionTabType: 'terminal',
        connState: state,
        bytes,
        deviceToken: null
      })
    },
    [client, state]
  )
}
