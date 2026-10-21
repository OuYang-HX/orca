import { describe, expect, it } from 'vitest'
import { shellHardwareKeyBytes } from './shell-hardware-key-bytes'

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
