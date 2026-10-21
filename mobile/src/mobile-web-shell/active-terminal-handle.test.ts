import { describe, expect, it } from 'vitest'
import { activeSessionTab } from './active-terminal-handle'

describe('activeSessionTab', () => {
  it('takes the terminal of the active tab', () => {
    const snapshot = {
      tabs: [
        { type: 'terminal', isActive: false, terminal: 'term-a' },
        { type: 'terminal', isActive: true, terminal: 'term-b' },
        { type: 'markdown', isActive: false }
      ]
    }
    expect(activeSessionTab(snapshot)).toEqual({ terminal: 'term-b', isTerminal: true })
  })

  it('reports a non-terminal active tab so the page keeps its keys', () => {
    expect(activeSessionTab({ tabs: [{ type: 'agent-session', isActive: true }] })).toEqual({
      terminal: null,
      isTerminal: false
    })
    expect(
      activeSessionTab({ tabs: [{ type: 'terminal', isActive: true, terminal: null }] })
    ).toEqual({ terminal: null, isTerminal: true })
  })

  it('survives a host shape it does not recognise', () => {
    expect(activeSessionTab(null)).toEqual({ terminal: null, isTerminal: false })
    expect(activeSessionTab('nope')).toEqual({ terminal: null, isTerminal: false })
    expect(activeSessionTab({})).toEqual({ terminal: null, isTerminal: false })
    expect(activeSessionTab({ tabs: 'nope' })).toEqual({ terminal: null, isTerminal: false })
    expect(activeSessionTab({ tabs: [null, 3, 'x'] })).toEqual({
      terminal: null,
      isTerminal: false
    })
  })
})
