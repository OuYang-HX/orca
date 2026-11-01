import { useCallback, useEffect, useRef, type RefObject } from 'react'
import type { TextInput } from 'react-native'
import { useFocusEffect } from 'expo-router'
import { hostOs } from '../platform/host-os'
import {
  addTerminalHardwareKeyListener,
  isTerminalHardwareKeyboardConnected,
  setTerminalHardwareKeysEnabled,
  setTerminalNavigationInterceptEnabled,
  setTerminalSubmitInterceptEnabled
} from '../terminal/terminal-hardware-keys'
import {
  scheduleTerminalLiveInputFocus,
  type TerminalLiveInputFocusTimerRef
} from '../terminal/terminal-live-input'
import type { TerminalLiveInputSender } from '../terminal/terminal-live-input-sender'
import type { ConnectionState } from '../transport/types'
import type { MobileSessionTabType } from './mobile-session-route-types'

type MobileSessionHardwareKeysArgs = {
  readonly activeHandle: string | null
  readonly activeHandleRef: RefObject<string | null>
  readonly activeSessionTabType: MobileSessionTabType | undefined
  readonly canSend: boolean
  readonly connStateRef: RefObject<ConnectionState>
  readonly keyboardHeight: number
  readonly liveInputEnabled: boolean
  readonly liveInputFocusTimerRef: TerminalLiveInputFocusTimerRef
  readonly liveInputRef: RefObject<TextInput | null>
  readonly liveInputSubmit: () => Promise<unknown> | void
  readonly liveInputTerminalHandlesRef: RefObject<Set<string>>
  readonly sendLiveTerminalInputRef: RefObject<TerminalLiveInputSender>
}

/**
 * Hardware-keyboard plumbing for the session screen: which keys the Android activity may take,
 * where they go, and keeping the capture field focused across tab and workspace switches.
 *
 * Why a hook of its own: the gates belong to the route's focus, not to the terminal runtime's
 * render, and keeping them beside it pushed that file past its line budget.
 */
export function useMobileSessionHardwareKeys({
  activeHandle,
  activeHandleRef,
  activeSessionTabType,
  canSend,
  connStateRef,
  keyboardHeight,
  liveInputEnabled,
  liveInputFocusTimerRef,
  liveInputRef,
  liveInputSubmit,
  liveInputTerminalHandlesRef,
  sendLiveTerminalInputRef
}: MobileSessionHardwareKeysArgs): void {
  // Why: a buffered terminal has no focused capture field, so its arrows would fall through to
  // Android focus navigation and hop between on-screen controls like Tab. The native gate still
  // yields to a focused editor.
  const terminalTabActive = activeSessionTabType === 'terminal'

  // Why: Android native EditText consumes arrow/escape hardware keys before onKeyPress sees
  // them; the activity forwards those keys here instead. The session route stays mounted while
  // blurred, so the native flags must follow route focus — a stale `true` swallows keys app-wide.
  useFocusEffect(
    useCallback(() => {
      if (hostOs() !== 'android') {
        return
      }
      setTerminalHardwareKeysEnabled(liveInputEnabled && canSend && activeHandle !== null)
      setTerminalNavigationInterceptEnabled(terminalTabActive && canSend && activeHandle !== null)
      return () => {
        setTerminalHardwareKeysEnabled(false)
        setTerminalNavigationInterceptEnabled(false)
      }
    }, [activeHandle, canSend, liveInputEnabled, terminalTabActive])
  )

  // Why: submit keys must guard from route focus, not from connection readiness — an unfocused
  // Enter during the connect window falls through to Android focus-search, which clicks whatever
  // Pressable gains focus (the session exit button).
  useFocusEffect(
    useCallback(() => {
      if (hostOs() === 'android') {
        setTerminalSubmitInterceptEnabled(true)
      }
      return () => {
        setTerminalSubmitInterceptEnabled(false)
      }
    }, [])
  )

  // Why: the subscription lifetime matches the session route, not reactive values.
  const liveInputSubmitRef = useRef(liveInputSubmit)
  useEffect(() => {
    liveInputSubmitRef.current = liveInputSubmit
  })
  useEffect(
    () =>
      addTerminalHardwareKeyListener((bytes) => {
        const handle = activeHandleRef.current
        if (
          !handle ||
          connStateRef.current !== 'connected' ||
          !liveInputTerminalHandlesRef.current.has(handle)
        ) {
          return
        }
        // Why: intercepted Enter only arrives unfocused (the native gate skips a focused editor);
        // route it through the submit path so any held field text flushes first, exactly like
        // onSubmitEditing for the focused field.
        if (bytes === '\r') {
          void liveInputSubmitRef.current()
          return
        }
        void sendLiveTerminalInputRef.current(handle, bytes)
      }),
    [activeHandleRef, connStateRef, liveInputTerminalHandlesRef, sendLiveTerminalInputRef]
  )

  // Why: hardware-keyboard users expect the capture field to stay focused when they switch
  // terminal tabs or workspaces; the keyboardHeight gate covers the soft keyboard already being
  // up, and a connected typing keyboard covers the hardware case — its IME stays hidden either
  // way. Touch phones without a keyboard never get an unprompted soft keyboard on tab activation.
  const previousFocusHandleRef = useRef<string | null>(null)
  useEffect(() => {
    // Why: the assignment sits inside the branch — the tab strip and connection settle AFTER the
    // switch lands, and marking the handle as seen before the gate passes would swallow the retry
    // when liveInputEnabled flips true.
    if (
      activeHandle === previousFocusHandleRef.current ||
      !(keyboardHeight > 0 || isTerminalHardwareKeyboardConnected()) ||
      !liveInputEnabled ||
      !canSend
    ) {
      return
    }
    previousFocusHandleRef.current = activeHandle
    scheduleTerminalLiveInputFocus(liveInputFocusTimerRef, () => liveInputRef.current?.focus())
  }, [
    activeHandle,
    canSend,
    keyboardHeight,
    liveInputEnabled,
    liveInputFocusTimerRef,
    liveInputRef
  ])
}
