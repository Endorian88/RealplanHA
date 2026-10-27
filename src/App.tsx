/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from 'react';
import { BottomControlDock } from './components/BottomControlDock';
import { DevicesAndEnergyView } from './components/DevicesAndEnergyView';
import { EditorWorkspacePanel } from './components/EditorWorkspacePanel';
import { EntityControlPopover } from './components/EntityControlPopover';
import { HacsExportView } from './components/HacsExportView';
import { ThreeFloorplanViewport } from './components/ThreeFloorplanViewport';
import { TwoDFloorplanCanvas } from './components/TwoDFloorplanCanvas';
import {
  INITIAL_FLOORPLAN_PROJECT,
  INITIAL_HA_ENTITIES,
} from './data/catalogAndInitialState';
import { ConnectionStatus, HAWebSocketBridge } from './services/haWebSocketBridge';
import {
  ActiveFloorView,
  CameraPresetId,
  CatalogItem,
  EditorViewMode,
  FloorLevelId,
  FloorplanProject,
  FloorplanZone,
  HAEntityState,
  isFenceOrHedgeAsset,
  isWalkwayAsset,
  PerformanceMode,
  PlacedAsset,
  WallOpening,
  WallOpeningType,
  WorkspaceTab,
} from './types/floorplan';

const STORAGE_KEY = 'realplan3d_estate_project_v7_empty';

const EMPTY_FLOORPLAN_PROJECT: FloorplanProject = {
  title: 'Mein Smart Home Grundriss',
  version: '2.0.0',
  zones: [],
  openings: [],
  assets: [],
};

export default function App() {
  const [project, setProject] = useState<FloorplanProject>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && Array.isArray(parsed.zones) && Array.isArray(parsed.assets)) {
          return parsed;
        }
      }
    } catch {
      // Fallback to empty project
    }
    return EMPTY_FLOORPLAN_PROJECT;
  });

  const [entities, setEntities] = useState<Record<string, HAEntityState>>(INITIAL_HA_ENTITIES);
  const [activeTab, setActiveTab] = useState<WorkspaceTab>('editor');
  const [editorViewMode, setEditorViewMode] = useState<EditorViewMode>('split');

  // Multi-Floor / Stockwerk State (-1 = KG, 0 = EG, 1 = 1. OG, 2 = DG, 'all_stacked' = Alle Etagen 3D)
  const [activeFloor, setActiveFloor] = useState<ActiveFloorView>(0);
  const activeSingleFloor: FloorLevelId = activeFloor === 'all_stacked' ? 0 : activeFloor;
  const [performanceMode, setPerformanceMode] = useState<PerformanceMode>('balanced');

  // 3D Scene, Lighting & Room Focus States
  const [sunHour, setSunHour] = useState<number>(15.5); // Balanced golden afternoon sun
  const [cameraPreset, setCameraPreset] = useState<CameraPresetId>('overview');
  const [focusedZoneId, setFocusedZoneId] = useState<string | null>(null);
  const [wallCutaway, setWallCutaway] = useState<boolean>(false);
  const [showClimateHeatmap, setShowClimateHeatmap] = useState<boolean>(false);
  const [showEnergyFlow, setShowEnergyFlow] = useState<boolean>(true);
  const [showSensorRadii, setShowSensorRadii] = useState<boolean>(false);
  const [showFloatingBadges, setShowFloatingBadges] = useState<boolean>(true);

  // Selection & Editor States
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
  const [selectedEntityId, setSelectedEntityId] = useState<string | null>(null);
  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(null);
  const [selectedOpeningId, setSelectedOpeningId] = useState<string | null>(null);
  const [pendingCatalogItem, setPendingCatalogItem] = useState<CatalogItem | null>(null);

  // Home Assistant WebSocket Bridge & Server Storage Sync
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('simulated');
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [haServerSyncedAt, setHaServerSyncedAt] = useState<string | null>(null);
  const wsBridgeRef = useRef<HAWebSocketBridge | null>(null);
  const skipNextRemoteEchoRef = useRef<boolean>(false);

  useEffect(() => {
    wsBridgeRef.current = new HAWebSocketBridge(
      (updatedEntities) => {
        setEntities((prev) => ({ ...prev, ...updatedEntities }));
      },
      (status, err) => {
        setConnectionStatus(status);
        setConnectionError(err || null);
      },
      (remoteProject) => {
        skipNextRemoteEchoRef.current = true;
        setProject(remoteProject);
        setHaServerSyncedAt(new Date().toLocaleTimeString('de-DE'));
      }
    );
    return () => {
      wsBridgeRef.current?.disconnect();
    };
  }, []);

  // Persist project changes to localStorage AND automatically sync to Home Assistant .storage when connected
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(project));
    } catch {
      // Ignore storage quota errors
    }

    if (skipNextRemoteEchoRef.current) {
      skipNextRemoteEchoRef.current = false;
      return;
    }

    if (connectionStatus === 'connected' && wsBridgeRef.current) {
      const timer = window.setTimeout(async () => {
        const ok = await wsBridgeRef.current?.saveProjectToHA(project);
        if (ok) {
          setHaServerSyncedAt(new Date().toLocaleTimeString('de-DE'));
        }
      }, 600);
      return () => window.clearTimeout(timer);
    }
  }, [project, connectionStatus]);

  const handleManualSaveToHA = async (): Promise<boolean> => {
    if (!wsBridgeRef.current) return false;
    const ok = await wsBridgeRef.current.saveProjectToHA(project);
    if (ok) {
      setHaServerSyncedAt(new Date().toLocaleTimeString('de-DE'));
    }
    return ok;
  };

  const handleManualLoadFromHA = async (): Promise<boolean> => {
    if (!wsBridgeRef.current) return false;
    const remote = await wsBridgeRef.current.loadProjectFromHA();
    if (remote) {
      skipNextRemoteEchoRef.current = true;
      setProject(remote);
      setHaServerSyncedAt(new Date().toLocaleTimeString('de-DE'));
      return true;
    }
    return false;
  };

  // Toggle or Trigger Smart Home Entity
  const handleToggleEntity = (entityId: string) => {
    setEntities((prev) => {
      const current = prev[entityId];
      if (!current) return prev;

      let nextState = current.state;
      const nextAttrs = { ...current.attributes };

      if (current.domain === 'light' || current.domain === 'switch') {
        nextState = current.state === 'on' ? 'off' : 'on';
      } else if (current.domain === 'valve') {
        nextState = current.state === 'open' ? 'closed' : 'open';
      } else if (current.domain === 'cover') {
        const isCurrentlyOpen = current.state === 'open' || (current.attributes.current_position ?? 0) > 20;
        nextState = isCurrentlyOpen ? 'closed' : 'open';
        nextAttrs.current_position = isCurrentlyOpen ? 0 : 100;
      } else if (current.domain === 'vacuum') {
        nextState = current.state === 'cleaning' ? 'docked' : 'cleaning';
      } else if (current.domain === 'binary_sensor') {
        const isDetected =
          current.state === 'detected' || current.state === 'open' || current.state === 'on';
        nextState = isDetected ? 'closed' : 'open';
        nextAttrs.alarm_test_active = !isDetected;
      } else if (current.domain === 'media_player') {
        nextState = current.state === 'playing' ? 'off' : 'playing';
      } else if (current.domain === 'climate') {
        nextState = current.state === 'heat' ? 'off' : 'heat';
      }

      wsBridgeRef.current?.callService('homeassistant', 'toggle', { entity_id: entityId });

      return {
        ...prev,
        [entityId]: {
          ...current,
          state: nextState,
          attributes: nextAttrs,
          last_changed: new Date().toISOString(),
        },
      };
    });
  };

  const handleUpdateEntityAttributes = (
    entityId: string,
    patchState?: string,
    patchAttrs?: Partial<HAEntityState['attributes']>
  ) => {
    setEntities((prev) => {
      const current = prev[entityId];
      if (!current) return prev;
      return {
        ...prev,
        [entityId]: {
          ...current,
          state: patchState ?? current.state,
          attributes: {
            ...current.attributes,
            ...(patchAttrs || {}),
          },
          last_changed: new Date().toISOString(),
        },
      };
    });
  };

  // Interactive 2-Sensor Window Test Helper (0/2 = Geschlossen, 1/2 = Gekippt, 2/2 = Geöffnet)
  const handleSetDualSensorTestState = (
    openingId: string,
    targetState: 'closed' | 'tilted' | 'open'
  ) => {
    const opening = project.openings.find((o) => o.id === openingId);
    if (!opening) return;

    setEntities((prev) => {
      const next = { ...prev };
      const sensorA = opening.entityId;
      const sensorB = opening.tiltEntityId;

      if (sensorA && next[sensorA]) {
        const sAState = targetState === 'closed' ? 'closed' : 'open';
        next[sensorA] = {
          ...next[sensorA],
          state: sAState,
          last_changed: new Date().toISOString(),
        };
      }
      if (sensorB && next[sensorB]) {
        const sBState = targetState === 'open' ? 'open' : 'closed';
        next[sensorB] = {
          ...next[sensorB],
          state: sBState,
          last_changed: new Date().toISOString(),
        };
      }
      return next;
    });
  };

  // Place armed Catalog Item at clicked 2D or 3D coordinates on the active floor
  const handlePlaceCatalogItemAt = (worldX: number, worldZ: number) => {
    if (!pendingCatalogItem) return;

    const matchingEntityId = Object.keys(entities).find((id) =>
      pendingCatalogItem.defaultDomain
        ? id.startsWith(`${pendingCatalogItem.defaultDomain}.`)
        : false
    );

    const isLinear = isFenceOrHedgeAsset(pendingCatalogItem.id);
    const isWalk = isWalkwayAsset(pendingCatalogItem.id);

    const newAsset: PlacedAsset = {
      id: `asset_${Date.now()}`,
      catalogId: pendingCatalogItem.id,
      name: pendingCatalogItem.name,
      category: pendingCatalogItem.category,
      mountType: pendingCatalogItem.mountType,
      level: activeSingleFloor,
      position: [worldX, pendingCatalogItem.defaultY, worldZ],
      rotationY: 0,
      scale: 1,
      customLength: isLinear ? pendingCatalogItem.width : undefined,
      customHeight: isLinear
        ? isWalk
          ? pendingCatalogItem.depth
          : pendingCatalogItem.height
        : undefined,
      entityId: matchingEntityId,
      lightConfig:
        pendingCatalogItem.category === 'lighting'
          ? { type: 'point', maxIntensity: 3.5, distance: 5.5 }
          : undefined,
    };

    setProject((prev) => ({
      ...prev,
      assets: [...prev.assets, newAsset],
    }));
    setSelectedAssetId(newAsset.id);
    setSelectedZoneId(null);
    setSelectedOpeningId(null);
    setPendingCatalogItem(null);
  };

  // Import custom .glb / .gltf 3D file
  const handleImportCustomGlb = (file: File) => {
    const objectUrl = URL.createObjectURL(file);
    const cleanName = file.name.replace(/\.(glb|gltf)$/i, '');
    const newAsset: PlacedAsset = {
      id: `glb_${Date.now()}`,
      catalogId: 'custom_glb',
      name: `3D-Modell: ${cleanName}`,
      category: 'custom_glb',
      mountType: 'floor',
      level: activeSingleFloor,
      position: [0, 0, 0],
      rotationY: 0,
      scale: 1,
      customGlbUrl: objectUrl,
    };
    setProject((prev) => ({
      ...prev,
      assets: [...prev.assets, newAsset],
    }));
    setSelectedAssetId(newAsset.id);
    setSelectedZoneId(null);
    setSelectedOpeningId(null);
  };

  // Update, Duplicate, or Delete Placed 3D Asset
  const handleUpdateAsset = (assetId: string, patch: Partial<PlacedAsset>) => {
    setProject((prev) => ({
      ...prev,
      assets: prev.assets.map((a) => (a.id === assetId ? { ...a, ...patch } : a)),
    }));
  };

  const handleDuplicateAsset = (assetId: string) => {
    const orig = project.assets.find((a) => a.id === assetId);
    if (!orig) return;
    const copy: PlacedAsset = {
      ...orig,
      id: `asset_${Date.now()}`,
      name: `${orig.name} (Kopie)`,
      position: [orig.position[0] + 0.6, orig.position[1], orig.position[2] + 0.6],
    };
    setProject((prev) => ({
      ...prev,
      assets: [...prev.assets, copy],
    }));
    setSelectedAssetId(copy.id);
  };

  const handleDeleteAsset = (assetId: string) => {
    setProject((prev) => ({
      ...prev,
      assets: prev.assets.filter((a) => a.id !== assetId),
    }));
    setSelectedAssetId(null);
  };

  // Add, Update, or Delete Indoor Room / Outbuilding / Outdoor Landscaping Zone on active floor
  const handleAddZone = (zoneType: 'indoor' | 'outdoor' | 'outbuilding') => {
    const newZone: FloorplanZone =
      zoneType === 'indoor'
        ? {
            id: `zone_${Date.now()}`,
            name: 'Neuer Wohnraum',
            zoneType: 'indoor',
            level: activeSingleFloor,
            buildingId: 'main_house',
            rotationY: 0,
            x: 0,
            z: 0,
            width: 4.4,
            depth: 4.2,
            wallHeight: 2.6,
            surfaceMaterial: 'oak_parquet',
            wallColor: '#e4e0d8',
          }
        : zoneType === 'outbuilding'
        ? {
            id: `zone_neben_${Date.now()}`,
            name: 'Neues Nebengebäude / Garage',
            zoneType: 'indoor',
            level: 0,
            buildingId: 'outbuilding_garage',
            rotationY: 0,
            x: -9.5,
            z: 0.5,
            width: 5.4,
            depth: 5.8,
            wallHeight: 2.6,
            surfaceMaterial: 'polished_concrete',
            wallColor: '#e2e8f0',
            roofConfig: {
              type: 'flat',
              pitchDeg: 15,
              overhang: 0.25,
              material: 'anthracite_tile',
              ridgeDirection: 'x',
              dormerType: 'none',
            },
          }
        : {
            id: `zone_out_${Date.now()}`,
            name: 'Große Garten- / Freizeitfläche',
            zoneType: 'outdoor',
            level: 0,
            x: -1.5,
            z: 11.5,
            width: 14.0,
            depth: 9.0,
            wallHeight: 0.12,
            surfaceMaterial: 'lush_lawn',
            wallColor: '#3f7a38',
            outdoorPerimeter: 'none',
            layerOrder: 0,
          };

    setProject((prev) => ({
      ...prev,
      zones: [...prev.zones, newZone],
    }));
    setSelectedZoneId(newZone.id);
    setSelectedAssetId(null);
    setSelectedOpeningId(null);
  };

  const handleUpdateZone = (zoneId: string, patch: Partial<FloorplanZone>) => {
    setProject((prev) => ({
      ...prev,
      zones: prev.zones.map((z) => (z.id === zoneId ? { ...z, ...patch } : z)),
    }));
  };

  const handleCreateCustomZone = (newZone: FloorplanZone) => {
    setProject((prev) => ({
      ...prev,
      zones: [...prev.zones, newZone],
    }));
    setSelectedZoneId(newZone.id);
    setSelectedAssetId(null);
    setSelectedOpeningId(null);
  };

  const handleDeleteZone = (zoneId: string) => {
    setProject((prev) => ({
      ...prev,
      zones: prev.zones.filter((z) => z.id !== zoneId),
    }));
    setSelectedZoneId(null);
    if (focusedZoneId === zoneId) setFocusedZoneId(null);
  };

  // Rotate either a single building part (room/zone) OR an entire building group (co-rotating all rooms, windows, doors & assets)
  const handleRotateBuilding = (
    zoneId: string,
    deltaRad: number,
    wholeBuilding: boolean
  ) => {
    setProject((prev) => {
      const targetZone = prev.zones.find((z) => z.id === zoneId);
      if (!targetZone) return prev;

      const groupZones =
        wholeBuilding && targetZone.buildingId
          ? prev.zones.filter(
              (z) => z.zoneType === 'indoor' && z.buildingId === targetZone.buildingId
            )
          : [targetZone];

      const groupZoneIds = new Set(groupZones.map((z) => z.id));

      // Compute pivot centroid of the building / room
      const pivotX =
        groupZones.reduce((acc, z) => acc + z.x, 0) / Math.max(1, groupZones.length);
      const pivotZ =
        groupZones.reduce((acc, z) => acc + z.z, 0) / Math.max(1, groupZones.length);

      const cos = Math.cos(-deltaRad);
      const sin = Math.sin(-deltaRad);
      const rotatePt = (x: number, z: number): [number, number] => {
        const dx = x - pivotX;
        const dz = z - pivotZ;
        return [
          +(pivotX + dx * cos - dz * sin).toFixed(2),
          +(pivotZ + dx * sin + dz * cos).toFixed(2),
        ];
      };

      const isInsideAnyGroupZone = (x: number, z: number, level: number, margin = 0.65) => {
        for (const gz of groupZones) {
          if ((gz.level ?? 0) !== level) continue;
          const rot = gz.rotationY ?? 0;
          const c = Math.cos(rot);
          const s = Math.sin(rot);
          const rx = x - gz.x;
          const rz = z - gz.z;
          const lx = rx * c - rz * s;
          const lz = rx * s + rz * c;
          if (
            Math.abs(lx) <= gz.width / 2 + margin &&
            Math.abs(lz) <= gz.depth / 2 + margin
          ) {
            return true;
          }
        }
        return false;
      };

      const nextZones = prev.zones.map((z) => {
        if (!groupZoneIds.has(z.id)) return z;
        const [nx, nz] = rotatePt(z.x, z.z);
        const nextPts = z.points
          ? z.points.map(([px, pz]) => rotatePt(px, pz))
          : undefined;
        return {
          ...z,
          x: nx,
          z: nz,
          rotationY: (z.rotationY ?? 0) + deltaRad,
          points: nextPts,
        };
      });

      const nextOpenings = prev.openings.map((op) => {
        if (!isInsideAnyGroupZone(op.x, op.z, op.level ?? 0, 0.7)) return op;
        const [nx, nz] = rotatePt(op.x, op.z);
        return {
          ...op,
          x: nx,
          z: nz,
          rotationY: op.rotationY + deltaRad,
        };
      });

      const nextAssets = prev.assets.map((a) => {
        if (!isInsideAnyGroupZone(a.position[0], a.position[2], a.level ?? 0, 0.5)) {
          return a;
        }
        const [nx, nz] = rotatePt(a.position[0], a.position[2]);
        return {
          ...a,
          position: [nx, a.position[1], nz] as [number, number, number],
          rotationY: a.rotationY + deltaRad,
        };
      });

      return {
        ...prev,
        zones: nextZones,
        openings: nextOpenings,
        assets: nextAssets,
      };
    });
  };

  const handleClearProject = () => {
    setProject(EMPTY_FLOORPLAN_PROJECT);
    setSelectedZoneId(null);
    setSelectedAssetId(null);
    setSelectedOpeningId(null);
    setFocusedZoneId(null);
  };

  const handleLoadDemoProject = () => {
    setProject(INITIAL_FLOORPLAN_PROJECT);
    setEntities(INITIAL_HA_ENTITIES);
    setSelectedZoneId(null);
    setSelectedAssetId(null);
    setSelectedOpeningId(null);
    setFocusedZoneId(null);
    setActiveFloor(0);
  };

  // Add, Update, or Delete Window / Door / Patio Slider / Shutter Opening
  const handleAddOpening = (presetType: WallOpeningType) => {
    const newOpening: WallOpening =
      presetType === 'window'
        ? {
            id: `open_win_${Date.now()}`,
            name: 'Neues Doppelfenster (2-Sensor Kipp/Offen)',
            type: 'window',
            level: activeSingleFloor,
            x: -1.2,
            z: 1.2,
            rotationY: 0,
            width: 1.8,
            height: 1.4,
            sillHeight: 0.85,
            sensorLogicMode: 'dual_tilt_open',
            entityId: 'binary_sensor.fenster_wz_west_griff',
            tiltEntityId: 'binary_sensor.fenster_wz_west_fluegel',
            shutterEntityId: 'cover.rollladen_wohnzimmer_sued',
          }
        : presetType === 'floor_window'
        ? {
            id: `open_pwin_${Date.now()}`,
            name: 'Neues Panoramafenster (Bodentief)',
            type: 'floor_window',
            level: activeSingleFloor,
            x: -6.4,
            z: -3.2,
            rotationY: Math.PI / 2,
            width: 2.2,
            height: 2.05,
            sillHeight: 0.15,
            sensorLogicMode: 'dual_tilt_open',
            entityId: 'binary_sensor.fenster_wz_west_griff',
            tiltEntityId: 'binary_sensor.fenster_wz_west_fluegel',
            shutterEntityId: 'cover.rollladen_wohnzimmer_west',
          }
        : presetType === 'double_patio_door'
        ? {
            id: `open_patio_${Date.now()}`,
            name: 'Neue Terrassen-Hebeschiebetür',
            type: 'double_patio_door',
            level: activeSingleFloor,
            x: 0.0,
            z: 1.2,
            rotationY: 0,
            width: 3.0,
            height: 2.25,
            sillHeight: 0.0,
            sensorLogicMode: 'single',
            entityId: 'cover.terrassentuer_wohnzimmer',
            shutterEntityId: 'cover.rollladen_wohnzimmer_sued',
          }
        : presetType === 'garage_door'
        ? {
            id: `open_gate_${Date.now()}`,
            name: 'Elektrisches Rolltor / Garagentor',
            type: 'garage_door',
            level: 0,
            x: 9.2,
            z: -1.1,
            rotationY: 0,
            width: 3.6,
            height: 2.25,
            sillHeight: 0.0,
            sensorLogicMode: 'single',
            entityId: 'cover.rolltor_nebengebaeude',
          }
        : {
            id: `open_door_${Date.now()}`,
            name: 'Neue Zimmer- / Haustür',
            type: 'door',
            level: 0,
            x: 0.0,
            z: -4.2,
            rotationY: 0,
            width: 0.95,
            height: 2.1,
            sillHeight: 0.0,
            sensorLogicMode: 'single',
            entityId: 'binary_sensor.haustuer_kontakt',
          };

    setProject((prev) => ({
      ...prev,
      openings: [...prev.openings, newOpening],
    }));
    setSelectedOpeningId(newOpening.id);
    setSelectedAssetId(null);
    setSelectedZoneId(null);
  };

  const handleUpdateOpening = (openingId: string, patch: Partial<WallOpening>) => {
    setProject((prev) => ({
      ...prev,
      openings: prev.openings.map((o) => (o.id === openingId ? { ...o, ...patch } : o)),
    }));
  };

  const handleDeleteOpening = (openingId: string) => {
    setProject((prev) => ({
      ...prev,
      openings: prev.openings.filter((o) => o.id !== openingId),
    }));
    setSelectedOpeningId(null);
  };

  // Window/Door settings & kinematics popover is strictly restricted to Editor view
  const activePopoverOpening =
    activeTab === 'editor' && selectedOpeningId
      ? project.openings.find((o) => o.id === selectedOpeningId) || null
      : null;
  const activePopoverEntity = selectedEntityId
    ? entities[selectedEntityId]
    : activePopoverOpening?.entityId
    ? entities[activePopoverOpening.entityId]
    : null;
  const activePopoverAsset = selectedAssetId
    ? project.assets.find((a) => a.id === selectedAssetId)
    : null;

  // Clicking a door, window, or gate in Live 3D mode immediately cycles its 3D animation state and opens the kinematics popover
  const handleSelectOpeningIn3D = (openingId: string | null) => {
    setSelectedOpeningId(openingId);
    setSelectedAssetId(null);
    setSelectedZoneId(null);
    if (!openingId) {
      setSelectedEntityId(null);
      return;
    }
    const op = project.openings.find((o) => o.id === openingId);
    if (!op) return;
    setSelectedEntityId(op.entityId || null);

    if (activeTab === 'live') {
      const isWin = op.type === 'window' || op.type === 'floor_window';
      // Determine current state
      let curr: 'closed' | 'tilted' | 'open' = op.openState;
      if (op.dualSensorRule?.enabled && isWin) {
        const sA = entities[op.dualSensorRule.sensorAEntityId]?.state === 'on';
        const sB = entities[op.dualSensorRule.sensorBEntityId]?.state === 'on';
        curr = sA && sB ? 'open' : sA || sB ? 'tilted' : 'closed';
      } else if (op.entityId && entities[op.entityId]) {
        const st = entities[op.entityId].state;
        const pos = entities[op.entityId].attributes.current_position;
        if (st === 'tilted') curr = 'tilted';
        else if (st === 'open' || st === 'on' || (typeof pos === 'number' && pos > 10)) curr = 'open';
        else curr = 'closed';
      }

      const nextState: 'closed' | 'tilted' | 'open' = isWin
        ? curr === 'closed'
          ? 'tilted'
          : curr === 'tilted'
          ? 'open'
          : 'closed'
        : curr === 'closed'
        ? 'open'
        : 'closed';

      handleUpdateOpening(op.id, {
        openState: nextState,
        openPositionPct: nextState === 'open' ? 100 : 0,
      });
      if (op.dualSensorRule?.enabled && isWin) {
        handleSetDualSensorTestState(op.id, nextState);
      } else if (op.entityId && entities[op.entityId]) {
        const ent = entities[op.entityId];
        if (ent.domain === 'cover') {
          handleUpdateEntityAttributes(
            op.entityId,
            nextState === 'closed' ? 'closed' : 'open',
            { current_position: nextState === 'closed' ? 0 : 100 }
          );
        } else {
          handleUpdateEntityAttributes(
            op.entityId,
            nextState === 'closed' ? 'off' : nextState === 'tilted' ? 'tilted' : 'on'
          );
        }
      }
    }
  };

  const showOnly2D = activeTab === 'editor' && editorViewMode === '2d';
  const showSplit2D3D = activeTab === 'editor' && editorViewMode === 'split';

  return (
    <div className="relative w-full h-[100dvh] bg-[#090d16] text-slate-100 overflow-hidden select-none touch-manipulation">
      {/* Strict 3-Zone Top Navigation Bar Contract (Responsive for Smartphone, Tablet & Desktop) */}
      <header className="fixed top-0 inset-x-0 z-30 h-14 px-2.5 sm:px-6 bg-[#090d16]/95 border-b border-white/10 flex items-center justify-between gap-2 sm:gap-6">
        {/* Zone 1: Single text element Brand Wordmark */}
        <a
          href="#top"
          onClick={(e) => {
            e.preventDefault();
            setActiveTab('live');
            setFocusedZoneId(null);
            setCameraPreset('overview');
          }}
          className="text-xs sm:text-base font-bold tracking-tight text-white whitespace-nowrap shrink-0"
        >
          RealPlan 3D
        </a>

        {/* Zone 2: 4 Concise Single-Line Navigation Links */}
        <nav className="flex items-center gap-2.5 sm:gap-6 text-xs font-medium text-slate-300 overflow-x-auto no-scrollbar">
          <a
            href="#live"
            onClick={(e) => {
              e.preventDefault();
              setActiveTab('live');
              setPendingCatalogItem(null);
            }}
            className={`py-1.5 px-1 transition-colors whitespace-nowrap shrink-0 ${
              activeTab === 'live'
                ? 'text-amber-400 underline underline-offset-8 decoration-2 font-semibold'
                : 'hover:text-white'
            }`}
          >
            Live 3D
          </a>
          <a
            href="#editor"
            onClick={(e) => {
              e.preventDefault();
              setActiveTab('editor');
            }}
            className={`py-1.5 px-1 transition-colors whitespace-nowrap shrink-0 ${
              activeTab === 'editor'
                ? 'text-amber-400 underline underline-offset-8 decoration-2 font-semibold'
                : 'hover:text-white'
            }`}
          >
            2D-Planer
          </a>
          <a
            href="#devices"
            onClick={(e) => {
              e.preventDefault();
              setActiveTab('devices');
            }}
            className={`py-1.5 px-1 transition-colors whitespace-nowrap shrink-0 ${
              activeTab === 'devices'
                ? 'text-amber-400 underline underline-offset-8 decoration-2 font-semibold'
                : 'hover:text-white'
            }`}
          >
            <span className="sm:hidden">Geräte</span>
            <span className="hidden sm:inline">Steckdosen & Sensoren</span>
          </a>
          <a
            href="#hacs"
            onClick={(e) => {
              e.preventDefault();
              setActiveTab('hacs');
            }}
            className={`py-1.5 px-1 transition-colors whitespace-nowrap shrink-0 ${
              activeTab === 'hacs'
                ? 'text-amber-400 underline underline-offset-8 decoration-2 font-semibold'
                : 'hover:text-white'
            }`}
          >
            HACS
          </a>
        </nav>

        {/* Zone 3: 1 Primary Action Button */}
        <div className="flex items-center shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('hacs')}
            className="px-2.5 sm:px-4 py-1.5 sm:py-2 text-xs font-semibold text-slate-950 bg-amber-400 hover:bg-amber-300 rounded-lg transition-colors whitespace-nowrap shrink-0"
          >
            {connectionStatus === 'connected' ? (
              'HA Verbunden'
            ) : (
              <>
                <span className="sm:hidden">HA / Export</span>
                <span className="hidden sm:inline">HACS & Seitenleiste</span>
              </>
            )}
          </button>
        </div>
      </header>

      {/* Main Viewport Area: 2D CAD Planner, Split 2D/3D (stacked on mobile/portrait tablet, side-by-side on desktop), or Full-Screen 3D */}
      <main className="w-full h-full pt-14 flex flex-col lg:flex-row">
        {showOnly2D ? (
          <div className="w-full h-full">
            <TwoDFloorplanCanvas
              project={project}
              entities={entities}
              activeFloor={activeSingleFloor}
              selectedZoneId={selectedZoneId}
              selectedAssetId={selectedAssetId}
              selectedOpeningId={selectedOpeningId}
              pendingCatalogItem={pendingCatalogItem}
              onSelectZone={(zId) => {
                setSelectedZoneId(zId);
                setSelectedAssetId(null);
                setSelectedOpeningId(null);
              }}
              onSelectAsset={(aId, eId) => {
                setSelectedAssetId(aId);
                setSelectedEntityId(eId || null);
                if (aId) {
                  setSelectedZoneId(null);
                  setSelectedOpeningId(null);
                }
              }}
              onSelectOpening={(oId) => {
                setSelectedOpeningId(oId);
                setSelectedAssetId(null);
                setSelectedZoneId(null);
              }}
              onUpdateZone={handleUpdateZone}
              onCreateZone={handleCreateCustomZone}
              onDeleteZone={handleDeleteZone}
              onRotateBuilding={handleRotateBuilding}
              onUpdateAsset={handleUpdateAsset}
              onUpdateOpening={handleUpdateOpening}
              onPlaceCatalogItemAt={handlePlaceCatalogItemAt}
              onLoadDemoProject={handleLoadDemoProject}
              onClearProject={handleClearProject}
            />
          </div>
        ) : showSplit2D3D ? (
          <>
            <div className="w-full h-1/2 lg:w-1/2 lg:h-full border-b lg:border-b-0 lg:border-r border-white/15">
              <TwoDFloorplanCanvas
                project={project}
                entities={entities}
                activeFloor={activeSingleFloor}
                selectedZoneId={selectedZoneId}
                selectedAssetId={selectedAssetId}
                selectedOpeningId={selectedOpeningId}
                pendingCatalogItem={pendingCatalogItem}
                onSelectZone={(zId) => {
                  setSelectedZoneId(zId);
                  setSelectedAssetId(null);
                  setSelectedOpeningId(null);
                }}
                onSelectAsset={(aId, eId) => {
                  setSelectedAssetId(aId);
                  setSelectedEntityId(eId || null);
                  if (aId) {
                    setSelectedZoneId(null);
                    setSelectedOpeningId(null);
                  }
                }}
                onSelectOpening={(oId) => {
                  setSelectedOpeningId(oId);
                  setSelectedAssetId(null);
                  setSelectedZoneId(null);
                }}
                onUpdateZone={handleUpdateZone}
                onCreateZone={handleCreateCustomZone}
                onDeleteZone={handleDeleteZone}
                onRotateBuilding={handleRotateBuilding}
                onUpdateAsset={handleUpdateAsset}
                onUpdateOpening={handleUpdateOpening}
                onPlaceCatalogItemAt={handlePlaceCatalogItemAt}
                onLoadDemoProject={handleLoadDemoProject}
                onClearProject={handleClearProject}
              />
            </div>
            <div className="w-full h-1/2 lg:w-1/2 lg:h-full">
              <ThreeFloorplanViewport
                project={project}
                entities={entities}
                activeTab={activeTab}
                activeFloor={activeFloor}
                performanceMode={performanceMode}
                sunHour={sunHour}
                wallCutaway={wallCutaway}
                showClimateHeatmap={showClimateHeatmap}
                showEnergyFlow={showEnergyFlow}
                showSensorRadii={showSensorRadii}
                showFloatingBadges={showFloatingBadges}
                cameraPreset={cameraPreset}
                focusedZoneId={focusedZoneId}
                selectedAssetId={selectedAssetId}
                selectedZoneId={selectedZoneId}
                pendingCatalogItem={pendingCatalogItem}
                onSelectAsset={(assetId, entityId) => {
                  setSelectedAssetId(assetId);
                  setSelectedEntityId(entityId || null);
                  if (assetId) {
                    setSelectedZoneId(null);
                    setSelectedOpeningId(null);
                  }
                }}
                onSelectZone={(zoneId) => {
                  setSelectedZoneId(zoneId);
                  setSelectedAssetId(null);
                  setSelectedOpeningId(null);
                }}
                onFocusZone={setFocusedZoneId}
                onSelectOpening={handleSelectOpeningIn3D}
                onUpdateAsset={handleUpdateAsset}
                onUpdateOpening={handleUpdateOpening}
                onPlaceCatalogItemAt={handlePlaceCatalogItemAt}
                onQuickToggleEntity={handleToggleEntity}
              />
            </div>
          </>
        ) : (
          <div className="w-full h-full">
            <ThreeFloorplanViewport
              project={project}
              entities={entities}
              activeTab={activeTab}
              activeFloor={activeFloor}
              performanceMode={performanceMode}
              sunHour={sunHour}
              wallCutaway={wallCutaway}
              showClimateHeatmap={showClimateHeatmap}
              showEnergyFlow={showEnergyFlow}
              showSensorRadii={showSensorRadii}
              showFloatingBadges={showFloatingBadges}
              cameraPreset={cameraPreset}
              focusedZoneId={focusedZoneId}
              selectedAssetId={selectedAssetId}
              selectedZoneId={selectedZoneId}
              pendingCatalogItem={pendingCatalogItem}
              onSelectAsset={(assetId, entityId) => {
                setSelectedAssetId(assetId);
                setSelectedEntityId(entityId || null);
                if (assetId) {
                  setSelectedZoneId(null);
                  setSelectedOpeningId(null);
                }
              }}
              onSelectZone={(zoneId) => {
                setSelectedZoneId(zoneId);
                setSelectedAssetId(null);
                setSelectedOpeningId(null);
              }}
              onFocusZone={setFocusedZoneId}
              onSelectOpening={handleSelectOpeningIn3D}
              onUpdateAsset={handleUpdateAsset}
              onUpdateOpening={handleUpdateOpening}
              onPlaceCatalogItemAt={handlePlaceCatalogItemAt}
              onQuickToggleEntity={handleToggleEntity}
            />
          </div>
        )}
      </main>

      {/* Live Mode: Interactive Smart Device & 3D Door/Window/Gate Kinematics Control Popover */}
      {activeTab === 'live' && (activePopoverEntity || activePopoverOpening) && (
        <EntityControlPopover
          entity={activePopoverEntity}
          asset={activePopoverAsset}
          opening={activePopoverOpening}
          entities={entities}
          onClose={() => {
            setSelectedEntityId(null);
            setSelectedAssetId(null);
            setSelectedOpeningId(null);
          }}
          onToggleEntity={handleToggleEntity}
          onUpdateAttributes={handleUpdateEntityAttributes}
          onUpdateOpening={handleUpdateOpening}
          onSetDualSensorTestState={handleSetDualSensorTestState}
        />
      )}

      {/* Editor Mode: 2D/3D Indoor & Outdoor Landscaping + Windows/Doors + Smart Asset Catalog */}
      {activeTab === 'editor' && (
        <EditorWorkspacePanel
          project={project}
          entities={entities}
          activeFloor={activeFloor}
          onChangeActiveFloor={(fl) => {
            setActiveFloor(fl);
            setFocusedZoneId(null);
          }}
          editorViewMode={editorViewMode}
          onChangeEditorViewMode={setEditorViewMode}
          selectedAssetId={selectedAssetId}
          selectedZoneId={selectedZoneId}
          selectedOpeningId={selectedOpeningId}
          pendingCatalogItem={pendingCatalogItem}
          onSelectCatalogItemToPlace={setPendingCatalogItem}
          onSelectAsset={(aId) => {
            setSelectedAssetId(aId);
            if (aId) {
              setSelectedZoneId(null);
              setSelectedOpeningId(null);
            }
          }}
          onSelectZone={(zId) => {
            setSelectedZoneId(zId);
            setSelectedAssetId(null);
            setSelectedOpeningId(null);
          }}
          onSelectOpening={(oId) => {
            setSelectedOpeningId(oId);
            setSelectedAssetId(null);
            setSelectedZoneId(null);
          }}
          onUpdateAsset={handleUpdateAsset}
          onDeleteAsset={handleDeleteAsset}
          onDuplicateAsset={handleDuplicateAsset}
          onImportCustomGlb={handleImportCustomGlb}
          onAddZone={handleAddZone}
          onUpdateZone={handleUpdateZone}
          onDeleteZone={handleDeleteZone}
          onAddOpening={handleAddOpening}
          onUpdateOpening={handleUpdateOpening}
          onDeleteOpening={handleDeleteOpening}
          onSetDualSensorTestState={handleSetDualSensorTestState}
          onRotateBuilding={handleRotateBuilding}
          onLoadDemoProject={handleLoadDemoProject}
          onClearProject={handleClearProject}
        />
      )}

      {/* Devices & Energy Overview Modal */}
      {activeTab === 'devices' && (
        <DevicesAndEnergyView
          project={project}
          entities={entities}
          onToggleEntity={handleToggleEntity}
          onTriggerSmokeTest={(entityId) => {
            const cur = entities[entityId];
            const isAlarm =
              cur?.state === 'detected' || Boolean(cur?.attributes.alarm_test_active);
            handleUpdateEntityAttributes(entityId, isAlarm ? 'clear' : 'detected', {
              alarm_test_active: !isAlarm,
            });
            setActiveTab('live');
            setSelectedEntityId(entityId);
          }}
          onFocusEntityIn3D={(entityId) => {
            const foundAsset = project.assets.find((a) => a.entityId === entityId);
            if (foundAsset) {
              setSelectedAssetId(foundAsset.id);
              if (foundAsset.level !== undefined && activeFloor !== 'all_stacked') {
                setActiveFloor(foundAsset.level);
              }
            }
            setSelectedEntityId(entityId);
            setActiveTab('live');
          }}
          onClose={() => setActiveTab('live')}
        />
      )}

      {/* HACS Custom Integration Exporter & Home Assistant WebSocket Setup */}
      {activeTab === 'hacs' && (
        <HacsExportView
          project={project}
          connectionStatus={connectionStatus}
          connectionError={connectionError}
          haServerSyncedAt={haServerSyncedAt}
          onConnectHA={(url, token) => wsBridgeRef.current?.connect(url, token)}
          onDisconnectHA={() => wsBridgeRef.current?.disconnect()}
          onSaveProjectToHA={handleManualSaveToHA}
          onLoadProjectFromHA={handleManualLoadFromHA}
          onResetDefaultProject={() => {
            setProject(INITIAL_FLOORPLAN_PROJECT);
            setEntities(INITIAL_HA_ENTITIES);
            setFocusedZoneId(null);
            setActiveFloor(0);
          }}
          onImportProjectJson={(imported) => setProject(imported)}
          onClose={() => setActiveTab('live')}
        />
      )}

      {/* Unified Collapsible Bottom Control Dock with Stockwerk-Umschalter & Room Focus Quick-Select */}
      <BottomControlDock
        zones={project.zones}
        activeFloor={activeFloor}
        onChangeActiveFloor={setActiveFloor}
        performanceMode={performanceMode}
        onChangePerformanceMode={setPerformanceMode}
        focusedZoneId={focusedZoneId}
        onSelectFocusedZone={(zId) => {
          setFocusedZoneId(zId);
        }}
        sunHour={sunHour}
        onChangeSunHour={setSunHour}
        cameraPreset={cameraPreset}
        onChangeCameraPreset={setCameraPreset}
        wallCutaway={wallCutaway}
        onToggleWallCutaway={() => setWallCutaway((prev) => !prev)}
        showClimateHeatmap={showClimateHeatmap}
        onToggleClimateHeatmap={() => setShowClimateHeatmap((prev) => !prev)}
        showEnergyFlow={showEnergyFlow}
        onToggleEnergyFlow={() => setShowEnergyFlow((prev) => !prev)}
        showSensorRadii={showSensorRadii}
        onToggleSensorRadii={() => setShowSensorRadii((prev) => !prev)}
        showFloatingBadges={showFloatingBadges}
        onToggleFloatingBadges={() => setShowFloatingBadges((prev) => !prev)}
      />
    </div>
  );
}
