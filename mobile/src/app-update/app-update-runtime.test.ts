import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AppUpdateCheckerDeps } from './app-update-checker'

const mocks = vi.hoisted(() => {
  const config: { version: string; extra: Record<string, string> } = {
    version: '0.0.52',
    extra: {}
  }
  return {
    platform: { OS: 'android' },
    config,
    createChecker: vi.fn((deps: AppUpdateCheckerDeps) => deps),
    loadPreferences: vi.fn(),
    saveCheck: vi.fn(),
    saveDismissedVersion: vi.fn()
  }
})

vi.mock('expo-constants', () => ({ default: { expoConfig: mocks.config } }))
vi.mock('expo-linking', () => ({ openURL: vi.fn() }))
vi.mock('react-native', () => ({ Platform: mocks.platform, AppState: {} }))
vi.mock('./app-update-checker', () => ({ createAppUpdateChecker: mocks.createChecker }))
vi.mock('../storage/app-update-preferences', () => ({
  loadAppUpdatePreferences: mocks.loadPreferences,
  saveAppUpdateCheck: mocks.saveCheck,
  saveDismissedAppUpdateVersion: mocks.saveDismissedVersion
}))

async function loadRuntime() {
  const runtime = await import('./app-update-runtime')
  const deps = mocks.createChecker.mock.calls.at(-1)?.[0]
  if (!deps) {
    throw new Error('Update checker was not created')
  }
  return { runtime, deps }
}

describe('embedded update channel', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    mocks.platform.OS = 'android'
    mocks.config.extra = {}
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('[]'))
    )
  })
  afterEach(() => vi.unstubAllGlobals())

  it('keeps a numeric installed version and routes custom Android checks and storage to the fork', async () => {
    mocks.config.extra = { androidUpdateRepository: 'OuYang-HX/orca', androidBuildLabel: 'oyhx.1' }
    const { runtime, deps } = await loadRuntime()
    expect(runtime.installedAppVersionLabel).toBe('0.0.52 (oyhx.1)')
    expect(deps.installedVersion).toBe('0.0.52')
    await deps.source?.check('0.0.52', new AbortController().signal)
    expect(fetch).toHaveBeenCalledWith(
      'https://api.github.com/repos/OuYang-HX/orca/git/matching-refs/tags/mobile-android-v',
      expect.anything()
    )
    await deps.loadPreferences()
    await deps.saveCheck(100, null)
    await deps.saveDismissedVersion('0.0.53')
    expect(mocks.loadPreferences).toHaveBeenCalledWith('OuYang-HX/orca')
    expect(mocks.saveCheck).toHaveBeenCalledWith(100, null, 'OuYang-HX/orca')
    expect(mocks.saveDismissedVersion).toHaveBeenCalledWith('0.0.53', 'OuYang-HX/orca')
  })

  it('preserves the official Android channel when no custom repository is configured', async () => {
    const { runtime, deps } = await loadRuntime()
    expect(runtime.installedAppVersionLabel).toBe('0.0.52')
    await deps.source?.check('0.0.52', new AbortController().signal)
    expect(fetch).toHaveBeenCalledWith(
      'https://api.github.com/repos/stablyai/orca/git/matching-refs/tags/mobile-android-v',
      expect.anything()
    )
    await deps.loadPreferences()
    expect(mocks.loadPreferences).toHaveBeenCalledWith(undefined)
  })

  it('keeps iOS on the App Store with its existing version label and preferences', async () => {
    mocks.platform.OS = 'ios'
    mocks.config.extra = { androidUpdateRepository: 'OuYang-HX/orca', androidBuildLabel: 'oyhx.1' }
    const { runtime, deps } = await loadRuntime()
    expect(runtime.installedAppVersionLabel).toBe('0.0.52')
    vi.mocked(fetch).mockResolvedValueOnce(new Response('{"results":[]}'))
    await deps.source?.check('0.0.52', new AbortController().signal)
    expect(fetch).toHaveBeenCalledWith(
      'https://itunes.apple.com/lookup?bundleId=com.stably.orca.mobile',
      expect.anything()
    )
    await deps.loadPreferences()
    expect(mocks.loadPreferences).toHaveBeenCalledWith(undefined)
  })
})
