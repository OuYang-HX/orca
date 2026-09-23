const { withMainActivity, createRunOncePlugin } = require('@expo/config-plugins')

const DISPATCH_OVERRIDE = `
  override fun dispatchKeyEvent(event: android.view.KeyEvent): Boolean {
    // Why: Android hardware keys (arrows/escape) are consumed by the focused
    // EditText before TextInput.onKeyPress can see them. When the terminal
    // screen enables interception, forward those keys to JS as escape bytes
    // and consume BOTH down and up so no view synthesizes a second event.
    if (expo.modules.terminalhwkeys.TerminalHwKeysModule.shouldInterceptKeyEvent(event)) {
      if (event.action == android.view.KeyEvent.ACTION_DOWN) {
        expo.modules.terminalhwkeys.TerminalHwKeysModule.maybeDispatchKeyEvent(event)
      }
      return true
    }
    return super.dispatchKeyEvent(event)
  }
`

function injectHwKeysDispatch(contents) {
  if (contents.includes('TerminalHwKeysModule.maybeDispatchKeyEvent')) {
    return contents
  }
  const anchor = 'class MainActivity : ReactActivity() {'
  if (!contents.includes(anchor)) {
    throw new Error('with-terminal-hwkeys: MainActivity anchor not found')
  }
  return contents.replace(anchor, anchor + DISPATCH_OVERRIDE)
}

const withTerminalHwKeys = (config) =>
  withMainActivity(config, (config) => {
    config.modResults.contents = injectHwKeysDispatch(config.modResults.contents)
    return config
  })

module.exports = createRunOncePlugin(withTerminalHwKeys, 'with-terminal-hwkeys', '1.0.0')
