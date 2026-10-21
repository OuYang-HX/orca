import { describe, expect, it } from 'vitest'
import { sessionHandleFromPathname } from './session-handle-from-route'

describe('sessionHandleFromPathname', () => {
  it('decodes the worktree id the session route names', () => {
    expect(
      sessionHandleFromPathname('/h/host-1/session/fc853b75%3A%3A%2FUsers%2Fme%2Frepo?name=feature')
    ).toBe('fc853b75::/Users/me/repo')
  })

  it('ignores a path that names no session', () => {
    expect(sessionHandleFromPathname('/h/host-1')).toBeNull()
    expect(sessionHandleFromPathname('/h/host-1/session/')).toBeNull()
  })

  it('refuses a segment that is not valid percent-encoding', () => {
    expect(sessionHandleFromPathname('/h/host-1/session/%E0%A4%A')).toBeNull()
  })
})
