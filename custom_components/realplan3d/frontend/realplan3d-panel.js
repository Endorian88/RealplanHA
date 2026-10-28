/**
 * RealPlan 3D — Home Assistant Sidebar Panel (<realplan3d-panel>) & Lovelace Card (<realplan3d-card>)
 * Registered automatically by custom_components/realplan3d/__init__.py
 *
 * Mounts 100% of the local RealPlan 3D / 2D Studio application directly inside Home Assistant:
 * 1. Always loads the local compiled Studio bundle (/realplan3d_static/app/index.html) from
 *    custom_components/realplan3d/frontend/app/ — never redirects to external cloud URLs.
 * 2. Bridges Home Assistant's live `hass` states, service calls, and central server storage
 *    (/config/.storage/realplan3d.floorplan_project) via both same-origin injection and postMessage.
 */

const PANEL_VERSION = '4.3.0';

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

  _boot(forceCacheBust = false) {
    if (this._initialized && !forceCacheBust) return;
    this._initialized = true;
    this._studioReady = false;

    const versionTag = forceCacheBust
      ? `${PANEL_VERSION}-${Date.now()}`
      : PANEL_VERSION;
    const localIndexUrl = `/realplan3d_static/app/index.html?v=${versionTag}`;

    this._mountStudioIframe(localIndexUrl);
    this._loadProjectFromHAStorage();
  }

  _mountStudioIframe(appUrl) {
    if (!this.shadowRoot) return;
    const isPanel = this.tagName.toLowerCase() === 'realplan3d-panel';
    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
          position: relative;
          width: 100%;
          height: ${isPanel ? '100dvh' : '720px'};
          background: #090d16;
          color: #f1f5f9;
          overflow: hidden;
          border: none;
          border-radius: ${isPanel ? '0px' : '16px'};
          font-family: system-ui, -apple-system, sans-serif;
        }
        iframe {
          width: 100%;
          height: 100%;
          border: none;
          display: block;
          background: #090d16;
        }
        .recovery-banner {
          display: none;
          position: absolute;
          inset: 0;
          background: #090d16;
          color: #f1f5f9;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 24px;
          text-align: center;
          z-index: 20;
        }
        .recovery-banner.visible {
          display: flex;
        }
        .recovery-card {
          max-width: 460px;
          background: rgba(15, 23, 42, 0.92);
          border: 1px solid rgba(148, 163, 184, 0.2);
          border-radius: 16px;
          padding: 24px;
          box-shadow: 0 20px 50px rgba(0, 0, 0, 0.5);
        }
        .recovery-title {
          font-size: 16px;
          font-weight: 700;
          margin: 0 0 8px 0;
          color: #f8fafc;
        }
        .recovery-desc {
          font-size: 13px;
          line-height: 1.5;
          color: #94a3b8;
          margin: 0 0 18px 0;
        }
        .recovery-btn {
          background: #f59e0b;
          color: #090d16;
          border: none;
          border-radius: 10px;
          padding: 10px 18px;
          font-size: 13px;
          font-weight: 700;
          cursor: pointer;
        }
        .recovery-btn:hover {
          background: #fbbf24;
        }
      </style>
      <iframe
        id="studioFrame"
        src="${appUrl}"
        allow="fullscreen; clipboard-read; clipboard-write"
      ></iframe>
      <div id="recoveryBanner" class="recovery-banner">
        <div class="recovery-card">
          <div class="recovery-title">RealPlan 3D wird aktualisiert…</div>
          <p id="recoveryDesc" class="recovery-desc">
            Dein Grundriss und alle Räume sind sicher in Home Assistant gespeichert.
            Falls nach einem HACS-Update noch alte Dateien im Browser-Cache liegen, lade das Panel hier frisch:
          </p>
          <button id="reloadStudioBtn" class="recovery-btn" type="button">
            Browser-Cache umgehen &amp; Studio neu laden
          </button>
        </div>
      </div>
    `;

    const iframe = this.shadowRoot.getElementById('studioFrame');
    const recoveryBanner = this.shadowRoot.getElementById('recoveryBanner');
    const recoveryDesc = this.shadowRoot.getElementById('recoveryDesc');
    const reloadBtn = this.shadowRoot.getElementById('reloadStudioBtn');

    if (reloadBtn) {
      reloadBtn.addEventListener('click', () => {
        if (recoveryBanner) recoveryBanner.classList.remove('visible');
        this._boot(true);
      });
    }

    if (iframe) {
      iframe.addEventListener('load', () => {
        this._pushHassToIframe();
      });

      if (this._watchdogTimer) clearTimeout(this._watchdogTimer);
      this._watchdogTimer = setTimeout(async () => {
        if (this._studioReady) return;
        try {
          const doc = iframe.contentDocument;
          const rootEl = doc && doc.getElementById('root');
          if (rootEl && rootEl.childElementCount > 0) {
            this._studioReady = true;
            return;
          }
          const checkRes = await fetch(`/realplan3d_static/app/assets/realplan3d.js?v=${Date.now()}`, {
            method: 'HEAD',
            cache: 'no-store',
          });
          if (!checkRes.ok && recoveryDesc) {
            recoveryDesc.textContent =
              'Hinweis: Die Bundle-Datei realplan3d.js wurde noch nicht vom Server geladen (Status ' +
              checkRes.status +
              '). Bitte führe in HACS "Erneut herunterladen" auf Version 4.2.2 aus und starte Home Assistant einmal neu.';
          }
          if (recoveryBanner) recoveryBanner.classList.add('visible');
        } catch (_e) {
          // Ignore inspection errors
        }
      }, 7500);
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
      if (this.shadowRoot) {
        const recoveryBanner = this.shadowRoot.getElementById('recoveryBanner');
        if (recoveryBanner) recoveryBanner.classList.remove('visible');
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
