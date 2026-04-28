/**
 * Build the Content-Security-Policy connect-src directive value.
 * If a port is specified, restricts connections to that port.
 * Otherwise, allows any localhost/127.0.0.1 port.
 */
export function buildConnectSrc(port?: number): string {
  if (port) {
    return `http://127.0.0.1:${port} http://localhost:${port} ws://127.0.0.1:${port} ws://localhost:${port}`
  }
  return "http://127.0.0.1:* http://localhost:* ws://127.0.0.1:* ws://localhost:*"
}

/**
 * Join an array of CSP directives into a policy string.
 */
function joinCspDirectives(directives: string[]): string {
  return directives.join("; ")
}

/**
 * Build the full CSP policy string for a webview.
 */
export function buildCspString(cspSource: string, nonce: string, port?: number): string {
  const connectSrc = buildConnectSrc(port)
  const directives = [
    "default-src 'none'",
    `style-src 'unsafe-inline' ${cspSource}`,
    `script-src 'nonce-${nonce}' 'wasm-unsafe-eval'`,
    `font-src ${cspSource}`,
    `connect-src ${cspSource} ${connectSrc} https://*.tts.speech.microsoft.com https://texttospeech.googleapis.com https://api.openai.com https://api.elevenlabs.io https://polly.*.amazonaws.com`,
    `img-src ${cspSource} data: https:`,
    // Allow VS Code's own internal service worker (registered by the webview preloader
    // at vscode-webview://<id>/service-worker.js) to operate after our HTML is injected.
    // Without this explicit worker-src, default-src 'none' would block the SW fetch
    // interceptor and trigger "Failed to register a ServiceWorker: document is in an
    // invalid state" on VS Code 1.90+ with module-type service workers.
    `worker-src ${cspSource} blob:`,
  ]
  return joinCspDirectives(directives)
}
