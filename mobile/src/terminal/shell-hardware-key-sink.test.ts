import { afterEach, describe, expect, it, vi } from 'vitest'
import { registerShellHardwareKeySink, shellHardwareKeyBytes } from './shell-hardware-key-sink'

describe('shellHardwareKeyBytes', () => {
  it('maps the routed hardware keys to the bytes xterm would send', () => {
    expect(shellHardwareKeyBytes(19)).toBe('\x1b[A')
    expect(shellHardwareKeyBytes(20)).toBe('\x1b[B')
    expect(shellHardwareKeyBytes(21)).toBe('\x1b[D')
    expect(shellHardwareKeyBytes(22)).toBe('\x1b[C')
    expect(shellHardwareKeyBytes(61)).toBe('\t')
  })

  it('leaves keys the page owns to the page', () => {
    expect(shellHardwareKeyBytes(66)).toBeNull()
    expect(shellHardwareKeyBytes(4)).toBeNull()
  })
})

describe('registerShellHardwareKeySink', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('publishes the sink and withdraws only its own', () => {
    const page: { __orcaSendTerminalKey?: (keyCode: number) => void } = {}
    vi.stubGlobal('window', page)
    const first = () => {}
    const dispose = registerShellHardwareKeySink(first)
    expect(page.__orcaSendTerminalKey).toBe(first)

    const second = () => {}
    registerShellHardwareKeySink(second)
    dispose()
    // Why: a remount registers before the old effect cleans up; removing by identity keeps the
    // live sink instead of leaving the page without one.
    expect(page.__orcaSendTerminalKey).toBe(second)
  })

  it('is inert without a page', () => {
    const dispose = registerShellHardwareKeySink(() => {})
    expect(() => dispose()).not.toThrow()
  })
})
