import AsyncStorage from '@react-native-async-storage/async-storage'
import { z } from 'zod'

function updateKey(field: string, channel?: string): string {
  return `orca:appUpdate${channel ? `:${channel}` : ''}:${field}`
}

export type KnownAppUpdate = { readonly version: string; readonly url: string }

export type AppUpdatePreferences = {
  /** Last successful check; failures never move it. */
  readonly lastCheckedAt: number | null
  /** Newest installable release that check saw, or null when it saw none. */
  readonly latest: KnownAppUpdate | null
  readonly dismissedVersion: string | null
}

export const EMPTY_APP_UPDATE_PREFERENCES: AppUpdatePreferences = {
  lastCheckedAt: null,
  latest: null,
  dismissedVersion: null
}

const knownAppUpdateSchema = z.object({ version: z.string(), url: z.string() })

// A corrupt record loses only itself, never the check time or the dismissal stored beside it.
function parseLatest(raw: string | null): KnownAppUpdate | null {
  try {
    const parsed = raw ? knownAppUpdateSchema.safeParse(JSON.parse(raw)) : null
    return parsed?.success ? parsed.data : null
  } catch {
    return null
  }
}

export async function loadAppUpdatePreferences(channel?: string): Promise<AppUpdatePreferences> {
  try {
    const [[, checkedAt], [, latest], [, dismissed]] = await AsyncStorage.multiGet([
      updateKey('lastCheckedAt', channel),
      updateKey('latest', channel),
      updateKey('dismissedVersion', channel)
    ])
    const lastCheckedAt = checkedAt === null ? null : Number(checkedAt)
    return {
      lastCheckedAt:
        lastCheckedAt !== null && Number.isFinite(lastCheckedAt) ? lastCheckedAt : null,
      latest: parseLatest(latest),
      dismissedVersion: dismissed
    }
  } catch {
    return EMPTY_APP_UPDATE_PREFERENCES
  }
}

export async function saveAppUpdateCheck(
  checkedAt: number,
  latest: KnownAppUpdate | null,
  channel?: string
) {
  await AsyncStorage.multiSet([
    [updateKey('lastCheckedAt', channel), String(checkedAt)],
    [updateKey('latest', channel), latest ? JSON.stringify(latest) : '']
  ])
}

export async function saveDismissedAppUpdateVersion(
  version: string,
  channel?: string
): Promise<void> {
  await AsyncStorage.setItem(updateKey('dismissedVersion', channel), version)
}
