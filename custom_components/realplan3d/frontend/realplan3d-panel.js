/**
 * RealPlan 3D — Home Assistant Sidebar Panel (<realplan3d-panel>) & Lovelace Card (<realplan3d-card>)
 * Registered automatically by custom_components/realplan3d/__init__.py
 */
class RealPlan3DBaseElement extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._hass = null;
    this._config = {};
  }

  setConfig(config) {
    this._config = config || {};
    this._render();
  }

  set hass(hass) {
    this._hass = hass;
    if (!this._rendered) {
      this._render();
      this._rendered = true;
    }
  }

  _render() {
    if (!this.shadowRoot) return;
    const isPanel = this.tagName.toLowerCase() === 'realplan3d-panel';
    const title = this._config.title || 'RealPlan 3D';
    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
          width: 100%;
          height: ${isPanel ? '100vh' : '640px'};
          background: #090d16;
          color: #f8fafc;
          font-family: system-ui, -apple-system, sans-serif;
          overflow: hidden;
        }
        .header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 12px 18px;
          background: #0f172a;
          border-bottom: 1px solid rgba(255,255,255,0.1);
          font-size: 14px;
          font-weight: 700;
        }
        .hint {
          padding: 24px;
          font-size: 13px;
          color: #94a3b8;
          line-height: 1.6;
        }
        code {
          color: #38bdf8;
          font-family: monospace;
        }
      </style>
      <div class="header">
        <span>${title}</span>
        <span style="color:#f59e0b;font-size:12px;">HACS Custom Integration aktiv</span>
      </div>
      <div class="hint">
        Ersetze diese Datei (<code>custom_components/realplan3d/frontend/realplan3d-panel.js</code>) durch die im <strong>RealPlan 3D Studio</strong> unter <em>HACS Integration → realplan3d-panel.js</em> exportierte Datei, um deinen individuell konfigurierten 3D-Grundriss anzuzeigen.
      </div>
    `;
  }

  getCardSize() {
    return 8;
  }
}

if (!customElements.get('realplan3d-card')) {
  customElements.define('realplan3d-card', class extends RealPlan3DBaseElement {});
}
if (!customElements.get('realplan3d-panel')) {
  customElements.define('realplan3d-panel', class extends RealPlan3DBaseElement {});
}
