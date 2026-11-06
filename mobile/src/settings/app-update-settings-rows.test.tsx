import { createElement } from 'react'
import { act, create, type ReactTestRenderer } from 'react-test-renderer'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AppUpdateSettingsRows, type AppUpdateCheckRowStatus } from './app-update-settings-rows'

vi.mock(
  './settings-screen-frame',
  async () => (await import('../test-support/settings-chrome-test-double')).settingsFrameDouble
)
vi.mock(
  '../components/list/ListGroup',
  async () => (await import('../test-support/settings-chrome-test-double')).listGroupDouble
)
vi.mock('react-native', () => ({
  Pressable: 'Pressable',
  StyleSheet: { create: <T,>(styles: T) => styles, hairlineWidth: 1 },
  Text: 'Text',
  View: 'View'
}))

const NOW = Date.UTC(2026, 8, 28, 12)

describe('AppUpdateSettingsRows', () => {
  let renderer: ReactTestRenderer | null = null
  afterEach(() => {
    act(() => renderer?.unmount())
    renderer = null
  })

  function render(opts: {
    available?: { version: string; url: string } | null
    lastCheckedAt?: number | null
    checkStatus?: AppUpdateCheckRowStatus
    requiresCustomBuild?: boolean
  }) {
    const onUpdate = vi.fn()
    const onCheck = vi.fn()
    act(() => {
      renderer = create(
        createElement(AppUpdateSettingsRows, {
          installedVersion: '0.0.48',
          requiresCustomBuild: opts.requiresCustomBuild,
          available: opts.available ?? null,
          lastCheckedAt: opts.lastCheckedAt ?? null,
          now: NOW,
          checkStatus: opts.checkStatus ?? 'idle',
          onUpdate,
          onCheck
        })
      )
    })
    const root = renderer!.root
    const rows = root.findAll((node) => String(node.type) === 'ListRow')
    // Each row's words in reading order: its title, then its value or inline action.
    const texts = rows.flatMap((row) => [
      String(row.props.title),
      ...(row.props.value === undefined ? [] : [String(row.props.value)]),
      ...row
        .findAll((node) => String(node.type) === 'Text')
        .map((node) => node.children.filter((child) => typeof child === 'string').join(''))
    ])
    return {
      root,
      texts,
      onUpdate,
      onCheck,
      pressables: rows.filter((row) => row.props.onPress !== undefined)
    }
  }

  it('offers official release details and a rebuild instruction for a custom APK', () => {
    const { texts, pressables, onUpdate } = render({
      requiresCustomBuild: true,
      available: {
        version: '0.0.53',
        url: 'https://github.com/stablyai/orca/releases/tag/mobile-android-v0.0.53'
      }
    })
    expect(texts).toEqual(['Official Orca 0.0.53', 'Details', 'Check official updates', 'Never'])
    act(() => pressables[0].props.onPress())
    expect(onUpdate).toHaveBeenCalledWith(
      'https://github.com/stablyai/orca/releases/tag/mobile-android-v0.0.53'
    )
  })

  it('says no newer official release after a custom APK successfully checks the official channel', () => {
    const { texts } = render({ requiresCustomBuild: true, checkStatus: 'up-to-date' })
    expect(texts).toEqual(['Version 0.0.48', 'Check official updates', 'No newer official release'])
  })
})
