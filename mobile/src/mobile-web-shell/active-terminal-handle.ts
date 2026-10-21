/**
 * The session's active tab, read from a `session.tabs.subscribe` snapshot.
 *
 * Why the shape is read defensively: this is host data delivered inside a stream callback, and a
 * shape change must drop a key rather than throw. Only a `terminal` tab carries a terminal handle,
 * which is what the key goes to; every other tab has nowhere for it to land, so the activity keeps
 * the key for the page instead of swallowing it.
 */
export type ActiveSessionTab = { terminal: string | null; isTerminal: boolean }

const NOT_A_TERMINAL: ActiveSessionTab = { terminal: null, isTerminal: false }

export function activeSessionTab(payload: unknown): ActiveSessionTab {
  if (typeof payload !== 'object' || payload === null || !('tabs' in payload)) {
    return NOT_A_TERMINAL
  }
  const tabs = payload.tabs
  if (!Array.isArray(tabs)) {
    return NOT_A_TERMINAL
  }
  for (const tab of tabs) {
    if (typeof tab !== 'object' || tab === null || !('isActive' in tab) || tab.isActive !== true) {
      continue
    }
    const isTerminal = 'type' in tab && tab.type === 'terminal'
    const terminal =
      isTerminal && 'terminal' in tab && typeof tab.terminal === 'string' && tab.terminal !== ''
        ? tab.terminal
        : null
    return { terminal, isTerminal }
  }
  return NOT_A_TERMINAL
}
