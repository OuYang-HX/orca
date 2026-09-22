import { useCallback, useLayoutEffect, useRef, type RefObject } from 'react'
import {
  beginTerminalLiveInputSuppressedBlur,
  clearTerminalLiveInputFocusTimer,
  focusTerminalLiveInputTarget,
  isTerminalLiveInputBlurSuppressed,
  scheduleTerminalLiveInputFocus,
  type TerminalLiveInputFocusTarget,
  type TerminalLiveInputFocusTimerRef
} from './terminal-live-input'

type TerminalLiveInputFocusContext = {
  readonly canSend: boolean
  readonly keyboardHeight: number
  readonly liveInputEnabled: boolean
  readonly reopenFocusedInputWhenKeyboardHidden: boolean
  // Why: Android hardware keys dispatch to the focused Android view — native
  // EditText consumes arrows/escape before onKeyPress can see them, so direct
  // input must focus the WebView's xterm instead of the RN capture field.
  readonly androidWebviewFocus?: boolean
  readonly focusTerminalWebview?: () => void
}

type UseTerminalLiveInputFocusOptions<T extends TerminalLiveInputFocusTarget> =
  TerminalLiveInputFocusContext & {
    readonly activeHandleRef: RefObject<string | null>
    readonly inputRef: RefObject<T | null>
    readonly lifecycleIdentity: object | null
    readonly lifecycleKey: string
    readonly timerRef: TerminalLiveInputFocusTimerRef
  }

type TerminalLiveInputFocusHandlers = {
  readonly focusLiveInput: () => void
  readonly handleCaptureBlur: () => void
  readonly handleTerminalTap: (handle: string) => void
  readonly resetLiveInputFocus: () => void
}

export function useTerminalLiveInputFocus<T extends TerminalLiveInputFocusTarget>({
  activeHandleRef,
  canSend,
  inputRef,
  keyboardHeight,
  lifecycleIdentity,
  lifecycleKey,
  reopenFocusedInputWhenKeyboardHidden,
  liveInputEnabled,
  androidWebviewFocus,
  focusTerminalWebview,
  timerRef
}: UseTerminalLiveInputFocusOptions<T>): TerminalLiveInputFocusHandlers {
  const contextRef = useRef<TerminalLiveInputFocusContext>({
    canSend,
    keyboardHeight,
    liveInputEnabled,
    reopenFocusedInputWhenKeyboardHidden,
    androidWebviewFocus,
    focusTerminalWebview
  })
  useLayoutEffect(() => {
    contextRef.current = {
      canSend,
      keyboardHeight,
      liveInputEnabled,
      reopenFocusedInputWhenKeyboardHidden,
      androidWebviewFocus,
      focusTerminalWebview
    }
  }, [
    canSend,
    keyboardHeight,
    liveInputEnabled,
    reopenFocusedInputWhenKeyboardHidden,
    androidWebviewFocus,
    focusTerminalWebview
  ])

  const resetLiveInputFocus = useCallback(() => {
    beginTerminalLiveInputSuppressedBlur()
    clearTerminalLiveInputFocusTimer(timerRef)
    inputRef.current?.blur()
  }, [inputRef, timerRef])

  // Why: hardware-keyboard sessions lose the capture focus on any stray tap
  // elsewhere; refocusing on natural blurs keeps direct typing alive. Blurs
  // from app-driven dismissals are suppressed at their call sites.
  const handleCaptureBlur = useCallback(() => {
    if (isTerminalLiveInputBlurSuppressed()) {
      return
    }
    const context = contextRef.current
    if (!context.canSend || !context.liveInputEnabled) {
      return
    }
    scheduleTerminalLiveInputFocus(timerRef, () => {
      if (isTerminalLiveInputBlurSuppressed()) {
        return
      }
      const current = contextRef.current
      if (!current.canSend || !current.liveInputEnabled || activeHandleRef.current === null) {
        return
      }
      if (current.androidWebviewFocus && current.focusTerminalWebview) {
        current.focusTerminalWebview()
        return
      }
      inputRef.current?.focus()
    })
  }, [activeHandleRef, inputRef, timerRef])

  // Retained Expo routes must not carry focus work across navigation or reconnect scopes.
  useLayoutEffect(() => resetLiveInputFocus, [lifecycleIdentity, lifecycleKey, resetLiveInputFocus])

  const focusLiveInput = useCallback(() => {
    const context = contextRef.current
    if (!context.canSend || !context.liveInputEnabled) {
      return
    }
    if (context.androidWebviewFocus && context.focusTerminalWebview) {
      context.focusTerminalWebview()
      return
    }
    focusTerminalLiveInputTarget(inputRef.current, {
      keyboardHeight: context.keyboardHeight,
      reopenFocusedInputWhenKeyboardHidden: context.reopenFocusedInputWhenKeyboardHidden,
      refocus: () => scheduleTerminalLiveInputFocus(timerRef, focusLiveInput)
    })
  }, [inputRef, timerRef])

  const handleTerminalTap = useCallback(
    (handle: string) => {
      const context = contextRef.current
      if (handle !== activeHandleRef.current || !context.canSend || !context.liveInputEnabled) {
        return
      }
      // Why: Android hardware keys dispatch to the focused view — native
      // EditText consumes arrows/escape before onKeyPress sees them, so
      // surface taps hand input focus to the WebView's xterm instead.
      if (context.androidWebviewFocus && context.focusTerminalWebview) {
        context.focusTerminalWebview()
        return
      }
      // WKWebView still owns first responder during its touchend notification.
      scheduleTerminalLiveInputFocus(timerRef, () => {
        if (activeHandleRef.current === handle) {
          focusLiveInput()
        }
      })
    },
    [activeHandleRef, focusLiveInput, timerRef]
  )

  return { focusLiveInput, handleCaptureBlur, handleTerminalTap, resetLiveInputFocus }
}
