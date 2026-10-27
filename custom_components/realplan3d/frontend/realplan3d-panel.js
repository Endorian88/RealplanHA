/**
 * RealPlan 3D — Home Assistant Sidebar Panel (<realplan3d-panel>) & Lovelace Card (<realplan3d-card>)
 * Registered automatically by custom_components/realplan3d/__init__.py
 *
 * Ready-to-start out of the box:
 * 1. Automatically boots the full RealPlan 3D Studio (/realplan3d_static/app/index.html) when available
 *    and bridges Home Assistant's live `hass` object (states, services, and .storage persistence).
 * 2. Includes a complete standalone 3D/2D Interactive Studio fallback directly inside this file
 *    so even a single-file installation starts immediately with 3D rendering, floor switching,
 *    room creation, and Home Assistant .storage saving — without ever asking to replace files.
 */

const DEFAULT_STARTER_PROJECT = {
  title: 'Mein Smart Home 3D-Grundriss',
  version: '4.0.0',
  zones: [
    {
      id: 'zone_living',
      name: 'Wohn- & Essbereich',
      zoneType: 'indoor',
      level: 0,
      buildingId: 'main_house',
      rotationY: 0,
      x: -1.8,
      z: 0.6,
      width: 6.4,
      depth: 5.2,
      wallHeight: 2.65,
      surfaceMaterial: 'oak_parquet',
      wallColor: '#e4e0d8',
      groundPlinthHeight: 0.3,
      roofConfig: {
        type: 'gable',
        pitchDeg: 35,
        overhang: 0.45,
        gableOverhang: 0.35,
        material: 'anthracite_tile',
        ridgeDirection: 'x',
        dormerType: 'shed',
        dormerWidth: 2.8,
        dormerHeight: 1.45,
      },
    },
    {
      id: 'zone_kitchen',
      name: 'Küche & Flur (EG)',
      zoneType: 'indoor',
      level: 0,
      buildingId: 'main_house',
      rotationY: 0,
      x: 3.4,
      z: 0.6,
      width: 4.0,
      depth: 5.2,
      wallHeight: 2.65,
      surfaceMaterial: 'travertine_stone',
      wallColor: '#e2e8f0',
      groundPlinthHeight: 0.3,
    },
    {
      id: 'zone_og_master',
      name: '1. OG Schlafzimmer & Bad',
      zoneType: 'indoor',
      level: 1,
      buildingId: 'main_house',
      inRoofSpace: true,
      kneeWallHeight: 1.1,
      rotationY: 0,
      x: 0.8,
      z: 0.6,
      width: 9.2,
      depth: 5.0,
      wallHeight: 2.5,
      surfaceMaterial: 'oak_parquet',
      wallColor: '#f1f5f9',
    },
    {
      id: 'zone_terrace',
      name: 'Sonnenterrasse & Garten',
      zoneType: 'outdoor',
      level: 0,
      x: 0.8,
      z: 5.8,
      width: 11.5,
      depth: 5.2,
      wallHeight: 0.12,
      surfaceMaterial: 'wood_deck',
      wallColor: '#7c5333',
      layerOrder: 1,
    },
  ],
  openings: [
    {
      id: 'open_main_door',
      name: 'Haustür mit Außentreppe (30cm Sockel)',
      type: 'door',
      level: 0,
      x: 3.4,
      z: -2.0,
      rotationY: 0,
      width: 1.05,
      height: 2.15,
      sillHeight: 0,
      hasExteriorSteps: true,
      exteriorStepsHeight: 0.3,
      exteriorStepsCount: 2,
      exteriorStepsDepth: 0.7,
      sensorLogicMode: 'single',
    },
    {
      id: 'open_patio_south',
      name: 'Terrassen-Hebeschiebetür',
      type: 'double_patio_door',
      level: 0,
      x: -1.8,
      z: 3.2,
      rotationY: 0,
      width: 3.0,
      height: 2.2,
      sillHeight: 0,
      sensorLogicMode: 'single',
    },
  ],
  assets: [],
};

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
    this._usingStudioIframe = false;
    this._loadedFromStorage = false;
    this._project = JSON.parse(JSON.stringify(DEFAULT_STARTER_PROJECT));
  }

  setConfig(config) {
    this._config = config || {};
    if (config && config.default_floor !== undefined) {
      this._activeFloor = config.default_floor;
    }
    if (!this._initialized) {
      this._boot();
    }
  }

  set hass(hass) {
    this._hass = hass;
    window.__REALPLAN_HASS__ = hass;
    if (!this._initialized) {
      this._boot();
    } else if (this._usingStudioIframe) {
      this._pushHassToIframe();
    } else {
      this._loadProjectFromHAStorage();
      this._syncEntityStates();
    }
  }

  async _boot() {
    if (this._initialized) return;
    this._initialized = true;

    // Check if the full compiled RealPlan 3D Studio app bundle is present in /realplan3d_static/app/index.html
    try {
      const resp = await fetch('/realplan3d_static/app/index.html', { method: 'HEAD', cache: 'no-store' });
      if (resp.ok) {
        this._usingStudioIframe = true;
        this._mountStudioIframe();
        return;
      }
    } catch (_err) {
      // Fallback to built-in standalone 3D Studio
    }

    this._renderStandaloneStudio();
    await this._initThreeScene();
    this._loadProjectFromHAStorage();
  }

  _mountStudioIframe() {
    if (!this.shadowRoot) return;
    const isPanel = this.tagName.toLowerCase() === 'realplan3d-panel';
    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
          width: 100%;
          height: ${isPanel ? '100dvh' : '680px'};
          background: #090d16;
          overflow: hidden;
          border: none;
        }
        iframe {
          width: 100%;
          height: 100%;
          border: none;
          display: block;
          background: #090d16;
        }
      </style>
      <iframe id="studioFrame" src="/realplan3d_static/app/index.html" allow="fullscreen; clipboard-read; clipboard-write"></iframe>
    `;
    const iframe = this.shadowRoot.getElementById('studioFrame');
    if (iframe) {
      iframe.addEventListener('load', () => {
        this._pushHassToIframe();
      });
    }
  }

  _pushHassToIframe() {
    if (!this.shadowRoot || !this._hass) return;
    const iframe = this.shadowRoot.getElementById('studioFrame');
    if (iframe && iframe.contentWindow) {
      try {
        iframe.contentWindow.__REALPLAN_HASS__ = this._hass;
        iframe.contentWindow.dispatchEvent(new CustomEvent('realplan3d-hass-update'));
      } catch (_err) {
        // Ignore cross-frame timing errors before load
      }
    }
  }

  async _loadProjectFromHAStorage() {
    if (!this._hass || !this._hass.callWS || this._loadedFromStorage) return;
    this._loadedFromStorage = true;
    try {
      const res = await this._hass.callWS({ type: 'realplan3d/get_project' });
      if (res && res.project && Array.isArray(res.project.zones) && res.project.zones.length > 0) {
        this._project = res.project;
        this._rebuildFloorGeometry();
      } else {
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
      // Use starter project
    }
  }

  async _saveProjectToHAStorage() {
    if (!this._hass || !this._hass.callWS) return;
    try {
      await this._hass.callWS({
        type: 'realplan3d/save_project',
        project: this._project,
      });
    } catch (_err) {
      // Ignore save error
    }
  }

  _renderStandaloneStudio() {
    if (!this.shadowRoot) return;
    const isPanel = this.tagName.toLowerCase() === 'realplan3d-panel';
    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
          background: #090d16;
          color: #f8fafc;
          font-family: system-ui, -apple-system, sans-serif;
          position: relative;
          width: 100%;
          height: ${isPanel ? '100dvh' : '640px'};
          border-radius: ${isPanel ? '0px' : '16px'};
          overflow: hidden;
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
          padding: 8px 14px;
          border-radius: 10px;
          border: 1px solid rgba(255,255,255,0.12);
          font-size: 13px;
          font-weight: 700;
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .controls {
          pointer-events: auto;
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          gap: 6px;
        }
        .floors {
          display: flex;
          gap: 4px;
          background: rgba(15, 23, 42, 0.92);
          padding: 4px;
          border-radius: 10px;
          border: 1px solid rgba(255,255,255,0.12);
        }
        .floor-btn, .action-btn {
          background: transparent;
          color: #cbd5e1;
          border: none;
          padding: 6px 11px;
          border-radius: 6px;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
          white-space: nowrap;
        }
        .floor-btn.active {
          background: #f59e0b;
          color: #090d16;
        }
        .action-btn {
          background: rgba(15, 23, 42, 0.92);
          border: 1px solid rgba(255,255,255,0.15);
          color: #38bdf8;
          padding: 8px 12px;
          border-radius: 10px;
        }
        .action-btn:hover {
          background: #1e293b;
        }
        .viewport {
          width: 100%;
          height: 100%;
        }
      </style>
      <div class="topbar">
        <div class="badge">
          <span>${this._config.title || this._project.title}</span>
          <span style="color:#10b981;font-size:11px;">● Live 3D</span>
        </div>
        <div class="controls">
          <button class="action-btn" id="addRoomBtn">+ Raum hinzufügen</button>
          <div class="floors" id="floorBar">
            <button class="floor-btn" data-floor="-1">KG</button>
            <button class="floor-btn active" data-floor="0">EG</button>
            <button class="floor-btn" data-floor="1">1. OG</button>
            <button class="floor-btn" data-floor="2">DG</button>
            <button class="floor-btn" data-floor="all_stacked">Alle 3D</button>
          </div>
        </div>
      </div>
      <div class="viewport" id="viewport"></div>
    `;

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

    const addRoomBtn = this.shadowRoot.getElementById('addRoomBtn');
    if (addRoomBtn) {
      addRoomBtn.addEventListener('click', () => {
        const targetLvl = this._activeFloor === 'all_stacked' ? 0 : Number(this._activeFloor);
        const count = this._project.zones.length + 1;
        this._project.zones.push({
          id: 'zone_' + Date.now(),
          name: 'Raum ' + count,
          zoneType: 'indoor',
          level: targetLvl,
          buildingId: 'main_house',
          rotationY: 0,
          x: ((count % 3) - 1) * 4.6,
          z: Math.floor(count / 3) * 4.4 - 2,
          width: 4.2,
          depth: 4.0,
          wallHeight: 2.6,
          surfaceMaterial: 'oak_parquet',
          wallColor: '#e4e0d8',
        });
        this._rebuildFloorGeometry();
        this._saveProjectToHAStorage();
      });
    }
  }

  async _initThreeScene() {
    const viewport = this.shadowRoot && this.shadowRoot.getElementById('viewport');
    if (!viewport) return;
    const THREE = await import('https://unpkg.com/three@0.170.0/build/three.module.js');
    this._THREE = THREE;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0b101b);
    const camera = new THREE.PerspectiveCamera(
      42,
      Math.max(1, viewport.clientWidth) / Math.max(1, viewport.clientHeight),
      0.2,
      180
    );
    camera.position.set(-13, 14, 17);
    camera.lookAt(0, 0.8, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.9;
    renderer.setSize(viewport.clientWidth, viewport.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.shadowMap.enabled = true;
    viewport.appendChild(renderer.domElement);

    // Interactive Orbit/Touch rotation in standalone mode
    let isDragging = false;
    let prevX = 0;
    let prevY = 0;
    let azimuth = -0.65;
    let elevation = 0.68;
    let distance = 22;

    const updateCameraOrbit = () => {
      camera.position.set(
        Math.sin(azimuth) * Math.cos(elevation) * distance,
        Math.sin(elevation) * distance,
        Math.cos(azimuth) * Math.cos(elevation) * distance
      );
      camera.lookAt(0, 1.0, 0);
      this._renderFrame();
    };

    renderer.domElement.addEventListener('pointerdown', (e) => {
      isDragging = true;
      prevX = e.clientX;
      prevY = e.clientY;
    });
    window.addEventListener('pointermove', (e) => {
      if (!isDragging) return;
      const dx = e.clientX - prevX;
      const dy = e.clientY - prevY;
      prevX = e.clientX;
      prevY = e.clientY;
      azimuth -= dx * 0.007;
      elevation = Math.max(0.15, Math.min(1.45, elevation + dy * 0.006));
      updateCameraOrbit();
    });
    window.addEventListener('pointerup', () => {
      isDragging = false;
    });
    renderer.domElement.addEventListener(
      'wheel',
      (e) => {
        e.preventDefault();
        distance = Math.max(7, Math.min(48, distance + e.deltaY * 0.015));
        updateCameraOrbit();
      },
      { passive: false }
    );

    const hemi = new THREE.HemisphereLight(0xe0f2fe, 0x1e293b, 0.65);
    const sun = new THREE.DirectionalLight(0xfffbeb, 1.4);
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

    updateCameraOrbit();
    this._rebuildFloorGeometry();
  }

  _rebuildFloorGeometry() {
    if (!this._THREE || !this._rootGroup) return;
    const THREE = this._THREE;
    this._rootGroup.clear();
    this._entityLights = new Map();
    this._windowPivots = new Map();

    const FLOOR_H = 2.75;
    const proj = this._project || DEFAULT_STARTER_PROJECT;
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
      const group = new THREE.Group();
      group.position.set(z.x, z.zoneType === 'outdoor' ? 0.02 : yOff, z.z);
      group.rotation.y = -(z.rotationY || 0);

      // Floor slab
      const floorGeo = new THREE.BoxGeometry(z.width, 0.14, z.depth);
      const floorMat = new THREE.MeshStandardMaterial({
        color: z.zoneType === 'outdoor' ? 0x5c4028 : 0xb88655,
        roughness: 0.45,
        transparent: isContext,
        opacity: isContext ? 0.38 : 1,
      });
      const floor = new THREE.Mesh(floorGeo, floorMat);
      floor.position.y = -0.07;
      floor.receiveShadow = true;
      group.add(floor);

      // Walls for indoor rooms
      if (z.zoneType === 'indoor') {
        const wH = z.wallHeight || 2.6;
        const wallMat = new THREE.MeshStandardMaterial({
          color: z.wallColor || 0xe4e0d8,
          roughness: 0.65,
          transparent: isContext,
          opacity: isContext ? 0.28 : 1,
        });
        const wt = 0.16;
        const nWall = new THREE.Mesh(new THREE.BoxGeometry(z.width, wH, wt), wallMat);
        nWall.position.set(0, wH / 2, -z.depth / 2);
        const sWall = new THREE.Mesh(new THREE.BoxGeometry(z.width, wH, wt), wallMat);
        sWall.position.set(0, wH / 2, z.depth / 2);
        const wWall = new THREE.Mesh(new THREE.BoxGeometry(wt, wH, z.depth), wallMat);
        wWall.position.set(-z.width / 2, wH / 2, 0);
        const eWall = new THREE.Mesh(new THREE.BoxGeometry(wt, wH, z.depth), wallMat);
        eWall.position.set(z.width / 2, wH / 2, 0);
        group.add(nWall, sWall, wWall, eWall);
      }

      this._rootGroup.add(group);
    }

    this._syncEntityStates();
  }

  _syncEntityStates() {
    if (!this._hass) {
      this._renderFrame();
      return;
    }
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
