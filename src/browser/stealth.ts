import type { BrowserContext } from 'playwright';

/**
 * Stealth init script injected into every page before any JS runs.
 * Patches the most common bot-detection fingerprints including Cloudflare Bot Management.
 *
 * Key principle: patched functions must appear native via toString().
 * CF and PerimeterX both call .toString() on navigator property descriptors
 * to check for [native code] — plain defineProperty getters fail this.
 */
export const STEALTH_SCRIPT = `
(function() {
  // ── Native function spoof helper ──────────────────────────────────────────
  // Makes any function appear to be native when .toString() is called.
  // Critical: Cloudflare calls getter.toString() on navigator descriptors.
  const nativeToString = Function.prototype.toString;
  function makeNative(fn, nativeName) {
    const str = nativeName
      ? 'function ' + nativeName + '() { [native code] }'
      : 'function () { [native code] }';
    Object.defineProperty(fn, 'toString', {
      value: function() { return str; },
      writable: true, configurable: true,
    });
    return fn;
  }
  // Patch Function.prototype.toString so wrapped functions also pass
  Function.prototype.toString = new Proxy(nativeToString, {
    apply(target, thisArg, args) {
      return target.apply(thisArg, args);
    },
  });

  // ── 1. Remove webdriver flag (native-looking getter) ─────────────────────
  const webdriverGetter = makeNative(function() { return undefined; }, 'get webdriver');
  Object.defineProperty(navigator, 'webdriver', {
    get: webdriverGetter,
    configurable: true,
  });

  // ── 2. Chrome runtime ─────────────────────────────────────────────────────
  if (!window.chrome || !window.chrome.runtime) {
    const chrome = {
      app: {
        isInstalled: false,
        InstallState: { DISABLED: 'disabled', INSTALLED: 'installed', NOT_INSTALLED: 'not_installed' },
        RunningState: { CANNOT_RUN: 'cannot_run', READY_TO_RUN: 'ready_to_run', RUNNING: 'running' },
      },
      runtime: {
        OnInstalledReason: { CHROME_UPDATE: 'chrome_update', INSTALL: 'install', SHARED_MODULE_UPDATE: 'shared_module_update', UPDATE: 'update' },
        OnRestartRequiredReason: { APP_UPDATE: 'app_update', GC: 'gc', OS_UPDATE: 'os_update' },
        PlatformArch: { ARM: 'arm', ARM64: 'arm64', MIPS: 'mips', MIPS64: 'mips64', X86_32: 'x86-32', X86_64: 'x86-64' },
        PlatformOs: { ANDROID: 'android', CROS: 'cros', LINUX: 'linux', MAC: 'mac', OPENBSD: 'openbsd', WIN: 'win' },
        RequestUpdateCheckStatus: { NO_UPDATE: 'no_update', THROTTLED: 'throttled', UPDATE_AVAILABLE: 'update_available' },
        connect: makeNative(function() {}, 'connect'),
        sendMessage: makeNative(function() {}, 'sendMessage'),
      },
      loadTimes: makeNative(function() {
        return { requestTime: Date.now() / 1000 - Math.random() * 2, startLoadTime: Date.now() / 1000 - Math.random(), commitLoadTime: Date.now() / 1000, finishDocumentLoadTime: 0, finishLoadTime: 0, firstPaintTime: 0, firstPaintAfterLoadTime: 0, navigationType: 'Other', wasFetchedViaSpdy: false, wasNpnNegotiated: false, npnNegotiatedProtocol: 'unknown', wasAlternateProtocolAvailable: false, connectionInfo: 'unknown' };
      }, 'loadTimes'),
      csi: makeNative(function() { return { startE: Date.now(), onloadT: Date.now(), pageT: Math.random() * 3000, tran: 15 }; }, 'csi'),
    };
    try {
      Object.defineProperty(window, 'chrome', { value: chrome, writable: false, configurable: false });
    } catch {}
  }

  // ── 3. navigator.plugins ──────────────────────────────────────────────────
  const pluginData = [
    { name: 'PDF Viewer', filename: 'internal-pdf-viewer', description: 'Portable Document Format' },
    { name: 'Chrome PDF Viewer', filename: 'internal-pdf-viewer', description: 'Portable Document Format' },
    { name: 'Chromium PDF Viewer', filename: 'internal-pdf-viewer', description: 'Portable Document Format' },
    { name: 'Microsoft Edge PDF Viewer', filename: 'internal-pdf-viewer', description: 'Portable Document Format' },
    { name: 'WebKit built-in PDF', filename: 'internal-pdf-viewer', description: 'Portable Document Format' },
  ];
  const pluginArr = pluginData.map(p => Object.assign(Object.create(Plugin.prototype || {}), p, { length: 1 }));
  Object.defineProperties(pluginArr, {
    item:      { value: makeNative(function(i) { return pluginArr[i] ?? null; }, 'item') },
    namedItem: { value: makeNative(function(n) { return pluginArr.find(p => p.name === n) ?? null; }, 'namedItem') },
    refresh:   { value: makeNative(function() {}, 'refresh') },
  });
  Object.defineProperty(navigator, 'plugins', { get: makeNative(function() { return pluginArr; }, 'get plugins'), configurable: true });

  // ── 4. navigator.mimeTypes ────────────────────────────────────────────────
  const mimeArr = [
    { type: 'application/pdf', suffixes: 'pdf', description: 'Portable Document Format', enabledPlugin: pluginArr[0] },
    { type: 'text/pdf', suffixes: 'pdf', description: 'Portable Document Format', enabledPlugin: pluginArr[0] },
  ].map(m => Object.assign(Object.create(MimeType.prototype || {}), m));
  Object.defineProperties(mimeArr, {
    item:      { value: makeNative(function(i) { return mimeArr[i] ?? null; }, 'item') },
    namedItem: { value: makeNative(function(n) { return mimeArr.find(m => m.type === n) ?? null; }, 'namedItem') },
  });
  Object.defineProperty(navigator, 'mimeTypes', { get: makeNative(function() { return mimeArr; }, 'get mimeTypes'), configurable: true });

  // ── 5. navigator.languages ────────────────────────────────────────────────
  Object.defineProperty(navigator, 'languages', { get: makeNative(function() { return ['en-GB', 'en-US', 'en']; }, 'get languages'), configurable: true });

  // ── 6. navigator.hardwareConcurrency & deviceMemory ──────────────────────
  Object.defineProperty(navigator, 'hardwareConcurrency', { get: makeNative(function() { return 8; }, 'get hardwareConcurrency'), configurable: true });
  try { Object.defineProperty(navigator, 'deviceMemory', { get: makeNative(function() { return 8; }, 'get deviceMemory'), configurable: true }); } catch {}

  // ── 7. Notification permissions ───────────────────────────────────────────
  if (navigator.permissions && navigator.permissions.query) {
    const origQuery = navigator.permissions.query.bind(navigator.permissions);
    navigator.permissions.query = makeNative(function(params) {
      if (params && params.name === 'notifications') {
        return Promise.resolve({ state: 'default', onchange: null });
      }
      return origQuery(params);
    }, 'query');
  }

  // ── 8. Canvas fingerprint noise ───────────────────────────────────────────
  const origToDataURL = HTMLCanvasElement.prototype.toDataURL;
  HTMLCanvasElement.prototype.toDataURL = makeNative(function(type, quality) {
    const ctx = this.getContext('2d');
    if (ctx && this.width > 0 && this.height > 0) {
      const imageData = ctx.getImageData(0, 0, this.width, this.height);
      for (let i = 0; i < Math.min(imageData.data.length, 400); i += 4) {
        imageData.data[i]     ^= (Math.random() * 2) | 0;
        imageData.data[i + 1] ^= (Math.random() * 2) | 0;
      }
      ctx.putImageData(imageData, 0, 0);
    }
    return origToDataURL.call(this, type, quality);
  }, 'toDataURL');

  // ── 9. WebGL vendor/renderer ──────────────────────────────────────────────
  const webglVendors = ['Google Inc. (Intel)', 'Google Inc. (NVIDIA)', 'Google Inc. (AMD)'];
  const webglRenderers = ['ANGLE (Intel, Intel(R) UHD Graphics Direct3D11 vs_5_0 ps_5_0, D3D11)', 'ANGLE (NVIDIA, NVIDIA GeForce GTX 1060 Direct3D11 vs_5_0 ps_5_0, D3D11)'];
  const wV = webglVendors[0]; const wR = webglRenderers[0];
  const origGetParam = WebGLRenderingContext.prototype.getParameter;
  WebGLRenderingContext.prototype.getParameter = makeNative(function(param) {
    if (param === 37445) return wV;
    if (param === 37446) return wR;
    return origGetParam.call(this, param);
  }, 'getParameter');
  if (typeof WebGL2RenderingContext !== 'undefined') {
    const orig2 = WebGL2RenderingContext.prototype.getParameter;
    WebGL2RenderingContext.prototype.getParameter = makeNative(function(param) {
      if (param === 37445) return wV;
      if (param === 37446) return wR;
      return orig2.call(this, param);
    }, 'getParameter');
  }

  // ── 10. Screen & window dimensions consistency ────────────────────────────
  // Headless has mismatched outerWidth/outerHeight vs screen — CF checks this
  try {
    if (window.outerWidth === 0) Object.defineProperty(window, 'outerWidth',  { get: makeNative(function() { return window.innerWidth; },  'get outerWidth'),  configurable: true });
    if (window.outerHeight === 0) Object.defineProperty(window, 'outerHeight', { get: makeNative(function() { return window.innerHeight + 100; }, 'get outerHeight'), configurable: true });
  } catch {}

  // ── 11. Hide automation args ──────────────────────────────────────────────
  // Playwright launches with --disable-blink-features=AutomationControlled but
  // the string may still appear in appVersion / userAgent on some versions
  try {
    const desc = Object.getOwnPropertyDescriptor(window, 'navigator');
    if (!desc || desc.configurable) {
      const ua = navigator.userAgent.replace('HeadlessChrome', 'Chrome');
      Object.defineProperty(navigator, 'userAgent', { get: makeNative(function() { return ua; }, 'get userAgent'), configurable: true });
      Object.defineProperty(navigator, 'appVersion', { get: makeNative(function() { return ua.replace('Mozilla/', ''); }, 'get appVersion'), configurable: true });
    }
  } catch {}
})();
`;

const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
];

const VIEWPORTS = [
  { width: 1920, height: 1080 },
  { width: 1440, height: 900 },
  { width: 1366, height: 768 },
  { width: 1280, height: 800 },
];

export function randomUA(): string {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

export function randomViewport() {
  return VIEWPORTS[Math.floor(Math.random() * VIEWPORTS.length)];
}

/** Apply stealth patches to a newly created browser context. */
export async function applyStealthContext(ctx: BrowserContext): Promise<void> {
  await ctx.addInitScript(STEALTH_SCRIPT);
}
