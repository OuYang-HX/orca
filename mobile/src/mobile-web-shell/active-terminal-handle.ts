/**
 * The terminal of the tab the session is showing, from a `session.tabs.subscribe` snapshot.
 *
 * Reads host data defensively: a shape change must drop a key rather than throw inside a stream
 * callback, and a snapshot with no active terminal means there is nowhere to send one.
 */
export function activeTerminalHandle(payload: unknown): string | null {
  if (typeof payload !== 'object' || payload === null || !('tabs' in payload)) {
    return null
  }
  const tabs = payload.tabs
  if (!Array.isArray(tabs)) {
    return null
  }
  for (const tab of tabs) {
    if (
      typeof tab === 'object' &&
      tab !== null &&
      'isActive' in tab &&
      tab.isActive === true &&
      'terminal' in tab &&
      typeof tab.terminal === 'string' &&
      tab.terminal !== ''
    ) {
      return tab.terminal
    }
  }
  return null
}
