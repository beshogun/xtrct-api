import type { BrowserContext } from 'playwright';

/**
 * Stealth init script injected into every page before any JS runs.
 * Patches the most common bot-detection fingerprints.
 */
export const STEALTH_SCRIPT = `
(function() {
  // 1. Remove webdriver flag
  Object.defineProperty(navigator, 'webdriver', { get: () => undefined });

  // 2. Fake chrome runtime (headless Chrome lacks this)
  if (!window.chrome) {
    Object.defineProperty(window, 'chrome', {
      value: {
        app: { isInstalled: false },
        webstore: {},
        runtime: {
          onConnect: { addListener: () => {}, removeListener: () => {} },
          onMessage: { addListener: () => {}, removeListener: () => {} },
        },
      },
      writable: false,
    });
  }

  // 3. Fake navigator.plugins (empty array triggers bot detection)
  const pluginData = [
    { name: 'Chrome PDF Plugin', filename: 'internal-pdf-viewer', description: 'Portable Document Format' },
    { name: 'Chrome PDF Viewer', filename: 'mhjfbmdgcfjbbpaeojofohoefgiehjai', description: '' },
    { name: 'Native Client', filename: 'internal-nacl-plugin', description: '' },
  ];
  Object.defineProperty(navigator, 'plugins', {
    get: () => {
      const arr = pluginData.map((p, i) => Object.assign(Object.create(Plugin.prototype || {}), p, { length: 0 }));
      Object.defineProperties(arr, {
        item:      { value: (i) => arr[i] ?? null },
        namedItem: { value: (n) => arr.find(p => p.name === n) ?? null },
        refresh:   { value: () => {} },
      });
      return arr;
    },
  });

  // 4. Fake navigator.languages
  Object.defineProperty(navigator, 'languages', {
    get: () => ['en-GB', 'en-US', 'en'],
  });

  // 5. Fix Notification.permissions query — headless throws otherwise
  if (navigator.permissions && navigator.permissions.query) {
    const orig = navigator.permissions.query.bind(navigator.permissions);
    navigator.permissions.query = (params) => {
      if (params && params.name === 'notifications') {
        return Promise.resolve({ state: Notification.permission ?? 'default', onchange: null });
      }
      return orig(params);
    };
  }

  // 6. Canvas fingerprint randomisation — subtle per-session noise
  const origToDataURL = HTMLCanvasElement.prototype.toDataURL;
  HTMLCanvasElement.prototype.toDataURL = function(type, quality) {
    const ctx = this.getContext('2d');
    if (ctx) {
      const imageData = ctx.getImageData(0, 0, this.width || 1, this.height || 1);
      for (let i = 0; i < imageData.data.length; i += 100) {
        imageData.data[i] ^= Math.floor(Math.random() * 3);
      }
      ctx.putImageData(imageData, 0, 0);
    }
    return origToDataURL.call(this, type, quality);
  };

  // 7. WebGL vendor/renderer spoofing
  const origGetParam = WebGLRenderingContext.prototype.getParameter;
  WebGLRenderingContext.prototype.getParameter = function(param) {
    if (param === 37445) return 'Intel Inc.';
    if (param === 37446) return 'Intel Iris OpenGL Engine';
    return origGetParam.call(this, param);
  };
  if (typeof WebGL2RenderingContext !== 'undefined') {
    const orig2 = WebGL2RenderingContext.prototype.getParameter;
    WebGL2RenderingContext.prototype.getParameter = function(param) {
      if (param === 37445) return 'Intel Inc.';
      if (param === 37446) return 'Intel Iris OpenGL Engine';
      return orig2.call(this, param);
    };
  }

  // 8. Fix hairline feature test (some detectors test this)
  Object.defineProperty(window, 'devicePixelRatio', { get: () => 1 });
})();
`;

const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
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
