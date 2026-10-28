/**
 * RealPlan 3D — Home Assistant Sidebar Panel (<realplan3d-panel>) & Lovelace Card (<realplan3d-card>)
 * Registered automatically by custom_components/realplan3d/__init__.py
 *
 * Mounts 100% of the complete RealPlan 3D / 2D Studio application directly inside Home Assistant:
 * 1. Uses the local compiled Studio bundle (/realplan3d_static/app/index.html) when present in
 *    custom_components/realplan3d/frontend/app/.
 * 2. Automatically falls back to the live hosted RealPlan 3D Studio application if the app/
 *    folder was not copied yet — so you ALWAYS get the exact full 2D/3D Studio inside Home Assistant!
 * 3. Bridges Home Assistant's live `hass` states, service calls, and central server storage
 *    (/config/.storage/realplan3d.floorplan_project) via both same-origin injection and postMessage.
 */

const PANEL_VERSION = '4.2.0';
const LIVE_STUDIO_FALLBACK_URL =
  'https://ais-pre-ndt4sayitgmxmao7f5sc3y-54898328272.europe-west2.run.app';

function isValidRealProject(proj) {
  if (!proj || !Array.isArray(proj.zones) || proj.zones.length === 0) return false;
  const ids = new Set(proj.zones.map((z) => z.id));
  const isOldStarterDummy =
    proj.zones.length === 4 &&
    ids.has('zone_living') &&
    ids.has('zone_kitchen') &&
    ids.has('zone_og_master') &&
    ids.has('zone_terrace') &&
    (!Array.isArray(proj.assets) || proj.assets.length === 0);
  return !isOldStarterDummy;
}

class RealPlan3DBaseElement extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._hass = null;
    this._config = {};
    this._initialized = false;
    this._studioReady = false;
    this._watchdogTimer = null;
    this._loadedFromStorage = false;
    this._project = null;
    this._boundOnMessage = this._onWindowMessage.bind(this);
  }

  connectedCallback() {
    window.addEventListener('message', this._boundOnMessage);
    if (!this._initialized) {
      this._boot();
    }
  }

  disconnectedCallback() {
    window.removeEventListener('message', this._boundOnMessage);
    if (this._watchdogTimer) {
      clearTimeout(this._watchdogTimer);
      this._watchdogTimer = null;
    }
  }

  setConfig(config) {
    this._config = config || {};
    if (!this._initialized) {
      this._boot();
    }
  }

  set hass(hass) {
    this._hass = hass;
    window.__REALPLAN_HASS__ = hass;
    if (!this._initialized) {
      this._boot();
    }
    this._loadProjectFromHAStorage();
    this._pushHassToIframe();
  }

  async _boot() {
    if (this._initialized) return;
    this._initialized = true;

    let targetUrl = LIVE_STUDIO_FALLBACK_URL;
    const localIndexUrl = `/realplan3d_static/app/index.html?v=${PANEL_VERSION}`;
    try {
      const resp = await fetch(localIndexUrl, {
        method: 'GET',
        cache: 'no-store',
      });
      if (resp.ok) {
        const text = await resp.text();
        if (text && text.includes('<div id="root">')) {
          // Verify that the referenced JS bundle inside index.html actually exists (prevents white page on partial HACS updates)
          const scriptMatch = text.match(/<script[^>]+src=["']([^"']+)["']/i);
          if (scriptMatch && scriptMatch[1]) {
            const rawSrc = scriptMatch[1].replace(/^\.\//, '');
            const scriptUrl = rawSrc.startsWith('/')
              ? `${rawSrc}?v=${PANEL_VERSION}`
              : `/realplan3d_static/app/${rawSrc}?v=${PANEL_VERSION}`;
            const scriptResp = await fetch(scriptUrl, {
              method: 'HEAD',
              cache: 'no-store',
            });
            if (scriptResp.ok) {
              targetUrl = localIndexUrl;
            }
          } else {
            targetUrl = localIndexUrl;
          }
        }
      }
    } catch (_err) {
      // Fallback to LIVE_STUDIO_FALLBACK_URL so the full 2D/3D Studio always loads
    }

    this._mountStudioIframe(targetUrl);
    this._loadProjectFromHAStorage();
  }

  _mountStudioIframe(appUrl) {
    if (!this.shadowRoot) return;
    const isPanel = this.tagName.toLowerCase() === 'realplan3d-panel';
    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
          width: 100%;
          height: ${isPanel ? '100dvh' : '720px'};
          background: #090d16;
          overflow: hidden;
          border: none;
          border-radius: ${isPanel ? '0px' : '16px'};
        }
        iframe {
          width: 100%;
          height: 100%;
          border: none;
          display: block;
          background: #090d16;
        }
      </style>
      <iframe
        id="studioFrame"
        src="${appUrl}"
        allow="fullscreen; clipboard-read; clipboard-write"
      ></iframe>
    `;
    const iframe = this.shadowRoot.getElementById('studioFrame');
    if (iframe) {
      iframe.addEventListener('load', () => {
        this._pushHassToIframe();
      });

      // Self-healing watchdog: if local bundle failed to mount React within 4.5s, fall back to live Studio URL
      if (appUrl !== LIVE_STUDIO_FALLBACK_URL) {
        if (this._watchdogTimer) clearTimeout(this._watchdogTimer);
        this._watchdogTimer = setTimeout(() => {
          if (this._studioReady) return;
          try {
            const doc = iframe.contentDocument;
            const rootEl = doc && doc.getElementById('root');
            if (!rootEl || rootEl.childElementCount === 0) {
              iframe.src = LIVE_STUDIO_FALLBACK_URL;
            }
          } catch (_e) {
            // Cross-origin frame already active
          }
        }, 4500);
      }
    }
  }

  _onWindowMessage(event) {
    const data = event && event.data;
    if (!data || typeof data !== 'object') return;

    if (data.type === 'REALPLAN_STUDIO_READY' || data.type === 'REALPLAN_GET_PROJECT') {
      this._studioReady = true;
      if (this._watchdogTimer) {
        clearTimeout(this._watchdogTimer);
        this._watchdogTimer = null;
      }
      this._pushHassToIframe(true);
    } else if (data.type === 'REALPLAN_CALL_SERVICE' && this._hass && this._hass.callService) {
      this._hass.callService(data.domain, data.service, data.serviceData || {});
    } else if (data.type === 'REALPLAN_SAVE_PROJECT' && data.project) {
      this._project = data.project;
      if (this._hass && this._hass.callWS) {
        this._hass
          .callWS({
            type: 'realplan3d/save_project',
            project: data.project,
          })
          .catch(() => {});
      }
    }
  }

  _pushHassToIframe(includeProject = false) {
    if (!this.shadowRoot) return;
    const iframe = this.shadowRoot.getElementById('studioFrame');
    if (!iframe || !iframe.contentWindow) return;

    try {
      if (this._hass) {
        iframe.contentWindow.__REALPLAN_HASS__ = this._hass;
        iframe.contentWindow.dispatchEvent(new CustomEvent('realplan3d-hass-update'));
      }
    } catch (_err) {
      // Cross-origin frame: postMessage below handles communication
    }

    try {
      iframe.contentWindow.postMessage(
        {
          type: 'REALPLAN_HASS_UPDATE',
          states: this._hass ? this._hass.states : undefined,
          project: includeProject && isValidRealProject(this._project) ? this._project : undefined,
        },
        '*'
      );
    } catch (_err) {
      // Ignore postMessage errors before iframe ready
    }
  }

  async _loadProjectFromHAStorage() {
    if (!this._hass || !this._hass.callWS || this._loadedFromStorage) return;
    this._loadedFromStorage = true;
    try {
      const res = await this._hass.callWS({ type: 'realplan3d/get_project' });
      if (res && isValidRealProject(res.project)) {
        this._project = res.project;
        this._pushHassToIframe(true);
      }
      if (this._hass.connection && this._hass.connection.subscribeEvents) {
        this._hass.connection.subscribeEvents((ev) => {
          if (ev && ev.data && isValidRealProject(ev.data.project)) {
            this._project = ev.data.project;
            const iframe = this.shadowRoot && this.shadowRoot.getElementById('studioFrame');
            if (iframe && iframe.contentWindow) {
              iframe.contentWindow.postMessage(
                { type: 'REALPLAN_PROJECT_UPDATED', project: this._project },
                '*'
              );
            }
          }
        }, 'realplan3d_project_updated');
      }
    } catch (_err) {
      // Ignore WS errors if custom_component backend not yet restarted
    }
  }

  getCardSize() {
    return 10;
  }
}

if (!customElements.get('realplan3d-card')) {
  customElements.define('realplan3d-card', class extends RealPlan3DBaseElement {});
}
if (!customElements.get('realplan3d-panel')) {
  customElements.define('realplan3d-panel', class extends RealPlan3DBaseElement {});
}

window.customCards = window.customCards || [];
window.customCards.push({
  type: 'realplan3d-card',
  name: 'RealPlan 3D — Full 2D/3D Floorplan Studio & Smart Home View',
  description: 'Vollständiges 2D/3D Grundriss-Studio & Live Smart-Home-Cockpit für Home Assistant.',
  preview: true,
});
