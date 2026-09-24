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
  isHardwareKeyboardConnected(): boolean
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
// Android focus-search and click whatever Pressable gains focus. Whether the
// field owns Enter is read live at the dispatch gate (Activity.currentFocus),
// so no JS focus reporting is needed.
export function setTerminalSubmitInterceptEnabled(enabled: boolean): void {
  TerminalHwKeys?.setSubmitInterceptEnabled(enabled)
}

// Why: with a hardware keyboard attached the soft keyboard never shows
// (keyboardHeight stays 0), so keyboardHeight-based focus gates would never
// fire for hardware-keyboard users switching tabs or workspaces. Only a real
// typing keyboard counts — auto-focusing must never pop the IME for touch
// users, and Android suppresses the soft keyboard while a hardware one is
// connected anyway.
export function isTerminalHardwareKeyboardConnected(): boolean {
  return TerminalHwKeys?.isHardwareKeyboardConnected() ?? false
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
