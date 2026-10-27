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
  const owner = parts[0] || 'thimobannuscher';
  const repo = parts[1] || 'realplan3d';
  const cleanUrl = `https://github.com/${owner}/${repo}`;
  const myHaHacsUrl = `https://my.home-assistant.io/redirect/hacs_repository/?owner=${encodeURIComponent(
    owner
  )}&repository=${encodeURIComponent(repo)}&category=integration`;
  return { owner, repo, cleanUrl, myHaHacsUrl };
}

export function generateManifestJson(githubRepoInput = 'thimobannuscher/realplan3d'): string {
  const { owner, cleanUrl } = parseGitHubRepoSlug(githubRepoInput);
  return JSON.stringify(
    {
      domain: 'realplan3d',
      name: 'RealPlan 3D — ArchViz 3D Floorplan Studio & Sidebar',
      version: '4.0.0',
      config_flow: true,
      documentation: cleanUrl,
      issue_tracker: `${cleanUrl}/issues`,
      dependencies: ['frontend', 'http', 'panel_custom', 'websocket_api'],
      codeowners: [`@${owner}`],
      iot_class: 'local_push',
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

  return `/**
 * RealPlan 3D — Home Assistant Sidebar Panel (<realplan3d-panel>) & Lovelace Card (<realplan3d-card>)
 * Generated by RealPlan 3D Studio v${project.version}
 *
 * Features:
 * - Central Home Assistant Server Storage (/config/.storage/realplan3d.floorplan_project)
 *   synced across Smartphone, Tablet, and Desktop via WebSocket (realplan3d/get_project & realplan3d/save_project)
 * - Embedded Fallback Project (REALPLAN_PROJECT) exported directly from the 2D/3D Studio
 * - Multi-Floor Switcher (KG, EG, 1. OG, DG, Alle 3D) with automatic roof hide on 1. OG
 * - 30 cm Raised Basement Plinth (Kellersockel), Exterior Entrance Steps, Roofs, Dormers, Skylights & Chimneys
 * - Curved Staircases (1/4-wendel), Under-Stair Storage Walls, Electric Sliding Gate & Trees
 */

const EMBEDDED_REALPLAN_PROJECT = ${serializedProject};

function resolveDualSensorWindow(opening, states) {
  if (!opening.entityId || !states) return 'closed';
  const s1 = states[opening.entityId];
  const a1 = s1 && (s1.state === 'on' || s1.state === 'open');
  if (opening.sensorLogicMode === 'dual_tilt_open' && opening.tiltEntityId) {
    const s2 = states[opening.tiltEntityId];
    const a2 = s2 && (s2.state === 'on' || s2.state === 'open');
    if (a1 && a2) return 'open';
    if (a1 || a2) return 'tilted';
    return 'closed';
  }
  return a1 ? 'open' : 'closed';
}

class RealPlan3DBaseElement extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._hass = null;
    this._config = {};
    this._activeFloor = 0;
    this._initialized = false;
    this._loadedFromStorage = false;
    this._project = JSON.parse(JSON.stringify(EMBEDDED_REALPLAN_PROJECT));
  }

  setConfig(config) {
    this._config = config || {};
    if (config && config.default_floor !== undefined) {
      this._activeFloor = config.default_floor;
    }
    this._renderShell();
  }

  set hass(hass) {
    this._hass = hass;
    if (!this._initialized) {
      this._renderShell();
      this._initThreeScene();
      this._loadProjectFromHAStorage();
      this._initialized = true;
    }
    this._syncEntityStates();
  }

  async _loadProjectFromHAStorage() {
    if (!this._hass || !this._hass.callWS || this._loadedFromStorage) return;
    this._loadedFromStorage = true;
    try {
      const res = await this._hass.callWS({ type: 'realplan3d/get_project' });
      if (res && res.project && Array.isArray(res.project.zones)) {
        this._project = res.project;
        this._rebuildFloorGeometry();
      } else {
        // Seed initial embedded project into Home Assistant .storage on first run
        await this._hass.callWS({
          type: 'realplan3d/save_project',
          project: this._project,
        });
      }
      if (this._hass.connection && this._hass.connection.subscribeEvents) {
        this._hass.connection.subscribeEvents((ev) => {
          if (ev && ev.data && ev.data.project && Array.isArray(ev.data.project.zones)) {
            this._project = ev.data.project;
            this._rebuildFloorGeometry();
          }
        }, 'realplan3d_project_updated');
      }
    } catch (_err) {
      // Fallback to embedded project if custom_component WS is not active
    }
  }

  _renderShell() {
    if (!this.shadowRoot) return;
    const isPanel = this.tagName.toLowerCase() === 'realplan3d-panel';
    this.shadowRoot.innerHTML = \`
      <style>
        :host {
          display: block;
          background: #090d16;
          color: #f8fafc;
          font-family: system-ui, -apple-system, sans-serif;
          position: relative;
          width: 100%;
          height: \${isPanel ? '100dvh' : '620px'};
          border-radius: \${isPanel ? '0px' : '16px'};
          overflow: hidden;
          border: \${isPanel ? 'none' : '1px solid rgba(255,255,255,0.08)'};
          touch-action: none;
        }
        .topbar {
          position: absolute;
          top: 12px;
          left: 12px;
          right: 12px;
          z-index: 10;
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
          pointer-events: none;
        }
        .badge {
          pointer-events: auto;
          background: rgba(15, 23, 42, 0.92);
          padding: 7px 12px;
          border-radius: 10px;
          border: 1px solid rgba(255,255,255,0.12);
          font-size: 12px;
          font-weight: 700;
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .floors {
          pointer-events: auto;
          display: flex;
          gap: 4px;
          background: rgba(15, 23, 42, 0.92);
          padding: 4px;
          border-radius: 10px;
          border: 1px solid rgba(255,255,255,0.12);
          overflow-x: auto;
        }
        .floor-btn {
          background: transparent;
          color: #cbd5e1;
          border: none;
          padding: 6px 10px;
          border-radius: 6px;
          font-size: 11px;
          font-weight: 600;
          cursor: pointer;
          white-space: nowrap;
        }
        .floor-btn.active {
          background: #f59e0b;
          color: #090d16;
        }
        .viewport {
          width: 100%;
          height: 100%;
        }
      </style>
      <div class="topbar">
        <div class="badge">
          <span>\${this._config.title || this._project.title}</span>
        </div>
        <div class="floors" id="floorBar">
          <button class="floor-btn" data-floor="-1">KG</button>
          <button class="floor-btn active" data-floor="0">EG</button>
          <button class="floor-btn" data-floor="1">1. OG</button>
          <button class="floor-btn" data-floor="2">DG</button>
          <button class="floor-btn" data-floor="all_stacked">Alle 3D</button>
        </div>
      </div>
      <div class="viewport" id="viewport"></div>
    \`;

    const btns = this.shadowRoot.querySelectorAll('.floor-btn');
    btns.forEach((b) => {
      b.addEventListener('click', () => {
        btns.forEach((x) => x.classList.remove('active'));
        b.classList.add('active');
        const val = b.getAttribute('data-floor');
        this._activeFloor = val === 'all_stacked' ? 'all_stacked' : Number(val);
        this._rebuildFloorGeometry();
      });
    });
  }

  async _initThreeScene() {
    const viewport = this.shadowRoot.getElementById('viewport');
    if (!viewport) return;
    const THREE = await import('https://unpkg.com/three@0.170.0/build/three.module.js');
    this._THREE = THREE;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0b101b);
    const camera = new THREE.PerspectiveCamera(
      42,
      Math.max(1, viewport.clientWidth) / Math.max(1, viewport.clientHeight),
      0.2,
      160
    );
    camera.position.set(-12, 13.5, 16);
    camera.lookAt(0, 0.8, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.88;
    renderer.setSize(viewport.clientWidth, viewport.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.shadowMap.enabled = true;
    viewport.appendChild(renderer.domElement);

    const hemi = new THREE.HemisphereLight(0xe0f2fe, 0x1e293b, 0.6);
    const sun = new THREE.DirectionalLight(0xfffbeb, 1.35);
    sun.position.set(14, 22, 14);
    sun.castShadow = true;
    scene.add(hemi, sun);

    this._rootGroup = new THREE.Group();
    scene.add(this._rootGroup);

    this._scene = scene;
    this._camera = camera;
    this._renderer = renderer;

    window.addEventListener('resize', () => {
      if (!viewport.clientWidth || !viewport.clientHeight) return;
      camera.aspect = viewport.clientWidth / viewport.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(viewport.clientWidth, viewport.clientHeight);
      this._renderFrame();
    });

    this._rebuildFloorGeometry();
  }

  _rebuildFloorGeometry() {
    if (!this._THREE || !this._rootGroup) return;
    const THREE = this._THREE;
    this._rootGroup.clear();
    this._entityLights = new Map();
    this._windowPivots = new Map();

    const FLOOR_H = 2.75;
    const proj = this._project || EMBEDDED_REALPLAN_PROJECT;

    // 30cm Basement Plinth Support (Kellersockel)
    const hasRaisedPlinth = proj.zones.some(
      (z) => z.zoneType === 'indoor' && (z.level || 0) === 0 && (z.groundPlinthHeight || 0) > 0.02
    );
    const plinthOffset = hasRaisedPlinth ? 0.3 : 0;

    const getFloorY = (lvl) => {
      if (lvl === -1) return -FLOOR_H + plinthOffset;
      return lvl * FLOOR_H + (lvl >= 0 ? plinthOffset : 0);
    };

    for (const z of proj.zones) {
      const zLvl = z.level || 0;
      if (this._activeFloor !== 'all_stacked' && zLvl > this._activeFloor && z.zoneType === 'indoor') {
        continue;
      }
      const yOff = getFloorY(zLvl);
      const isContext = this._activeFloor !== 'all_stacked' && zLvl !== this._activeFloor;
      const floorGeo = new THREE.BoxGeometry(z.width, 0.14, z.depth);
      const floorMat = new THREE.MeshStandardMaterial({
        color: z.zoneType === 'outdoor' ? 0x3b6e38 : 0xa67546,
        roughness: 0.45,
        transparent: isContext,
        opacity: isContext ? 0.45 : 1,
      });
      const floor = new THREE.Mesh(floorGeo, floorMat);
      floor.position.set(z.x, z.zoneType === 'outdoor' ? 0.02 : yOff - 0.06, z.z);
      floor.rotation.y = -(z.rotationY || 0);
      floor.receiveShadow = true;
      this._rootGroup.add(floor);
    }

    for (const op of proj.openings) {
      const oLvl = op.level || 0;
      if (this._activeFloor !== 'all_stacked' && oLvl > this._activeFloor) continue;
      const yOff = getFloorY(oLvl);
      const pivot = new THREE.Group();
      pivot.position.set(op.x, yOff + op.sillHeight, op.z);
      pivot.rotation.y = op.rotationY;
      const pane = new THREE.Mesh(
        new THREE.BoxGeometry(op.width, op.height, 0.06),
        new THREE.MeshStandardMaterial({ color: 0x93c5fd, transparent: true, opacity: 0.45 })
      );
      pane.position.y = op.height / 2;
      pivot.add(pane);
      this._rootGroup.add(pivot);
      this._windowPivots.set(op.id, { opening: op, pivot });
    }

    for (const asset of proj.assets) {
      const aLvl = asset.level || 0;
      if (this._activeFloor !== 'all_stacked' && aLvl > this._activeFloor) continue;
      const yOff = asset.category === 'outdoor' ? 0 : getFloorY(aLvl);
      const mat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.35 });
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.45, 0.45), mat);
      mesh.position.set(asset.position[0], yOff + asset.position[1] + 0.22, asset.position[2]);
      mesh.rotation.y = asset.rotationY || 0;
      this._rootGroup.add(mesh);

      if (asset.entityId && asset.entityId.startsWith('light.')) {
        const pt = new THREE.PointLight(0xffd699, 1.4, 7.5);
        pt.position.set(asset.position[0], yOff + asset.position[1], asset.position[2]);
        this._rootGroup.add(pt);
        this._entityLights.set(asset.entityId, pt);
      }
    }

    this._syncEntityStates();
  }

  _syncEntityStates() {
    if (!this._hass) return;
    if (this._entityLights) {
      for (const [entityId, light] of this._entityLights.entries()) {
        const st = this._hass.states[entityId];
        if (st) {
          light.intensity = st.state === 'on' ? 1.8 : 0.0;
        }
      }
    }
    if (this._windowPivots) {
      for (const { opening, pivot } of this._windowPivots.values()) {
        const st = resolveDualSensorWindow(opening, this._hass.states);
        pivot.rotation.x = st === 'tilted' ? 0.25 : 0;
      }
    }
    this._renderFrame();
  }

  _renderFrame() {
    if (this._renderer && this._scene && this._camera) {
      this._renderer.render(this._scene, this._camera);
    }
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

window.customCards = window.customCards || [];
window.customCards.push({
  type: 'realplan3d-card',
  name: 'RealPlan 3D — Multi-Floor & 2-Sensor ArchViz Floorplan',
  description: 'Photorealistic PBR 3D floorplan with Home Assistant .storage persistence, KG/EG/OG/DG floors, 2-sensor window logic, and room-filling lights.',
  preview: true,
});
`;
}

