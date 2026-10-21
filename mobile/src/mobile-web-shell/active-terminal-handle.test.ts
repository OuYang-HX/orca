import { describe, expect, it } from 'vitest'
import { activeTerminalHandle } from './active-terminal-handle'

describe('activeTerminalHandle', () => {
  it('takes the terminal of the active tab', () => {
    const snapshot = {
      tabs: [
        { isActive: false, terminal: 'term-a' },
        { isActive: true, terminal: 'term-b' },
        { isActive: false, terminal: 'term-c' }
      ]
    }
    expect(activeTerminalHandle(snapshot)).toBe('term-b')
  })

  it('has nothing to send to without an active terminal', () => {
    expect(activeTerminalHandle({ tabs: [{ isActive: true, terminal: null }] })).toBeNull()
    expect(activeTerminalHandle({ tabs: [{ isActive: true }] })).toBeNull()
    expect(activeTerminalHandle({ tabs: [] })).toBeNull()
  })

  it('survives a host shape it does not recognise', () => {
    expect(activeTerminalHandle(null)).toBeNull()
    expect(activeTerminalHandle('nope')).toBeNull()
    expect(activeTerminalHandle({})).toBeNull()
    expect(activeTerminalHandle({ tabs: 'nope' })).toBeNull()
    expect(activeTerminalHandle({ tabs: [null, 3, 'x'] })).toBeNull()
  })
})
