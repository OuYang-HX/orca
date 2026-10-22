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

  it('maps a Ctrl chord onto its control byte', () => {
    expect(shellHardwareKeyBytes(29, true)).toBe('\x01') // Ctrl+A
    expect(shellHardwareKeyBytes(49, true)).toBe('\x15') // Ctrl+U
    expect(shellHardwareKeyBytes(54, true)).toBe('\x1a') // Ctrl+Z
    expect(shellHardwareKeyBytes(62, true)).toBe('\x00') // Ctrl+Space
    expect(shellHardwareKeyBytes(71, true)).toBe('\x1b') // Ctrl+[
    expect(shellHardwareKeyBytes(73, true)).toBe('\x1c') // Ctrl+\\
  })

  it('keeps a Ctrl chord the terminal has no byte for on the page', () => {
    expect(shellHardwareKeyBytes(66, true)).toBeNull()
  })

  it('leaves keys the page owns to the page', () => {
    expect(shellHardwareKeyBytes(66)).toBeNull()
    expect(shellHardwareKeyBytes(4)).toBeNull()
  })
})
