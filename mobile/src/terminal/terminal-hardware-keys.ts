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
  setSubmitInterceptEnabled(enabled: boolean): void
  setLiveInputFocused(focused: boolean): void
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

// Why: submit keys stand guard from route focus — before the tab strip and
// connection settle, an unfocused Enter would otherwise fall through to
// Android focus-search and click whatever Pressable gains focus.
export function setTerminalSubmitInterceptEnabled(enabled: boolean): void {
  TerminalHwKeys?.setSubmitInterceptEnabled(enabled)
}

// Why: the focused field owns Enter (IME composition confirm / editor action);
// unfocused Enter is intercepted instead of falling through to Android
// focus-search, which would click whatever Pressable gains focus.
export function setTerminalLiveInputFocused(focused: boolean): void {
  TerminalHwKeys?.setLiveInputFocused(focused)
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
