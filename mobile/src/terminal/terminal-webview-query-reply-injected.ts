// Kept as one injectable unit so tests execute the same replay/generation gate
// that the WebView document runs, rather than a TypeScript reimplementation.
export const TERMINAL_QUERY_REPLY_JS = `
  var terminalDataRepliesEnabled = false;
  // Why: Android hardware keys never reach the RN capture field (native
  // EditText consumes arrows/escape), so when the WebView takes input focus
  // xterm itself encodes the key bytes; RN forwards them via terminal-input.
  var terminalHardwareKeysEnabled = false;

  function setTerminalHardwareKeysEnabled(enabled) {
    terminalHardwareKeysEnabled = enabled;
    try {
      term.attachCustomKeyEventHandler(function() { return terminalHardwareKeysEnabled; });
      if (term.textarea) {
        term.textarea.readOnly = !enabled;
        term.textarea.setAttribute('inputmode', 'none');
      }
    } catch (e) {}
  }

  function resetTerminalDataReplyAuthority() {
    terminalDataRepliesEnabled = false;
  }

  function resumeTerminalDataReplyAuthority() {
    terminalDataRepliesEnabled = true;
  }

  function forwardTerminalDataReply(data) {
    if (terminalDataRepliesEnabled) notify({ type: 'terminal-data', bytes: data });
  }

  function enqueueTerminalDataReplyBoundary(gen) {
    enqueueWriteBoundary(function() {
      if (gen === terminalGeneration) terminalDataRepliesEnabled = true;
    });
  }

  function attachTerminalQueryReplyBridge(term, gen) {
    // Why: parser replies require stdin enabled, but touch input is owned by
    // native controls. The key handler passes keys only in hardware-keyboard
    // mode (Android webview focus); otherwise xterm's textarea stays inert.
    try {
      term.attachCustomKeyEventHandler(function() { return terminalHardwareKeysEnabled; });
      if (term.textarea) {
        term.textarea.readOnly = !terminalHardwareKeysEnabled;
        term.textarea.tabIndex = -1;
        term.textarea.setAttribute('inputmode', 'none');
      }
    } catch (e) {}
    try {
      termObserverDisposables.push(term.onData(function(data) {
        if (terminalHardwareKeysEnabled) {
          notify({ type: 'terminal-input', bytes: data });
          return;
        }
        forwardTerminalDataReply(data);
      }));
    } catch (e) {}
    // Why: live output can queue before initial replay finishes. Enable replies
    // at the replay boundary so those live queries are answered, never replayed ones.
    enqueueTerminalDataReplyBoundary(gen);
  }
`
