import { createElement } from 'react'
import { act, create, type ReactTestRenderer } from 'react-test-renderer'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AppUpdateCard } from './AppUpdateCard'

vi.mock('react-native', () => ({
  Pressable: 'Pressable',
  StyleSheet: { create: <T,>(styles: T) => styles },
  Text: 'Text',
  View: 'View'
}))
vi.mock('lucide-react-native', () => ({ ArrowUpFromLine: 'ArrowUpFromLine', X: 'X' }))

describe('AppUpdateCard', () => {
  let renderer: ReactTestRenderer | null = null
  afterEach(() => {
    act(() => renderer?.unmount())
    renderer = null
  })

  function render(requiresCustomBuild = false) {
    const onPress = vi.fn()
    const onDismiss = vi.fn()
    act(() => {
      renderer = create(
        createElement(AppUpdateCard, { version: '0.0.51', requiresCustomBuild, onPress, onDismiss })
      )
    })
    const root = renderer!.root
    return { root, onPress, onDismiss }
  }

  it('opens the update from the card body and dismisses from the X', () => {
    const { root, onPress, onDismiss } = render()
    const [body, dismiss] = root.findAll((node) => String(node.type) === 'Pressable')
    expect(dismiss.props.accessibilityLabel).toBe('Dismiss Orca 0.0.51 update')
    act(() => body.props.onPress())
    expect(onPress).toHaveBeenCalledTimes(1)
    expect(onDismiss).not.toHaveBeenCalled()
    act(() => dismiss.props.onPress())
    expect(onDismiss).toHaveBeenCalledTimes(1)
  })

  it('labels the official release as a custom APK rebuild and opens its details', () => {
    const { root, onPress } = render(true)
    const texts = root
      .findAll((node) => String(node.type) === 'Text')
      .map((node) => node.props.children)
    expect(texts).toEqual(['Official Orca 0.0.51 is available', 'View notes'])
    const body = root.findAll((node) => String(node.type) === 'Pressable')[0]
    expect(body.props.accessibilityLabel).toBe(
      'Official Orca 0.0.51 is available, view release notes'
    )
    act(() => body.props.onPress())
    expect(onPress).toHaveBeenCalledTimes(1)
  })
})
