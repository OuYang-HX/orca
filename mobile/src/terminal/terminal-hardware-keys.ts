import { Platform } from 'react-native'
import { EventEmitter, NativeModule, requireNativeModule } from 'expo-modules-core'

// Why: Android native EditText consumes arrow/escape hardware keys before
// TextInput.onKeyPress can see them; MainActivity intercepts them and this
// module forwards the encoded bytes. iOS has no such gap — no module there.
type TerminalHwKeysEvents = {
  onTerminalHardwareKey: (event: { bytes: string }) => void
}

declare class TerminalHwKeysModule extends NativeModule<TerminalHwKeysEvents> {
  setEnabled(enabled: boolean): void
}

const TerminalHwKeys =
  Platform.OS === 'android'
    ? requireNativeModule<TerminalHwKeysModule>('TerminalHwKeys')
    : null

const hardwareKeyEmitter = TerminalHwKeys
  ? new EventEmitter<TerminalHwKeysEvents>(TerminalHwKeys)
  : null

export function setTerminalHardwareKeysEnabled(enabled: boolean): void {
  TerminalHwKeys?.setEnabled(enabled)
}

export function addTerminalHardwareKeyListener(listener: (bytes: string) => void): () => void {
  if (!hardwareKeyEmitter) {
    return () => {}
  }
  const subscription = hardwareKeyEmitter.addListener('onTerminalHardwareKey', (event) => {
    if (!event || typeof event.bytes !== 'string' || event.bytes.length === 0) {
      return
    }
    listener(event.bytes)
  })
  return () => subscription.remove()
}
