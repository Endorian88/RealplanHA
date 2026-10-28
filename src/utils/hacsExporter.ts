import { FloorplanProject } from '../types/floorplan';

export function generateLovelaceYaml(project: FloorplanProject): string {
  const boundEntities = Array.from(
    new Set(
      [
        ...project.assets.map((a) => a.entityId),
        ...project.openings.map((o) => o.entityId),
        ...project.openings.map((o) => o.tiltEntityId),
        ...project.openings.map((o) => o.shutterEntityId),
        ...project.zones.map((z) => z.climateEntityId),
      ].filter(Boolean)
    )
  );

  return `type: custom:realplan3d-card
title: "${project.title}"
render_engine: ue5_pbr_archviz
default_floor: 0
enable_multi_floor_stack: true
dual_sensor_window_tilt: true
day_night_cycle: auto_sun
enable_shadows: true
outdoor_grounds: true
entities:
${boundEntities.map((id) => `  - entity: ${id}`).join('\n')}
zones_count: ${project.zones.length}
assets_count: ${project.assets.length}`;
}

export function generateHacsJson(): string {
  return JSON.stringify(
    {
      name: 'RealPlan 3D — Home Assistant 3D Studio, Sidebar Panel & Card',
      content_in_root: false,
      render_readme: true,
      homeassistant: '2024.10.0',
    },
    null,
    2
  );
}

export function parseGitHubRepoSlug(input: string): {
  owner: string;
  repo: string;
  cleanUrl: string;
  myHaHacsUrl: string;
} {
  const trimmed = input
    .trim()
    .replace(/^https?:\/\/(www\.)?github\.com\//i, '')
    .replace(/\.git$/i, '')
    .replace(/^\/+|\/+$/g, '');
  const parts = trimmed.split('/').filter(Boolean);
  const owner = parts[0] || 'Endorian88';
  const repo = parts[1] || 'RealplanHA';
  const cleanUrl = `https://github.com/${owner}/${repo}`;
  const myHaHacsUrl = `https://my.home-assistant.io/redirect/hacs_repository/?owner=${encodeURIComponent(
    owner
  )}&repository=${encodeURIComponent(repo)}&category=integration`;
  return { owner, repo, cleanUrl, myHaHacsUrl };
}

export function generateManifestJson(githubRepoInput = 'Endorian88/RealplanHA'): string {
  const { owner, cleanUrl } = parseGitHubRepoSlug(githubRepoInput);
  return JSON.stringify(
    {
      domain: 'realplan3d',
      name: 'RealPlan 3D — ArchViz 3D Floorplan Studio & Sidebar',
      codeowners: [`@${owner}`],
      config_flow: true,
      dependencies: ['frontend', 'http', 'panel_custom', 'websocket_api'],
      documentation: cleanUrl,
      iot_class: 'local_push',
      issue_tracker: `${cleanUrl}/issues`,
      requirements: [],
      version: '4.3.0',
    },
    null,
    2
  );
}

export function generateInitPy(project: FloorplanProject): string {
  return `"""RealPlan 3D — Home Assistant Custom Integration & Sidebar Panel."""
from __future__ import annotations

import os
from homeassistant.components import frontend
from homeassistant.components.http import StaticPathConfig
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant

DOMAIN = "realplan3d"
PANEL_URL = "/realplan3d_static/realplan3d-panel.js"



async def async_setup(hass: HomeAssistant, config: dict) -> bool:
    """Set up the RealPlan 3D component."""
    hass.data.setdefault(DOMAIN, {})
    return True


async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Set up RealPlan 3D from a config entry and register Sidebar Panel + Lovelace Card."""
    static_dir = os.path.join(os.path.dirname(__file__), "frontend")

    await hass.http.async_register_static_paths(
        [StaticPathConfig("/realplan3d_static", static_dir, cache_headers=False)]
    )

    sidebar_title = entry.options.get(
        "sidebar_title", entry.data.get("sidebar_title", "${project.title}")
    )
    sidebar_icon = entry.options.get(
        "sidebar_icon", entry.data.get("sidebar_icon", "mdi:floor-plan")
    )

    frontend.async_register_built_in_panel(
        hass,
        component_name="custom",
        sidebar_title=sidebar_title,
        sidebar_icon=sidebar_icon,
        frontend_url_path="realplan3d",
        config={
            "_panel_custom": {
                "name": "realplan3d-panel",
                "module_url": PANEL_URL,
                "embed_iframe": False,
            }
        },
        require_admin=False,
    )

    return True


async def async_unload_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Unload RealPlan 3D config entry and remove sidebar panel."""
    frontend.async_remove_panel(hass, "realplan3d")
    return True
`;
}

export function generateConfigFlowPy(project: FloorplanProject): string {
  return `"""Config flow for RealPlan 3D Integration (Geräte & Dienste -> Integration hinzufügen)."""
from __future__ import annotations

from typing import Any
import voluptuous as vol

from homeassistant import config_entries
from homeassistant.data_entry_flow import FlowResult

DOMAIN = "realplan3d"


class RealPlan3DConfigFlow(config_entries.ConfigFlow, domain=DOMAIN):
    """Handle a config flow for RealPlan 3D."""

    VERSION = 1

    async def async_step_user(
        self, user_input: dict[str, Any] | None = None
    ) -> FlowResult:
        """Handle the initial step when user adds RealPlan 3D via Integrations UI."""
        if self._async_current_entries():
            return self.async_abort(reason="single_instance_allowed")

        if user_input is not None:
            return self.async_create_entry(
                title=user_input.get("sidebar_title", "RealPlan 3D"),
                data=user_input,
            )

        schema = vol.Schema(
            {
                vol.Optional("sidebar_title", default="RealPlan 3D"): str,
                vol.Optional("sidebar_icon", default="mdi:floor-plan"): str,
                vol.Optional("default_floor", default="0"): vol.In(
                    {"-1": "Keller (KG)", "0": "Erdgeschoss (EG)", "1": "1. OG", "2": "Dachgeschoss (DG)", "all_stacked": "Alle Etagen (3D-Stapel)"}
                ),
            }
        )

        return self.async_show_form(step_id="user", data_schema=schema)
`;
}

export function generateTranslationsDeJson(): string {
  return JSON.stringify(
    {
      config: {
        step: {
          user: {
            title: 'RealPlan 3D — Seitenleisten-Panel & 3D-Integration einrichten',
            description:
              'Fügt RealPlan 3D direkt in deine Home Assistant Seitenleiste ein und registriert die Lovelace-Card (custom:realplan3d-card).',
            data: {
              sidebar_title: 'Name in der Home Assistant Seitenleiste',
              sidebar_icon: 'Icon in der Seitenleiste (z. B. mdi:floor-plan)',
              default_floor: 'Standard-Stockwerk beim Start',
            },
          },
        },
        abort: {
          single_instance_allowed: 'RealPlan 3D ist bereits eingerichtet.',
        },
      },
    },
    null,
    2
  );
}

export function generateCustomCardBundleJs(project: FloorplanProject): string {
  const serializedProject = JSON.stringify(project, null, 2);
  const fallbackStudioUrl =
    typeof window !== 'undefined' && window.location?.origin
      ? window.location.origin
      : 'https://ais-pre-ndt4sayitgmxmao7f5sc3y-54898328272.europe-west2.run.app';

  return `/**
 * RealPlan 3D — Home Assistant Sidebar Panel (<realplan3d-panel>) & Lovelace Card (<realplan3d-card>)
 * Generated by RealPlan 3D Studio v${project.version}
 *
 * Mounts 100% of the complete RealPlan 3D / 2D Studio application directly inside Home Assistant
 * (Sidebar Panel & Lovelace Dashboard Card) and bridges Home Assistant's live \`hass\` states,
 * service calls, and central server storage (/config/.storage/realplan3d.floorplan_project).
 */

const EMBEDDED_REALPLAN_PROJECT = ${serializedProject};
const LIVE_STUDIO_FALLBACK_URL = ${JSON.stringify(fallbackStudioUrl)};

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
    this._loadedFromStorage = false;
    this._project = isValidRealProject(EMBEDDED_REALPLAN_PROJECT)
      ? JSON.parse(JSON.stringify(EMBEDDED_REALPLAN_PROJECT))
      : null;
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
    try {
      const resp = await fetch('/realplan3d_static/app/index.html', {
        method: 'GET',
        cache: 'no-store',
      });
      if (resp.ok) {
        const text = await resp.text();
        if (text && text.includes('<div id="root">')) {
          targetUrl = '/realplan3d_static/app/index.html';
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
    this.shadowRoot.innerHTML = \`
      <style>
        :host {
          display: block;
          width: 100%;
          height: \${isPanel ? '100dvh' : '720px'};
          background: #090d16;
          overflow: hidden;
          border: none;
          border-radius: \${isPanel ? '0px' : '16px'};
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
        src="\${appUrl}"
        allow="fullscreen; clipboard-read; clipboard-write"
      ></iframe>
    \`;
    const iframe = this.shadowRoot.getElementById('studioFrame');
    if (iframe) {
      iframe.addEventListener('load', () => {
        this._pushHassToIframe();
      });
    }
  }

  _onWindowMessage(event) {
    const data = event && event.data;
    if (!data || typeof data !== 'object') return;

    if (data.type === 'REALPLAN_STUDIO_READY' || data.type === 'REALPLAN_GET_PROJECT') {
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
      } else if (isValidRealProject(this._project)) {
        await this._hass.callWS({
          type: 'realplan3d/save_project',
          project: this._project,
        });
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
`;
}

