import { createElement, type RefObject } from 'react'
import { act, create, type ReactTestRenderer } from 'react-test-renderer'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type {
  TerminalLiveInputFocusTarget,
  TerminalLiveInputFocusTimerRef
} from './terminal-live-input'
import { useTerminalLiveInputFocus } from './use-terminal-live-input-focus'

const platformRef: { os: 'android' | 'ios' } = vi.hoisted(() => ({ os: 'android' }))
vi.mock('react-native', () => ({
  Platform: {
    get OS(): string {
      return platformRef.os
    }
  }
}))

type HarnessProps = {
  readonly activeHandleRef: RefObject<string | null>
  readonly canSend: boolean
  readonly inputRef: RefObject<TerminalLiveInputFocusTarget | null>
  readonly keyboardHeight?: number
  readonly lifecycleIdentity: object | null
  readonly lifecycleKey: string
  readonly reopenFocusedInputWhenKeyboardHidden: boolean
  readonly timerRef: TerminalLiveInputFocusTimerRef
}

type FocusHandlers = ReturnType<typeof useTerminalLiveInputFocus>

function createFocusTarget(initiallyFocused = false): TerminalLiveInputFocusTarget & {
  readonly blur: ReturnType<typeof vi.fn>
  readonly focus: ReturnType<typeof vi.fn>
} {
  let focused = initiallyFocused
  return {
    blur: vi.fn(() => {
      focused = false
    }),
    focus: vi.fn(() => {
      focused = true
    }),
    isFocused: () => focused
  }
}

function createTimerRef(): TerminalLiveInputFocusTimerRef {
  return { current: null }
}

function createHarness(initialProps: HarnessProps): {
  readonly handlers: () => FocusHandlers
  readonly render: (props: HarnessProps) => void
  readonly unmount: () => void
} {
  let handlers: FocusHandlers | null = null
  let renderer: ReactTestRenderer | null = null

  function Harness(props: HarnessProps): null {
    handlers = useTerminalLiveInputFocus({
      ...props,
      keyboardHeight: props.keyboardHeight ?? 0
    })
    return null
  }

  act(() => {
    renderer = create(createElement(Harness, initialProps))
  })
  if (!handlers || !renderer) {
    throw new Error('terminal live input focus harness did not render')
  }

  return {
    handlers: () => {
      if (!handlers) {
        throw new Error('terminal live input focus harness is not mounted')
      }
      return handlers
    },
    render: (props) => {
      act(() => renderer?.update(createElement(Harness, props)))
    },
    unmount: () => {
      act(() => renderer?.unmount())
      handlers = null
    }
  }
}

function connectedProps(
  inputRef: RefObject<TerminalLiveInputFocusTarget | null>,
  timerRef = createTimerRef(),
  activeHandleRef: RefObject<string | null> = { current: 'terminal-a' }
): HarnessProps {
  return {
    activeHandleRef,
    canSend: true,
    inputRef,
    lifecycleIdentity: null,
    lifecycleKey: 'host-a:worktree-a:connected',
    reopenFocusedInputWhenKeyboardHidden: true,
    timerRef
  }
}

describe('terminal live input focus hook', () => {
  afterEach(() => {
    vi.useRealTimers()
    platformRef.os = 'android'
  })

  it('refocuses the capture field after a natural blur on Android', () => {
    vi.useFakeTimers()
    const input = createFocusTarget()
    const harness = createHarness(connectedProps({ current: input }))

    harness.handlers().handleCaptureBlur()
    vi.runOnlyPendingTimers()

    expect(input.focus).toHaveBeenCalledTimes(1)
    harness.unmount()
  })

  it('never refocuses on blur on iOS so a swiped-away keyboard stays dismissed', () => {
    vi.useFakeTimers()
    platformRef.os = 'ios'
    const input = createFocusTarget()
    const harness = createHarness(connectedProps({ current: input }))

    harness.handlers().handleCaptureBlur()
    vi.runAllTimers()

    expect(input.focus).not.toHaveBeenCalled()
    harness.unmount()
  })
})
