import { createElement, type RefObject } from 'react'
import { act, create, type ReactTestRenderer } from 'react-test-renderer'
import { afterEach, beforeEach, describe, expect, it, type Mock, vi } from 'vitest'

const platform: { os: 'android' | 'ios' } = vi.hoisted(() => ({ os: 'android' }))
vi.mock('../platform/host-os', () => ({
  hostOs: () => platform.os
}))

const focusCallbacks: (() => void | (() => void))[] = vi.hoisted(() => [])
vi.mock('expo-router', () => ({
  useFocusEffect: (effect: () => void | (() => void)) => {
    focusCallbacks.push(effect)
  }
}))

const native: {
  setTerminalHardwareKeysEnabled: Mock<() => void>
  setTerminalNavigationInterceptEnabled: Mock<() => void>
  setTerminalSubmitInterceptEnabled: Mock<() => void>
  isTerminalHardwareKeyboardConnected: Mock<() => boolean>
  listener: ((bytes: string) => void) | null
  addTerminalHardwareKeyListener: Mock<(listener: (bytes: string) => void) => () => void>
} = vi.hoisted(() => ({
  setTerminalHardwareKeysEnabled: vi.fn(),
  setTerminalNavigationInterceptEnabled: vi.fn(),
  setTerminalSubmitInterceptEnabled: vi.fn(),
  isTerminalHardwareKeyboardConnected: vi.fn(() => true),
  listener: null,
  addTerminalHardwareKeyListener: vi.fn((listener: (bytes: string) => void) => {
    native.listener = listener
    return () => {
      native.listener = null
    }
  })
}))
vi.mock('../terminal/terminal-hardware-keys', () => native)
vi.mock('../terminal/terminal-live-input', () => ({
  scheduleTerminalLiveInputFocus: vi.fn((_timer: unknown, run: () => void) => run())
}))

import { useMobileSessionHardwareKeys } from './use-mobile-session-hardware-keys'

type Args = Parameters<typeof useMobileSessionHardwareKeys>[0]

function ref<T>(current: T): RefObject<T> {
  const value: RefObject<T> = { current }
  return value
}

describe('useMobileSessionHardwareKeys', () => {
  let renderer: ReactTestRenderer | null = null

  beforeEach(() => {
    focusCallbacks.length = 0
    platform.os = 'android'
    native.listener = null
    native.setTerminalHardwareKeysEnabled.mockClear()
    native.setTerminalNavigationInterceptEnabled.mockClear()
    native.setTerminalSubmitInterceptEnabled.mockClear()
    native.addTerminalHardwareKeyListener.mockClear()
    native.isTerminalHardwareKeyboardConnected.mockReturnValue(true)
  })

  afterEach(() => {
    act(() => renderer?.unmount())
    renderer = null
  })

  function render(overrides: Partial<Args> = {}): void {
    const args: Args = {
      activeHandle: 't1',
      activeHandleRef: ref<string | null>('t1'),
      activeSessionTabType: 'terminal',
      canSend: true,
      connStateRef: ref('connected' as const),
      keyboardHeight: 0,
      liveInputFocusTimerRef: ref(null),
      liveInputRef: ref(null),
      liveInputSubmit: vi.fn(),
      activeSessionTabTypeRef: ref('terminal' as const),
      sendLiveTerminalInputRef: ref(vi.fn()),
      ...overrides
    }
    act(() => {
      renderer = create(
        createElement(function Harness() {
          useMobileSessionHardwareKeys(args)
          return null
        })
      )
    })
  }

  it('opens the hardware-key gates while the terminal route holds focus', () => {
    render()
    act(() => {
      for (const effect of focusCallbacks) {
        effect()
      }
    })
    expect(native.setTerminalHardwareKeysEnabled).toHaveBeenCalledWith(true)
    expect(native.setTerminalNavigationInterceptEnabled).toHaveBeenCalledWith(true)
    expect(native.setTerminalSubmitInterceptEnabled).toHaveBeenCalledWith(true)
  })

  it('keeps a non-terminal tab for the page', () => {
    render({ activeSessionTabType: 'markdown' })
    act(() => {
      for (const effect of focusCallbacks) {
        effect()
      }
    })
    expect(native.setTerminalNavigationInterceptEnabled).toHaveBeenCalledWith(false)
  })

  it('leaves every gate untouched off Android', () => {
    platform.os = 'ios'
    render()
    act(() => {
      for (const effect of focusCallbacks) {
        effect()
      }
    })
    expect(native.setTerminalHardwareKeysEnabled).not.toHaveBeenCalled()
    expect(native.setTerminalSubmitInterceptEnabled).not.toHaveBeenCalled()
  })

  it('routes an intercepted Enter through submit and everything else to the terminal', () => {
    const submit = vi.fn()
    const send = vi.fn()
    render({
      liveInputSubmit: submit,
      sendLiveTerminalInputRef: ref(send)
    })
    act(() => native.listener?.('\r'))
    act(() => native.listener?.('\u001b[A'))
    expect(submit).toHaveBeenCalledTimes(1)
    expect(send).toHaveBeenCalledWith('t1', '\u001b[A')
  })

  it('drops keys while the session is not connected', () => {
    const send = vi.fn()
    render({
      connStateRef: ref('connecting' as const),
      sendLiveTerminalInputRef: ref(send)
    })
    act(() => native.listener?.('\u001b[A'))
    expect(send).not.toHaveBeenCalled()
  })
})
