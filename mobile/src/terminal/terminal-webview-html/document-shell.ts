import { TERMINAL_DOCUMENT_MARKUP } from './document-markup'
import { TERMINAL_DOCUMENT_STYLE } from './document-style'
import { SYMBOLS_NERD_FONT_B64 } from './nerd-font-data'
import { XTERM_ENGINE_CSS } from '../terminal-webview-engine-css.generated'
import { XTERM_ENGINE_JS } from '../terminal-webview-engine.generated'

export const TERMINAL_HTML_DOCUMENT_SHELL = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, user-scalable=no">
<script>
window.__engineErrors = [];
window.onerror = function(msg) {
  // Why: a degraded engine can throw per frame; cap so the capture buffer
  // and downstream reporting stay bounded for the document's lifetime.
  if (window.__engineErrors.length < 20) window.__engineErrors.push(String(msg));
};
</script>
<style>${SYMBOLS_NERD_FONT_B64 ? `@font-face { font-family: 'Symbols Nerd Font Mono'; src: url(data:font/ttf;base64,${SYMBOLS_NERD_FONT_B64}) format('truetype'); font-display: block; }` : ''}</style>
<script>
(function () {
  try {
    if (!document.fonts || !document.fonts.load) { return }
    // Why: the glyph atlas rasterizes at first paint, and the embedded webfont
    // may still be decoding then — tofu gets cached for the session. Hold host
    // frames until the font resolves (3s cap), then replay them in order.
    var queued = []
    var ready = false
    var flush = function () {
      if (ready) { return }
      ready = true
      for (var i = 0; i < queued.length; i++) {
        window.dispatchEvent(new MessageEvent('message', { data: queued[i] }))
      }
      queued = []
    }
    document.fonts.load('300 14px "Symbols Nerd Font Mono"').then(flush, flush)
    setTimeout(flush, 3000)
    window.addEventListener('message', function (ev) {
      if (ready) { return }
      queued.push(ev.data)
      try {
        var msg = typeof ev.data === 'string' ? JSON.parse(ev.data) : ev.data
        if (msg && msg.type === 'init') {
          document.fonts.load('300 14px "Symbols Nerd Font Mono"')
        }
      } catch (e) {}
    })
  } catch (e) {}
})()
</script>
<style>${XTERM_ENGINE_CSS}</style>
<style>
${TERMINAL_DOCUMENT_STYLE}
</style>
</head>
<body>
${TERMINAL_DOCUMENT_MARKUP}
<script>${XTERM_ENGINE_JS}</script>
<script>
`
