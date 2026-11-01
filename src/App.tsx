/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from 'react';
import { BottomControlDock } from './components/BottomControlDock';
import { CabinetPlannerModal } from './components/CabinetPlannerModal';
import { DevicesAndEnergyView } from './components/DevicesAndEnergyView';
import { EditorWorkspacePanel } from './components/EditorWorkspacePanel';
import { EntityControlPopover } from './components/EntityControlPopover';
import { HacsExportView } from './components/HacsExportView';
import { ThreeFloorplanViewport } from './components/ThreeFloorplanViewport';
import { TwoDFloorplanCanvas } from './components/TwoDFloorplanCanvas';
import { WallModulePlannerModal } from './components/WallModulePlannerModal';
import {
  ASSET_CATALOG,
  INITIAL_FLOORPLAN_PROJECT,
  INITIAL_HA_ENTITIES,
} from './data/catalogAndInitialState';
import { ConnectionStatus, HAWebSocketBridge } from './services/haWebSocketBridge';
import {
  ActiveFloorView,
  buildDefaultAutoPowerLines,
  CameraPresetId,
  CatalogItem,
  CustomWallSegment,
  EditorViewMode,
  FloorLevelId,
  FloorplanProject,
  FloorplanZone,
  HAEntityState,
  isAssetActuatorControllable,
  isFenceOrHedgeAsset,
  isOpeningActuatorControllable,
  isWalkwayAsset,
  LiveCockpitConfig,
  PerformanceMode,
  PlacedAsset,
  PowerLineRoute,
  VisualStyleMode,
  WallOpening,
  WallOpeningType,
  WallPlannerCategory,
  WallSideId,
  WeatherSimulationMode,
  WorkspaceTab,
} from './types/floorplan';
import { getCurrentLocalHour, useControlDockSettings } from './hooks/useControlDockSettings';
import { useProjectHistory } from './hooks/useProjectHistory';
import {
  EMPTY_FLOORPLAN_PROJECT,
  STORAGE_KEY,
  deduplicateProjectOpeningsAndGates,
  loadInitialProjectFromStorage,
} from './utils/projectNormalization';

export default function App() {
  const [project, setProject] = useState<FloorplanProject>(() => loadInitialProjectFromStorage());

  const [entities, setEntities] = useState<Record<string, HAEntityState>>(INITIAL_HA_ENTITIES);

  // Parse optional Lovelace Card URL query params (?tab=live&displayMode=pure_live&hideHeader=1&hideDock=1&hideRoomList=1)
  const initialUrlParams =
    typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
  const initialDisplayMode = initialUrlParams?.get('displayMode') || '';
  const initialIsPureLive =
    initialDisplayMode === 'pure_live' || initialUrlParams?.get('pureLive') === '1';

  const [activeTab, setActiveTab] = useState<WorkspaceTab>(() => {
    const tabParam = initialUrlParams?.get('tab');
    if (tabParam === 'live' || initialIsPureLive || initialDisplayMode === 'live_minimal') {
      return 'live';
    }
    return 'editor';
  });
  const [editorViewMode, setEditorViewMode] = useState<EditorViewMode>(() =>
    typeof window !== 'undefined' && window.innerWidth < 1024 ? '2d' : 'split'
  );

  // Card / Pure Live Chromeless Mode states (hides top navigation header & bottom camera/control dock)
  const [hideTopHeader, setHideTopHeader] = useState<boolean>(() =>
    initialUrlParams?.get('hideHeader') === '1' ||
    initialIsPureLive ||
    initialDisplayMode === 'live_minimal'
  );
  const [hideBottomDock, setHideBottomDock] = useState<boolean>(() =>
    initialUrlParams?.get('hideDock') === '1' || initialIsPureLive
  );
  const [hideRoomDirectory, setHideRoomDirectory] = useState<boolean>(() =>
    initialUrlParams?.get('hideRoomList') === '1' || initialIsPureLive
  );

  // Persistent 3D Control Dock Settings (Hybrid: Device localStorage + Project HA Sync)
  const {
    activeFloor,
    setActiveFloor,
    activeSingleFloor,
    performanceMode,
    setPerformanceMode,
    sunHour,
    setSunHour,
    isRealTimeClock,
    setIsRealTimeClock,
    visualStyle,
    setVisualStyle,
    weatherMode,
    setWeatherMode,
    showPresenceAvatars,
    setShowPresenceAvatars,
    showSmartCockpitCards,
    setShowSmartCockpitCards,
    cameraPreset,
    setCameraPreset,
    focusedZoneId,
    setFocusedZoneId,
    wallCutaway,
    setWallCutaway,
    showClimateHeatmap,
    setShowClimateHeatmap,
    showEnergyFlow,
    setShowEnergyFlow,
    showSensorRadii,
    setShowSensorRadii,
    showFloatingBadges,
    setShowFloatingBadges,
    show3DCards,
    setShow3DCards,
    autoIdleAfterInactivity,
    setAutoIdleAfterInactivity,
    dockCollapsed,
    setDockCollapsed,
  } = useControlDockSettings(project, setProject, activeTab, initialUrlParams);
  const [showTourRouteModal, setShowTourRouteModal] = useState<boolean>(false);

  // Selection & Editor States
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
  const [selectedEntityId, setSelectedEntityId] = useState<string | null>(null);
  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(null);
  const [selectedOpeningId, setSelectedOpeningId] = useState<string | null>(null);
  const [selectedWallId, setSelectedWallId] = useState<string | null>(null);
  const [pendingCatalogItem, setPendingCatalogItem] = useState<CatalogItem | null>(null);
  const [cameraIdleMode, setCameraIdleMode] = useState<boolean>(false);
  const [wallPlannerModalState, setWallPlannerModalState] = useState<{
    zoneId: string;
    wallSide?: WallSideId;
    category?: WallPlannerCategory;
  } | null>(null);
  const [cabinetPlannerAssetId, setCabinetPlannerAssetId] = useState<string | null>(null);

  const handleOpenWallPlanner = (
    zoneId: string,
    wallSide?: WallSideId,
    category?: WallPlannerCategory
  ) => {
    setSelectedZoneId(zoneId);
    setWallPlannerModalState({ zoneId, wallSide, category });
  };

  const handleApplyWallModules = (
    zoneId: string,
    wallSide: WallSideId,
    category: WallPlannerCategory,
    newAssets: PlacedAsset[],
    replaceExistingOnWall: boolean
  ) => {
    setProject((prev) => {
      const isElecNet = category === 'electrical_net';
      const keptAssets = replaceExistingOnWall
        ? prev.assets.filter((a) => {
            if (
              a.catalogId !== 'wall_planner_module' ||
              (a.wallModuleConfig?.hostZoneId ?? a.wallModuleConfig?.attachedZoneId) !== zoneId ||
              (a.wallModuleConfig?.wallSide ?? a.wallModuleConfig?.attachedWallSide) !== wallSide
            ) {
              return true;
            }
            const existingIsElec = a.wallModuleConfig?.category === 'electrical_net';
            return existingIsElec !== isElecNet;
          })
        : prev.assets;
      return {
        ...prev,
        assets: [...keptAssets, ...newAssets],
      };
    });
    if (newAssets.length > 0) {
      setSelectedAssetId(newAssets[0].id);
      setSelectedZoneId(null);
      setSelectedOpeningId(null);
    }
  };
  const clipboardRef = useRef<
    | { kind: 'asset'; data: PlacedAsset }
    | { kind: 'opening'; data: WallOpening }
    | { kind: 'zone'; data: FloorplanZone }
    | { kind: 'wall'; data: CustomWallSegment }
    | null
  >(null);

  // Undo / Redo History Stack (coalesces continuous drags into single undo steps, ignores dockPreferences)
  const { historyCounts, handleUndo, handleRedo, skipNextRemoteEchoRef } = useProjectHistory(
    project,
    setProject
  );

  // Home Assistant WebSocket Bridge & Server Storage Sync
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('simulated');
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [haServerSyncedAt, setHaServerSyncedAt] = useState<string | null>(null);
  const wsBridgeRef = useRef<HAWebSocketBridge | null>(null);

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
        setProject(deduplicateProjectOpeningsAndGates(remoteProject));
        setHaServerSyncedAt(new Date().toLocaleTimeString('de-DE'));
      }
    );
    return () => {
      wsBridgeRef.current?.disconnect();
    };
  }, []);


  // Persist project changes to localStorage (debounced to keep 60 FPS dragging silky-smooth) AND sync to Home Assistant .storage
  const latestProjectForStorageRef = useRef<FloorplanProject>(project);
  latestProjectForStorageRef.current = project;

  useEffect(() => {
    const flushToStorage = () => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(latestProjectForStorageRef.current));
      } catch {
        // Ignore storage quota errors
      }
    };
    window.addEventListener('beforeunload', flushToStorage);
    return () => window.removeEventListener('beforeunload', flushToStorage);
  }, []);

  useEffect(() => {
    const localTimer = window.setTimeout(() => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(project));
      } catch {
        // Ignore storage quota errors
      }
    }, 320);

    if (skipNextRemoteEchoRef.current) {
      skipNextRemoteEchoRef.current = false;
      return () => window.clearTimeout(localTimer);
    }

    let haTimer = 0;
    if (connectionStatus === 'connected' && wsBridgeRef.current && project.zones.length > 0) {
      haTimer = window.setTimeout(async () => {
        const ok = await wsBridgeRef.current?.saveProjectToHA(project);
        if (ok) {
          setHaServerSyncedAt(new Date().toLocaleTimeString('de-DE'));
        }
      }, 650);
    }
    return () => {
      window.clearTimeout(localTimer);
      if (haTimer) window.clearTimeout(haTimer);
    };
  }, [project]);

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
      setProject(deduplicateProjectOpeningsAndGates(remote));
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

    // Always update this specific opening's override state first
    handleUpdateOpening(openingId, {
      previewStateOverride: targetState,
      openState: targetState,
      openPositionPct: targetState === 'open' ? 100 : 0,
    });

    const sensorAShared =
      opening.entityId &&
      project.openings.some((o) => o.id !== openingId && o.entityId === opening.entityId);
    const sensorBShared =
      opening.tiltEntityId &&
      project.openings.some((o) => o.id !== openingId && o.tiltEntityId === opening.tiltEntityId);

    setEntities((prev) => {
      const next = { ...prev };
      const sensorA = opening.entityId;
      const sensorB = opening.tiltEntityId;

      if (sensorA && next[sensorA] && !sensorAShared) {
        const sAState = targetState === 'closed' ? 'closed' : 'open';
        next[sensorA] = {
          ...next[sensorA],
          state: sAState,
          last_changed: new Date().toISOString(),
        };
      }
      if (sensorB && next[sensorB] && !sensorBShared) {
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
  // Note: Entities are NOT created automatically on placement — only when explicitly bound or requested by the user.
  const handlePlaceCatalogItemAt = (worldX: number, worldZ: number) => {
    if (!pendingCatalogItem) return;

    const uid = Date.now();
    const isLinear = isFenceOrHedgeAsset(pendingCatalogItem.id);
    const isWalk = isWalkwayAsset(pendingCatalogItem.id);

    const newAsset: PlacedAsset = {
      id: `asset_${uid}`,
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
      entityId: undefined,
      statusBadgeMode: 'hidden',
      calloutCardMode: 'hidden',
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

  // Update, Duplicate, or Delete Placed 3D Asset (with automatic Group Delta Movement when groupId is active)
  const handleUpdateAsset = (assetId: string, patch: Partial<PlacedAsset>) => {
    setProject((prev) => {
      const target = prev.assets.find((a) => a.id === assetId);
      if (!target) return prev;

      const activeGroupId =
        patch.groupId !== undefined ? patch.groupId : target.groupId;
      const moveTogether =
        (patch.moveGroupTogether ?? target.moveGroupTogether) !== false;
      const hasXZMove =
        patch.position &&
        (Math.abs(patch.position[0] - target.position[0]) > 0.0005 ||
          Math.abs(patch.position[2] - target.position[2]) > 0.0005);

      const dx = patch.position ? patch.position[0] - target.position[0] : 0;
      const dz = patch.position ? patch.position[2] - target.position[2] : 0;

      return {
        ...prev,
        assets: prev.assets.map((a) => {
          if (a.id === assetId) {
            return { ...a, ...patch };
          }
          if (
            activeGroupId &&
            moveTogether &&
            hasXZMove &&
            a.groupId === activeGroupId &&
            !a.locked
          ) {
            return {
              ...a,
              position: [
                +(a.position[0] + dx).toFixed(3),
                a.position[1],
                +(a.position[2] + dz).toFixed(3),
              ],
            };
          }
          return a;
        }),
      };
    });
  };

  const handleBatchUpdateGroup = (
    groupId: string,
    patch: Partial<PlacedAsset>
  ) => {
    if (!groupId) return;
    const safePatch = Object.fromEntries(
      Object.entries(patch).filter(
        ([key, val]) => key !== 'position' && key !== 'id' && val !== undefined
      )
    ) as Partial<PlacedAsset>;
    setProject((prev) => ({
      ...prev,
      assets: prev.assets.map((a) =>
        a.groupId === groupId
          ? {
              ...a,
              ...safePatch,
              position: a.position,
            }
          : a
      ),
    }));
  };

  const handleUpdatePowerLines = (powerLines: PowerLineRoute[]) => {
    setProject((prev) => ({
      ...prev,
      powerLines,
    }));
    if (powerLines.length > 0) {
      setShowEnergyFlow(true);
    }
  };

  const handleDuplicateAsset = (assetId: string) => {
    const orig = project.assets.find((a) => a.id === assetId);
    if (!orig) return;
    const uid = Date.now();
    const copy: PlacedAsset = {
      ...orig,
      id: `asset_${uid}`,
      name: `${orig.name} (Kopie)`,
      position: [orig.position[0] + 0.6, orig.position[1], orig.position[2] + 0.6],
      entityId: undefined,
    };
    setProject((prev) => ({
      ...prev,
      assets: [...prev.assets, copy],
    }));
    setSelectedAssetId(copy.id);
  };

  const handleDeleteAsset = (assetId: string) => {
    const target = project.assets.find((a) => a.id === assetId);
    if (target?.locked) return;
    setProject((prev) => ({
      ...prev,
      assets: prev.assets.filter((a) => a.id !== assetId),
    }));
    setSelectedAssetId(null);
  };

  // Add, Update, or Delete Indoor Building (Wohnraum / Nebengebäude), Interior Room (Raum) or Outdoor Landscaping Zone
  const handleAddZone = (
    zoneType: 'indoor' | 'outdoor' | 'outbuilding' | 'room',
    targetBuildingId?: string
  ) => {
    const existingOutbuildings = project.zones.filter(
      (z) =>
        z.zoneType === 'indoor' &&
        (z.zoneRole === 'outbuilding' ||
          (z.buildingId && z.buildingId !== 'main_house' && !z.buildingId.startsWith('main_house')))
    );
    const outbuildingIndex = existingOutbuildings.length + 1;
    const nextOutbuildingId =
      outbuildingIndex === 1
        ? 'outbuilding_garage'
        : outbuildingIndex === 2
        ? 'outbuilding_garage_2'
        : outbuildingIndex === 3
        ? 'outbuilding_workshop'
        : `outbuilding_garage_${outbuildingIndex}`;

    // Find parent building shell to center a newly created interior room inside it
    const resolvedRoomBuildingId = targetBuildingId || 'main_house';
    const parentHull = project.zones.find(
      (z) =>
        z.zoneType === 'indoor' &&
        (z.buildingId === resolvedRoomBuildingId || z.id === resolvedRoomBuildingId) &&
        (z.level ?? 0) === activeSingleFloor &&
        z.zoneRole !== 'room'
    ) ||
      project.zones.find(
        (z) =>
          z.zoneType === 'indoor' &&
          (z.buildingId === resolvedRoomBuildingId || z.id === resolvedRoomBuildingId)
      );

    const existingRoomsInBldg = project.zones.filter(
      (z) =>
        z.zoneType === 'indoor' &&
        (z.buildingId || 'main_house') === resolvedRoomBuildingId &&
        (z.level ?? 0) === activeSingleFloor
    );

    const newZone: FloorplanZone =
      zoneType === 'indoor'
        ? {
            id: `zone_${Date.now()}`,
            name: 'Wohnraum (Hauptgebäude)',
            zoneType: 'indoor',
            zoneRole: 'wohnraum_building',
            level: activeSingleFloor,
            buildingId: targetBuildingId || 'main_house',
            rotationY: 0,
            x: 0,
            z: 0,
            width: 9.6,
            depth: 7.4,
            wallHeight: 2.6,
            surfaceMaterial: 'oak_parquet',
            wallColor: '#e4e0d8',
          }
        : zoneType === 'room'
        ? {
            id: `zone_room_${Date.now()}`,
            name: `Raum ${existingRoomsInBldg.length + 1}`,
            zoneType: 'indoor',
            zoneRole: 'room',
            level: activeSingleFloor,
            buildingId: resolvedRoomBuildingId,
            rotationY: parentHull?.rotationY ?? 0,
            x: parentHull ? parentHull.x : 0,
            z: parentHull ? parentHull.z : 0,
            width: parentHull ? Math.min(3.8, Math.max(2.2, parentHull.width * 0.48)) : 3.8,
            depth: parentHull ? Math.min(3.4, Math.max(2.2, parentHull.depth * 0.48)) : 3.4,
            wallHeight: parentHull?.wallHeight ?? 2.6,
            surfaceMaterial: 'travertine_stone',
            wallColor: '#e4e0d8',
          }
        : zoneType === 'outbuilding'
        ? {
            id: `zone_neben_${Date.now()}`,
            name:
              outbuildingIndex === 1
                ? 'Nebengebäude / Garage 1'
                : `Nebengebäude / Garage ${outbuildingIndex}`,
            zoneType: 'indoor',
            zoneRole: 'outbuilding',
            level: 0,
            buildingId: targetBuildingId || nextOutbuildingId,
            rotationY: 0,
            x: outbuildingIndex % 2 === 1 ? -9.5 : 9.5,
            z: 0.5 + (outbuildingIndex - 1) * 3.5,
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
            zoneType: 'indoor' as never, // overridden below
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

    if (zoneType === 'outdoor') {
      newZone.zoneType = 'outdoor';
    }

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
    const target = project.zones.find((z) => z.id === zoneId);
    if (target?.locked) return;
    setProject((prev) => ({
      ...prev,
      zones: prev.zones.filter((z) => z.id !== zoneId),
    }));
    setSelectedZoneId(null);
    if (focusedZoneId === zoneId) setFocusedZoneId(null);
  };

  // Custom Free-Standing Partition Wall CRUD (Wand-Designer)
  const handleCreateCustomWall = (newWall: CustomWallSegment) => {
    setProject((prev) => ({
      ...prev,
      customWalls: [...(prev.customWalls || []), newWall],
    }));
    setSelectedWallId(newWall.id);
    setSelectedZoneId(null);
    setSelectedAssetId(null);
    setSelectedOpeningId(null);
  };

  const handleAddCustomWall = () => {
    const newWall: CustomWallSegment = {
      id: `wall_${Date.now()}`,
      name: 'Freie Trennwand / Akzentwand',
      level: activeSingleFloor,
      x1: -2.0,
      z1: 0.0,
      x2: 2.0,
      z2: 0.0,
      height: 2.6,
      thickness: 0.16,
      mode: 'full',
      finish: 'wood_slats',
      color: '#e2e8f0',
    };
    handleCreateCustomWall(newWall);
  };

  const handleUpdateCustomWall = (wallId: string, patch: Partial<CustomWallSegment>) => {
    setProject((prev) => ({
      ...prev,
      customWalls: (prev.customWalls || []).map((w) =>
        w.id === wallId ? { ...w, ...patch } : w
      ),
    }));
  };

  const handleDeleteCustomWall = (wallId: string) => {
    const target = (project.customWalls || []).find((w) => w.id === wallId);
    if (target?.locked) return;
    setProject((prev) => ({
      ...prev,
      customWalls: (prev.customWalls || []).filter((w) => w.id !== wallId),
    }));
    setSelectedWallId(null);
  };

  const handleUpdatePersonRoom = (personEntityId: string, roomName: string) => {
    handleUpdateEntityAttributes(personEntityId, 'home', {
      room_name: roomName,
    });
  };

  // Rotate either a single building part (room/zone) OR an entire building group (co-rotating all rooms, windows, doors & assets)
  const handleRotateBuilding = (
    zoneId: string,
    deltaRad: number,
    wholeBuilding: boolean
  ) => {
    setProject((prev) => {
      const targetZone = prev.zones.find((z) => z.id === zoneId);
      if (!targetZone || targetZone.locked) return prev;

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
    setProject(deduplicateProjectOpeningsAndGates(INITIAL_FLOORPLAN_PROJECT));
    setEntities(INITIAL_HA_ENTITIES);
    setSelectedZoneId(null);
    setSelectedAssetId(null);
    setSelectedOpeningId(null);
    setFocusedZoneId(null);
    setActiveFloor(0);
  };

  // Add, Update, or Delete Window / Door / Patio Slider / Shutter Opening
  // Note: New openings do NOT auto-generate fake entities unless requested by the user.
  const handleAddOpening = (presetType: WallOpeningType) => {
    const uid = Date.now();
    const newOpening: WallOpening =
      presetType === 'window'
        ? {
            id: `open_win_${uid}`,
            name: 'Neues Doppelfenster',
            type: 'window',
            level: activeSingleFloor,
            x: -1.2,
            z: 1.2,
            rotationY: 0,
            width: 1.8,
            height: 1.4,
            sillHeight: 0.85,
            sensorLogicMode: 'single',
          }
        : presetType === 'floor_window'
        ? {
            id: `open_pwin_${uid}`,
            name: 'Neues Panoramafenster (Bodentief)',
            type: 'floor_window',
            level: activeSingleFloor,
            x: -6.4,
            z: -3.2,
            rotationY: Math.PI / 2,
            width: 2.2,
            height: 2.05,
            sillHeight: 0.15,
            sensorLogicMode: 'single',
          }
        : presetType === 'double_patio_door'
        ? {
            id: `open_patio_${uid}`,
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
          }
        : presetType === 'glass_block_window'
        ? {
            id: `open_gblock_${uid}`,
            name: 'Glasbausteine / Glasbaustein-Wandfeld',
            type: 'glass_block_window',
            level: activeSingleFloor,
            x: -6.9,
            z: 5.8,
            rotationY: Math.PI / 2,
            width: 1.6,
            height: 1.2,
            sillHeight: 1.0,
          }
        : presetType === 'garage_door'
        ? {
            id: `open_gate_${uid}`,
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
          }
        : {
            id: `open_door_${uid}`,
            name: 'Neue Zimmer- / Haustür',
            type: 'door',
            level: activeSingleFloor,
            x: 0.0,
            z: -4.2,
            rotationY: 0,
            width: 0.95,
            height: 2.1,
            sillHeight: 0.0,
            sensorLogicMode: 'single',
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
    const target = project.openings.find((o) => o.id === openingId);
    if (target?.locked) return;
    setProject((prev) => ({
      ...prev,
      openings: prev.openings.filter((o) => o.id !== openingId),
    }));
    setSelectedOpeningId(null);
  };

  const handleUpdateNorthAngle = (angleDeg: number) => {
    const normalized = ((angleDeg % 360) + 360) % 360;
    setProject((prev) => ({
      ...prev,
      northAngle: normalized,
    }));
  };

  // Global Standard Keyboard Shortcuts: Ctrl+C (Copy), Ctrl+V (Paste), Ctrl+D (Duplicate), Delete/Backspace (Delete), R (Rotate), Esc (Cancel)
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      const tag = document.activeElement?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') {
        return;
      }

      const isMod = e.ctrlKey || e.metaKey;

      // ESC: Cancel pending catalog placement or deselect
      if (e.key === 'Escape') {
        if (pendingCatalogItem) {
          setPendingCatalogItem(null);
        } else {
          setSelectedAssetId(null);
          setSelectedOpeningId(null);
          setSelectedZoneId(null);
          setSelectedWallId(null);
        }
        return;
      }

      // CTRL+Z / CMD+Z: Undo (or CTRL+SHIFT+Z / CTRL+Y: Redo)
      if (isMod && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) {
          handleRedo();
        } else {
          handleUndo();
        }
        return;
      }
      if (isMod && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        handleRedo();
        return;
      }

      // CTRL+C / CMD+C: Copy selected Asset, Opening, Zone, or Custom Wall
      if (isMod && e.key.toLowerCase() === 'c') {
        if (selectedAssetId) {
          const a = project.assets.find((x) => x.id === selectedAssetId);
          if (a) {
            clipboardRef.current = { kind: 'asset', data: JSON.parse(JSON.stringify(a)) };
            e.preventDefault();
          }
        } else if (selectedOpeningId) {
          const o = project.openings.find((x) => x.id === selectedOpeningId);
          if (o) {
            clipboardRef.current = { kind: 'opening', data: JSON.parse(JSON.stringify(o)) };
            e.preventDefault();
          }
        } else if (selectedZoneId) {
          const z = project.zones.find((x) => x.id === selectedZoneId);
          if (z) {
            clipboardRef.current = { kind: 'zone', data: JSON.parse(JSON.stringify(z)) };
            e.preventDefault();
          }
        } else if (selectedWallId) {
          const w = (project.customWalls || []).find((x) => x.id === selectedWallId);
          if (w) {
            clipboardRef.current = { kind: 'wall', data: JSON.parse(JSON.stringify(w)) };
            e.preventDefault();
          }
        }
        return;
      }

      // CTRL+V / CMD+V: Paste copied item onto active floor with unique ID & independent sensor entity
      if (isMod && e.key.toLowerCase() === 'v') {
        const clip = clipboardRef.current;
        if (!clip) return;
        e.preventDefault();
        const uid = Date.now();

        if (clip.kind === 'asset') {
          const src = clip.data;
          const isGateOrCover =
            src.catalogId === 'electric_roller_gate' ||
            src.catalogId === 'electric_sliding_driveway_gate' ||
            src.catalogId === 'garden_pedestrian_gate' ||
            src.catalogId === 'garage_door_opener_rail';
          const pasted: PlacedAsset = {
            ...JSON.parse(JSON.stringify(src)),
            id: `asset_paste_${uid}`,
            name: `${src.name} (Kopie)`,
            level: activeSingleFloor,
            position: [
              +(src.position[0] + 0.5).toFixed(2),
              src.position[1],
              +(src.position[2] + 0.5).toFixed(2),
            ],
            entityId: isGateOrCover ? `cover.tor_${uid}` : src.entityId,
          };
          setProject((prev) => ({ ...prev, assets: [...prev.assets, pasted] }));
          setSelectedAssetId(pasted.id);
          setSelectedOpeningId(null);
          setSelectedZoneId(null);
          setSelectedWallId(null);
        } else if (clip.kind === 'opening') {
          const src = clip.data;
          const prefix =
            src.type === 'garage_door' || src.type === 'double_patio_door'
              ? 'cover.opening'
              : 'binary_sensor.opening';
          const pasted: WallOpening = {
            ...JSON.parse(JSON.stringify(src)),
            id: `open_paste_${uid}`,
            name: `${src.name} (Kopie)`,
            level: activeSingleFloor,
            x: +(src.x + 0.5).toFixed(2),
            z: +(src.z + 0.5).toFixed(2),
            entityId: src.entityId ? `${prefix}_${uid}` : undefined,
            tiltEntityId: src.tiltEntityId ? `binary_sensor.opening_${uid}_tilt` : undefined,
            shutterEntityId: src.shutterEntityId ? `cover.rollladen_${uid}` : undefined,
          };
          setProject((prev) => ({ ...prev, openings: [...prev.openings, pasted] }));
          setSelectedOpeningId(pasted.id);
          setSelectedAssetId(null);
          setSelectedZoneId(null);
          setSelectedWallId(null);
        } else if (clip.kind === 'zone') {
          const src = clip.data;
          const pasted: FloorplanZone = {
            ...JSON.parse(JSON.stringify(src)),
            id: `zone_paste_${uid}`,
            name: `${src.name} (Kopie)`,
            level: activeSingleFloor,
            x: +(src.x + 0.8).toFixed(2),
            z: +(src.z + 0.8).toFixed(2),
            points: src.points
              ? src.points.map(([px, pz]: [number, number]) => [
                  +(px + 0.8).toFixed(2),
                  +(pz + 0.8).toFixed(2),
                ])
              : undefined,
          };
          setProject((prev) => ({ ...prev, zones: [...prev.zones, pasted] }));
          setSelectedZoneId(pasted.id);
          setSelectedAssetId(null);
          setSelectedOpeningId(null);
          setSelectedWallId(null);
        } else if (clip.kind === 'wall') {
          const src = clip.data;
          const pasted: CustomWallSegment = {
            ...JSON.parse(JSON.stringify(src)),
            id: `cwall_paste_${uid}`,
            name: `${src.name} (Kopie)`,
            level: activeSingleFloor,
            x1: +(src.x1 + 0.5).toFixed(2),
            z1: +(src.z1 + 0.5).toFixed(2),
            x2: +(src.x2 + 0.5).toFixed(2),
            z2: +(src.z2 + 0.5).toFixed(2),
          };
          setProject((prev) => ({
            ...prev,
            customWalls: [...(prev.customWalls || []), pasted],
          }));
          setSelectedWallId(pasted.id);
          setSelectedAssetId(null);
          setSelectedOpeningId(null);
          setSelectedZoneId(null);
        }
        return;
      }

      // CTRL+D / CMD+D: Immediate Duplicate
      if (isMod && e.key.toLowerCase() === 'd') {
        if (selectedAssetId) {
          e.preventDefault();
          handleDuplicateAsset(selectedAssetId);
        }
        return;
      }

      // DELETE / BACKSPACE: Delete selected item
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedAssetId) {
          e.preventDefault();
          handleDeleteAsset(selectedAssetId);
        } else if (selectedOpeningId) {
          e.preventDefault();
          handleDeleteOpening(selectedOpeningId);
        } else if (selectedWallId) {
          e.preventDefault();
          handleDeleteCustomWall(selectedWallId);
        } else if (selectedZoneId) {
          e.preventDefault();
          handleDeleteZone(selectedZoneId);
        }
        return;
      }

      // R: Rotate selected Asset, Opening, or Zone (unless locked)
      if (!isMod && e.key.toLowerCase() === 'r') {
        if (selectedAssetId) {
          e.preventDefault();
          const a = project.assets.find((x) => x.id === selectedAssetId);
          if (a && !a.locked) {
            const step = e.shiftKey ? Math.PI / 2 : Math.PI / 4;
            handleUpdateAsset(a.id, { rotationY: (a.rotationY + step) % (Math.PI * 2) });
          }
        } else if (selectedOpeningId) {
          e.preventDefault();
          const o = project.openings.find((x) => x.id === selectedOpeningId);
          if (o && !o.locked) {
            handleUpdateOpening(o.id, {
              rotationY: Math.abs(Math.sin(o.rotationY)) >= 0.6 ? 0 : Math.PI / 2,
            });
          }
        } else if (selectedZoneId) {
          e.preventDefault();
          handleRotateBuilding(selectedZoneId, -Math.PI / 12, e.shiftKey);
        }
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [
    project,
    selectedAssetId,
    selectedOpeningId,
    selectedZoneId,
    selectedWallId,
    pendingCatalogItem,
    activeSingleFloor,
  ]);

  const activePopoverOpening = selectedOpeningId
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

  const handleUpdateLiveCockpitConfig = (liveCockpitConfig: LiveCockpitConfig) => {
    setProject((prev) => ({
      ...prev,
      liveCockpitConfig,
    }));
  };

  // Clicking a door, window, or gate in Live 3D mode:
  // - If it is a read-only contact sensor (binary_sensor / sensor without actuatorEntityId), NEVER toggle it open on click; only show its live status popover.
  // - If it has a controllable actuator (cover.*, switch.*, button.*, or actuatorEntityId), trigger the actuator.
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
      const canControl = isOpeningActuatorControllable(op, entities);
      if (!canControl) {
        // Strictly read-only contact sensor: clear any old manual preview override so 3D strictly matches HA sensor
        if (op.previewStateOverride) {
          handleUpdateOpening(op.id, { previewStateOverride: undefined });
        }
        return;
      }

      if (op.actuatorEntityId && entities[op.actuatorEntityId]) {
        handleToggleEntity(op.actuatorEntityId);
        return;
      }

      const isWin = op.type === 'window' || op.type === 'floor_window';
      // Determine current state of THIS specific opening
      let curr: 'closed' | 'tilted' | 'open' =
        op.previewStateOverride || op.openState || 'closed';
      if (!op.previewStateOverride && !op.openState) {
        if (op.dualSensorRule?.enabled && isWin) {
          const sA = entities[op.dualSensorRule.sensorAEntityId]?.state === 'on';
          const sB = entities[op.dualSensorRule.sensorBEntityId]?.state === 'on';
          curr = sA && sB ? 'open' : sA || sB ? 'tilted' : 'closed';
        } else if (op.entityId && entities[op.entityId]) {
          const st = entities[op.entityId].state;
          const pos = entities[op.entityId].attributes.current_position;
          if (st === 'tilted') curr = 'tilted';
          else if (st === 'open' || st === 'on' || (typeof pos === 'number' && pos > 10))
            curr = 'open';
          else curr = 'closed';
        }
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
        previewStateOverride: nextState,
        openState: nextState,
        openPositionPct: nextState === 'open' ? 100 : 0,
      });

      const isSharedEntity =
        op.entityId &&
        (project.openings.some((o) => o.id !== op.id && o.entityId === op.entityId) ||
          project.assets.some((a) => a.entityId === op.entityId));

      if (op.dualSensorRule?.enabled && isWin) {
        handleSetDualSensorTestState(op.id, nextState);
      } else if (op.entityId && entities[op.entityId] && !isSharedEntity) {
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
            nextState === 'closed' ? 'closed' : nextState === 'tilted' ? 'tilted' : 'open'
          );
        }
      }
    }
  };

  const showOnly2D = activeTab === 'editor' && editorViewMode === '2d';
  const showSplit2D3D = activeTab === 'editor' && editorViewMode === 'split';
  const isPureLiveCardView = activeTab === 'live' && hideTopHeader && hideBottomDock;

  const handleAddManualOverviewEntity = (entityId: string) => {
    const clean = entityId.trim();
    if (!clean) return;
    setProject((prev) => {
      const existing = prev.manualOverviewIds || [];
      if (existing.includes(clean)) return prev;
      return {
        ...prev,
        manualOverviewIds: [...existing, clean],
      };
    });
  };

  const handleRemoveManualOverviewEntity = (entityId: string) => {
    setProject((prev) => ({
      ...prev,
      manualOverviewIds: (prev.manualOverviewIds || []).filter((id) => id !== entityId),
    }));
  };

  return (
    <div className="relative w-full h-[100dvh] bg-[#090d16] text-slate-100 overflow-hidden select-none touch-manipulation">
      {/* Strict 3-Zone Top Navigation Bar Contract (Hidden when in Pure Live Card Mode) */}
      {!hideTopHeader && (
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
                if (typeof window !== 'undefined' && window.innerWidth < 1024) {
                  setEditorViewMode('2d');
                }
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

          {/* Zone 3: Pure Live Toggle + Primary Action Button */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {activeTab === 'live' && (
              <button
                type="button"
                onClick={() => {
                  setHideTopHeader(true);
                  setHideBottomDock(true);
                  setHideRoomDirectory(true);
                }}
                title="Nur Live-3D (Card-Ansicht ohne obere Leiste und ohne Kamerafahrt-Leiste)"
                className="px-2 sm:px-3 py-1.5 text-[11px] font-semibold text-emerald-300 bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-400/40 rounded-lg transition-colors whitespace-nowrap"
              >
                <span className="sm:hidden">Vollbild</span>
                <span className="hidden sm:inline">Nur Live (Card)</span>
              </button>
            )}
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
      )}

      {/* Subtle restore button in bottom-left when Pure Live Card Mode is active */}
      {(hideTopHeader || hideBottomDock) && (
        <button
          type="button"
          onClick={() => {
            setHideTopHeader(false);
            setHideBottomDock(false);
            setHideRoomDirectory(false);
          }}
          title="Menü- und Kamerafahrt-Leisten wieder einblenden"
          className="fixed bottom-3 left-3 z-30 px-2.5 py-1.5 rounded-xl bg-[#090d16]/85 hover:bg-slate-900 text-slate-300 hover:text-white border border-white/15 text-[10.5px] font-semibold shadow-xl backdrop-blur-sm transition-colors"
        >
          ☰ Leisten einblenden
        </button>
      )}

      {/* Main Viewport Area: 2D CAD Planner, Split 2D/3D (stacked on mobile/portrait tablet, side-by-side on desktop), or Full-Screen 3D */}
      <main
        className={`w-full h-full ${
          hideTopHeader ? 'pt-0' : 'pt-14'
        } flex flex-col lg:flex-row`}
      >
        {showOnly2D ? (
          <div className="w-full h-full">
            <TwoDFloorplanCanvas
              project={project}
              entities={entities}
              activeFloor={activeSingleFloor}
              selectedZoneId={selectedZoneId}
              selectedAssetId={selectedAssetId}
              selectedOpeningId={selectedOpeningId}
              selectedWallId={selectedWallId}
              pendingCatalogItem={pendingCatalogItem}
              onSelectZone={(zId) => {
                setSelectedZoneId(zId);
                setSelectedAssetId(null);
                setSelectedOpeningId(null);
                setSelectedWallId(null);
              }}
              onSelectAsset={(aId, eId) => {
                setSelectedAssetId(aId);
                setSelectedEntityId(eId || null);
                if (aId) {
                  setSelectedZoneId(null);
                  setSelectedOpeningId(null);
                  setSelectedWallId(null);
                }
              }}
              onSelectOpening={(oId) => {
                setSelectedOpeningId(oId);
                setSelectedAssetId(null);
                setSelectedZoneId(null);
                setSelectedWallId(null);
              }}
              onSelectWall={(wId) => {
                setSelectedWallId(wId);
                if (wId) {
                  setSelectedZoneId(null);
                  setSelectedAssetId(null);
                  setSelectedOpeningId(null);
                }
              }}
              onUpdateZone={handleUpdateZone}
              onCreateZone={handleCreateCustomZone}
              onDeleteZone={handleDeleteZone}
              onCreateCustomWall={handleCreateCustomWall}
              onUpdateCustomWall={handleUpdateCustomWall}
              onDeleteCustomWall={handleDeleteCustomWall}
              onRotateBuilding={handleRotateBuilding}
              onUpdateNorthAngle={handleUpdateNorthAngle}
              onUpdateAsset={handleUpdateAsset}
              onUpdateOpening={handleUpdateOpening}
              onPlaceCatalogItemAt={handlePlaceCatalogItemAt}
              onLoadDemoProject={handleLoadDemoProject}
              onClearProject={handleClearProject}
              onOpenWallPlanner={handleOpenWallPlanner}
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
                selectedWallId={selectedWallId}
                pendingCatalogItem={pendingCatalogItem}
                onSelectZone={(zId) => {
                  setSelectedZoneId(zId);
                  setSelectedAssetId(null);
                  setSelectedOpeningId(null);
                  setSelectedWallId(null);
                }}
                onSelectAsset={(aId, eId) => {
                  setSelectedAssetId(aId);
                  setSelectedEntityId(eId || null);
                  if (aId) {
                    setSelectedZoneId(null);
                    setSelectedOpeningId(null);
                    setSelectedWallId(null);
                  }
                }}
                onSelectOpening={(oId) => {
                  setSelectedOpeningId(oId);
                  setSelectedAssetId(null);
                  setSelectedZoneId(null);
                  setSelectedWallId(null);
                }}
                onSelectWall={(wId) => {
                  setSelectedWallId(wId);
                  if (wId) {
                    setSelectedZoneId(null);
                    setSelectedAssetId(null);
                    setSelectedOpeningId(null);
                  }
                }}
                onUpdateZone={handleUpdateZone}
                onCreateZone={handleCreateCustomZone}
                onDeleteZone={handleDeleteZone}
                onCreateCustomWall={handleCreateCustomWall}
                onUpdateCustomWall={handleUpdateCustomWall}
                onDeleteCustomWall={handleDeleteCustomWall}
                onRotateBuilding={handleRotateBuilding}
                onUpdateNorthAngle={handleUpdateNorthAngle}
                onUpdateAsset={handleUpdateAsset}
                onUpdateOpening={handleUpdateOpening}
                onPlaceCatalogItemAt={handlePlaceCatalogItemAt}
                onLoadDemoProject={handleLoadDemoProject}
                onClearProject={handleClearProject}
                onUndo={handleUndo}
                onRedo={handleRedo}
                canUndo={historyCounts.undo > 0}
                canRedo={historyCounts.redo > 0}
                onOpenWallPlanner={handleOpenWallPlanner}
              />
            </div>
            <div className="w-full h-1/2 lg:w-1/2 lg:h-full">
              <ThreeFloorplanViewport
                project={project}
                entities={entities}
                activeTab={activeTab}
                activeFloor={activeFloor}
                onChangeActiveFloor={setActiveFloor}
                performanceMode={performanceMode}
                visualStyle={visualStyle}
                weatherMode={weatherMode}
                showPresenceAvatars={showPresenceAvatars}
                showSmartCockpitCards={showSmartCockpitCards}
                sunHour={sunHour}
                wallCutaway={wallCutaway}
                showClimateHeatmap={showClimateHeatmap}
                showEnergyFlow={showEnergyFlow}
                showSensorRadii={showSensorRadii}
                showFloatingBadges={showFloatingBadges}
                show3DCards={show3DCards}
                showTourRouteModal={showTourRouteModal}
                onCloseTourRouteModal={() => setShowTourRouteModal(false)}
                cameraPreset={cameraPreset}
                focusedZoneId={focusedZoneId}
                selectedAssetId={selectedAssetId}
                selectedZoneId={selectedZoneId}
                pendingCatalogItem={pendingCatalogItem}
                cameraIdleMode={cameraIdleMode}
                autoIdleAfterInactivity={autoIdleAfterInactivity}
                onChangeCameraIdleMode={setCameraIdleMode}
                onUpdateNorthAngle={handleUpdateNorthAngle}
                onSelectAsset={(assetId, entityId) => {
                  setSelectedAssetId(assetId);
                  setSelectedEntityId(entityId || null);
                  if (assetId) {
                    setSelectedZoneId(null);
                    setSelectedOpeningId(null);
                    setSelectedWallId(null);
                  }
                }}
                onSelectZone={(zoneId) => {
                  setSelectedZoneId(zoneId);
                  setSelectedAssetId(null);
                  setSelectedOpeningId(null);
                  setSelectedWallId(null);
                }}
                onFocusZone={setFocusedZoneId}
                onSelectOpening={handleSelectOpeningIn3D}
                onUpdateAsset={handleUpdateAsset}
                onUpdateOpening={handleUpdateOpening}
                onUpdateZone={handleUpdateZone}
                onPlaceCatalogItemAt={handlePlaceCatalogItemAt}
                onQuickToggleEntity={handleToggleEntity}
                onToggleSensorRadii={() => setShowSensorRadii((prev) => !prev)}
                onToggleEnergyFlow={() => setShowEnergyFlow((prev) => !prev)}
                onTogglePresenceAvatars={() => setShowPresenceAvatars((prev) => !prev)}
                onUpdatePersonRoom={handleUpdatePersonRoom}
                onUpdateLiveCockpitConfig={handleUpdateLiveCockpitConfig}
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
              onChangeActiveFloor={setActiveFloor}
              performanceMode={performanceMode}
              visualStyle={visualStyle}
              weatherMode={weatherMode}
              showPresenceAvatars={showPresenceAvatars}
              showSmartCockpitCards={showSmartCockpitCards}
              sunHour={sunHour}
              wallCutaway={wallCutaway}
              showClimateHeatmap={showClimateHeatmap}
              showEnergyFlow={showEnergyFlow}
              showSensorRadii={showSensorRadii}
              showFloatingBadges={showFloatingBadges}
              show3DCards={show3DCards}
              showTourRouteModal={showTourRouteModal}
              onCloseTourRouteModal={() => setShowTourRouteModal(false)}
              cameraPreset={cameraPreset}
              focusedZoneId={focusedZoneId}
              selectedAssetId={selectedAssetId}
              selectedZoneId={selectedZoneId}
              pendingCatalogItem={pendingCatalogItem}
              cameraIdleMode={cameraIdleMode}
              autoIdleAfterInactivity={autoIdleAfterInactivity}
              onChangeCameraIdleMode={setCameraIdleMode}
              onUpdateNorthAngle={handleUpdateNorthAngle}
              onSelectAsset={(assetId, entityId) => {
                setSelectedAssetId(assetId);
                setSelectedEntityId(entityId || null);
                if (assetId) {
                  setSelectedZoneId(null);
                  setSelectedOpeningId(null);
                  setSelectedWallId(null);
                  if (activeTab === 'live') {
                    const clickedAsset = project.assets.find((a) => a.id === assetId);
                    if (clickedAsset) {
                      const groupMembers = clickedAsset.groupId
                        ? project.assets.filter((a) => a.groupId === clickedAsset.groupId)
                        : [clickedAsset];
                      const toggledEntities = new Set<string>();
                      for (const member of groupMembers) {
                        if (isAssetActuatorControllable(member, entities)) {
                          const targetActuator =
                            member.actuatorEntityId || member.entityId;
                          if (
                            targetActuator &&
                            !toggledEntities.has(targetActuator) &&
                            (member.controlMode === 'actuator' ||
                              member.controlMode === 'sensor_and_actuator')
                          ) {
                            toggledEntities.add(targetActuator);
                            handleToggleEntity(targetActuator);
                          }
                        }
                      }
                    }
                  }
                }
              }}
              onSelectZone={(zoneId) => {
                setSelectedZoneId(zoneId);
                setSelectedAssetId(null);
                setSelectedOpeningId(null);
                setSelectedWallId(null);
              }}
              onFocusZone={setFocusedZoneId}
              onSelectOpening={handleSelectOpeningIn3D}
              onUpdateAsset={handleUpdateAsset}
              onUpdateOpening={handleUpdateOpening}
              onUpdateZone={handleUpdateZone}
              onPlaceCatalogItemAt={handlePlaceCatalogItemAt}
              onQuickToggleEntity={handleToggleEntity}
              onToggleSensorRadii={() => setShowSensorRadii((prev) => !prev)}
              onToggleEnergyFlow={() => setShowEnergyFlow((prev) => !prev)}
              onTogglePresenceAvatars={() => setShowPresenceAvatars((prev) => !prev)}
              onUpdatePersonRoom={handleUpdatePersonRoom}
              onUpdateLiveCockpitConfig={handleUpdateLiveCockpitConfig}
              pureLiveMode={isPureLiveCardView}
              hideRoomDirectory={hideRoomDirectory}
            />
          </div>
        )}
      </main>

      {/* Note: No EntityControlPopover is shown in Live 3D mode — Live 3D is strictly for viewing & direct actuator toggling */}

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
          selectedWallId={selectedWallId}
          pendingCatalogItem={pendingCatalogItem}
          onSelectCatalogItemToPlace={setPendingCatalogItem}
          onSelectAsset={(aId) => {
            setSelectedAssetId(aId);
            if (aId) {
              setSelectedZoneId(null);
              setSelectedOpeningId(null);
              setSelectedWallId(null);
            }
          }}
          onSelectZone={(zId) => {
            setSelectedZoneId(zId);
            setSelectedAssetId(null);
            setSelectedOpeningId(null);
            setSelectedWallId(null);
          }}
          onSelectOpening={(oId) => {
            setSelectedOpeningId(oId);
            setSelectedAssetId(null);
            setSelectedZoneId(null);
            setSelectedWallId(null);
          }}
          onSelectWall={(wId) => {
            setSelectedWallId(wId);
            if (wId) {
              setSelectedAssetId(null);
              setSelectedZoneId(null);
              setSelectedOpeningId(null);
            }
          }}
          onUpdateAsset={handleUpdateAsset}
          onDeleteAsset={handleDeleteAsset}
          onDuplicateAsset={handleDuplicateAsset}
          onImportCustomGlb={handleImportCustomGlb}
          onAddZone={handleAddZone}
          onUpdateZone={handleUpdateZone}
          onDeleteZone={handleDeleteZone}
          onAddCustomWall={handleAddCustomWall}
          onUpdateCustomWall={handleUpdateCustomWall}
          onDeleteCustomWall={handleDeleteCustomWall}
          onAddOpening={handleAddOpening}
          onUpdateOpening={handleUpdateOpening}
          onDeleteOpening={handleDeleteOpening}
          onSetDualSensorTestState={handleSetDualSensorTestState}
          onRotateBuilding={handleRotateBuilding}
          onLoadDemoProject={handleLoadDemoProject}
          onClearProject={handleClearProject}
          onUndo={handleUndo}
          onRedo={handleRedo}
          canUndo={historyCounts.undo > 0}
          canRedo={historyCounts.redo > 0}
          onOpenWallPlanner={handleOpenWallPlanner}
          onOpenCabinetPlanner={(assetId) => setCabinetPlannerAssetId(assetId)}
          onBatchUpdateGroup={handleBatchUpdateGroup}
          onUpdatePowerLines={handleUpdatePowerLines}
        />
      )}

      {/* Interactive Wall- & Einbau-Planer Modal (Küche, Wohnwand, Garderobe, Schränke) */}
      {wallPlannerModalState &&
        (() => {
          const targetZone = project.zones.find(
            (z) => z.id === wallPlannerModalState.zoneId
          );
          if (!targetZone) return null;
          return (
            <WallModulePlannerModal
              zone={targetZone}
              initialWallSide={wallPlannerModalState.wallSide}
              initialCategory={wallPlannerModalState.category}
              existingAssets={project.assets}
              openings={project.openings}
              onApplyWallModules={handleApplyWallModules}
              onClose={() => setWallPlannerModalState(null)}
            />
          );
        })()}

      {/* Interactive 2D Distribution Cabinet Planner Modal (Grafischer Unterverteiler- & Zählerschrank-Editor im Hauptfenster) */}
      {cabinetPlannerAssetId &&
        (() => {
          const targetAsset = project.assets.find((a) => a.id === cabinetPlannerAssetId);
          if (!targetAsset) return null;
          const catItem = ASSET_CATALOG.find((c) => c.id === targetAsset.catalogId);
          return (
            <CabinetPlannerModal
              asset={targetAsset}
              catalogItem={catItem}
              entities={entities}
              onUpdateAsset={handleUpdateAsset}
              onClose={() => setCabinetPlannerAssetId(null)}
            />
          );
        })()}

      {/* Overview Modal (Strictly Planned Assets, Lamps, Sun Sails, Sub-Distributions, Sensors + Manually Added Entities) */}
      {activeTab === 'devices' && (
        <DevicesAndEnergyView
          project={project}
          entities={entities}
          onToggleEntity={handleToggleEntity}
          onTriggerAlarmTest={(entityId) => {
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
            const foundAsset = project.assets.find(
              (a) => a.entityId === entityId || a.actuatorEntityId === entityId
            );
            if (foundAsset) {
              setSelectedAssetId(foundAsset.id);
              if (foundAsset.level !== undefined && activeFloor !== 'all_stacked') {
                setActiveFloor(foundAsset.level);
              }
            }
            setSelectedEntityId(entityId);
            setActiveTab('live');
          }}
          onFocusAssetOrOpeningIn3D={(opts) => {
            if (opts.level !== undefined && activeFloor !== 'all_stacked') {
              setActiveFloor(opts.level as FloorLevelId);
            }
            if (opts.assetId) {
              setSelectedAssetId(opts.assetId);
              setSelectedOpeningId(null);
              setSelectedZoneId(null);
            } else if (opts.openingId) {
              setSelectedOpeningId(opts.openingId);
              setSelectedAssetId(null);
              setSelectedZoneId(null);
            } else if (opts.zoneId) {
              setSelectedZoneId(opts.zoneId);
              setFocusedZoneId(opts.zoneId);
            }
            if (opts.entityId) {
              setSelectedEntityId(opts.entityId);
            }
            setActiveTab('live');
          }}
          onAddManualOverviewEntity={handleAddManualOverviewEntity}
          onRemoveManualOverviewEntity={handleRemoveManualOverviewEntity}
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
            setProject(deduplicateProjectOpeningsAndGates(INITIAL_FLOORPLAN_PROJECT));
            setEntities(INITIAL_HA_ENTITIES);
            setFocusedZoneId(null);
            setActiveFloor(0);
          }}
          onImportProjectJson={(imported) =>
            setProject(deduplicateProjectOpeningsAndGates(imported))
          }
          onActivatePureLivePreview={(opts) => {
            setHideTopHeader(opts.hideHeader);
            setHideBottomDock(opts.hideDock);
            setHideRoomDirectory(opts.hideRoomList);
            setActiveTab('live');
          }}
          onClose={() => setActiveTab('live')}
        />
      )}

      {/* Unified Collapsible Bottom Control Dock with Stockwerk-Umschalter & Room Focus Quick-Select */}
      {!hideBottomDock && !(activeTab === 'editor' && editorViewMode === '2d') && (
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
          onChangeSunHour={(h) => {
            setIsRealTimeClock(false);
            setSunHour(h);
          }}
          isRealTimeClock={isRealTimeClock}
          onToggleRealTimeClock={() => {
            setIsRealTimeClock((prev) => {
              const next = !prev;
              if (next) {
                setSunHour(getCurrentLocalHour());
              }
              return next;
            });
          }}
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
          show3DCards={show3DCards}
          onToggle3DCards={() => setShow3DCards((prev) => !prev)}
          visualStyle={visualStyle}
          onChangeVisualStyle={setVisualStyle}
          weatherMode={weatherMode}
          onChangeWeatherMode={setWeatherMode}
          weatherEntityId={project.liveCockpitConfig?.weatherEntityId}
          weatherEntities={Object.keys(entities)
            .filter((id) => id.startsWith('weather.'))
            .map((id) => ({
              id,
              label: entities[id]?.attributes.friendly_name || id,
              state: entities[id]?.state || '',
            }))}
          onChangeWeatherEntityId={(entityId) =>
            handleUpdateLiveCockpitConfig({
              ...(project.liveCockpitConfig || {
                energyCard: { enabled: true },
                weatherSolarCard: { enabled: true },
                securityCard: { enabled: true },
                personTrackerCard: { enabled: true },
                roomClimateBadge: { enabled: true },
              }),
              weatherEntityId: entityId,
            })
          }
          holidayThemeMode={project.liveCockpitConfig?.holidayThemeMode || 'auto'}
          onChangeHolidayThemeMode={(mode) =>
            handleUpdateLiveCockpitConfig({
              ...(project.liveCockpitConfig || {
                energyCard: { enabled: true },
                weatherSolarCard: { enabled: true },
                securityCard: { enabled: true },
                personTrackerCard: { enabled: true },
                roomClimateBadge: { enabled: true },
              }),
              holidayThemeMode: mode,
            })
          }
          showPresenceAvatars={showPresenceAvatars}
          onTogglePresenceAvatars={() => setShowPresenceAvatars((prev) => !prev)}
          showSmartCockpitCards={showSmartCockpitCards}
          onToggleSmartCockpitCards={() => setShowSmartCockpitCards((prev) => !prev)}
          cameraIdleMode={cameraIdleMode}
          onToggleCameraIdleMode={() => setCameraIdleMode((prev) => !prev)}
          onOpenTourConfig={() => setShowTourRouteModal(true)}
          autoIdleAfterInactivity={autoIdleAfterInactivity}
          onToggleAutoIdleAfterInactivity={() => setAutoIdleAfterInactivity((prev) => !prev)}
          northAngle={project.northAngle ?? 0}
          onChangeNorthAngle={handleUpdateNorthAngle}
          collapsed={dockCollapsed}
          onToggleCollapsed={() => setDockCollapsed((prev) => !prev)}
        />
      )}
    </div>
  );
}
