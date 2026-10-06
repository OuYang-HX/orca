import { afterEach, expect, it, vi } from 'vitest'

const start = vi.hoisted(() => vi.fn())
vi.mock('./create-terminal-document', () => ({ createTerminalDocument: start }))

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
  vi.resetModules()
  start.mockClear()
})

function pendingFont() {
  let finish = () => {}
  const ready = new Promise<FontFace[]>((resolve) => {
    finish = () => resolve([])
  })
  vi.stubGlobal('document', { fonts: { check: () => false, load: () => ready } })
  return finish
}

it('starts the native document only after its embedded font loads', async () => {
  const finish = pendingFont()
  await import('./native-document-entry')
  expect(start).not.toHaveBeenCalled()

  finish()
  await Promise.resolve()
  await Promise.resolve()
  expect(start).toHaveBeenCalledTimes(1)
})

it('starts after the fallback deadline and ignores a late font completion', async () => {
  vi.useFakeTimers()
  const finish = pendingFont()
  await import('./native-document-entry')
  await vi.advanceTimersByTimeAsync(3000)
  expect(start).toHaveBeenCalledTimes(1)

  finish()
  await Promise.resolve()
  expect(start).toHaveBeenCalledTimes(1)
})

it('starts when font decoding fails instead of leaving the terminal blank', async () => {
  vi.stubGlobal('document', {
    fonts: { check: () => false, load: () => Promise.reject(new Error('font decoding failed')) }
  })
  await import('./native-document-entry')
  await Promise.resolve()
  expect(start).toHaveBeenCalledTimes(1)
})

it('starts immediately when the font is already available', async () => {
  vi.stubGlobal('document', { fonts: { check: () => true } })
  await import('./native-document-entry')
  expect(start).toHaveBeenCalledTimes(1)
})
