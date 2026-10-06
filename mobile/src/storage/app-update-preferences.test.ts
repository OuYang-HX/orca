import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  EMPTY_APP_UPDATE_PREFERENCES,
  loadAppUpdatePreferences,
  saveAppUpdateCheck,
  saveDismissedAppUpdateVersion
} from './app-update-preferences'

const stored = new Map<string, string>()
vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    multiGet: async (keys: string[]) => keys.map((key) => [key, stored.get(key) ?? null]),
    multiSet: async (entries: [string, string][]) => {
      for (const [key, value] of entries) {
        stored.set(key, value)
      }
    },
    setItem: async (key: string, value: string) => {
      stored.set(key, value)
    }
  }
}))

describe('loadAppUpdatePreferences', () => {
  beforeEach(() => stored.clear())

  it('isolates the check, cached release and dismissal when the update channel changes', async () => {
    const official = { version: '0.0.99', url: 'https://github.com/stablyai/orca/releases/tag/new' }
    await saveAppUpdateCheck(100, official)
    await saveDismissedAppUpdateVersion('0.0.99')
    await expect(loadAppUpdatePreferences('OuYang-HX/orca')).resolves.toEqual(
      EMPTY_APP_UPDATE_PREFERENCES
    )

    const custom = { version: '0.0.53', url: 'https://github.com/OuYang-HX/orca/releases/tag/new' }
    await saveAppUpdateCheck(200, custom, 'OuYang-HX/orca')
    await saveDismissedAppUpdateVersion('0.0.53', 'OuYang-HX/orca')
    await expect(loadAppUpdatePreferences('OuYang-HX/orca')).resolves.toEqual({
      lastCheckedAt: 200,
      latest: custom,
      dismissedVersion: '0.0.53'
    })
    await expect(loadAppUpdatePreferences()).resolves.toEqual({
      lastCheckedAt: 100,
      latest: official,
      dismissedVersion: '0.0.99'
    })
  })

  it('drops only a corrupt update record, keeping the check time and dismissal beside it', async () => {
    stored.set('orca:appUpdate:lastCheckedAt', '1700000000000')
    stored.set('orca:appUpdate:latest', '{not json')
    stored.set('orca:appUpdate:dismissedVersion', '0.0.51')
    await expect(loadAppUpdatePreferences()).resolves.toEqual({
      lastCheckedAt: 1700000000000,
      latest: null,
      dismissedVersion: '0.0.51'
    })
  })

  it('reads a well-formed update record', async () => {
    stored.set(
      'orca:appUpdate:latest',
      JSON.stringify({ version: '0.0.52', url: 'https://x.test' })
    )
    await expect(loadAppUpdatePreferences()).resolves.toMatchObject({
      latest: { version: '0.0.52', url: 'https://x.test' }
    })
  })
})
