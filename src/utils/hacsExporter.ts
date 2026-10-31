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
      version: '4.5.0',
    },
    null,
    2
  );
}

export function generateInitPy(project: FloorplanProject): string {
  return `"""RealPlan 3D — Home Assistant Custom Integration, Server Storage & Sidebar Panel."""
from __future__ import annotations

import os
from typing import Any
import voluptuous as vol

from homeassistant.components import frontend, websocket_api
from homeassistant.components.http import StaticPathConfig
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from homeassistant.helpers.storage import Store

DOMAIN = "realplan3d"
PANEL_VERSION = "4.5.0"
PANEL_URL = f"/realplan3d_static/realplan3d-panel.js?v={PANEL_VERSION}"
STORAGE_VERSION = 1
STORAGE_KEY = "realplan3d.floorplan_project"


def _deduplicate_project_items(project_data: dict[str, Any] | None) -> dict[str, Any] | None:
    """Ensure zones, openings, assets, and customWalls have unique IDs in Home Assistant storage."""
    if not isinstance(project_data, dict):
        return project_data

    cleaned = dict(project_data)
    for key in ("zones", "openings", "assets", "customWalls"):
        items = cleaned.get(key)
        if isinstance(items, list):
            seen_ids: set[str] = set()
            unique_items = []
            for item in items:
                if not isinstance(item, dict):
                    continue
                item_id = item.get("id")
                if not item_id or item_id in seen_ids:
                    continue
                seen_ids.add(item_id)
                unique_items.append(item)
            cleaned[key] = unique_items
    return cleaned


@websocket_api.websocket_command(
    {
        vol.Required("type"): "realplan3d/get_project",
    }
)
@websocket_api.async_response
async def ws_get_project(
    hass: HomeAssistant,
    connection: websocket_api.ActiveConnection,
    msg: dict[str, Any],
) -> None:
    """Return the saved RealPlan 3D floorplan project from Home Assistant .storage."""
    store: Store | None = hass.data.get(DOMAIN, {}).get("store")
    saved_project = await store.async_load() if store else None
    cleaned_project = _deduplicate_project_items(saved_project)
    connection.send_result(msg["id"], {"project": cleaned_project})


@websocket_api.websocket_command(
    {
        vol.Required("type"): "realplan3d/save_project",
        vol.Required("project"): dict,
    }
)
@websocket_api.async_response
async def ws_save_project(
    hass: HomeAssistant,
    connection: websocket_api.ActiveConnection,
    msg: dict[str, Any],
) -> None:
    """Persist the RealPlan 3D floorplan project to Home Assistant .storage and notify all devices."""
    store: Store | None = hass.data.get(DOMAIN, {}).get("store")
    project_data = _deduplicate_project_items(msg["project"]) or {}

    if store is not None:
        existing = await store.async_load()
        existing_zones = existing.get("zones") if isinstance(existing, dict) else None
        new_zones = project_data.get("zones")
        if existing_zones and isinstance(new_zones, list) and len(new_zones) == 0:
            connection.send_result(msg["id"], {"saved": False, "reason": "ignored_empty_boot_state"})
            return
        await store.async_save(project_data)

    hass.bus.async_fire("realplan3d_project_updated", {"project": project_data})
    connection.send_result(msg["id"], {"saved": True})


async def async_setup(hass: HomeAssistant, config: dict) -> bool:
    """Set up the RealPlan 3D component and persistent .storage store."""
    hass.data.setdefault(DOMAIN, {})
    if "store" not in hass.data[DOMAIN]:
        hass.data[DOMAIN]["store"] = Store(hass, STORAGE_VERSION, STORAGE_KEY)
        websocket_api.async_register_command(hass, ws_get_project)
        websocket_api.async_register_command(hass, ws_save_project)
    return True


async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Set up RealPlan 3D from a config entry and register Sidebar Panel + Lovelace Card."""
    hass.data.setdefault(DOMAIN, {})
    if "store" not in hass.data[DOMAIN]:
        hass.data[DOMAIN]["store"] = Store(hass, STORAGE_VERSION, STORAGE_KEY)
        websocket_api.async_register_command(hass, ws_get_project)
        websocket_api.async_register_command(hass, ws_save_project)

    static_dir = os.path.join(os.path.dirname(__file__), "frontend")

    if not hass.data[DOMAIN].get("static_registered"):
        try:
            await hass.http.async_register_static_paths(
                [StaticPathConfig("/realplan3d_static", static_dir, cache_headers=False)]
            )
            hass.data[DOMAIN]["static_registered"] = True
        except Exception:
            pass

    try:
        frontend.add_extra_js_url(hass, PANEL_URL)
    except Exception:
        pass

    sidebar_title = entry.options.get(
        "sidebar_title", entry.data.get("sidebar_title", "${project.title || 'RealPlan 3D'}")
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
        update=True,
    )

    return True


async def async_unload_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Unload RealPlan 3D config entry and remove sidebar panel."""
    frontend.async_remove_panel(hass, "realplan3d")
    return True
`;
}

export function generateConfigFlowPy(_project: FloorplanProject): string {
  return `"""Config flow for RealPlan 3D Integration (Geräte & Dienste -> Integration hinzufügen)."""
from __future__ import annotations

from typing import Any
import voluptuous as vol

from homeassistant import config_entries
try:
    from homeassistant.config_entries import ConfigFlowResult as FlowResult
except ImportError:
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
 * Generated by RealPlan 3D Studio v4.5.0
 *
 * Mounts 100% of the complete RealPlan 3D / 2D Studio application directly inside Home Assistant
 * (Sidebar Panel & Lovelace Dashboard Card) and bridges Home Assistant's live \`hass\` states,
 * service calls, and central server storage (/config/.storage/realplan3d.floorplan_project).
 */

const PANEL_VERSION = '4.5.0';
const EMBEDDED_REALPLAN_PROJECT = ${serializedProject};
const LIVE_STUDIO_FALLBACK_URL = ${JSON.stringify(fallbackStudioUrl)};

function deduplicateProjectItems(proj) {
  if (!proj || typeof proj !== 'object') return proj;
  const copy = Object.assign({}, proj);
  for (const key of ['zones', 'openings', 'assets', 'customWalls']) {
    if (Array.isArray(copy[key])) {
      const seen = new Set();
      copy[key] = copy[key].filter((item) => {
        if (!item || !item.id || seen.has(item.id)) return false;
        seen.add(item.id);
        return true;
      });
    }
  }
  return copy;
}

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
      ? deduplicateProjectItems(JSON.parse(JSON.stringify(EMBEDDED_REALPLAN_PROJECT)))
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
    const tag = this.tagName.toLowerCase();
    const isPanel = tag === 'realplan3d-panel';
    const cfg = this._config || {};
    const displayMode = cfg.display_mode || (isPanel ? 'full_studio' : 'pure_live');
    const isPureLive = displayMode === 'pure_live' || cfg.pure_live === true;
    const hideHeader =
      cfg.show_top_header !== undefined
        ? !cfg.show_top_header
        : !isPanel && (isPureLive || displayMode === 'live_minimal');
    const hideDock =
      cfg.show_bottom_dock !== undefined
        ? !cfg.show_bottom_dock
        : !isPanel && isPureLive;
    const hideRoomList =
      cfg.show_room_directory !== undefined
        ? !cfg.show_room_directory
        : !isPanel && isPureLive;
    const cardHeight = cfg.card_height || cfg.height || (isPanel ? '100dvh' : '680px');

    const params = new URLSearchParams();
    params.set('v', PANEL_VERSION + '-' + Date.now());
    if (!isPanel || displayMode !== 'full_studio') {
      params.set('tab', 'live');
      params.set('displayMode', displayMode);
      params.set('hideHeader', hideHeader ? '1' : '0');
      params.set('hideDock', hideDock ? '1' : '0');
      params.set('hideRoomList', hideRoomList ? '1' : '0');
      if (cfg.default_floor !== undefined) params.set('floor', String(cfg.default_floor));
      if (cfg.visual_style) params.set('style', String(cfg.visual_style));
      if (cfg.room_id) params.set('room', String(cfg.room_id));
    }

    const sep = appUrl.includes('?') ? '&' : '?';
    const queryParams = \`\${sep}\${params.toString()}\`;

    this.shadowRoot.innerHTML = \`
      <style>
        :host {
          display: block;
          width: 100%;
          height: \${isPanel ? '100dvh' : cardHeight};
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
        src="\${appUrl}\${queryParams}"
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
      const cleaned = deduplicateProjectItems(data.project);
      if (!isValidRealProject(cleaned)) return;
      this._project = cleaned;
      if (this._hass && this._hass.callWS) {
        this._hass
          .callWS({
            type: 'realplan3d/save_project',
            project: cleaned,
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
          config: this._config || undefined,
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
        this._project = deduplicateProjectItems(res.project);
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
            this._project = deduplicateProjectItems(ev.data.project);
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

for (const tag of [
  'realplan3d-panel',
  'realplan3d-card',
  'realplan3d-room-card',
  'realplan3d-energy-card',
  'realplan3d-camera-card',
]) {
  if (!customElements.get(tag)) {
    customElements.define(tag, class extends RealPlan3DBaseElement {});
  }
}

window.customCards = window.customCards || [];
if (!window.customCards.some((c) => c.type === 'realplan3d-card')) {
  window.customCards.push(
    {
      type: 'realplan3d-card',
      name: 'RealPlan 3D — Full 2D/3D Floorplan Studio & Smart Home View',
      description: 'Vollständiges 2D/3D Grundriss-Studio & Live Smart-Home-Cockpit für Home Assistant.',
      preview: true,
    },
    {
      type: 'realplan3d-room-card',
      name: 'RealPlan 3D — Raum-Status-Card (3D Fokus)',
      description: 'Fokussierte 3D-Raumkarte für Lovelace Dashboards.',
      preview: true,
    },
    {
      type: 'realplan3d-energy-card',
      name: 'RealPlan 3D — Energie-Pro-Card & 3D-Stromfluss',
      description: '3D-Visualisierung von PV, Speicher, Wallbox und Hausverbrauch.',
      preview: true,
    },
    {
      type: 'realplan3d-camera-card',
      name: 'RealPlan 3D — Kamera-Cockpit-Card mit 3D-Sichtkegel',
      description: '3D-Außenkameras und Bewegungssensoren mit Sichtkegeln.',
      preview: true,
    }
  );
}
`;
}

