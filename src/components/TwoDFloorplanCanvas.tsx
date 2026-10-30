import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Check,
  Grid,
  Home,
  Lock,
  Maximize2,
  Minus,
  MousePointer,
  Move,
  Pentagon,
  Plus,
  Redo2,
  RotateCw,
  Ruler,
  Square,
  Sparkles,
  Trash2,
  Trees,
  Undo2,
  Unlock,
  X,
} from 'lucide-react';
import { ASSET_CATALOG, SURFACE_MATERIALS } from '../data/catalogAndInitialState';
import { getEffectiveRoofDormers, getEffectiveSunSailCorners } from '../three/assetBuilder';
import {
  BUILDING_PRESETS,
  CatalogItem,
  clampAssetPositionInsideRoomWalls,
  computePolygonAreaM2,
  computePolygonBounds,
  computeRoofHostFootprintZone,
  computeZoneAreaM2,
  CustomWallSegment,
  fitStairAssetToRoomWalls,
  FloorLevelId,
  FloorplanProject,
  FloorplanZone,
  getAssetEffectiveFootprint,
  getAvailableBuildingOptions,
  getEffectiveDormerWindows,
  getZoneCorners,
  HAEntityState,
  isAcousticPanelAsset,
  isExteriorStairAsset,
  isFenceOrHedgeAsset,
  isInteriorRoomZone,
  isRadiatorAsset,
  isSofaAsset,
  isStairAsset,
  isWalkwayAsset,
  isWallModuleAsset,
  isWallSnapAsset,
  isZoneRotated,
  PlacedAsset,
  resolveOpeningSensorState,
  resolveZoneRole,
  snapAssetToNearestRoomWall,
  SurfaceMaterialId,
  WallOpening,
  WallPlannerCategory,
  WallSegmentMode,
  WallSideId,
  WallSurfaceFinish,
} from '../types/floorplan';

export type CadDrawToolMode =
  | 'select'
  | 'draw_rect_room'
  | 'draw_rect_surface'
  | 'draw_poly_room'
  | 'draw_poly_surface'
  | 'draw_wall';

type RectResizeHandle = 'n' | 's' | 'w' | 'e' | 'nw' | 'ne' | 'sw' | 'se';

interface TwoDFloorplanCanvasProps {
  project: FloorplanProject;
  entities: Record<string, HAEntityState>;
  activeFloor: FloorLevelId;
  selectedAssetId: string | null;
  selectedZoneId: string | null;
  selectedOpeningId: string | null;
  selectedWallId?: string | null;
  pendingCatalogItem: CatalogItem | null;
  onSelectAsset: (assetId: string | null, entityId?: string) => void;
  onSelectZone: (zoneId: string | null) => void;
  onSelectOpening: (openingId: string | null) => void;
  onSelectWall?: (wallId: string | null) => void;
  onUpdateAsset: (assetId: string, patch: Partial<PlacedAsset>) => void;
  onUpdateZone: (zoneId: string, patch: Partial<FloorplanZone>) => void;
  onUpdateOpening: (openingId: string, patch: Partial<WallOpening>) => void;
  onCreateCustomWall?: (newWall: CustomWallSegment) => void;
  onUpdateCustomWall?: (wallId: string, patch: Partial<CustomWallSegment>) => void;
  onDeleteCustomWall?: (wallId: string) => void;
  onPlaceCatalogItemAt: (worldX: number, worldZ: number) => void;
  onCreateZone?: (newZone: FloorplanZone) => void;
  onDeleteZone?: (zoneId: string) => void;
  onRotateBuilding?: (zoneId: string, deltaRad: number, wholeBuilding: boolean) => void;
  onUpdateNorthAngle?: (angleDeg: number) => void;
  onLoadDemoProject?: () => void;
  onClearProject?: () => void;
  onUndo?: () => void;
  onRedo?: () => void;
  canUndo?: boolean;
  canRedo?: boolean;
  onOpenWallPlanner?: (
    zoneId: string,
    wallSide?: WallSideId,
    category?: WallPlannerCategory
  ) => void;
}

const FLOOR_NAMES: Record<FloorLevelId, string> = {
  [-1]: 'Keller (KG)',
  0: 'Erdgeschoss (EG)',
  1: '1. Obergeschoss (OG)',
  2: 'Dachgeschoss (DG)',
};

export const TwoDFloorplanCanvas: React.FC<TwoDFloorplanCanvasProps> = ({
  project,
  entities,
  activeFloor,
  selectedAssetId,
  selectedZoneId,
  selectedOpeningId,
  selectedWallId = null,
  pendingCatalogItem,
  onSelectAsset,
  onSelectZone,
  onSelectOpening,
  onSelectWall,
  onUpdateAsset,
  onUpdateZone,
  onUpdateOpening,
  onCreateCustomWall,
  onUpdateCustomWall,
  onDeleteCustomWall,
  onPlaceCatalogItemAt,
  onCreateZone,
  onDeleteZone,
  onRotateBuilding,
  onUpdateNorthAngle,
  onLoadDemoProject,
  onClearProject,
  onUndo,
  onRedo,
  canUndo = false,
  canRedo = false,
  onOpenWallPlanner,
}) => {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [zoom, setZoom] = useState<number>(0.85);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 35, y: -25 });
  const [snapToGrid, setSnapToGrid] = useState<boolean>(true);
  const [furnitureGridStep, setFurnitureGridStep] = useState<number>(0.1);
  const [wallCollisionStop, setWallCollisionStop] = useState<boolean>(true);
  const [showDimensions, setShowDimensions] = useState<boolean>(true);
  const [drawTool, setDrawTool] = useState<CadDrawToolMode>('select');
  const [draftMaterial, setDraftMaterial] = useState<SurfaceMaterialId>('oak_parquet');
  const [draftCustomName, setDraftCustomName] = useState<string>('');
  const [draftWallHeight, setDraftWallHeight] = useState<number>(2.6);
  const [draftWallThickness, setDraftWallThickness] = useState<number>(0.16);
  const [draftWallMode, setDraftWallMode] = useState<WallSegmentMode>('full');
  const [draftWallFinish, setDraftWallFinish] = useState<WallSurfaceFinish>('plaster');
  const [draftBuildingId, setDraftBuildingId] = useState<string>('auto');
  const [activeBuildingSnapInfo, setActiveBuildingSnapInfo] = useState<{
    buildingId: string;
    buildingName: string;
    rotationY: number;
    hostZoneName: string;
  } | null>(null);

  const [cursorWorld, setCursorWorld] = useState<{ wx: number; wz: number }>({ wx: 0, wz: 0 });
  const cursorXDomRef = useRef<HTMLSpanElement | null>(null);
  const cursorZDomRef = useRef<HTMLSpanElement | null>(null);
  const [polyDraftPoints, setPolyDraftPoints] = useState<[number, number][]>([]);
  const [hoveredAssetId, setHoveredAssetId] = useState<string | null>(null);
  const [hoveredOpeningId, setHoveredOpeningId] = useState<string | null>(null);

  const [dragState, setDragState] = useState<
    | { type: 'pan'; startClientX: number; startClientY: number; origPanX: number; origPanY: number }
    | { type: 'asset'; id: string; startWorldX: number; startWorldZ: number; origX: number; origZ: number }
    | {
        type: 'fence_endpoint';
        id: string;
        end: 'start' | 'end';
        anchorX: number;
        anchorZ: number;
      }
    | {
        type: 'sail_corner';
        id: string;
        cornerIndex: number;
      }
    | {
        type: 'custom_wall_endpoint';
        id: string;
        end: 'start' | 'end';
      }
    | {
        type: 'custom_wall_move';
        id: string;
        startWorldX: number;
        startWorldZ: number;
        origX1: number;
        origZ1: number;
        origX2: number;
        origZ2: number;
      }
    | {
        type: 'draw_wall_drag';
        startX: number;
        startZ: number;
        curX: number;
        curZ: number;
      }
    | { type: 'opening'; id: string; startWorldX: number; startWorldZ: number; origX: number; origZ: number }
    | {
        type: 'opening_resize';
        id: string;
        side: 'left' | 'right';
        origX: number;
        origZ: number;
        origWidth: number;
        rotationY: number;
        startWorldX: number;
        startWorldZ: number;
      }
    | {
        type: 'zone_move';
        id: string;
        startWorldX: number;
        startWorldZ: number;
        origX: number;
        origZ: number;
        origPoints?: [number, number][];
      }
    | {
        type: 'zone_rotate';
        id: string;
        centerX: number;
        centerZ: number;
      }
    | {
        type: 'zone_resize';
        id: string;
        handle: RectResizeHandle;
        origMinX: number;
        origMaxX: number;
        origMinZ: number;
        origMaxZ: number;
      }
    | {
        type: 'zone_vertex';
        id: string;
        vertexIndex: number;
      }
    | {
        type: 'draw_rect';
        zoneType: 'indoor' | 'outdoor';
        startX: number;
        startZ: number;
        curX: number;
        curZ: number;
        snappedBuildingId?: string;
        snappedRotationY?: number;
      }
    | null
  >(null);

  const PIXELS_PER_METER = 38 * zoom;

  const activeZones = useMemo(
    () => project.zones.filter((z) => (z.level ?? 0) === activeFloor),
    [project.zones, activeFloor]
  );
  const activeOpenings = useMemo(
    () => project.openings.filter((o) => (o.level ?? 0) === activeFloor),
    [project.openings, activeFloor]
  );
  const activeAssets = useMemo(
    () => project.assets.filter((a) => (a.level ?? 0) === activeFloor),
    [project.assets, activeFloor]
  );
  const activeCustomWalls = useMemo(
    () => (project.customWalls || []).filter((w) => (w.level ?? 0) === activeFloor),
    [project.customWalls, activeFloor]
  );

  const [activeFenceSnapPoint, setActiveFenceSnapPoint] = useState<[number, number] | null>(
    null
  );

  // Faint Ghost Blueprint of the floor below (or EG above when in KG basement so you see what is directly above the cellar!)
  const ghostReferenceFloor = activeFloor === -1 ? 0 : activeFloor - 1;
  const ghostZones = useMemo(
    () =>
      project.zones.filter(
        (z) => z.zoneType === 'indoor' && (z.level ?? 0) === ghostReferenceFloor
      ),
    [project.zones, ghostReferenceFloor]
  );

  const roundCoord = (val: number, forceSnap = false, customStep?: number) => {
    const step = customStep ?? (snapToGrid || forceSnap ? furnitureGridStep : 0.02);
    return +(Math.round(val / step) * step).toFixed(2);
  };

  // Helper: computes world Start & End coordinates of any linear fence / hedge / walkway asset
  const getLinearAssetEndpoints = (a: PlacedAsset) => {
    const catMeta = ASSET_CATALOG.find((c) => c.id === a.catalogId);
    const scale = a.scale || 1;
    const len = (a.customLength ?? catMeta?.width ?? 3.0) * scale;
    const halfLen = len / 2;
    const cos = Math.cos(-a.rotationY);
    const sin = Math.sin(-a.rotationY);
    return {
      startX: a.position[0] - halfLen * cos,
      startZ: a.position[2] - halfLen * sin,
      endX: a.position[0] + halfLen * cos,
      endZ: a.position[2] + halfLen * sin,
      len,
      rotY: a.rotationY,
    };
  };

  // Magnetic Fence-to-Fence Endpoint Snap (snaps to start/end of other fences + 0°/90° corner alignment)
  const snapFenceEndpointToOtherFences = (
    rawX: number,
    rawZ: number,
    anchorX: number,
    anchorZ: number,
    excludeAssetId: string,
    forceGrid: boolean
  ): { x: number; z: number; snappedToFence: boolean } => {
    let bestX = roundCoord(rawX, forceGrid);
    let bestZ = roundCoord(rawZ, forceGrid);
    let bestDist = 0.55; // 55cm magnetic capture radius at fence posts
    let snappedToFence = false;

    for (const other of activeAssets) {
      if (other.id === excludeAssetId || !isFenceOrHedgeAsset(other.catalogId)) continue;
      const pts = getLinearAssetEndpoints(other);
      for (const [tx, tz] of [
        [pts.startX, pts.startZ],
        [pts.endX, pts.endZ],
      ] as [number, number][]) {
        // Avoid collapsing both ends onto the exact same point
        if (Math.hypot(tx - anchorX, tz - anchorZ) < 0.25) continue;
        const d = Math.hypot(rawX - tx, rawZ - tz);
        if (d < bestDist) {
          bestDist = d;
          bestX = +tx.toFixed(2);
          bestZ = +tz.toFixed(2);
          snappedToFence = true;
        }
      }
    }

    // If not directly snapping to a target endpoint, check if anchor is connected to another fence
    // and snap the angle to 0°/180° (collinear) or ±90° (L-corner) relative to that fence!
    if (!snappedToFence) {
      for (const other of activeAssets) {
        if (other.id === excludeAssetId || !isFenceOrHedgeAsset(other.catalogId)) continue;
        const pts = getLinearAssetEndpoints(other);
        const anchoredToOther =
          Math.hypot(anchorX - pts.startX, anchorZ - pts.startZ) <= 0.15 ||
          Math.hypot(anchorX - pts.endX, anchorZ - pts.endZ) <= 0.15;
        if (anchoredToOther) {
          const dx = bestX - anchorX;
          const dz = bestZ - anchorZ;
          const curLen = Math.hypot(dx, dz);
          if (curLen > 0.4) {
            const curAngle = Math.atan2(dz, dx);
            const otherAngle = -other.rotationY;
            const candidateAngles = [
              otherAngle,
              otherAngle + Math.PI,
              otherAngle + Math.PI / 2,
              otherAngle - Math.PI / 2,
            ];
            for (const candA of candidateAngles) {
              const diff = Math.atan2(Math.sin(curAngle - candA), Math.cos(curAngle - candA));
              if (Math.abs(diff) <= 0.11) {
                bestX = +(anchorX + curLen * Math.cos(candA)).toFixed(2);
                bestZ = +(anchorZ + curLen * Math.sin(candA)).toFixed(2);
                snappedToFence = true;
                break;
              }
            }
          }
          break;
        }
      }
    }

    return { x: bestX, z: bestZ, snappedToFence };
  };

  const clientToWorld = (clientX: number, clientY: number) => {
    const svg = svgRef.current;
    if (!svg) return { wx: 0, wz: 0 };
    const rect = svg.getBoundingClientRect();
    const centerX = rect.width / 2 + pan.x;
    const centerY = rect.height / 2 + pan.y;
    const wx = (clientX - rect.left - centerX) / PIXELS_PER_METER;
    const wz = (clientY - rect.top - centerY) / PIXELS_PER_METER;
    return { wx, wz };
  };

  // Switch default material when switching between room & surface drawing tools
  const activateDrawTool = (mode: CadDrawToolMode, defaultMat?: SurfaceMaterialId) => {
    setDrawTool(mode);
    setPolyDraftPoints([]);
    setDragState(null);
    if (defaultMat) {
      setDraftMaterial(defaultMat);
    } else if (mode === 'draw_rect_room' || mode === 'draw_poly_room') {
      if (
        draftMaterial === 'lush_lawn' ||
        draftMaterial === 'pool_water' ||
        draftMaterial === 'driveway_pavers' ||
        draftMaterial === 'gravel_bed'
      ) {
        setDraftMaterial('oak_parquet');
      }
    } else if (mode === 'draw_rect_surface' || mode === 'draw_poly_surface') {
      if (draftMaterial === 'oak_parquet') {
        setDraftMaterial('lush_lawn');
      }
    }
  };

  // Snap a point (wx, wz) directly to the nearest building/outbuilding local grid & wall lines
  // and return the buildingId & rotationY for automatic building assignment!
  const snapPointToBuildingGrid = (
    rawWx: number,
    rawWz: number,
    excludeZoneId?: string
  ): {
    wx: number;
    wz: number;
    buildingId: string | undefined;
    rotationY: number;
    hostZoneName?: string;
  } => {
    const candidateZones = [...activeZones, ...ghostZones].filter(
      (z) => z.zoneType === 'indoor' && z.id !== excludeZoneId
    );

    let bestZone: FloorplanZone | null = null;
    let bestDist = 2.4; // Snap radius around existing building / outbuilding walls

    for (const z of candidateZones) {
      if (draftBuildingId !== 'auto' && draftBuildingId !== 'none' && z.buildingId && z.buildingId !== draftBuildingId) {
        continue;
      }
      const corners = getZoneCorners(z);
      for (let i = 0; i < corners.length; i++) {
        const [x1, z1] = corners[i];
        const [x2, z2] = corners[(i + 1) % corners.length];
        const dx = x2 - x1;
        const dz = z2 - z1;
        const lenSq = dx * dx + dz * dz;
        if (lenSq < 0.01) continue;
        const t = Math.max(0, Math.min(1, ((rawWx - x1) * dx + (rawWz - z1) * dz) / lenSq));
        const dist = Math.hypot(rawWx - (x1 + t * dx), rawWz - (z1 + t * dz));
        if (dist < bestDist) {
          bestDist = dist;
          bestZone = z;
        }
      }
      // Also check if point is inside the room's bounding box
      const rotY = z.rotationY ?? 0;
      const cos = Math.cos(rotY);
      const sin = Math.sin(rotY);
      const relX = rawWx - z.x;
      const relZ = rawWz - z.z;
      const locX = relX * cos - relZ * sin;
      const locZ = relX * sin + relZ * cos;
      if (Math.abs(locX) <= z.width / 2 + 0.6 && Math.abs(locZ) <= z.depth / 2 + 0.6) {
        bestDist = 0;
        bestZone = z;
        break;
      }
    }

    if (!bestZone) {
      const explicitBld =
        draftBuildingId !== 'auto' && draftBuildingId !== 'none' ? draftBuildingId : undefined;
      return {
        wx: roundCoord(rawWx),
        wz: roundCoord(rawWz),
        buildingId: explicitBld,
        rotationY: 0,
      };
    }

    const bldId =
      draftBuildingId !== 'auto' && draftBuildingId !== 'none'
        ? draftBuildingId
        : bestZone.buildingId || 'main_house';
    const rotY = bestZone.rotationY ?? 0;
    const cos = Math.cos(rotY);
    const sin = Math.sin(rotY);

    // Transform raw world point into the target building room's local rotated coordinate system
    const dx = rawWx - bestZone.x;
    const dz = rawWz - bestZone.z;
    let locX = dx * cos - dz * sin;
    let locZ = dx * sin + dz * cos;

    // 1. Snap to 0.10m building grid
    locX = Math.round(locX * 10) / 10;
    locZ = Math.round(locZ * 10) / 10;

    // 2. Magnetic wall-line alignment with all rooms in the same building
    const sameBuildingZones = candidateZones.filter(
      (z) => (z.buildingId || 'main_house') === bldId
    );
    const xLines: number[] = [-bestZone.width / 2, 0, bestZone.width / 2];
    const zLines: number[] = [-bestZone.depth / 2, 0, bestZone.depth / 2];

    for (const sz of sameBuildingZones) {
      if (sz.id === bestZone.id) continue;
      const sdx = sz.x - bestZone.x;
      const sdz = sz.z - bestZone.z;
      const sLocX = sdx * cos - sdz * sin;
      const sLocZ = sdx * sin + sdz * cos;
      xLines.push(sLocX - sz.width / 2, sLocX, sLocX + sz.width / 2);
      zLines.push(sLocZ - sz.depth / 2, sLocZ, sLocZ + sz.depth / 2);
    }

    for (const xl of xLines) {
      if (Math.abs(locX - xl) <= 0.28) {
        locX = xl;
        break;
      }
    }
    for (const zl of zLines) {
      if (Math.abs(locZ - zl) <= 0.28) {
        locZ = zl;
        break;
      }
    }

    // Transform back from building local coordinates to world coordinates
    const snappedWx = +(bestZone.x + locX * cos + locZ * sin).toFixed(2);
    const snappedWz = +(bestZone.z - locX * sin + locZ * cos).toFixed(2);

    return {
      wx: snappedWx,
      wz: snappedWz,
      buildingId: bldId,
      rotationY: rotY,
      hostZoneName: bestZone.name,
    };
  };

  // Finish & commit a freeform polygon zone
  const commitPolygonDraft = (pointsToCommit: [number, number][]) => {
    if (!onCreateZone || pointsToCommit.length < 3) {
      setPolyDraftPoints([]);
      return;
    }
    const isIndoor = drawTool === 'draw_poly_room';
    const bounds = computePolygonBounds(pointsToCommit);
    const matMeta = SURFACE_MATERIALS.find((m) => m.id === draftMaterial);
    const roomCount = project.zones.filter((z) => z.zoneType === 'indoor').length + 1;
    const surfCount = project.zones.filter((z) => z.zoneType === 'outdoor').length + 1;

    const defaultName =
      draftCustomName.trim() ||
      (draftMaterial === 'pool_water'
        ? `Pool ${surfCount}`
        : isIndoor
        ? `Raum ${roomCount}`
        : `${matMeta?.name.split(' ')[0] || 'Fläche'} ${surfCount}`);

    // Detect building assignment from polygon points if indoor room
    let assignedBuildingId: string | undefined =
      draftBuildingId !== 'auto' && draftBuildingId !== 'none' ? draftBuildingId : undefined;
    if (isIndoor && draftBuildingId === 'auto') {
      const snapCheck = snapPointToBuildingGrid(bounds.x, bounds.z);
      assignedBuildingId = snapCheck.buildingId || 'main_house';
    }

    const hasExistingHullInBuilding =
      isIndoor &&
      assignedBuildingId &&
      project.zones.some(
        (z) =>
          z.zoneType === 'indoor' &&
          (z.buildingId || 'main_house') === assignedBuildingId &&
          (z.level ?? 0) === activeFloor
      );

    const newZone: FloorplanZone = {
      id: `zone_poly_${Date.now()}`,
      name: defaultName,
      zoneType: isIndoor ? 'indoor' : 'outdoor',
      zoneRole: isIndoor
        ? hasExistingHullInBuilding
          ? 'room'
          : assignedBuildingId?.startsWith('outbuilding_')
          ? 'outbuilding'
          : 'wohnraum_building'
        : undefined,
      level: activeFloor,
      buildingId: isIndoor ? assignedBuildingId : undefined,
      x: bounds.x,
      z: bounds.z,
      width: bounds.width,
      depth: bounds.depth,
      wallHeight: isIndoor ? draftWallHeight : 0.12,
      surfaceMaterial: draftMaterial,
      wallColor: isIndoor ? '#e4e0d8' : '#cbd5e1',
      outdoorPerimeter:
        draftMaterial === 'pool_water'
          ? 'stone_curb'
          : !isIndoor
          ? 'none'
          : undefined,
      points: pointsToCommit,
    };

    onCreateZone(newZone);
    setPolyDraftPoints([]);
    setDraftCustomName('');
    setDrawTool('select');
  };

  // Keyboard shortcuts for Polygon Enter / Escape / Backspace
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        document.activeElement?.tagName === 'INPUT' ||
        document.activeElement?.tagName === 'SELECT'
      ) {
        return;
      }
      if (e.key === 'Escape') {
        setPolyDraftPoints([]);
        setDragState(null);
        setDrawTool('select');
      } else if (e.key === 'Enter' && polyDraftPoints.length >= 3) {
        e.preventDefault();
        commitPolygonDraft(polyDraftPoints);
      } else if (e.key === 'Backspace' && polyDraftPoints.length > 0) {
        e.preventDefault();
        setPolyDraftPoints((prev) => prev.slice(0, -1));
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [polyDraftPoints, drawTool, draftMaterial, draftCustomName, draftWallHeight]);

  // Snap a dragged window/door/gate onto the nearest indoor room wall on the active floor & auto-orient rotationY
  const snapOpeningToNearestWall = (
    rawX: number,
    rawZ: number,
    currentRotY: number,
    openingWidth = 1.2
  ) => {
    let bestX = rawX;
    let bestZ = rawZ;
    let bestRotY = currentRotY;
    let minDist = 0.95;

    for (const zone of activeZones) {
      if (zone.zoneType !== 'indoor') continue;

      const wallSegments: [number, number, number, number][] = [];
      const zCorners = getZoneCorners(zone);
      for (let i = 0; i < zCorners.length; i++) {
        const [x1, z1] = zCorners[i];
        const [x2, z2] = zCorners[(i + 1) % zCorners.length];
        wallSegments.push([x1, z1, x2, z2]);
      }

      for (const [x1, z1, x2, z2] of wallSegments) {
        const dx = x2 - x1;
        const dz = z2 - z1;
        const lenSq = dx * dx + dz * dz;
        const segLen = Math.sqrt(lenSq);
        if (segLen < 0.25) continue;

        const halfOpen = Math.min(openingWidth * 0.45, segLen * 0.42);
        const marginT = Math.min(0.45, Math.max(0.03, (halfOpen + 0.04) / segLen));
        const rawT = ((rawX - x1) * dx + (rawZ - z1) * dz) / lenSq;
        const t = Math.max(marginT, Math.min(1 - marginT, rawT));
        const projX = x1 + t * dx;
        const projZ = z1 + t * dz;
        const dist = Math.hypot(rawX - projX, rawZ - projZ);

        if (dist < minDist) {
          minDist = dist;
          bestX = projX;
          bestZ = projZ;
          if (Math.abs(dx) < 0.01) {
            bestRotY = Math.PI / 2;
          } else if (Math.abs(dz) < 0.01) {
            bestRotY = 0;
          } else {
            bestRotY = -Math.atan2(dz, dx);
          }
        }
      }
    }

    return {
      x: roundCoord(bestX),
      z: roundCoord(bestZ),
      rotationY: bestRotY,
    };
  };

  // Magnetic vertex & ortho snap helper used both during polygon drawing AND when editing polygon vertices afterwards
  const snapVertexToRoomsAndOrtho = (
    rawWx: number,
    rawWz: number,
    shiftKey: boolean,
    excludeZoneId?: string,
    neighborPts: [number, number][] = []
  ): [number, number] => {
    let x = roundCoord(rawWx, shiftKey);
    let z = roundCoord(rawWz, shiftKey);

    const candidateZones = [...activeZones, ...ghostZones].filter(
      (zn) => zn.zoneType === 'indoor' && zn.id !== excludeZoneId
    );

    // 1. Snap directly to existing room corners (highest priority, 0.34m radius)
    let bestCornerDist = 0.34;
    let snappedToCorner = false;
    for (const zn of candidateZones) {
      const corners = getZoneCorners(zn);
      for (const [cx, cz] of corners) {
        const d = Math.hypot(rawWx - cx, rawWz - cz);
        if (d < bestCornerDist) {
          bestCornerDist = d;
          x = +cx.toFixed(2);
          z = +cz.toFixed(2);
          snappedToCorner = true;
        }
      }
    }

    // 2. If not on a corner, snap flush onto any existing room wall segment (0.28m radius)
    let snappedToWallX = snappedToCorner;
    let snappedToWallZ = snappedToCorner;
    if (!snappedToCorner) {
      let bestWallDist = 0.28;
      for (const zn of candidateZones) {
        const corners = getZoneCorners(zn);
        for (let i = 0; i < corners.length; i++) {
          const [x1, z1] = corners[i];
          const [x2, z2] = corners[(i + 1) % corners.length];
          const dx = x2 - x1;
          const dz = z2 - z1;
          const lenSq = dx * dx + dz * dz;
          if (lenSq < 0.04) continue;
          const t = Math.max(0, Math.min(1, ((rawWx - x1) * dx + (rawWz - z1) * dz) / lenSq));
          const projX = x1 + t * dx;
          const projZ = z1 + t * dz;
          const dist = Math.hypot(rawWx - projX, rawWz - projZ);
          if (dist < bestWallDist) {
            bestWallDist = dist;
            if (Math.abs(dx) < 0.02) {
              // Vertical wall segment: lock X exactly to wall X, round Z along wall
              x = +x1.toFixed(2);
              z = roundCoord(projZ, shiftKey);
              snappedToWallX = true;
            } else if (Math.abs(dz) < 0.02) {
              // Horizontal wall segment: lock Z exactly to wall Z, round X along wall
              x = roundCoord(projX, shiftKey);
              z = +z1.toFixed(2);
              snappedToWallZ = true;
            } else {
              x = +projX.toFixed(2);
              z = +projZ.toFixed(2);
              snappedToWallX = true;
              snappedToWallZ = true;
            }
          }
        }
      }
    }

    // 3. Ortho-align with neighbor vertices (0°/90°) when close (0.18m) or holding Shift
    for (const [nx, nz] of neighborPts) {
      const dx = Math.abs(x - nx);
      const dz = Math.abs(z - nz);
      if (shiftKey && !snappedToCorner) {
        if (dx >= dz && !snappedToWallZ) z = nz;
        else if (dz > dx && !snappedToWallX) x = nx;
      } else {
        if (!snappedToWallZ && dx > 0.3 && dz < 0.18) z = nz;
        if (!snappedToWallX && dz > 0.3 && dx < 0.18) x = nx;
      }
    }

    return [+x.toFixed(2), +z.toFixed(2)];
  };

  // Ortho-snap & room-wall-snap helper when drawing polygon segments
  const getSnappedPolyPoint = (rawWx: number, rawWz: number, shiftKey: boolean): [number, number] => {
    const neighborPts: [number, number][] = [];
    if (polyDraftPoints.length > 0) {
      neighborPts.push(polyDraftPoints[polyDraftPoints.length - 1]);
    }
    if (polyDraftPoints.length > 2) {
      neighborPts.push(polyDraftPoints[0]);
    }
    return snapVertexToRoomsAndOrtho(rawWx, rawWz, shiftKey, undefined, neighborPts);
  };

  const handlePointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const { wx, wz } = clientToWorld(e.clientX, e.clientY);
    const forceSnap = e.shiftKey;

    if (drawTool === 'draw_rect_room' || drawTool === 'draw_poly_room') {
      const bSnap = snapPointToBuildingGrid(wx, wz);
      setCursorWorld({ wx: bSnap.wx, wz: bSnap.wz });
      if (bSnap.buildingId && bSnap.hostZoneName) {
        const bPreset = BUILDING_PRESETS.find((b) => b.id === bSnap.buildingId);
        setActiveBuildingSnapInfo({
          buildingId: bSnap.buildingId,
          buildingName: bPreset?.name || 'Gebäude',
          rotationY: bSnap.rotationY,
          hostZoneName: bSnap.hostZoneName,
        });
      } else {
        setActiveBuildingSnapInfo((prev) => (prev ? null : prev));
      }
    } else if (drawTool !== 'select' || pendingCatalogItem) {
      setCursorWorld({
        wx: roundCoord(wx, forceSnap),
        wz: roundCoord(wz, forceSnap),
      });
      if (!dragState) setActiveBuildingSnapInfo((prev) => (prev ? null : prev));
    } else {
      // Zero-rerender fast path in select mode: update coordinate spans directly via DOM refs
      const rx = roundCoord(wx, forceSnap);
      const rz = roundCoord(wz, forceSnap);
      if (cursorXDomRef.current) {
        cursorXDomRef.current.textContent = `X: ${rx >= 0 ? `+${rx.toFixed(2)}` : rx.toFixed(2)} m`;
      }
      if (cursorZDomRef.current) {
        cursorZDomRef.current.textContent = `Z: ${rz >= 0 ? `+${rz.toFixed(2)}` : rz.toFixed(2)} m`;
      }
      if (!dragState) setActiveBuildingSnapInfo((prev) => (prev ? null : prev));
    }

    if (!dragState) return;
    if (dragState.type === 'pan') {
      setPan({
        x: dragState.origPanX + (e.clientX - dragState.startClientX),
        y: dragState.origPanY + (e.clientY - dragState.startClientY),
      });
      return;
    }

    if (dragState.type === 'zone_rotate') {
      const angleToCursor = Math.atan2(wx - dragState.centerX, -(wz - dragState.centerZ));
      const snapDeg = e.shiftKey ? 1 : 5;
      const deg = Math.round(((angleToCursor * 180) / Math.PI) / snapDeg) * snapDeg;
      const newRotY = -((deg * Math.PI) / 180);
      onUpdateZone(dragState.id, { rotationY: newRotY });
      return;
    }

    if (dragState.type === 'draw_rect') {
      if (dragState.zoneType === 'indoor' && !e.altKey) {
        const bSnap = snapPointToBuildingGrid(wx, wz);
        setDragState({
          ...dragState,
          curX: bSnap.wx,
          curZ: bSnap.wz,
          snappedBuildingId: bSnap.buildingId || dragState.snappedBuildingId,
          snappedRotationY:
            bSnap.hostZoneName !== undefined
              ? bSnap.rotationY
              : dragState.snappedRotationY,
        });
      } else {
        setDragState({
          ...dragState,
          curX: roundCoord(wx, forceSnap),
          curZ: roundCoord(wz, forceSnap),
        });
      }
      return;
    }

    if (dragState.type === 'fence_endpoint') {
      const asset = project.assets.find((a) => a.id === dragState.id);
      if (!asset) return;
      let curX = roundCoord(wx, forceSnap);
      let curZ = roundCoord(wz, forceSnap);
      if (!e.altKey) {
        const snapped = snapFenceEndpointToOtherFences(
          wx,
          wz,
          dragState.anchorX,
          dragState.anchorZ,
          asset.id,
          forceSnap
        );
        curX = snapped.x;
        curZ = snapped.z;
        setActiveFenceSnapPoint(snapped.snappedToFence ? [curX, curZ] : null);
      } else {
        setActiveFenceSnapPoint(null);
      }
      const startPtX = dragState.end === 'start' ? curX : dragState.anchorX;
      const startPtZ = dragState.end === 'start' ? curZ : dragState.anchorZ;
      const endPtX = dragState.end === 'end' ? curX : dragState.anchorX;
      const endPtZ = dragState.end === 'end' ? curZ : dragState.anchorZ;
      const segDx = endPtX - startPtX;
      const segDz = endPtZ - startPtZ;
      const newLen = Math.max(0.4, +Math.hypot(segDx, segDz).toFixed(2));
      const midX = +((startPtX + endPtX) / 2).toFixed(2);
      const midZ = +((startPtZ + endPtZ) / 2).toFixed(2);
      const newRotY = -Math.atan2(segDz, segDx);
      onUpdateAsset(asset.id, {
        position: [midX, asset.position[1], midZ],
        customLength: newLen,
        rotationY: newRotY,
      });
      return;
    }

    if (dragState.type === 'sail_corner') {
      const asset = project.assets.find((a) => a.id === dragState.id);
      if (!asset) return;
      const curX = roundCoord(wx, forceSnap);
      const curZ = roundCoord(wz, forceSnap);
      const sc = asset.scale || 1;
      const dxRel = curX - asset.position[0];
      const dzRel = curZ - asset.position[2];
      // Transform world offset into asset's local unrotated group coordinates
      const cosR = Math.cos(asset.rotationY || 0);
      const sinR = Math.sin(asset.rotationY || 0);
      const localX = +((dxRel * cosR - dzRel * sinR) / sc).toFixed(2);
      const localZ = +((dxRel * sinR + dzRel * cosR) / sc).toFixed(2);
      const baseCorners = getEffectiveSunSailCorners(asset);
      const nextCorners = baseCorners.map((pt, idx) =>
        idx === dragState.cornerIndex ? ([localX, localZ] as [number, number]) : pt
      );
      onUpdateAsset(asset.id, { sailCorners: nextCorners });
      return;
    }

    if (dragState.type === 'custom_wall_endpoint') {
      if (!onUpdateCustomWall) return;
      const curX = roundCoord(wx, forceSnap);
      const curZ = roundCoord(wz, forceSnap);
      if (dragState.end === 'start') {
        onUpdateCustomWall(dragState.id, { x1: curX, z1: curZ });
      } else {
        onUpdateCustomWall(dragState.id, { x2: curX, z2: curZ });
      }
      return;
    }

    if (dragState.type === 'custom_wall_move') {
      if (!onUpdateCustomWall) return;
      const dxw = roundCoord(wx - dragState.startWorldX, forceSnap);
      const dzw = roundCoord(wz - dragState.startWorldZ, forceSnap);
      onUpdateCustomWall(dragState.id, {
        x1: +(dragState.origX1 + dxw).toFixed(2),
        z1: +(dragState.origZ1 + dzw).toFixed(2),
        x2: +(dragState.origX2 + dxw).toFixed(2),
        z2: +(dragState.origZ2 + dzw).toFixed(2),
      });
      return;
    }

    if (dragState.type === 'draw_wall_drag') {
      let curX = roundCoord(wx, forceSnap);
      let curZ = roundCoord(wz, forceSnap);
      const dxw = Math.abs(curX - dragState.startX);
      const dzw = Math.abs(curZ - dragState.startZ);
      if (e.shiftKey || (dxw > 0.3 && dzw < 0.14)) {
        curZ = dragState.startZ;
      } else if (dzw > 0.3 && dxw < 0.14) {
        curX = dragState.startX;
      }
      setDragState({
        ...dragState,
        curX,
        curZ,
      });
      return;
    }

    if (dragState.type === 'opening_resize') {
      const op = project.openings.find((o) => o.id === dragState.id);
      if (!op) return;
      const dWx = wx - dragState.startWorldX;
      const dWz = wz - dragState.startWorldZ;
      const cosR = Math.cos(-dragState.rotationY);
      const sinR = Math.sin(-dragState.rotationY);
      const deltaAlongWall = dWx * cosR + dWz * sinR;
      const signedDelta = dragState.side === 'right' ? deltaAlongWall : -deltaAlongWall;
      const newWidth = Math.max(
        0.45,
        Math.min(6.0, +(dragState.origWidth + signedDelta * 2).toFixed(2))
      );
      onUpdateOpening(op.id, { width: newWidth });
      return;
    }

    if (dragState.type === 'zone_vertex') {
      const zone = project.zones.find((z) => z.id === dragState.id);
      if (!zone || !zone.points) return;
      const nPts = zone.points.length;
      const prevPt = zone.points[(dragState.vertexIndex - 1 + nPts) % nPts];
      const nextPt = zone.points[(dragState.vertexIndex + 1) % nPts];
      const snappedPt: [number, number] = e.altKey
        ? [roundCoord(wx, forceSnap), roundCoord(wz, forceSnap)]
        : snapVertexToRoomsAndOrtho(wx, wz, forceSnap, zone.id, [prevPt, nextPt]);

      const nextPts = zone.points.map((pt, idx) =>
        idx === dragState.vertexIndex ? snappedPt : pt
      );
      const bounds = computePolygonBounds(nextPts);
      onUpdateZone(zone.id, {
        points: nextPts,
        x: bounds.x,
        z: bounds.z,
        width: bounds.width,
        depth: bounds.depth,
      });
      return;
    }

    if (dragState.type === 'zone_resize') {
      let curX = roundCoord(wx, forceSnap);
      let curZ = roundCoord(wz, forceSnap);

      // Snap resized edge to adjacent indoor room walls & corners unless Alt is held
      if (!e.altKey) {
        const candidateZones = [...activeZones, ...ghostZones].filter(
          (zn) => zn.zoneType === 'indoor' && zn.id !== dragState.id
        );
        let bestDx = 0.28;
        let bestDz = 0.28;
        for (const zn of candidateZones) {
          for (const [cx, cz] of getZoneCorners(zn)) {
            if (Math.abs(wx - cx) < bestDx) {
              bestDx = Math.abs(wx - cx);
              curX = +cx.toFixed(2);
            }
            if (Math.abs(wz - cz) < bestDz) {
              bestDz = Math.abs(wz - cz);
              curZ = +cz.toFixed(2);
            }
          }
        }
      }

      let minX = dragState.origMinX;
      let maxX = dragState.origMaxX;
      let minZ = dragState.origMinZ;
      let maxZ = dragState.origMaxZ;
      const minSize = 0.6;

      if (dragState.handle.includes('w')) {
        minX = Math.min(curX, maxX - minSize);
      }
      if (dragState.handle.includes('e')) {
        maxX = Math.max(curX, minX + minSize);
      }
      if (dragState.handle.includes('n')) {
        minZ = Math.min(curZ, maxZ - minSize);
      }
      if (dragState.handle.includes('s')) {
        maxZ = Math.max(curZ, minZ + minSize);
      }

      const newW = +(maxX - minX).toFixed(2);
      const newD = +(maxZ - minZ).toFixed(2);
      const newCenterX = +((minX + maxX) / 2).toFixed(2);
      const newCenterZ = +((minZ + maxZ) / 2).toFixed(2);

      onUpdateZone(dragState.id, {
        width: newW,
        depth: newD,
        x: newCenterX,
        z: newCenterZ,
      });
      return;
    }

    const dx = wx - dragState.startWorldX;
    const dz = wz - dragState.startWorldZ;

    if (dragState.type === 'asset') {
      const asset = project.assets.find((a) => a.id === dragState.id);
      if (!asset) return;
      let nextX = roundCoord(dragState.origX + dx, forceSnap);
      let nextZ = roundCoord(dragState.origZ + dz, forceSnap);
      let nextRotY = asset.rotationY;
      let snappedFencePt: [number, number] | null = null;

      // Magnetic Fence-to-Fence Snap when moving a whole fence/hedge segment near another fence's endpoint!
      if (isFenceOrHedgeAsset(asset.catalogId) && !e.altKey) {
        const catMeta = ASSET_CATALOG.find((c) => c.id === asset.catalogId);
        const scale = asset.scale || 1;
        const myLen = (asset.customLength ?? catMeta?.width ?? 3.0) * scale;
        const halfLen = myLen / 2;
        const myCos = Math.cos(-asset.rotationY);
        const mySin = Math.sin(-asset.rotationY);
        const rawCenterX = dragState.origX + dx;
        const rawCenterZ = dragState.origZ + dz;
        const myStart: [number, number] = [
          rawCenterX - halfLen * myCos,
          rawCenterZ - halfLen * mySin,
        ];
        const myEnd: [number, number] = [
          rawCenterX + halfLen * myCos,
          rawCenterZ + halfLen * mySin,
        ];

        let bestDist = 0.55; // 55cm magnetic post-to-post capture radius
        for (const other of activeAssets) {
          if (other.id === asset.id || !isFenceOrHedgeAsset(other.catalogId)) continue;
          const oPts = getLinearAssetEndpoints(other);
          const targetEnds: [number, number][] = [
            [oPts.startX, oPts.startZ],
            [oPts.endX, oPts.endZ],
          ];
          const myEnds: { pt: [number, number]; sign: -1 | 1 }[] = [
            { pt: myStart, sign: -1 },
            { pt: myEnd, sign: 1 },
          ];
          for (const [tx, tz] of targetEnds) {
            for (const me of myEnds) {
              const dist = Math.hypot(me.pt[0] - tx, me.pt[1] - tz);
              if (dist < bestDist) {
                bestDist = dist;
                // Check if our rotation is close to 0°/180° (collinear) or ±90° (corner) relative to `other`
                let alignedRot = asset.rotationY;
                const candRots = [
                  other.rotationY,
                  other.rotationY + Math.PI,
                  other.rotationY + Math.PI / 2,
                  other.rotationY - Math.PI / 2,
                ];
                for (const cr of candRots) {
                  const diff = Math.atan2(
                    Math.sin(asset.rotationY - cr),
                    Math.cos(asset.rotationY - cr)
                  );
                  if (Math.abs(diff) <= 0.16) {
                    alignedRot = cr;
                    break;
                  }
                }
                const aCos = Math.cos(-alignedRot);
                const aSin = Math.sin(-alignedRot);
                nextX = +(tx - me.sign * halfLen * aCos).toFixed(2);
                nextZ = +(tz - me.sign * halfLen * aSin).toFixed(2);
                nextRotY = alignedRot;
                snappedFencePt = [tx, tz];
              }
            }
          }
        }
      }

      // Magnetic Wall Snap for Radiators, Acoustic Panels, Wall Modules & Wall-Mounted Decor
      const catMetaForDrag = ASSET_CATALOG.find((c) => c.id === asset.catalogId);
      const footForDrag = getAssetEffectiveFootprint(asset, catMetaForDrag);

      if (
        isWallSnapAsset(asset, catMetaForDrag) &&
        asset.radiatorConfig?.snapToWall !== false &&
        !e.altKey
      ) {
        const wallSnap = snapAssetToNearestRoomWall(
          dragState.origX + dx,
          dragState.origZ + dz,
          footForDrag.widthM,
          footForDrag.depthM,
          activeZones,
          snapToGrid || forceSnap ? furnitureGridStep : 0.02,
          0.7
        );
        if (wallSnap) {
          nextX = wallSnap.x;
          nextZ = wallSnap.z;
          nextRotY = wallSnap.rotationY;
        }
      } else if (
        wallCollisionStop &&
        !e.altKey &&
        !isFenceOrHedgeAsset(asset.catalogId) &&
        !isWalkwayAsset(asset.catalogId) &&
        asset.mountType !== 'ceiling'
      ) {
        // Hard wall collision stop for indoor furniture, beds, sofas, kitchens, stairs, etc.
        const clamped = clampAssetPositionInsideRoomWalls(
          nextX,
          nextZ,
          nextRotY,
          footForDrag.widthM,
          footForDrag.depthM,
          activeZones,
          true
        );
        nextX = clamped.x;
        nextZ = clamped.z;
      }

      setActiveFenceSnapPoint(snappedFencePt);
      onUpdateAsset(dragState.id, {
        position: [nextX, asset.position[1], nextZ],
        rotationY: nextRotY,
      });
    } else if (dragState.type === 'opening') {
      const op = project.openings.find((o) => o.id === dragState.id);
      if (!op) return;
      if (e.altKey) {
        onUpdateOpening(dragState.id, {
          x: roundCoord(dragState.origX + dx, forceSnap),
          z: roundCoord(dragState.origZ + dz, forceSnap),
        });
      } else {
        const snapped = snapOpeningToNearestWall(
          dragState.origX + dx,
          dragState.origZ + dz,
          op.rotationY,
          op.width
        );
        onUpdateOpening(dragState.id, snapped);
      }
    } else if (dragState.type === 'zone_move') {
      const movingZone = project.zones.find((z) => z.id === dragState.id);
      let nextX = roundCoord(dragState.origX + dx, forceSnap);
      let nextZ = roundCoord(dragState.origZ + dz, forceSnap);
      let autoPatch: Partial<FloorplanZone> = {};

      // When moving ANY indoor room (rectangular OR freeform polygon) near another building room,
      // snap its corners & edges flush to adjacent rooms with zero wall gap!
      if (movingZone && movingZone.zoneType === 'indoor' && !e.altKey) {
        const candidateZones = [...activeZones, ...ghostZones].filter(
          (z) => z.zoneType === 'indoor' && z.id !== movingZone.id
        );

        let snappedByCornerOrWall = false;
        const tentativeDx = nextX - dragState.origX;
        const tentativeDz = nextZ - dragState.origZ;
        const myMovedCorners: [number, number][] =
          dragState.origPoints && dragState.origPoints.length >= 3
            ? dragState.origPoints.map(([px, pz]) => [px + tentativeDx, pz + tentativeDz])
            : getZoneCorners({ ...movingZone, x: nextX, z: nextZ });

        // 1. Corner-to-corner & corner-to-wall magnetic docking (works for both polygon and rectangular rooms)
        let bestSnapDist = 0.34;
        let snapShiftX = 0;
        let snapShiftZ = 0;
        let snapTargetZone: FloorplanZone | null = null;

        for (const other of candidateZones) {
          const otherCorners = getZoneCorners(other);
          for (const [mx, mz] of myMovedCorners) {
            for (const [ox, oz] of otherCorners) {
              const d = Math.hypot(mx - ox, mz - oz);
              if (d < bestSnapDist) {
                bestSnapDist = d;
                snapShiftX = ox - mx;
                snapShiftZ = oz - mz;
                snapTargetZone = other;
                snappedByCornerOrWall = true;
              }
            }
            // Also check distance to other room's wall segments
            for (let i = 0; i < otherCorners.length; i++) {
              const [x1, z1] = otherCorners[i];
              const [x2, z2] = otherCorners[(i + 1) % otherCorners.length];
              const sdx = x2 - x1;
              const sdz = z2 - z1;
              const lenSq = sdx * sdx + sdz * sdz;
              if (lenSq < 0.04) continue;
              const t = Math.max(0, Math.min(1, ((mx - x1) * sdx + (mz - z1) * sdz) / lenSq));
              const projX = x1 + t * sdx;
              const projZ = z1 + t * sdz;
              const d = Math.hypot(mx - projX, mz - projZ);
              if (d < bestSnapDist) {
                bestSnapDist = d;
                snapShiftX = projX - mx;
                snapShiftZ = projZ - mz;
                snapTargetZone = other;
                snappedByCornerOrWall = true;
              }
            }
          }
        }

        if (snappedByCornerOrWall && snapTargetZone) {
          nextX = +(nextX + snapShiftX).toFixed(2);
          nextZ = +(nextZ + snapShiftZ).toFixed(2);
          if (!movingZone.buildingId && snapTargetZone.buildingId) {
            autoPatch = { buildingId: snapTargetZone.buildingId };
          }
          const bPreset = BUILDING_PRESETS.find(
            (b) => b.id === (snapTargetZone!.buildingId || movingZone.buildingId || 'main_house')
          );
          setActiveBuildingSnapInfo({
            buildingId: snapTargetZone.buildingId || movingZone.buildingId || 'main_house',
            buildingName: bPreset?.name || 'Gebäude',
            rotationY: snapTargetZone.rotationY ?? 0,
            hostZoneName: snapTargetZone.name,
          });
        } else if (!dragState.origPoints) {
          // 2. Rotated bounding-box edge alignment for rectangular rooms
          let bestTarget: FloorplanZone | null = null;
          let bestCenterDist = 8.5;
          for (const z of candidateZones) {
            const dist = Math.hypot(nextX - z.x, nextZ - z.z);
            if (dist < bestCenterDist) {
              bestCenterDist = dist;
              bestTarget = z;
            }
          }
          if (bestTarget) {
            const rotY = bestTarget.rotationY ?? 0;
            const cos = Math.cos(rotY);
            const sin = Math.sin(rotY);
            const relX = nextX - bestTarget.x;
            const relZ = nextZ - bestTarget.z;
            let locX = relX * cos - relZ * sin;
            let locZ = relZ * cos + relX * sin;

            const snapTargetsX = [
              -(bestTarget.width + movingZone.width) / 2,
              (bestTarget.width + movingZone.width) / 2,
              (bestTarget.width - movingZone.width) / 2,
              -(bestTarget.width - movingZone.width) / 2,
              0,
            ];
            const snapTargetsZ = [
              -(bestTarget.depth + movingZone.depth) / 2,
              (bestTarget.depth + movingZone.depth) / 2,
              (bestTarget.depth - movingZone.depth) / 2,
              -(bestTarget.depth - movingZone.depth) / 2,
              0,
            ];

            const bothAxesClose =
              Math.abs(locX) <= (bestTarget.width + movingZone.width) / 2 + 0.65 &&
              Math.abs(locZ) <= (bestTarget.depth + movingZone.depth) / 2 + 0.65;

            let snappedEdge = false;
            if (bothAxesClose) {
              for (const tx of snapTargetsX) {
                if (Math.abs(locX - tx) <= 0.32) {
                  locX = tx;
                  snappedEdge = true;
                  break;
                }
              }
              for (const tz of snapTargetsZ) {
                if (Math.abs(locZ - tz) <= 0.32) {
                  locZ = tz;
                  snappedEdge = true;
                  break;
                }
              }
            }

            if (snappedEdge && bothAxesClose) {
              locX = Math.round(locX * 10) / 10;
              locZ = Math.round(locZ * 10) / 10;
              nextX = +(bestTarget.x + locX * cos + locZ * sin).toFixed(2);
              nextZ = +(bestTarget.z - locX * sin + locZ * cos).toFixed(2);
              autoPatch = {
                buildingId: bestTarget.buildingId || 'main_house',
                rotationY: rotY,
              };
              const bPreset = BUILDING_PRESETS.find(
                (b) => b.id === (bestTarget!.buildingId || 'main_house')
              );
              setActiveBuildingSnapInfo({
                buildingId: bestTarget.buildingId || 'main_house',
                buildingName: bPreset?.name || 'Gebäude',
                rotationY: rotY,
                hostZoneName: bestTarget.name,
              });
            } else {
              setActiveBuildingSnapInfo(null);
            }
          }
        } else {
          setActiveBuildingSnapInfo(null);
        }
      }

      const actualDx = nextX - dragState.origX;
      const actualDz = nextZ - dragState.origZ;
      if (dragState.origPoints && dragState.origPoints.length >= 3) {
        const movedPoints: [number, number][] = dragState.origPoints.map(([px, pz]) => [
          +(px + actualDx).toFixed(2),
          +(pz + actualDz).toFixed(2),
        ]);
        const bounds = computePolygonBounds(movedPoints);
        onUpdateZone(dragState.id, {
          x: bounds.x,
          z: bounds.z,
          width: bounds.width,
          depth: bounds.depth,
          points: movedPoints,
          ...autoPatch,
        });
      } else {
        onUpdateZone(dragState.id, {
          x: nextX,
          z: nextZ,
          ...autoPatch,
        });
      }
    }
  };

  const handlePointerUp = () => {
    if (dragState?.type === 'draw_rect') {
      const rotY = dragState.snappedRotationY ?? 0;
      const cos = Math.cos(rotY);
      const sin = Math.sin(rotY);
      const dx = dragState.curX - dragState.startX;
      const dz = dragState.curZ - dragState.startZ;
      const localU = dx * cos - dz * sin;
      const localV = dx * sin + dz * cos;
      const w = +Math.abs(localU).toFixed(2);
      const d = +Math.abs(localV).toFixed(2);
      const centerX = +((dragState.startX + dragState.curX) / 2).toFixed(2);
      const centerZ = +((dragState.startZ + dragState.curZ) / 2).toFixed(2);

      if (w >= 0.5 && d >= 0.5 && onCreateZone) {
        const isIndoor = dragState.zoneType === 'indoor';
        const matMeta = SURFACE_MATERIALS.find((m) => m.id === draftMaterial);
        const roomCount = project.zones.filter((z) => z.zoneType === 'indoor').length + 1;
        const surfCount = project.zones.filter((z) => z.zoneType === 'outdoor').length + 1;

        const defaultName =
          draftCustomName.trim() ||
          (draftMaterial === 'pool_water'
            ? `Pool ${surfCount}`
            : isIndoor
            ? `Raum ${roomCount}`
            : `${matMeta?.name.split(' ')[0] || 'Fläche'} ${surfCount}`);

        const assignedBuildingId = isIndoor
          ? draftBuildingId !== 'auto' && draftBuildingId !== 'none'
            ? draftBuildingId
            : dragState.snappedBuildingId || 'main_house'
          : undefined;

        const hasExistingHullInBuilding =
          isIndoor &&
          assignedBuildingId &&
          project.zones.some(
            (z) =>
              z.zoneType === 'indoor' &&
              (z.buildingId || 'main_house') === assignedBuildingId &&
              (z.level ?? 0) === activeFloor
          );

        const newZone: FloorplanZone = {
          id: `zone_${Date.now()}`,
          name: defaultName,
          zoneType: isIndoor ? 'indoor' : 'outdoor',
          zoneRole: isIndoor
            ? hasExistingHullInBuilding
              ? 'room'
              : assignedBuildingId?.startsWith('outbuilding_')
              ? 'outbuilding'
              : 'wohnraum_building'
            : undefined,
          level: activeFloor,
          buildingId: assignedBuildingId,
          rotationY: isIndoor ? rotY : 0,
          x: centerX,
          z: centerZ,
          width: w,
          depth: d,
          wallHeight: isIndoor ? draftWallHeight : 0.12,
          surfaceMaterial: draftMaterial,
          wallColor: isIndoor ? '#e4e0d8' : '#cbd5e1',
          outdoorPerimeter:
            draftMaterial === 'pool_water'
              ? 'stone_curb'
              : !isIndoor
              ? 'none'
              : undefined,
        };
        onCreateZone(newZone);
        setDraftCustomName('');
        setDrawTool('select');
      }
    } else if (dragState?.type === 'draw_wall_drag') {
      const segLen = Math.hypot(
        dragState.curX - dragState.startX,
        dragState.curZ - dragState.startZ
      );
      if (segLen >= 0.35 && onCreateCustomWall) {
        const wallCount = (project.customWalls || []).length + 1;
        const newWall: CustomWallSegment = {
          id: `cwall_${Date.now()}`,
          name: draftCustomName.trim() || `Trennwand ${wallCount}`,
          level: activeFloor,
          x1: dragState.startX,
          z1: dragState.startZ,
          x2: dragState.curX,
          z2: dragState.curZ,
          height: draftWallMode === 'half_height' ? 1.1 : draftWallHeight,
          thickness: draftWallThickness,
          mode: draftWallMode,
          finish: draftWallFinish,
          color: '#e4e0d8',
        };
        onCreateCustomWall(newWall);
        setDraftCustomName('');
        setDrawTool('select');
      }
    }
    setDragState(null);
    setActiveBuildingSnapInfo(null);
    setActiveFenceSnapPoint(null);
  };

  const touchPinchRef = useRef<{
    initialDist: number;
    initialZoom: number;
    initialMidX: number;
    initialMidY: number;
    initialPanX: number;
    initialPanY: number;
  } | null>(null);

  const handleTouchStart = (e: React.TouchEvent<SVGSVGElement>) => {
    if (e.touches.length === 2) {
      const t1 = e.touches[0];
      const t2 = e.touches[1];
      const dist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
      const midX = (t1.clientX + t2.clientX) / 2;
      const midY = (t1.clientY + t2.clientY) / 2;
      touchPinchRef.current = {
        initialDist: Math.max(20, dist),
        initialZoom: zoom,
        initialMidX: midX,
        initialMidY: midY,
        initialPanX: pan.x,
        initialPanY: pan.y,
      };
      setDragState(null);
    }
  };

  const handleTouchMove = (e: React.TouchEvent<SVGSVGElement>) => {
    if (e.touches.length === 2 && touchPinchRef.current) {
      const t1 = e.touches[0];
      const t2 = e.touches[1];
      const dist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
      const midX = (t1.clientX + t2.clientX) / 2;
      const midY = (t1.clientY + t2.clientY) / 2;
      const scaleRatio = dist / touchPinchRef.current.initialDist;
      const nextZoom = Math.min(
        2.4,
        Math.max(0.35, +(touchPinchRef.current.initialZoom * scaleRatio).toFixed(2))
      );
      setZoom(nextZoom);
      setPan({
        x: touchPinchRef.current.initialPanX + (midX - touchPinchRef.current.initialMidX),
        y: touchPinchRef.current.initialPanY + (midY - touchPinchRef.current.initialMidY),
      });
    }
  };

  const handleTouchEnd = (e: React.TouchEvent<SVGSVGElement>) => {
    if (e.touches.length < 2) {
      touchPinchRef.current = null;
    }
  };

  const handleBackgroundPointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    if (touchPinchRef.current) return;
    // Standard Mouse Control: Right-click (button 2) or Middle-click (button 1) always pans the 2D canvas
    if (e.pointerType === 'mouse' && (e.button === 1 || e.button === 2)) {
      e.preventDefault();
      setDragState({
        type: 'pan',
        startClientX: e.clientX,
        startClientY: e.clientY,
        origPanX: pan.x,
        origPanY: pan.y,
      });
      return;
    }
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    const { wx, wz } = clientToWorld(e.clientX, e.clientY);
    const snappedX = roundCoord(wx, e.shiftKey);
    const snappedZ = roundCoord(wz, e.shiftKey);

    if (pendingCatalogItem) {
      onPlaceCatalogItemAt(snappedX, snappedZ);
      return;
    }

    if (drawTool === 'draw_rect_room' || drawTool === 'draw_rect_surface') {
      if (drawTool === 'draw_rect_room' && !e.altKey) {
        const bSnap = snapPointToBuildingGrid(wx, wz);
        setDragState({
          type: 'draw_rect',
          zoneType: 'indoor',
          startX: bSnap.wx,
          startZ: bSnap.wz,
          curX: bSnap.wx,
          curZ: bSnap.wz,
          snappedBuildingId: bSnap.buildingId,
          snappedRotationY: bSnap.rotationY,
        });
      } else {
        setDragState({
          type: 'draw_rect',
          zoneType: drawTool === 'draw_rect_room' ? 'indoor' : 'outdoor',
          startX: snappedX,
          startZ: snappedZ,
          curX: snappedX,
          curZ: snappedZ,
        });
      }
      return;
    }

    if (drawTool === 'draw_poly_room' || drawTool === 'draw_poly_surface') {
      const [ptX, ptZ] = getSnappedPolyPoint(wx, wz, e.shiftKey);
      // If user clicks near the first point and has >= 3 points, close & create polygon!
      if (polyDraftPoints.length >= 3) {
        const [firstX, firstZ] = polyDraftPoints[0];
        if (Math.hypot(ptX - firstX, ptZ - firstZ) <= 0.5) {
          commitPolygonDraft(polyDraftPoints);
          return;
        }
      }
      setPolyDraftPoints((prev) => [...prev, [ptX, ptZ]]);
      return;
    }

    if (drawTool === 'draw_wall') {
      setDragState({
        type: 'draw_wall_drag',
        startX: snappedX,
        startZ: snappedZ,
        curX: snappedX,
        curZ: snappedZ,
      });
      return;
    }

    setDragState({
      type: 'pan',
      startClientX: e.clientX,
      startClientY: e.clientY,
      origPanX: pan.x,
      origPanY: pan.y,
    });
  };

  // Helper to render a crisp CAD Dimension Line between two points in SVG pixel coordinates
  const renderCadDimensionLine = (
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    labelText: string,
    offsetPx: number,
    accentHex = '#38bdf8',
    key?: string
  ) => {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const lenPx = Math.hypot(dx, dy);
    if (lenPx < 22) return null;

    const nx = -dy / lenPx;
    const ny = dx / lenPx;

    const ax1 = x1 + nx * offsetPx;
    const ay1 = y1 + ny * offsetPx;
    const ax2 = x2 + nx * offsetPx;
    const ay2 = y2 + ny * offsetPx;
    const midX = (ax1 + ax2) / 2;
    const midY = (ay1 + ay2) / 2;

    const pillW = Math.max(44, labelText.length * 6.2 + 10);
    const pillH = 16;

    return (
      <g key={key} className="pointer-events-none">
        {/* Extension Lines from wall corners */}
        <line
          x1={x1}
          y1={y1}
          x2={ax1 + nx * 4}
          y2={ay1 + ny * 4}
          stroke={accentHex}
          strokeOpacity={0.55}
          strokeWidth={1}
        />
        <line
          x1={x2}
          y1={y2}
          x2={ax2 + nx * 4}
          y2={ay2 + ny * 4}
          stroke={accentHex}
          strokeOpacity={0.55}
          strokeWidth={1}
        />
        {/* Main Dimension Line */}
        <line
          x1={ax1}
          y1={ay1}
          x2={ax2}
          y2={ay2}
          stroke={accentHex}
          strokeWidth={1.5}
        />
        {/* End Ticks */}
        <circle cx={ax1} cy={ay1} r={2.4} fill={accentHex} />
        <circle cx={ax2} cy={ay2} r={2.4} fill={accentHex} />

        {/* Measurement Badge */}
        <rect
          x={midX - pillW / 2}
          y={midY - pillH / 2}
          width={pillW}
          height={pillH}
          rx={4}
          fill="#090d16"
          fillOpacity={0.94}
          stroke={accentHex}
          strokeWidth={1.1}
        />
        <text
          x={midX}
          y={midY + 3.5}
          textAnchor="middle"
          fill="#f8fafc"
          fontSize={9.5}
          fontWeight="700"
          fontFamily="JetBrains Mono, monospace"
        >
          {labelText}
        </text>
      </g>
    );
  };

  const isDrawingMode = drawTool !== 'select';
  const isPolyMode = drawTool === 'draw_poly_room' || drawTool === 'draw_poly_surface';
  const snappedPolyCursor = isPolyMode
    ? getSnappedPolyPoint(cursorWorld.wx, cursorWorld.wz, false)
    : ([cursorWorld.wx, cursorWorld.wz] as [number, number]);

  return (
    <div className="relative w-full h-full bg-[#0b111e] overflow-hidden select-none">
      {/* Top-Right 2D CAD Toolbar: Horizontally scrollable on Smartphone/Tablet, full toolbar on Desktop */}
      <div className="absolute top-14 lg:top-3 right-2.5 sm:right-4 z-15 flex flex-col items-end gap-2 max-w-[calc(100vw-1.25rem)]">
        <div className="flex items-center gap-1.5 bg-[#0f172a]/95 border border-white/15 rounded-xl px-2.5 py-1.5 shadow-2xl overflow-x-auto no-scrollbar max-w-full">
          <span className="text-xs font-semibold text-amber-300 px-1.5 whitespace-nowrap shrink-0">
            {FLOOR_NAMES[activeFloor]}
          </span>

          <div className="h-4 w-px bg-white/10 mx-0.5 shrink-0" />

          {/* Undo / Redo (Strg+Z / Strg+Y) */}
          {onUndo && (
            <button
              type="button"
              onClick={onUndo}
              disabled={!canUndo}
              title="Rückgängig (Strg + Z)"
              className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-semibold transition-colors whitespace-nowrap shrink-0 ${
                canUndo
                  ? 'bg-slate-800/90 text-slate-200 hover:bg-slate-700 hover:text-white border border-white/15'
                  : 'bg-slate-900/50 text-slate-600 cursor-not-allowed border border-white/5'
              }`}
            >
              <Undo2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Rückgängig</span>
            </button>
          )}
          {onRedo && (
            <button
              type="button"
              onClick={onRedo}
              disabled={!canRedo}
              title="Wiederherstellen (Strg + Y)"
              className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-semibold transition-colors whitespace-nowrap shrink-0 ${
                canRedo
                  ? 'bg-slate-800/90 text-slate-200 hover:bg-slate-700 hover:text-white border border-white/15'
                  : 'bg-slate-900/50 text-slate-600 cursor-not-allowed border border-white/5'
              }`}
            >
              <Redo2 className="w-3.5 h-3.5" />
            </button>
          )}

          {/* Tool 1: Select / Move */}
          <button
            type="button"
            onClick={() => activateDrawTool('select')}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors whitespace-nowrap shrink-0 ${
              drawTool === 'select'
                ? 'bg-amber-400 text-slate-950'
                : 'bg-slate-800/90 text-slate-300 hover:text-white'
            }`}
            title="Auswählen, Verschieben und Wand-/Eckpunkte bearbeiten"
          >
            <MousePointer className="w-3.5 h-3.5" />
            <span>Auswahl</span>
          </button>

          {/* Tool 2: Draw Rectangle Room (with walls) */}
          <button
            type="button"
            onClick={() => activateDrawTool('draw_rect_room', 'oak_parquet')}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors whitespace-nowrap shrink-0 ${
              drawTool === 'draw_rect_room'
                ? 'bg-sky-400 text-slate-950'
                : 'bg-slate-800/90 text-sky-300 hover:bg-slate-700 border border-sky-400/30'
            }`}
            title="Raum mit Wänden per Maus/Touch aufziehen (mit Live-Maßen in Metern & m²)"
          >
            <Square className="w-3.5 h-3.5" />
            <span>+ Raum (Rechteck)</span>
          </button>

          {/* Tool 3: Draw Freeform Polygon Room (with walls) */}
          <button
            type="button"
            onClick={() => activateDrawTool('draw_poly_room', 'oak_parquet')}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors whitespace-nowrap shrink-0 ${
              drawTool === 'draw_poly_room'
                ? 'bg-sky-400 text-slate-950'
                : 'bg-slate-800/90 text-sky-200 hover:bg-slate-700 border border-sky-400/30'
            }`}
            title="Raum frei Punkt für Punkt zeichnen (L-Form, Schrägen, beliebiger Grundriss)"
          >
            <Pentagon className="w-3.5 h-3.5" />
            <span>+ Raum (Freiform)</span>
          </button>

          {/* Tool 4: Draw Rectangle Surface / Area */}
          <button
            type="button"
            onClick={() => activateDrawTool('draw_rect_surface', 'lush_lawn')}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors whitespace-nowrap shrink-0 ${
              drawTool === 'draw_rect_surface'
                ? 'bg-emerald-400 text-slate-950'
                : 'bg-slate-800/90 text-emerald-300 hover:bg-slate-700 border border-emerald-400/30'
            }`}
            title="Fläche (Garten, Terrasse, Einfahrt, Pool, Boden) aufziehen"
          >
            <Trees className="w-3.5 h-3.5" />
            <span>+ Fläche (Rechteck)</span>
          </button>

          {/* Tool 5: Draw Freeform Polygon Surface / Area */}
          <button
            type="button"
            onClick={() => activateDrawTool('draw_poly_surface', 'lush_lawn')}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors whitespace-nowrap shrink-0 ${
              drawTool === 'draw_poly_surface' && draftMaterial !== 'pool_water' && !draftMaterial.startsWith('pathway_')
                ? 'bg-emerald-400 text-slate-950'
                : 'bg-slate-800/90 text-emerald-200 hover:bg-slate-700 border border-emerald-400/30'
            }`}
            title="Fläche frei Punkt für Punkt erstellen (Grundstück, Terrasse, Beet, Wege)"
          >
            <Pentagon className="w-3.5 h-3.5" />
            <span>+ Fläche (Freiform)</span>
          </button>

          {/* Tool 6: Draw Freeform Polygon Pool */}
          <button
            type="button"
            onClick={() => activateDrawTool('draw_poly_surface', 'pool_water')}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors whitespace-nowrap shrink-0 ${
              drawTool === 'draw_poly_surface' && draftMaterial === 'pool_water'
                ? 'bg-cyan-400 text-slate-950'
                : 'bg-slate-800/90 text-cyan-300 hover:bg-slate-700 border border-cyan-400/35'
            }`}
            title="Freiform-Swimmingpool Punkt für Punkt zeichnen (echte 3D-Polygon-Beckenform)"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>+ Pool (Freiform)</span>
          </button>

          {/* Tool 7: Draw Pathway / Walkway */}
          <button
            type="button"
            onClick={() => activateDrawTool('draw_poly_surface', 'pathway_stone')}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors whitespace-nowrap shrink-0 ${
              drawTool === 'draw_poly_surface' && draftMaterial.startsWith('pathway_')
                ? 'bg-amber-400 text-slate-950'
                : 'bg-slate-800/90 text-amber-200 hover:bg-slate-700 border border-amber-400/35'
            }`}
            title="Gartenweg / Pfad anlegen (Naturstein, Holzbohlen, Trittplatten, Kopfsteinpflaster)"
          >
            <Pentagon className="w-3.5 h-3.5" />
            <span>+ Weg / Pfad</span>
          </button>

          {/* Tool 8: Draw Street (Asphalt Road with Lane Markings) */}
          <button
            type="button"
            onClick={() => activateDrawTool('draw_rect_surface', 'asphalt_road')}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors whitespace-nowrap shrink-0 ${
              drawTool === 'draw_rect_surface' && draftMaterial === 'asphalt_road'
                ? 'bg-slate-200 text-slate-950'
                : 'bg-slate-800/90 text-slate-200 hover:bg-slate-700 border border-slate-400/35'
            }`}
            title="Asphaltstraße mit Fahrbahnmarkierung & Bordstein aufziehen"
          >
            <Square className="w-3.5 h-3.5" />
            <span>+ Straße</span>
          </button>

          {/* Tool 9: Draw Sidewalk (Bürgersteig / Gehweg) */}
          <button
            type="button"
            onClick={() => activateDrawTool('draw_rect_surface', 'sidewalk_pavers')}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors whitespace-nowrap shrink-0 ${
              drawTool === 'draw_rect_surface' && draftMaterial === 'sidewalk_pavers'
                ? 'bg-slate-300 text-slate-950'
                : 'bg-slate-800/90 text-slate-300 hover:bg-slate-700 border border-slate-400/30'
            }`}
            title="Gehweg / Bürgersteig mit Hochbord-Kante aufziehen"
          >
            <Square className="w-3.5 h-3.5" />
            <span>+ Gehweg</span>
          </button>

          {/* Tool 10: Draw Free-Standing Partition Wall (Wand-Designer) */}
          <button
            type="button"
            onClick={() => activateDrawTool('draw_wall')}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors whitespace-nowrap shrink-0 ${
              drawTool === 'draw_wall'
                ? 'bg-fuchsia-400 text-slate-950'
                : 'bg-slate-800/90 text-fuchsia-300 hover:bg-slate-700 border border-fuchsia-400/40'
            }`}
            title="Freie Einzelwand, Trennwand, Akzentwand oder halbhohe Theke im Plan einzeichnen"
          >
            <Ruler className="w-3.5 h-3.5" />
            <span>+ Freie Wand</span>
          </button>

          <div className="h-4 w-px bg-white/10 mx-0.5 shrink-0" />

          {/* Toggle CAD Dimension Lines */}
          <button
            type="button"
            onClick={() => setShowDimensions((prev) => !prev)}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors whitespace-nowrap shrink-0 ${
              showDimensions
                ? 'bg-amber-500/20 text-amber-300 border border-amber-400/40'
                : 'bg-slate-800 text-slate-400 hover:text-slate-200'
            }`}
            title="Wandlängen und Flächenmaße dauerhaft ein-/ausblenden"
          >
            <Ruler className="w-3.5 h-3.5" />
            <span>Maße {showDimensions ? 'AN' : 'AUS'}</span>
          </button>

          {/* Configurable Furniture & Room Grid Selector (Frei / 5 cm / 10 cm / 25 cm) */}
          <div className="flex items-center gap-0.5 bg-slate-900/95 border border-sky-400/35 rounded-lg p-0.5 shrink-0">
            <span className="text-[10px] font-semibold text-sky-300 px-1.5 flex items-center gap-1">
              <Grid className="w-3 h-3" />
              <span>Raster:</span>
            </span>
            {[
              { label: 'Aus', active: !snapToGrid, step: 0.02 },
              { label: '5cm', active: snapToGrid && furnitureGridStep === 0.05, step: 0.05 },
              { label: '10cm', active: snapToGrid && furnitureGridStep === 0.1, step: 0.1 },
              { label: '25cm', active: snapToGrid && furnitureGridStep === 0.25, step: 0.25 },
            ].map((opt) => (
              <button
                key={opt.label}
                type="button"
                onClick={() => {
                  if (opt.label === 'Aus') {
                    setSnapToGrid(false);
                  } else {
                    setSnapToGrid(true);
                    setFurnitureGridStep(opt.step);
                  }
                }}
                className={`px-1.5 py-0.5 rounded text-[10px] font-bold transition-colors ${
                  opt.active
                    ? 'bg-sky-400 text-slate-950'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800'
                }`}
                title={`Möbel- und Raum-Raster auf ${opt.label} setzen`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* Toggle Hard Wall Collision Stop for Furniture & Stairs */}
          <button
            type="button"
            onClick={() => setWallCollisionStop((prev) => !prev)}
            className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-semibold transition-colors whitespace-nowrap shrink-0 ${
              wallCollisionStop
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/40'
                : 'bg-slate-800 text-slate-400 hover:text-white border border-white/10'
            }`}
            title="Harter Wand-Stopp: Verhindert, dass Möbel, Sofas oder Treppen beim Verschieben in Raumwände ragen (Alt gedrückt halten zum Ignorieren)"
          >
            {wallCollisionStop ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
            <span>Wand-Stopp {wallCollisionStop ? 'AN' : 'AUS'}</span>
          </button>

          {/* Direct Wall Planner Trigger in 2D Toolbar */}
          {onOpenWallPlanner && (
            <button
              type="button"
              onClick={() => {
                const selectedAssetObj = selectedAssetId
                  ? activeAssets.find((a) => a.id === selectedAssetId)
                  : null;
                const targetZoneId =
                  selectedZoneId ||
                  selectedAssetObj?.wallModuleConfig?.hostZoneId ||
                  activeZones.find((z) => z.zoneType === 'indoor')?.id;
                if (targetZoneId) {
                  onOpenWallPlanner(
                    targetZoneId,
                    selectedAssetObj?.wallModuleConfig?.wallSide,
                    selectedAssetObj?.wallModuleConfig?.category
                  );
                }
              }}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-amber-400 hover:bg-amber-300 text-slate-950 shadow-md transition-colors whitespace-nowrap shrink-0"
              title="Wand-Planer öffnen (Küche, Wohnwand, Garderobe & Schränke bündig an einer Wand planen)"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>🧱 Wand-Planer</span>
            </button>
          )}

          {/* Quick Wall-to-Wall Fit Button when an Indoor Staircase is selected */}
          {selectedAssetId &&
            (() => {
              const selA = activeAssets.find((a) => a.id === selectedAssetId);
              if (!selA || !isStairAsset(selA.catalogId)) return null;
              return (
                <button
                  type="button"
                  onClick={() => {
                    const fitted = fitStairAssetToRoomWalls(selA, activeZones, 'wall_to_wall');
                    if (fitted) {
                      onUpdateAsset(selA.id, fitted);
                    }
                  }}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-sky-400 hover:bg-sky-300 text-slate-950 shadow-md transition-colors whitespace-nowrap shrink-0"
                  title="Treppe automatisch bündig von Wand zu Wand im Raum einpassen"
                >
                  <Maximize2 className="w-3.5 h-3.5" />
                  <span>📐 Treppe Wand-zu-Wand</span>
                </button>
              );
            })()}

          <button
            type="button"
            onClick={() => setZoom((z) => Math.max(0.35, +(z - 0.15).toFixed(2)))}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 shrink-0"
            title="Herauszoomen"
          >
            <Minus className="w-3.5 h-3.5" />
          </button>
          <span className="text-xs font-mono text-amber-300 tabular-nums w-11 text-center shrink-0">
            {Math.round(zoom * 100)}%
          </span>
          <button
            type="button"
            onClick={() => setZoom((z) => Math.min(2.4, +(z + 0.15).toFixed(2)))}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 shrink-0"
            title="Hereinzoomen"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => {
              setZoom(0.85);
              setPan({ x: 35, y: -25 });
            }}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 shrink-0"
            title="Ansicht zentrieren"
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Sub-Bar when a Room, Surface, or Free Wall Drawing Tool is active */}
        {isDrawingMode && (
          <div className="flex flex-wrap items-center gap-2 bg-[#090d16]/95 border border-amber-400/50 rounded-xl px-3 py-2 shadow-2xl max-w-full overflow-x-auto">
            <span className="text-[11px] font-bold text-amber-300">
              {drawTool === 'draw_wall'
                ? 'Freie Wand / Trennwand ziehen:'
                : drawTool === 'draw_rect_room'
                ? 'Rechteck-Raum aufziehen:'
                : drawTool === 'draw_poly_room'
                ? 'Freiform-Raum (Eckpunkte antippen/klicken):'
                : drawTool === 'draw_rect_surface'
                ? 'Rechteck-Fläche aufziehen:'
                : 'Freiform-Fläche (Eckpunkte antippen/klicken):'}
            </span>

            <input
              type="text"
              value={draftCustomName}
              onChange={(e) => setDraftCustomName(e.target.value)}
              placeholder={
                drawTool === 'draw_wall'
                  ? 'Name (z.B. Küchen-Trennwand)...'
                  : 'Name (z.B. Wohnzimmer, Straße)...'
              }
              className="w-36 sm:w-44 bg-slate-900 border border-white/15 rounded-lg px-2 py-1 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-amber-400"
            />

            {drawTool === 'draw_wall' ? (
              <>
                <select
                  value={draftWallMode}
                  onChange={(e) => setDraftWallMode(e.target.value as WallSegmentMode)}
                  className="bg-slate-900 border border-fuchsia-400/40 rounded-lg px-2 py-1 text-xs text-fuchsia-300 font-semibold"
                >
                  <option value="full">Volle Raumhöhe</option>
                  <option value="half_height">Halbhohe Wand / Theke (1,10m)</option>
                  <option value="archway">Wand mit Rundbogen-Durchgang</option>
                </select>
                <select
                  value={draftWallFinish}
                  onChange={(e) => setDraftWallFinish(e.target.value as WallSurfaceFinish)}
                  className="bg-slate-900 border border-white/15 rounded-lg px-2 py-1 text-xs text-sky-300 font-medium"
                >
                  <option value="plaster">Glattputz Standard</option>
                  <option value="wood_slats">Akustik-Holzlamellen</option>
                  <option value="brick_exposed">Sichtklinker / Backstein</option>
                  <option value="stone_tile">Naturstein-Fliesen</option>
                  <option value="concrete_loft">Sichtbeton Loft</option>
                  <option value="wallpaper_accent">Design-Akzenttapete</option>
                  <option value="glass_block">Glasbausteine (Lichtdurchlässig)</option>
                </select>
                <div className="flex items-center gap-1 text-xs text-slate-300">
                  <span>Stärke:</span>
                  <input
                    type="number"
                    step={0.02}
                    min={0.08}
                    max={0.45}
                    value={draftWallThickness}
                    onChange={(e) => setDraftWallThickness(parseFloat(e.target.value) || 0.16)}
                    className="w-14 bg-slate-900 border border-white/15 rounded px-1.5 py-1 text-xs font-mono text-white"
                  />
                  <span>m</span>
                </div>
              </>
            ) : (
              <select
                value={draftMaterial}
                onChange={(e) => setDraftMaterial(e.target.value as SurfaceMaterialId)}
                className="bg-slate-900 border border-white/15 rounded-lg px-2 py-1 text-xs text-sky-300 font-medium"
              >
                {SURFACE_MATERIALS.map((mat) => (
                  <option key={mat.id} value={mat.id}>
                    {mat.name}
                  </option>
                ))}
              </select>
            )}

            {(drawTool === 'draw_rect_room' || drawTool === 'draw_poly_room') && (
              <>
                <div className="flex items-center gap-1 text-xs text-slate-300">
                  <span>Gebäude:</span>
                  <select
                    value={draftBuildingId}
                    onChange={(e) => setDraftBuildingId(e.target.value)}
                    className="bg-slate-900 border border-amber-400/40 rounded-lg px-2 py-1 text-xs text-amber-300 font-semibold"
                    title="Gebäude-Zuordnung & Raster-Fang beim Einzeichnen"
                  >
                    <option value="auto">Auto-Raster & Gebäude erkennen</option>
                    {getAvailableBuildingOptions(project.zones).map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.label} ({b.hint})
                      </option>
                    ))}
                    <option value="none">Freistehend (ohne Zuordnung)</option>
                  </select>
                </div>
                <div className="flex items-center gap-1 text-xs text-slate-300">
                  <span>Wandhöhe:</span>
                  <input
                    type="number"
                    step={0.1}
                    min={1.0}
                    max={5.0}
                    value={draftWallHeight}
                    onChange={(e) => setDraftWallHeight(parseFloat(e.target.value) || 2.6)}
                    className="w-14 bg-slate-900 border border-white/15 rounded px-1.5 py-1 text-xs font-mono text-white"
                  />
                  <span>m</span>
                </div>
              </>
            )}

            {isPolyMode && (
              <div className="flex items-center gap-1.5 pl-1 border-l border-white/15">
                <span className="text-[11px] font-mono text-emerald-300">
                  {polyDraftPoints.length} Pkt.
                </span>
                {polyDraftPoints.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setPolyDraftPoints((prev) => prev.slice(0, -1))}
                    className="flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px]"
                    title="Letzten Eckpunkt rückgängig machen (Backspace)"
                  >
                    <Undo2 className="w-3 h-3" />
                    <span>Zurück</span>
                  </button>
                )}
                {polyDraftPoints.length >= 3 && (
                  <button
                    type="button"
                    onClick={() => commitPolygonDraft(polyDraftPoints)}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-[11px]"
                    title="Polygon-Fläche jetzt fertigstellen (Enter)"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Fertigstellen ({computePolygonAreaM2(polyDraftPoints).toFixed(1)} m²)</span>
                  </button>
                )}
              </div>
            )}

            <button
              type="button"
              onClick={() => {
                setPolyDraftPoints([]);
                setDrawTool('select');
              }}
              className="p-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white"
              title="Zeichnen abbrechen (Esc)"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* Empty Canvas Quick-Start Overlay when no zones exist yet */}
      {project.zones.length === 0 && !isDrawingMode && !pendingCatalogItem && (
        <div className="absolute top-28 sm:top-24 left-1/2 -translate-x-1/2 z-15 w-[min(92vw,660px)] rounded-2xl bg-[#090d16]/95 border border-white/15 p-3.5 sm:p-4 shadow-2xl">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-white/10">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Ruler className="w-4 h-4 text-amber-400 shrink-0" />
                <span>Leere Planungs-Ansicht — Starte deinen Grundriss mit Live-Maßen</span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Ziehe Räume und Flächen per Finger/Maus auf oder zeichne freie Polygone Punkt für Punkt mit exakter Meter- & m²-Anzeige.
              </p>
            </div>
            {onLoadDemoProject && (
              <button
                type="button"
                onClick={onLoadDemoProject}
                className="shrink-0 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-white/10 text-xs font-medium text-slate-300 hover:text-white"
              >
                Beispiel-Villa laden
              </button>
            )}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-3">
            <button
              type="button"
              onClick={() => activateDrawTool('draw_rect_room', 'oak_parquet')}
              className="flex flex-col items-start p-2.5 rounded-xl bg-sky-500/15 hover:bg-sky-500/25 border border-sky-400/40 text-left transition-colors"
            >
              <span className="text-xs font-bold text-sky-300 flex items-center gap-1.5">
                <Square className="w-3.5 h-3.5" />
                Raum aufziehen
              </span>
              <span className="text-[10px] text-slate-400 mt-1">
                Rechteck-Raum mit Wänden & Live-Maßen
              </span>
            </button>

            <button
              type="button"
              onClick={() => activateDrawTool('draw_poly_room', 'oak_parquet')}
              className="flex flex-col items-start p-2.5 rounded-xl bg-sky-500/10 hover:bg-sky-500/20 border border-sky-400/30 text-left transition-colors"
            >
              <span className="text-xs font-bold text-sky-200 flex items-center gap-1.5">
                <Pentagon className="w-3.5 h-3.5" />
                Freiform-Raum
              </span>
              <span className="text-[10px] text-slate-400 mt-1">
                Eckpunkte frei setzen (L-Form, Schrägen)
              </span>
            </button>

            <button
              type="button"
              onClick={() => activateDrawTool('draw_rect_surface', 'lush_lawn')}
              className="flex flex-col items-start p-2.5 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-400/40 text-left transition-colors"
            >
              <span className="text-xs font-bold text-emerald-300 flex items-center gap-1.5">
                <Trees className="w-3.5 h-3.5" />
                Fläche aufziehen
              </span>
              <span className="text-[10px] text-slate-400 mt-1">
                Garten, Terrasse, Einfahrt, Pool
              </span>
            </button>

            <button
              type="button"
              onClick={() => activateDrawTool('draw_poly_surface', 'lush_lawn')}
              className="flex flex-col items-start p-2.5 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-400/30 text-left transition-colors"
            >
              <span className="text-xs font-bold text-emerald-200 flex items-center gap-1.5">
                <Pentagon className="w-3.5 h-3.5" />
                Freiform-Fläche
              </span>
              <span className="text-[10px] text-slate-400 mt-1">
                Freies Grundstück / Polygon zeichnen
              </span>
            </button>
          </div>
        </div>
      )}

      {/* Placement Mode Banner */}
      {pendingCatalogItem && (
        <div className="absolute top-14 lg:top-4 left-1/2 -translate-x-1/2 z-20 pointer-events-none max-w-[92vw]">
          <div className="px-3.5 py-2 rounded-lg bg-amber-500 text-slate-950 text-xs font-semibold shadow-lg truncate">
            2D-Platzierung ({FLOOR_NAMES[activeFloor]}): Tippe/klicke auf die gewünschte Stelle für „{pendingCatalogItem.name}“
          </div>
        </div>
      )}

      {/* Bottom-Left Live Cursor Coordinates & Active Tool Status */}
      <div className="absolute bottom-14 sm:bottom-24 left-2.5 sm:left-5 z-15 pointer-events-none flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#090d16]/90 border border-white/10 text-[11px] font-mono text-slate-300 shadow-lg max-w-[calc(100vw-1.25rem)] overflow-hidden">
        <span className="text-amber-400 font-semibold shrink-0">POS</span>
        <span ref={cursorXDomRef} className="tabular-nums shrink-0">
          X: {cursorWorld.wx >= 0 ? `+${cursorWorld.wx.toFixed(2)}` : cursorWorld.wx.toFixed(2)} m
        </span>
        <span className="text-slate-600 shrink-0">·</span>
        <span ref={cursorZDomRef} className="tabular-nums shrink-0">
          Z: {cursorWorld.wz >= 0 ? `+${cursorWorld.wz.toFixed(2)}` : cursorWorld.wz.toFixed(2)} m
        </span>
        {isDrawingMode && (
          <>
            <span className="text-slate-600 shrink-0">|</span>
            <span className="text-sky-300 font-sans font-semibold truncate">
              {isPolyMode
                ? 'Tippen/Klicken = Eckpunkt · Startpunkt / Fertigstellen = Abschließen'
                : 'Gedrückt halten & aufziehen'}
            </span>
          </>
        )}
        {activeBuildingSnapInfo && (
          <>
            <span className="text-slate-600 shrink-0">|</span>
            <span className="text-emerald-300 font-sans font-bold flex items-center gap-1 truncate">
              <Home className="w-3 h-3 text-emerald-400 shrink-0" />
              Gebäude-Raster: {activeBuildingSnapInfo.buildingName} (an „{activeBuildingSnapInfo.hostZoneName}“
              {Math.abs(activeBuildingSnapInfo.rotationY) > 0.01
                ? ` · ${Math.round((-activeBuildingSnapInfo.rotationY * 180) / Math.PI)}°`
                : ''}
              )
            </span>
          </>
        )}
      </div>

      {/* Interactive 2D North Star (Nordstern) Compass Widget in Bottom-Left above POS bar */}
      <div className="absolute bottom-24 sm:bottom-36 left-2.5 sm:left-5 z-15 flex items-center gap-2 px-2.5 py-1.5 rounded-xl bg-[#090d16]/95 border border-white/15 shadow-xl">
        <button
          type="button"
          onClick={() => {
            if (onUpdateNorthAngle) {
              onUpdateNorthAngle(((project.northAngle ?? 0) + 45) % 360);
            }
          }}
          onContextMenu={(e) => {
            e.preventDefault();
            if (onUpdateNorthAngle) onUpdateNorthAngle(0);
          }}
          title="Nordstern: Klicken = +45° drehen · Rechtsklick = 0° Nord oben"
          className="flex items-center gap-2 text-left hover:opacity-90"
        >
          <svg
            viewBox="0 0 36 36"
            className="w-7 h-7 shrink-0 transition-transform duration-300"
            style={{ transform: `rotate(${project.northAngle ?? 0}deg)` }}
          >
            <circle
              cx="18"
              cy="18"
              r="16"
              fill="#0f172a"
              stroke="rgba(245, 158, 11, 0.5)"
              strokeWidth="1.2"
            />
            <polygon points="18,3 21.5,18 18,15 14.5,18" fill="#f59e0b" />
            <polygon points="18,33 21,18 18,21 15,18" fill="#64748b" />
            <polygon points="33,18 18,21 21,18 18,15" fill="#475569" />
            <polygon points="3,18 18,21 15,18 18,15" fill="#475569" />
            <text
              x="18"
              y="10.5"
              textAnchor="middle"
              fill="#fef08a"
              fontSize="6.5"
              fontWeight="800"
              fontFamily="JetBrains Mono, monospace"
            >
              N
            </text>
          </svg>
          <div>
            <div className="text-[10px] font-bold text-amber-300 leading-tight">
              Nordstern ({Math.round(project.northAngle ?? 0)}°)
            </div>
            <div className="text-[9px] text-slate-400 leading-tight">
              Klick +45° · Sonnenbahn
            </div>
          </div>
        </button>
        {onUpdateNorthAngle && (
          <input
            type="range"
            min={0}
            max={345}
            step={15}
            value={project.northAngle ?? 0}
            onChange={(e) => onUpdateNorthAngle(parseInt(e.target.value, 10))}
            className="w-16 accent-amber-400 cursor-pointer h-1 bg-slate-800 rounded"
            title="Nord-Ausrichtung in 15°-Schritten frei drehen"
          />
        )}
      </div>

      <svg
        ref={svgRef}
        onContextMenu={(e) => e.preventDefault()}
        onPointerDownCapture={(e) => {
          // Allow right-click (button 2) or middle-click (button 1) drag anywhere on the 2D canvas (even over rooms/assets) to pan smoothly!
          if (e.pointerType === 'mouse' && (e.button === 1 || e.button === 2)) {
            e.stopPropagation();
            setDragState({
              type: 'pan',
              startClientX: e.clientX,
              startClientY: e.clientY,
              origPanX: pan.x,
              origPanY: pan.y,
            });
          }
        }}
        onPointerDown={handleBackgroundPointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onDoubleClick={() => {
          if (isPolyMode && polyDraftPoints.length >= 3) {
            commitPolygonDraft(polyDraftPoints);
          }
        }}
        onWheel={(e) => {
          const factor = e.deltaY < 0 ? 1.1 : 0.9;
          const nextZoom = Math.min(2.4, Math.max(0.35, +(zoom * factor).toFixed(2)));
          if (nextZoom !== zoom && svgRef.current) {
            const rect = svgRef.current.getBoundingClientRect();
            const cx = e.clientX - rect.left - rect.width / 2;
            const cy = e.clientY - rect.top - rect.height / 2;
            const ratio = nextZoom / zoom;
            setPan((prev) => ({
              x: cx - (cx - prev.x) * ratio,
              y: cy - (cy - prev.y) * ratio,
            }));
            setZoom(nextZoom);
          }
        }}
        className={`w-full h-full touch-none ${
          pendingCatalogItem || isDrawingMode
            ? 'cursor-crosshair'
            : dragState
            ? 'cursor-grabbing'
            : 'cursor-grab'
        }`}
      >
        <defs>
          <pattern
            id="cadSubGrid"
            width={PIXELS_PER_METER * 0.5}
            height={PIXELS_PER_METER * 0.5}
            patternUnits="userSpaceOnUse"
          >
            <path
              d={`M ${PIXELS_PER_METER * 0.5} 0 L 0 0 0 ${PIXELS_PER_METER * 0.5}`}
              fill="none"
              stroke="rgba(148, 163, 184, 0.08)"
              strokeWidth="1"
            />
          </pattern>
          <pattern
            id="cadMainGrid"
            width={PIXELS_PER_METER * 2}
            height={PIXELS_PER_METER * 2}
            patternUnits="userSpaceOnUse"
          >
            <rect
              width={PIXELS_PER_METER * 2}
              height={PIXELS_PER_METER * 2}
              fill="url(#cadSubGrid)"
            />
            <path
              d={`M ${PIXELS_PER_METER * 2} 0 L 0 0 0 ${PIXELS_PER_METER * 2}`}
              fill="none"
              stroke="rgba(148, 163, 184, 0.18)"
              strokeWidth="1.2"
            />
          </pattern>
        </defs>

        {/* Infinite CAD Grid */}
        <rect width="100%" height="100%" fill="url(#cadMainGrid)" />

        {/* World Origin Group centered in SVG */}
        <g
          transform={`translate(${
            (svgRef.current?.clientWidth || window.innerWidth) / 2 + pan.x
          }, ${(svgRef.current?.clientHeight || window.innerHeight) / 2 + pan.y})`}
        >
          {/* Origin Crosshair (0.00m, 0.00m) */}
          <g className="pointer-events-none opacity-45">
            <line x1={-16} y1={0} x2={16} y2={0} stroke="#f59e0b" strokeWidth={1.2} />
            <line x1={0} y1={-16} x2={0} y2={16} stroke="#f59e0b" strokeWidth={1.2} />
            <circle cx={0} cy={0} r={3} fill="none" stroke="#f59e0b" strokeWidth={1.2} />
          </g>

          {/* 0. Faint Ghost Blueprint of Lower Floor (or EG Above when in KG Basement) */}
          {ghostZones.map((gz) => {
            const ghostPrefix = activeFloor === -1 ? 'EG darüber' : 'Darunter';
            const ghostStroke = activeFloor === -1 ? '#38bdf8' : '#64748b';
            const ghostOpacity = activeFloor === -1 ? 'opacity-45' : 'opacity-30';
            if (gz.points && gz.points.length >= 3) {
              const polyStr = gz.points
                .map(([px, pz]) => `${px * PIXELS_PER_METER},${pz * PIXELS_PER_METER}`)
                .join(' ');
              return (
                <g key={`ghost_${gz.id}`} className={`pointer-events-none ${ghostOpacity}`}>
                  <polygon
                    points={polyStr}
                    fill="none"
                    stroke={ghostStroke}
                    strokeWidth={2}
                    strokeDasharray="5 4"
                  />
                  <text
                    x={gz.x * PIXELS_PER_METER}
                    y={gz.z * PIXELS_PER_METER}
                    textAnchor="middle"
                    fill={ghostStroke}
                    fontSize={9}
                    fontFamily="JetBrains Mono, monospace"
                  >
                    {ghostPrefix}: {gz.name}
                  </text>
                </g>
              );
            }
            const xPx = (gz.x - gz.width / 2) * PIXELS_PER_METER;
            const zPx = (gz.z - gz.depth / 2) * PIXELS_PER_METER;
            const wPx = gz.width * PIXELS_PER_METER;
            const dPx = gz.depth * PIXELS_PER_METER;
            return (
              <g key={`ghost_${gz.id}`} className={`pointer-events-none ${ghostOpacity}`}>
                <rect
                  x={xPx}
                  y={zPx}
                  width={wPx}
                  height={dPx}
                  fill="none"
                  stroke={ghostStroke}
                  strokeWidth={2}
                  strokeDasharray="5 4"
                />
                <text
                  x={xPx + 8}
                  y={zPx + 14}
                  fill={ghostStroke}
                  fontSize={9}
                  fontFamily="JetBrains Mono, monospace"
                >
                  {ghostPrefix}: {gz.name}
                </text>
              </g>
            );
          })}

          {/* 0b. Multi-Story Stairwell Cutout Preview (Treppenauge / Austritt von Treppe aus dem Geschoss darunter bzw. EG darüber im Keller) */}
          {project.assets
            .filter(
              (a) => isStairAsset(a.catalogId) && (a.level ?? 0) === ghostReferenceFloor
            )
            .map((lowerStair) => {
              const sc = lowerStair.scale || 1;
              const isSpiral = lowerStair.catalogId.includes('spiral');
              const isQuarter = lowerStair.catalogId.includes('l_quarter');
              const isHalf = lowerStair.catalogId.includes('u_half');
              const stW =
                (lowerStair.stairConfig?.width ??
                  (isSpiral ? 1.85 : isQuarter || isHalf ? 2.1 : 1.12)) *
                sc *
                PIXELS_PER_METER;
              const stD =
                (lowerStair.stairConfig?.totalRun ??
                  (isSpiral ? 1.85 : isHalf ? 2.6 : 3.05)) *
                sc *
                PIXELS_PER_METER;
              const sx = lowerStair.position[0] * PIXELS_PER_METER;
              const sz = lowerStair.position[2] * PIXELS_PER_METER;
              const rotDeg = (-lowerStair.rotationY * 180) / Math.PI;
              const stepCount = Math.max(6, Math.min(16, lowerStair.stairConfig?.stepCount ?? 14));

              return (
                <g
                  key={`stair_below_${lowerStair.id}`}
                  transform={`translate(${sx}, ${sz}) rotate(${rotDeg})`}
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectAsset(lowerStair.id, lowerStair.entityId);
                  }}
                  className="cursor-pointer opacity-85 hover:opacity-100"
                >
                  <rect
                    x={-stW / 2}
                    y={-stD / 2}
                    width={stW}
                    height={stD}
                    rx={4}
                    fill="rgba(56, 189, 248, 0.1)"
                    stroke="#38bdf8"
                    strokeWidth={2}
                    strokeDasharray="5 3"
                  />
                  {Array.from({ length: Math.min(10, stepCount) }).map((_, idx) => {
                    const yPos = -stD / 2 + ((idx + 1) / (Math.min(10, stepCount) + 1)) * stD;
                    return (
                      <line
                        key={idx}
                        x1={-stW / 2 + 4}
                        y1={yPos}
                        x2={stW / 2 - 4}
                        y2={yPos}
                        stroke="rgba(56, 189, 248, 0.45)"
                        strokeWidth={1.1}
                      />
                    );
                  })}
                  <line
                    x1={0}
                    y1={stD * 0.35}
                    x2={0}
                    y2={-stD * 0.35}
                    stroke="#fbbf24"
                    strokeWidth={1.8}
                  />
                  <polygon
                    points={`0,${-stD * 0.4} -5,${-stD * 0.25} 5,${-stD * 0.25}`}
                    fill="#fbbf24"
                  />
                  <text
                    x={0}
                    y={4}
                    textAnchor="middle"
                    fill="#bae6fd"
                    fontSize={8.5}
                    fontWeight="700"
                    fontFamily="JetBrains Mono, monospace"
                  >
                    Treppenauge ↑
                  </text>
                </g>
              );
            })}

          {/* 1. Render Active Floor Zones in Deterministic Layer Order (Lawn -> Gravel -> Decks/Driveways -> Pathways -> Pool -> Wohnraum/Nebengebäude Base -> Interior Rooms on top) */}
          {[...activeZones]
            .sort((a, b) => {
              const getTier = (z: FloorplanZone) => {
                if (z.zoneType === 'indoor') {
                  return isInteriorRoomZone(z, activeZones) ? 12 : 10;
                }
                if (typeof z.layerOrder === 'number' && z.layerOrder !== 0) {
                  return 2 + z.layerOrder;
                }
                if (z.surfaceMaterial === 'pool_water') return 5;
                if (z.surfaceMaterial.startsWith('pathway_')) return 4;
                if (z.surfaceMaterial === 'lush_lawn') return 0;
                if (z.surfaceMaterial === 'gravel_bed') return 1;
                return 2;
              };
              const tA = getTier(a);
              const tB = getTier(b);
              if (tA !== tB) return tA - tB;
              return computeZoneAreaM2(b) - computeZoneAreaM2(a);
            })
            .map((zone) => {
              const isSelected = zone.id === selectedZoneId;
              const isInnerRoom =
                zone.zoneType === 'indoor' && isInteriorRoomZone(zone, activeZones);
              const matMeta = SURFACE_MATERIALS.find((m) => m.id === zone.surfaceMaterial);
              const isPolygon = Boolean(zone.points && zone.points.length >= 3);
              const areaM2 = computeZoneAreaM2(zone).toFixed(1);

              const xPx = (zone.x - zone.width / 2) * PIXELS_PER_METER;
              const zPx = (zone.z - zone.depth / 2) * PIXELS_PER_METER;
              const wPx = zone.width * PIXELS_PER_METER;
              const dPx = zone.depth * PIXELS_PER_METER;

              const halfW = zone.width / 2 + 0.35;
              const halfD = zone.depth / 2 + 0.35;
              const roomAssets = activeAssets.filter(
                (a) =>
                  a.position[0] >= zone.x - halfW &&
                  a.position[0] <= zone.x + halfW &&
                  a.position[2] >= zone.z - halfD &&
                  a.position[2] <= zone.z + halfD
              );
              const roomSmartCount = roomAssets.filter((a) => Boolean(a.entityId)).length;
              const roomTemp =
                zone.climateEntityId && entities[zone.climateEntityId]
                  ? entities[zone.climateEntityId].attributes.current_temperature
                  : undefined;

              return (
                <g
                  key={zone.id}
                  onPointerDown={(e) => {
                    if (pendingCatalogItem || isDrawingMode) return;
                    e.stopPropagation();
                    onSelectZone(zone.id);
                    if (zone.locked) return;
                    const { wx, wz } = clientToWorld(e.clientX, e.clientY);
                    setDragState({
                      type: 'zone_move',
                      id: zone.id,
                      startWorldX: wx,
                      startWorldZ: wz,
                      origX: zone.x,
                      origZ: zone.z,
                      origPoints: zone.points ? zone.points.map((p) => [...p] as [number, number]) : undefined,
                    });
                  }}
                  className={
                    isDrawingMode
                      ? 'cursor-crosshair'
                      : zone.locked
                      ? 'cursor-pointer'
                      : 'cursor-move'
                  }
                >
                  {/* Zone Floor Fill (Polygon or Rectangle with optional Building Rotation; Interior Rooms sit OPAQUELY over the Wohnraum floor) */}
                  {isPolygon && zone.points ? (
                    <g>
                      {isInnerRoom && (
                        <polygon
                          points={zone.points
                            .map(([px, pz]) => `${px * PIXELS_PER_METER},${pz * PIXELS_PER_METER}`)
                            .join(' ')}
                          fill="#0b111e"
                          fillOpacity={0.94}
                        />
                      )}
                      <polygon
                        points={zone.points
                          .map(([px, pz]) => `${px * PIXELS_PER_METER},${pz * PIXELS_PER_METER}`)
                          .join(' ')}
                        fill={matMeta?.previewHex || '#334155'}
                        fillOpacity={
                          isInnerRoom ? 0.68 : zone.zoneType === 'indoor' ? 0.38 : 0.32
                        }
                        stroke={
                          isSelected
                            ? '#38bdf8'
                            : zone.zoneType === 'indoor'
                            ? '#e2e8f0'
                            : '#4ade80'
                        }
                        strokeWidth={isSelected ? 3.5 : zone.zoneType === 'indoor' ? 5 : 2}
                        strokeDasharray={zone.zoneType === 'outdoor' ? '6 4' : undefined}
                        strokeLinejoin="round"
                      />
                    </g>
                  ) : (
                    <g
                      transform={
                        isZoneRotated(zone)
                          ? `rotate(${(-(zone.rotationY || 0) * 180) / Math.PI}, ${
                              zone.x * PIXELS_PER_METER
                            }, ${zone.z * PIXELS_PER_METER})`
                          : undefined
                      }
                    >
                      {isInnerRoom && (
                        <rect
                          x={xPx}
                          y={zPx}
                          width={wPx}
                          height={dPx}
                          fill="#0b111e"
                          fillOpacity={0.94}
                          rx={1}
                        />
                      )}
                      <rect
                        x={xPx}
                        y={zPx}
                        width={wPx}
                        height={dPx}
                        fill={matMeta?.previewHex || '#334155'}
                        fillOpacity={
                          isInnerRoom ? 0.68 : zone.zoneType === 'indoor' ? 0.38 : 0.32
                        }
                        stroke={
                          isSelected
                            ? '#38bdf8'
                            : zone.zoneType === 'indoor'
                            ? '#e2e8f0'
                            : '#4ade80'
                        }
                        strokeWidth={
                          isSelected ? 3.5 : zone.zoneType === 'indoor' ? 5 : 2
                        }
                        strokeDasharray={zone.zoneType === 'outdoor' ? '6 4' : undefined}
                        rx={zone.zoneType === 'outdoor' ? 4 : 1}
                      />

                      {/* 2D Wand-Designer: Visual Overlay for Hidden / Half-Height / Archway / Styled Room Walls */}
                      {zone.zoneType === 'indoor' &&
                        zone.wallSides &&
                        (
                          [
                            {
                              side: 'north' as WallSideId,
                              x1: xPx,
                              y1: zPx,
                              x2: xPx + wPx,
                              y2: zPx,
                              mx: xPx + wPx / 2,
                              my: zPx,
                            },
                            {
                              side: 'south' as WallSideId,
                              x1: xPx,
                              y1: zPx + dPx,
                              x2: xPx + wPx,
                              y2: zPx + dPx,
                              mx: xPx + wPx / 2,
                              my: zPx + dPx,
                            },
                            {
                              side: 'west' as WallSideId,
                              x1: xPx,
                              y1: zPx,
                              x2: xPx,
                              y2: zPx + dPx,
                              mx: xPx,
                              my: zPx + dPx / 2,
                            },
                            {
                              side: 'east' as WallSideId,
                              x1: xPx + wPx,
                              y1: zPx,
                              x2: xPx + wPx,
                              y2: zPx + dPx,
                              mx: xPx + wPx,
                              my: zPx + dPx / 2,
                            },
                          ] as const
                        ).map((wLine) => {
                          const cfg = zone.wallSides?.[wLine.side];
                          if (!cfg) return null;
                          const isHidden = cfg.mode === 'hidden';
                          const isHalf = cfg.mode === 'half_height';
                          const isArch = cfg.mode === 'archway';
                          const hasCustomFinish = cfg.finish && cfg.finish !== 'plaster';
                          if (!isHidden && !isHalf && !isArch && !hasCustomFinish) return null;

                          return (
                            <g key={`ws_${wLine.side}`} className="pointer-events-none">
                              {/* First mask out default wall line if hidden */}
                              {isHidden && (
                                <line
                                  x1={wLine.x1}
                                  y1={wLine.y1}
                                  x2={wLine.x2}
                                  y2={wLine.y2}
                                  stroke="#0b111e"
                                  strokeWidth={6.5}
                                />
                              )}
                              <line
                                x1={wLine.x1}
                                y1={wLine.y1}
                                x2={wLine.x2}
                                y2={wLine.y2}
                                stroke={
                                  isHidden
                                    ? '#38bdf8'
                                    : isHalf
                                    ? '#fbbf24'
                                    : isArch
                                    ? '#c084fc'
                                    : '#f472b6'
                                }
                                strokeWidth={isHidden ? 2 : 5.5}
                                strokeDasharray={
                                  isHidden ? '4 4' : isHalf ? '8 3' : isArch ? '10 4' : undefined
                                }
                              />
                              <rect
                                x={wLine.mx - 28}
                                y={wLine.my - 7}
                                width={56}
                                height={14}
                                rx={4}
                                fill="#090d16"
                                fillOpacity={0.92}
                                stroke={
                                  isHidden
                                    ? '#38bdf8'
                                    : isHalf
                                    ? '#fbbf24'
                                    : isArch
                                    ? '#c084fc'
                                    : '#f472b6'
                                }
                                strokeWidth={1}
                              />
                              <text
                                x={wLine.mx}
                                y={wLine.my + 3}
                                textAnchor="middle"
                                fill="#f8fafc"
                                fontSize={7.5}
                                fontWeight="700"
                                fontFamily="JetBrains Mono, monospace"
                              >
                                {isHidden
                                  ? 'OFFEN'
                                  : isHalf
                                  ? 'THEKE 1.1m'
                                  : isArch
                                  ? 'RUNDBOGEN'
                                  : cfg.finish === 'wood_slats'
                                  ? 'LAMELLEN'
                                  : cfg.finish === 'brick_exposed'
                                  ? 'KLINKER'
                                  : 'DESIGN'}
                              </text>
                            </g>
                          );
                        })}

                      {/* 2D Roof Ridge, Overhangs (Traufe vs. Giebel), Individual Dormers, Skylights & Chimneys Blueprint Overlay */}
                      {zone.zoneType === 'indoor' &&
                        zone.roofConfig &&
                        zone.roofConfig.type !== 'none' && (() => {
                          const hostZ = computeRoofHostFootprintZone(zone, project.zones);
                          const isRidgeX = (zone.roofConfig.ridgeDirection || 'x') === 'x';
                          const ridgeLen = isRidgeX ? hostZ.width : hostZ.depth;
                          const spanD = isRidgeX ? hostZ.depth : hostZ.width;
                          const eavesOvPx =
                            (zone.roofConfig.overhang ?? 0.35) * PIXELS_PER_METER;
                          const gableOvPx =
                            (zone.roofConfig.gableOverhang ??
                              zone.roofConfig.overhang ??
                              0.35) * PIXELS_PER_METER;
                          const ovX = isRidgeX ? gableOvPx : eavesOvPx;
                          const ovZ = isRidgeX ? eavesOvPx : gableOvPx;
                          const hxPx = (hostZ.x - hostZ.width / 2) * PIXELS_PER_METER;
                          const hzPx = (hostZ.z - hostZ.depth / 2) * PIXELS_PER_METER;
                          const hwPx = hostZ.width * PIXELS_PER_METER;
                          const hdPx = hostZ.depth * PIXELS_PER_METER;
                          const dormers2D = getEffectiveRoofDormers(zone.roofConfig, ridgeLen);
                          const skylights2D = zone.roofConfig.skylights || [];
                          const chimneys2D = zone.roofConfig.chimneys || [];
                          const cxPx = hostZ.x * PIXELS_PER_METER;
                          const czPx = hostZ.z * PIXELS_PER_METER;

                          return (
                            <g className="pointer-events-none opacity-85">
                              {/* Dashed Roof Overhang Contour (Trauf- vs. Giebelüberstand) */}
                              <rect
                                x={hxPx - ovX}
                                y={hzPx - ovZ}
                                width={hwPx + ovX * 2}
                                height={hdPx + ovZ * 2}
                                rx={2}
                                fill="none"
                                stroke="#fbbf24"
                                strokeOpacity={0.55}
                                strokeWidth={1.1}
                                strokeDasharray="4 4"
                              />
                              {isRidgeX ? (
                                <line
                                  x1={hxPx - ovX + 4}
                                  y1={czPx}
                                  x2={hxPx + hwPx + ovX - 4}
                                  y2={czPx}
                                  stroke="#fbbf24"
                                  strokeWidth={1.6}
                                  strokeDasharray="5 3"
                                />
                              ) : (
                                <line
                                  x1={cxPx}
                                  y1={hzPx - ovZ + 4}
                                  x2={cxPx}
                                  y2={hzPx + hdPx + ovZ - 4}
                                  stroke="#fbbf24"
                                  strokeWidth={1.6}
                                  strokeDasharray="5 3"
                                />
                              )}

                              {/* Individual Roof Dormers with Per-Window Mullion Divisions */}
                              {dormers2D.map((dItem, dIdx) => {
                                const dir = dItem.side === 'back' ? -1 : 1;
                                const dwPx = Math.max(14, dItem.width * PIXELS_PER_METER);
                                const ddPx = Math.min(spanD * 0.34, 1.35) * PIXELS_PER_METER;
                                const offsetPx = dItem.offsetAlongRidge * PIXELS_PER_METER;
                                const eavesSetbackM = dItem.eavesSetback ?? 0.35;
                                const frontDistM = Math.max(
                                  spanD * 0.18,
                                  spanD / 2 - eavesSetbackM - (ddPx / PIXELS_PER_METER) * 0.5
                                );
                                const slopeOffPx = dir * frontDistM * PIXELS_PER_METER;

                                const rx = isRidgeX
                                  ? cxPx + offsetPx - dwPx / 2
                                  : cxPx + slopeOffPx - ddPx / 2;
                                const ry = isRidgeX
                                  ? czPx + slopeOffPx - ddPx / 2
                                  : czPx + offsetPx - dwPx / 2;
                                const rw = isRidgeX ? dwPx : ddPx;
                                const rh = isRidgeX ? ddPx : dwPx;
                                const winUnits = getEffectiveDormerWindows(dItem);
                                const totalRatio = winUnits.reduce(
                                  (acc, u) => acc + Math.max(0.25, u.widthRatio ?? 1),
                                  0
                                );

                                let accum = 0;
                                const dividers: number[] = [];
                                for (let wi = 0; wi < winUnits.length - 1; wi++) {
                                  accum += Math.max(0.25, winUnits[wi].widthRatio ?? 1);
                                  dividers.push(accum / totalRatio);
                                }

                                return (
                                  <g key={`d2d_${dItem.id || dIdx}`}>
                                    <rect
                                      x={rx}
                                      y={ry}
                                      width={rw}
                                      height={rh}
                                      rx={2}
                                      fill="rgba(251, 191, 36, 0.24)"
                                      stroke="#fbbf24"
                                      strokeWidth={1.3}
                                    />
                                    <line
                                      x1={rx}
                                      y1={ry + rh / 2}
                                      x2={rx + rw}
                                      y2={ry + rh / 2}
                                      stroke="#fde68a"
                                      strokeWidth={0.9}
                                    />
                                    {dividers.map((frac, divIdx) =>
                                      isRidgeX ? (
                                        <line
                                          key={divIdx}
                                          x1={rx + rw * frac}
                                          y1={ry + 1}
                                          x2={rx + rw * frac}
                                          y2={ry + rh - 1}
                                          stroke="#38bdf8"
                                          strokeWidth={1.2}
                                        />
                                      ) : (
                                        <line
                                          key={divIdx}
                                          x1={rx + 1}
                                          y1={ry + rh * frac}
                                          x2={rx + rw - 1}
                                          y2={ry + rh * frac}
                                          stroke="#38bdf8"
                                          strokeWidth={1.2}
                                        />
                                      )
                                    )}
                                  </g>
                                );
                              })}

                              {/* Individual Roof Skylights (Dachfenster) */}
                              {skylights2D.map((sky, sIdx) => {
                                const dir = sky.side === 'back' ? -1 : 1;
                                const swPx = Math.max(12, sky.width * PIXELS_PER_METER);
                                const slPx = Math.max(12, sky.length * PIXELS_PER_METER * 0.75);
                                const offsetPx = sky.offsetAlongRidge * PIXELS_PER_METER;
                                const slopeOffPx =
                                  dir * (spanD * 0.5 * (sky.slopePosition ?? 0.5)) * PIXELS_PER_METER;

                                const rx = isRidgeX
                                  ? cxPx + offsetPx - swPx / 2
                                  : cxPx + slopeOffPx - slPx / 2;
                                const ry = isRidgeX
                                  ? czPx + slopeOffPx - slPx / 2
                                  : czPx + offsetPx - swPx / 2;
                                const rw = isRidgeX ? swPx : slPx;
                                const rh = isRidgeX ? slPx : swPx;

                                return (
                                  <g key={`sky2d_${sky.id || sIdx}`}>
                                    <rect
                                      x={rx}
                                      y={ry}
                                      width={rw}
                                      height={rh}
                                      rx={2}
                                      fill="rgba(56, 189, 248, 0.28)"
                                      stroke="#38bdf8"
                                      strokeWidth={1.3}
                                    />
                                    <line
                                      x1={rx + 2}
                                      y1={ry + 2}
                                      x2={rx + rw - 2}
                                      y2={ry + rh - 2}
                                      stroke="#bae6fd"
                                      strokeWidth={0.9}
                                    />
                                  </g>
                                );
                              })}

                              {/* Individual Building Chimneys (Schornsteine / Kamine) */}
                              {chimneys2D.map((chim, cIdx) => {
                                const cwPx = Math.max(11, chim.width * PIXELS_PER_METER);
                                const chX = isRidgeX
                                  ? cxPx + chim.offsetX * PIXELS_PER_METER
                                  : cxPx + chim.offsetZ * PIXELS_PER_METER;
                                const chY = isRidgeX
                                  ? czPx + chim.offsetZ * PIXELS_PER_METER
                                  : czPx + chim.offsetX * PIXELS_PER_METER;

                                return (
                                  <g key={`chim2d_${chim.id || cIdx}`}>
                                    <rect
                                      x={chX - cwPx / 2}
                                      y={chY - cwPx / 2}
                                      width={cwPx}
                                      height={cwPx}
                                      rx={2}
                                      fill="rgba(180, 83, 9, 0.72)"
                                      stroke="#fb923c"
                                      strokeWidth={1.5}
                                    />
                                    <circle
                                      cx={chX}
                                      cy={chY}
                                      r={Math.max(2.5, cwPx * 0.24)}
                                      fill="#0f172a"
                                      stroke="#cbd5e1"
                                      strokeWidth={1}
                                    />
                                  </g>
                                );
                              })}
                            </g>
                          );
                        })()}

                      {/* Top Draggable Rotation Handle when Rectangular Zone is Selected & Not Locked */}
                      {isSelected && !isDrawingMode && !zone.locked && (
                        <g
                          transform={`translate(${zone.x * PIXELS_PER_METER}, ${zPx - 26})`}
                          onPointerDown={(e) => {
                            e.stopPropagation();
                            setDragState({
                              type: 'zone_rotate',
                              id: zone.id,
                              centerX: zone.x,
                              centerZ: zone.z,
                            });
                          }}
                          className="cursor-grab"
                        >
                          <line
                            x1={0}
                            y1={0}
                            x2={0}
                            y2={20}
                            stroke="#f59e0b"
                            strokeWidth={1.8}
                            strokeDasharray="2 2"
                          />
                          <circle
                            r={7.5}
                            fill="#f59e0b"
                            stroke="#090d16"
                            strokeWidth={2}
                          />
                        </g>
                      )}
                    </g>
                  )}

                  {/* Room labels intentionally omitted to keep 2D floorplan clean and uncluttered */}

                  {/* CAD Dimension Lines for Selected or All Zones */}
                  {(showDimensions || isSelected) && (
                    <>
                      {isPolygon && zone.points ? (
                        zone.points.map(([x1, z1], idx) => {
                          const [x2, z2] = zone.points![(idx + 1) % zone.points!.length];
                          const segLen = Math.hypot(x2 - x1, z2 - z1);
                          if (segLen < 0.25) return null;
                          const sx1 = x1 * PIXELS_PER_METER;
                          const sz1 = z1 * PIXELS_PER_METER;
                          const sx2 = x2 * PIXELS_PER_METER;
                          const sz2 = z2 * PIXELS_PER_METER;
                          return renderCadDimensionLine(
                            sx1,
                            sz1,
                            sx2,
                            sz2,
                            `${segLen.toFixed(2)} m`,
                            isSelected ? -16 : -10,
                            isSelected ? '#38bdf8' : '#94a3b8',
                            `dim_${zone.id}_${idx}`
                          );
                        })
                      ) : (
                        <>
                          {/* Top Width Dimension Line */}
                          {renderCadDimensionLine(
                            xPx,
                            zPx,
                            xPx + wPx,
                            zPx,
                            `${zone.width.toFixed(2)} m`,
                            isSelected ? -18 : -12,
                            isSelected
                              ? '#38bdf8'
                              : zone.zoneType === 'indoor'
                              ? '#cbd5e1'
                              : '#4ade80',
                            `dim_w_${zone.id}`
                          )}
                          {/* Right Depth Dimension Line */}
                          {renderCadDimensionLine(
                            xPx + wPx,
                            zPx,
                            xPx + wPx,
                            zPx + dPx,
                            `${zone.depth.toFixed(2)} m`,
                            isSelected ? -18 : -12,
                            isSelected
                              ? '#38bdf8'
                              : zone.zoneType === 'indoor'
                              ? '#cbd5e1'
                              : '#4ade80',
                            `dim_d_${zone.id}`
                          )}
                        </>
                      )}
                    </>
                  )}

                  {/* Interactive Handles when Zone is Selected & Not Locked (8 Handles for Rect, Vertex + Midpoint Handles for Polygon) */}
                  {isSelected && !isDrawingMode && !zone.locked && (
                    <>
                      {isPolygon && zone.points ? (
                        <>
                          {/* Midpoint '+' Handles to insert a new corner on any polygon edge */}
                          {zone.points.map(([x1, z1], idx) => {
                            const nextIdx = (idx + 1) % zone.points!.length;
                            const [x2, z2] = zone.points![nextIdx];
                            const mx = ((x1 + x2) / 2) * PIXELS_PER_METER;
                            const mz = ((z1 + z2) / 2) * PIXELS_PER_METER;
                            return (
                              <g
                                key={`mid_${idx}`}
                                transform={`translate(${mx}, ${mz})`}
                                onPointerDown={(e) => {
                                  e.stopPropagation();
                                  const newPt: [number, number] = [
                                    +((x1 + x2) / 2).toFixed(2),
                                    +((z1 + z2) / 2).toFixed(2),
                                  ];
                                  const nextPts = [
                                    ...zone.points!.slice(0, idx + 1),
                                    newPt,
                                    ...zone.points!.slice(idx + 1),
                                  ];
                                  onUpdateZone(zone.id, { points: nextPts });
                                  setDragState({
                                    type: 'zone_vertex',
                                    id: zone.id,
                                    vertexIndex: idx + 1,
                                  });
                                }}
                                className="cursor-pointer"
                              >
                                <circle
                                  r={5}
                                  fill="#090d16"
                                  stroke="#38bdf8"
                                  strokeWidth={1.5}
                                />
                                <line x1={-2.5} y1={0} x2={2.5} y2={0} stroke="#38bdf8" strokeWidth={1.4} />
                                <line x1={0} y1={-2.5} x2={0} y2={2.5} stroke="#38bdf8" strokeWidth={1.4} />
                              </g>
                            );
                          })}

                          {/* Draggable Corner Vertex Handles */}
                          {zone.points.map(([vx, vz], idx) => (
                            <g
                              key={`vert_${idx}`}
                              transform={`translate(${vx * PIXELS_PER_METER}, ${vz * PIXELS_PER_METER})`}
                              onPointerDown={(e) => {
                                e.stopPropagation();
                                setDragState({
                                  type: 'zone_vertex',
                                  id: zone.id,
                                  vertexIndex: idx,
                                });
                              }}
                              onDoubleClick={(e) => {
                                e.stopPropagation();
                                if (zone.points && zone.points.length > 3) {
                                  const nextPts = zone.points.filter((_, i) => i !== idx);
                                  const bounds = computePolygonBounds(nextPts);
                                  onUpdateZone(zone.id, {
                                    points: nextPts,
                                    ...bounds,
                                  });
                                }
                              }}
                              className="cursor-move"
                            >
                              <circle
                                r={6.5}
                                fill="#38bdf8"
                                stroke="#090d16"
                                strokeWidth={2}
                              />
                            </g>
                          ))}
                        </>
                      ) : (
                        /* 8 Resize Handles (4 Corners + 4 Wall Midpoints) for Rectangular Zones */
                        (
                          [
                            { h: 'nw', x: xPx, y: zPx, cursor: 'cursor-nwse-resize' },
                            { h: 'ne', x: xPx + wPx, y: zPx, cursor: 'cursor-nesw-resize' },
                            { h: 'sw', x: xPx, y: zPx + dPx, cursor: 'cursor-nesw-resize' },
                            { h: 'se', x: xPx + wPx, y: zPx + dPx, cursor: 'cursor-nwse-resize' },
                            { h: 'n', x: xPx + wPx / 2, y: zPx, cursor: 'cursor-ns-resize' },
                            { h: 's', x: xPx + wPx / 2, y: zPx + dPx, cursor: 'cursor-ns-resize' },
                            { h: 'w', x: xPx, y: zPx + dPx / 2, cursor: 'cursor-ew-resize' },
                            { h: 'e', x: xPx + wPx, y: zPx + dPx / 2, cursor: 'cursor-ew-resize' },
                          ] as const
                        ).map((item) => (
                          <g
                            key={item.h}
                            transform={`translate(${item.x}, ${item.y})`}
                            onPointerDown={(e) => {
                              e.stopPropagation();
                              setDragState({
                                type: 'zone_resize',
                                id: zone.id,
                                handle: item.h,
                                origMinX: zone.x - zone.width / 2,
                                origMaxX: zone.x + zone.width / 2,
                                origMinZ: zone.z - zone.depth / 2,
                                origMaxZ: zone.z + zone.depth / 2,
                              });
                            }}
                            className={item.cursor}
                          >
                            <rect
                              x={-6}
                              y={-6}
                              width={12}
                              height={12}
                              rx={item.h.length === 2 ? 3 : 6}
                              fill={item.h.length === 2 ? '#38bdf8' : '#fbbf24'}
                              stroke="#090d16"
                              strokeWidth={2}
                            />
                          </g>
                        ))
                      )}
                    </>
                  )}
                </g>
              );
            })}

          {/* 1B. Live Interactive Preview while Drawing a Rectangle Room/Surface */}
          {dragState?.type === 'draw_rect' &&
            (() => {
              const minX = Math.min(dragState.startX, dragState.curX);
              const maxX = Math.max(dragState.startX, dragState.curX);
              const minZ = Math.min(dragState.startZ, dragState.curZ);
              const maxZ = Math.max(dragState.startZ, dragState.curZ);
              const w = +(maxX - minX).toFixed(2);
              const d = +(maxZ - minZ).toFixed(2);
              const area = (w * d).toFixed(2);
              const perim = (2 * (w + d)).toFixed(2);

              const xPx = minX * PIXELS_PER_METER;
              const zPx = minZ * PIXELS_PER_METER;
              const wPx = Math.max(2, w * PIXELS_PER_METER);
              const dPx = Math.max(2, d * PIXELS_PER_METER);
              const isIndoor = dragState.zoneType === 'indoor';
              const accent = isIndoor ? '#38bdf8' : '#34d399';

              return (
                <g className="pointer-events-none">
                  <rect
                    x={xPx}
                    y={zPx}
                    width={wPx}
                    height={dPx}
                    fill={accent}
                    fillOpacity={0.22}
                    stroke={accent}
                    strokeWidth={isIndoor ? 4 : 2.5}
                    strokeDasharray={isIndoor ? undefined : '6 4'}
                  />
                  {/* Live Width & Depth CAD Dimension Lines */}
                  {renderCadDimensionLine(
                    xPx,
                    zPx,
                    xPx + wPx,
                    zPx,
                    `Breite: ${w.toFixed(2)} m`,
                    -20,
                    '#fbbf24'
                  )}
                  {renderCadDimensionLine(
                    xPx + wPx,
                    zPx,
                    xPx + wPx,
                    zPx + dPx,
                    `Tiefe: ${d.toFixed(2)} m`,
                    -20,
                    '#fbbf24'
                  )}

                  {/* Center Live Measurement Readout Box */}
                  <g transform={`translate(${xPx + wPx / 2}, ${zPx + dPx / 2})`}>
                    <rect
                      x={-88}
                      y={-22}
                      width={176}
                      height={44}
                      rx={8}
                      fill="#090d16"
                      fillOpacity={0.95}
                      stroke="#fbbf24"
                      strokeWidth={1.5}
                    />
                    <text
                      x={0}
                      y={-5}
                      textAnchor="middle"
                      fill="#fde68a"
                      fontSize={11}
                      fontWeight="700"
                      fontFamily="JetBrains Mono, monospace"
                    >
                      {w.toFixed(2)} m × {d.toFixed(2)} m
                    </text>
                    <text
                      x={0}
                      y={12}
                      textAnchor="middle"
                      fill="#f8fafc"
                      fontSize={9.5}
                      fontFamily="JetBrains Mono, monospace"
                    >
                      {area} m² · Umfang {perim} m
                    </text>
                  </g>
                </g>
              );
            })()}

          {/* 1C. Live Interactive Preview while Drawing a Freeform Polygon Room/Surface */}
          {isPolyMode &&
            polyDraftPoints.length > 0 &&
            (() => {
              const allPreviewPts: [number, number][] = [...polyDraftPoints, snappedPolyCursor];
              const polyStr = allPreviewPts
                .map(([px, pz]) => `${px * PIXELS_PER_METER},${pz * PIXELS_PER_METER}`)
                .join(' ');
              const [lastX, lastZ] = polyDraftPoints[polyDraftPoints.length - 1];
              const [curX, curZ] = snappedPolyCursor;
              const liveSegLen = Math.hypot(curX - lastX, curZ - lastZ);
              const liveAngleDeg = Math.round((Math.atan2(-(curZ - lastZ), curX - lastX) * 180) / Math.PI);
              const liveArea =
                allPreviewPts.length >= 3 ? computePolygonAreaM2(allPreviewPts) : 0;
              const isIndoor = drawTool === 'draw_poly_room';
              const accent = isIndoor ? '#38bdf8' : '#34d399';

              return (
                <g className="pointer-events-none">
                  {/* Filled Preview Polygon */}
                  {allPreviewPts.length >= 3 && (
                    <polygon
                      points={polyStr}
                      fill={accent}
                      fillOpacity={0.18}
                      stroke={accent}
                      strokeWidth={1.5}
                      strokeDasharray="4 4"
                    />
                  )}

                  {/* Placed Segments + Exact Length Callouts */}
                  {polyDraftPoints.map(([x1, z1], idx) => {
                    if (idx === 0) return null;
                    const [prevX, prevZ] = polyDraftPoints[idx - 1];
                    const segLen = Math.hypot(x1 - prevX, z1 - prevZ);
                    return (
                      <g key={`pseg_${idx}`}>
                        <line
                          x1={prevX * PIXELS_PER_METER}
                          y1={prevZ * PIXELS_PER_METER}
                          x2={x1 * PIXELS_PER_METER}
                          y2={z1 * PIXELS_PER_METER}
                          stroke={accent}
                          strokeWidth={3}
                        />
                        {renderCadDimensionLine(
                          prevX * PIXELS_PER_METER,
                          prevZ * PIXELS_PER_METER,
                          x1 * PIXELS_PER_METER,
                          z1 * PIXELS_PER_METER,
                          `${segLen.toFixed(2)} m`,
                          -14,
                          accent
                        )}
                      </g>
                    );
                  })}

                  {/* Rubber-band Line from Last Point to Current Cursor with Live Length & Angle */}
                  <line
                    x1={lastX * PIXELS_PER_METER}
                    y1={lastZ * PIXELS_PER_METER}
                    x2={curX * PIXELS_PER_METER}
                    y2={curZ * PIXELS_PER_METER}
                    stroke="#fbbf24"
                    strokeWidth={2.5}
                    strokeDasharray="6 4"
                  />
                  {liveSegLen > 0.05 &&
                    renderCadDimensionLine(
                      lastX * PIXELS_PER_METER,
                      lastZ * PIXELS_PER_METER,
                      curX * PIXELS_PER_METER,
                      curZ * PIXELS_PER_METER,
                      `${liveSegLen.toFixed(2)} m (${liveAngleDeg}°)`,
                      -18,
                      '#fbbf24'
                    )}

                  {/* Closing Line Preview back to Start Point */}
                  {polyDraftPoints.length >= 2 && (
                    <line
                      x1={curX * PIXELS_PER_METER}
                      y1={curZ * PIXELS_PER_METER}
                      x2={polyDraftPoints[0][0] * PIXELS_PER_METER}
                      y2={polyDraftPoints[0][1] * PIXELS_PER_METER}
                      stroke="#94a3b8"
                      strokeWidth={1.2}
                      strokeDasharray="3 3"
                    />
                  )}

                  {/* Placed Vertices (First point highlighted in green to close polygon) */}
                  {polyDraftPoints.map(([vx, vz], idx) => (
                    <g
                      key={`pvert_${idx}`}
                      transform={`translate(${vx * PIXELS_PER_METER}, ${vz * PIXELS_PER_METER})`}
                    >
                      <circle
                        r={idx === 0 ? 7 : 5}
                        fill={idx === 0 ? '#10b981' : '#f8fafc'}
                        stroke="#090d16"
                        strokeWidth={2}
                      />
                      {idx === 0 && polyDraftPoints.length >= 3 && (
                        <text
                          x={0}
                          y={-12}
                          textAnchor="middle"
                          fill="#34d399"
                          fontSize={9.5}
                          fontWeight="700"
                          fontFamily="JetBrains Mono, monospace"
                        >
                          Hier klicken zum Schließen ({liveArea.toFixed(1)} m²)
                        </text>
                      )}
                    </g>
                  ))}
                </g>
              );
            })()}

          {/* 1D. Render Free-Standing Custom Partition Walls (project.customWalls) & Live Draw Wall Preview */}
          {activeCustomWalls.map((cw) => {
            const isSel = cw.id === selectedWallId;
            const x1Px = cw.x1 * PIXELS_PER_METER;
            const z1Px = cw.z1 * PIXELS_PER_METER;
            const x2Px = cw.x2 * PIXELS_PER_METER;
            const z2Px = cw.z2 * PIXELS_PER_METER;
            const lenM = Math.hypot(cw.x2 - cw.x1, cw.z2 - cw.z1);
            const thickPx = Math.max(5, (cw.thickness ?? 0.16) * PIXELS_PER_METER);
            const midX = (x1Px + x2Px) / 2;
            const midZ = (z1Px + z2Px) / 2;

            return (
              <g
                key={cw.id}
                onPointerDown={(e) => {
                  if (pendingCatalogItem || isDrawingMode) return;
                  e.stopPropagation();
                  onSelectWall?.(cw.id);
                  if (cw.locked) return;
                  const { wx, wz } = clientToWorld(e.clientX, e.clientY);
                  setDragState({
                    type: 'custom_wall_move',
                    id: cw.id,
                    startWorldX: wx,
                    startWorldZ: wz,
                    origX1: cw.x1,
                    origZ1: cw.z1,
                    origX2: cw.x2,
                    origZ2: cw.z2,
                  });
                }}
                className={cw.locked ? 'cursor-pointer' : 'cursor-move'}
              >
                {/* Invisible thick hit target */}
                <line
                  x1={x1Px}
                  y1={z1Px}
                  x2={x2Px}
                  y2={z2Px}
                  stroke="transparent"
                  strokeWidth={Math.max(18, thickPx + 12)}
                  strokeLinecap="round"
                />
                {isSel && (
                  <line
                    x1={x1Px}
                    y1={z1Px}
                    x2={x2Px}
                    y2={z2Px}
                    stroke="#e879f9"
                    strokeWidth={thickPx + 6}
                    strokeOpacity={0.35}
                    strokeLinecap="round"
                  />
                )}
                <line
                  x1={x1Px}
                  y1={z1Px}
                  x2={x2Px}
                  y2={z2Px}
                  stroke={
                    isSel
                      ? '#e879f9'
                      : cw.mode === 'half_height'
                      ? '#fbbf24'
                      : cw.mode === 'archway'
                      ? '#c084fc'
                      : '#f8fafc'
                  }
                  strokeWidth={thickPx}
                  strokeDasharray={cw.mode === 'half_height' ? '8 3' : undefined}
                  strokeLinecap="square"
                />
                {(showDimensions || isSel) &&
                  renderCadDimensionLine(
                    x1Px,
                    z1Px,
                    x2Px,
                    z2Px,
                    `${cw.locked ? '🔒 ' : ''}${cw.name}: ${lenM.toFixed(2)} m`,
                    -15,
                    isSel ? '#e879f9' : '#f472b6',
                    `dim_cw_${cw.id}`
                  )}
                {isSel && !isDrawingMode && !cw.locked && (
                  <>
                    <g
                      transform={`translate(${x1Px}, ${z1Px})`}
                      onPointerDown={(e) => {
                        e.stopPropagation();
                        setDragState({
                          type: 'custom_wall_endpoint',
                          id: cw.id,
                          end: 'start',
                        });
                      }}
                      className="cursor-move"
                    >
                      <circle r={6.5} fill="#e879f9" stroke="#090d16" strokeWidth={2} />
                    </g>
                    <g
                      transform={`translate(${x2Px}, ${z2Px})`}
                      onPointerDown={(e) => {
                        e.stopPropagation();
                        setDragState({
                          type: 'custom_wall_endpoint',
                          id: cw.id,
                          end: 'end',
                        });
                      }}
                      className="cursor-move"
                    >
                      <circle r={6.5} fill="#e879f9" stroke="#090d16" strokeWidth={2} />
                    </g>
                  </>
                )}
              </g>
            );
          })}

          {dragState?.type === 'draw_wall_drag' && (() => {
            const x1Px = dragState.startX * PIXELS_PER_METER;
            const z1Px = dragState.startZ * PIXELS_PER_METER;
            const x2Px = dragState.curX * PIXELS_PER_METER;
            const z2Px = dragState.curZ * PIXELS_PER_METER;
            const lenM = Math.hypot(
              dragState.curX - dragState.startX,
              dragState.curZ - dragState.startZ
            );
            return (
              <g className="pointer-events-none">
                <line
                  x1={x1Px}
                  y1={z1Px}
                  x2={x2Px}
                  y2={z2Px}
                  stroke="#e879f9"
                  strokeWidth={Math.max(6, draftWallThickness * PIXELS_PER_METER)}
                  strokeLinecap="square"
                />
                {lenM > 0.1 &&
                  renderCadDimensionLine(
                    x1Px,
                    z1Px,
                    x2Px,
                    z2Px,
                    `Trennwand: ${lenM.toFixed(2)} m`,
                    -18,
                    '#e879f9'
                  )}
              </g>
            );
          })()}

          {/* 2. Interactive Architectural Windows, Patio Sliders, Doors, Gates & Shutters */}
          {activeOpenings.map((op) => {
            const isSelected = op.id === selectedOpeningId;
            const isHovered = op.id === hoveredOpeningId;
            const ox = op.x * PIXELS_PER_METER;
            const oz = op.z * PIXELS_PER_METER;
            const ow = op.width * PIXELS_PER_METER;
            const rotDeg = (-op.rotationY * 180) / Math.PI;
            const isDoor = op.type === 'door';
            const isWindow = op.type === 'window' || op.type === 'floor_window';
            const isGlassBlockWin = op.type === 'glass_block_window';
            const isPatio = op.type === 'double_patio_door';
            const resolvedState = resolveOpeningSensorState(op, entities);
            const isDualSensor = op.sensorLogicMode === 'dual_tilt_open';

            const hingeSide = op.hingeSide || 'left';
            const openDirection = op.openDirection || 'inward';
            const hingeX = hingeSide === 'right' ? ow / 2 : -ow / 2;
            const oppX = hingeSide === 'right' ? -ow / 2 : ow / 2;
            const dirY = openDirection === 'outward' ? 1 : -1;
            const isTwoSash =
              op.sashCount === 2 ||
              ((!op.sashCount || op.sashCount === 'auto') &&
                (isPatio || op.width >= 1.35));

            return (
              <g
                key={op.id}
                transform={`translate(${ox}, ${oz})`}
                onPointerEnter={() => setHoveredOpeningId(op.id)}
                onPointerLeave={() =>
                  setHoveredOpeningId((prev) => (prev === op.id ? null : prev))
                }
                onPointerDown={(e) => {
                  if (pendingCatalogItem || isDrawingMode) return;
                  e.stopPropagation();
                  onSelectOpening(op.id);
                  if (op.locked) return;
                  const { wx, wz } = clientToWorld(e.clientX, e.clientY);
                  setDragState({
                    type: 'opening',
                    id: op.id,
                    startWorldX: wx,
                    startWorldZ: wz,
                    origX: op.x,
                    origZ: op.z,
                  });
                }}
                className={op.locked ? 'cursor-pointer' : 'cursor-move'}
              >
                <g transform={`rotate(${rotDeg})`}>
                  {/* Generous Invisible Hit Target so every window, door & gate is effortless to grab */}
                  <rect
                    x={-ow / 2 - 8}
                    y={-14}
                    width={ow + 16}
                    height={28}
                    fill="transparent"
                  />

                  {/* Selection Halo */}
                  {(isSelected || isHovered) && (
                    <rect
                      x={-ow / 2 - 4}
                      y={-10}
                      width={ow + 8}
                      height={20}
                      rx={4}
                      fill="rgba(245, 158, 11, 0.16)"
                      stroke="#f59e0b"
                      strokeWidth={1.5}
                      strokeDasharray="3 2"
                    />
                  )}

                  {/* Wall Cutout Background */}
                  <rect
                    x={-ow / 2}
                    y={-6}
                    width={ow}
                    height={12}
                    fill="#0b111e"
                    stroke={
                      isSelected
                        ? '#f59e0b'
                        : resolvedState === 'tilted'
                        ? '#f59e0b'
                        : resolvedState === 'open'
                        ? '#38bdf8'
                        : isDoor
                        ? '#d97706'
                        : '#38bdf8'
                    }
                    strokeWidth={isSelected ? 2.8 : 2.0}
                    rx={2}
                  />

                  {/* Architectural Glass Block Grid for glass_block_window (Glasbausteine) */}
                  {isGlassBlockWin && (
                    <>
                      <rect
                        x={-ow / 2 + 2}
                        y={-4.5}
                        width={ow - 4}
                        height={9}
                        fill="rgba(103, 232, 249, 0.28)"
                        stroke="#22d3ee"
                        strokeWidth={1.3}
                      />
                      {Array.from({
                        length: Math.max(2, Math.min(12, Math.round(op.width / 0.22))),
                      }).map((_, bIdx, arr) => {
                        const gx = -ow / 2 + ((bIdx + 1) / (arr.length + 1)) * ow;
                        return (
                          <line
                            key={bIdx}
                            x1={gx}
                            y1={-4.5}
                            x2={gx}
                            y2={4.5}
                            stroke="#e2e8f0"
                            strokeWidth={1.3}
                          />
                        );
                      })}
                    </>
                  )}

                  {/* Architectural Double Glass Line + Hinge/Swing Indicator for Windows & Patio Doors */}
                  {(isWindow || isPatio) && (
                    <>
                      <line
                        x1={-ow / 2 + 3}
                        y1={-2}
                        x2={ow / 2 - 3}
                        y2={-2}
                        stroke={resolvedState === 'tilted' ? '#fde68a' : '#7dd3fc'}
                        strokeWidth={1.6}
                      />
                      <line
                        x1={-ow / 2 + 3}
                        y1={2}
                        x2={ow / 2 - 3}
                        y2={2}
                        stroke={resolvedState === 'tilted' ? '#f59e0b' : '#38bdf8'}
                        strokeWidth={1.6}
                      />
                      {isTwoSash && (
                        <line
                          x1={0}
                          y1={-5}
                          x2={0}
                          y2={5}
                          stroke="#f8fafc"
                          strokeWidth={1.8}
                        />
                      )}

                      {isWindow && (
                        <>
                          <circle
                            cx={hingeX + (hingeSide === 'right' ? -3 : 3)}
                            cy={0}
                            r={2.8}
                            fill="#38bdf8"
                          />
                          <line
                            x1={hingeX}
                            y1={0}
                            x2={hingeX}
                            y2={dirY * ow * 0.52}
                            stroke="#38bdf8"
                            strokeWidth={1.6}
                          />
                          <line
                            x1={hingeX}
                            y1={dirY * ow * 0.52}
                            x2={oppX}
                            y2={0}
                            stroke="#38bdf8"
                            strokeWidth={1.1}
                            strokeDasharray="3 2"
                            opacity={0.75}
                          />
                        </>
                      )}

                      {isPatio && (
                        <line
                          x1={hingeSide === 'right' ? ow * 0.22 : -ow * 0.22}
                          y1={dirY * 9}
                          x2={hingeSide === 'right' ? -ow * 0.22 : ow * 0.22}
                          y2={dirY * 9}
                          stroke="#fbbf24"
                          strokeWidth={1.8}
                        />
                      )}

                      {resolvedState === 'tilted' && (
                        <polygon
                          points={`${-ow / 3},${-dirY * 6} ${ow / 3},${-dirY * 6} 0,${
                            dirY * 14
                          }`}
                          fill="rgba(245, 158, 11, 0.25)"
                          stroke="#f59e0b"
                          strokeWidth={1.4}
                        />
                      )}
                    </>
                  )}

                  {isDoor && (
                    <>
                      <path
                        d={`M ${hingeX} 0 L ${hingeX} ${dirY * ow * 0.85} Q ${oppX} ${
                          dirY * ow * 0.85
                        } ${oppX} 0`}
                        fill="rgba(245, 158, 11, 0.16)"
                        stroke="#f59e0b"
                        strokeWidth={1.4}
                        strokeDasharray="3 2"
                      />
                      <line
                        x1={hingeX}
                        y1={0}
                        x2={hingeX}
                        y2={dirY * ow * 0.85}
                        stroke="#fbbf24"
                        strokeWidth={2.6}
                      />
                      <circle cx={hingeX} cy={0} r={3} fill="#fbbf24" />
                    </>
                  )}

                  {op.hasExteriorSteps && (
                    <g opacity={0.92}>
                      {(() => {
                        const stepsCount = Math.max(1, Math.min(8, op.exteriorStepsCount ?? 2));
                        const stepW =
                          (op.exteriorStepsWidth ?? Math.max(1.3, op.width + 0.35)) *
                          PIXELS_PER_METER;
                        const totalD = (op.exteriorStepsDepth ?? 0.95) * PIXELS_PER_METER;
                        const outSign = -dirY; // opposite to interior swing
                        const extShape = op.exteriorStepsShape || 'straight';
                        const yBase = outSign > 0 ? 4 : -4 - totalD;

                        if (extShape === 'curved_fan') {
                          return (
                            <>
                              {Array.from({ length: stepsCount + 1 }).map((_, sIdx) => {
                                const frac = (stepsCount + 1 - sIdx) / (stepsCount + 1);
                                const rx = (stepW / 2) * (0.55 + 0.45 * frac);
                                const ry = totalD * frac;
                                const arcY = outSign > 0 ? 4 : -4;
                                const sweep = outSign > 0 ? 1 : 0;
                                return (
                                  <path
                                    key={sIdx}
                                    d={`M ${-rx} ${arcY} A ${rx} ${ry} 0 0 ${sweep} ${rx} ${arcY} Z`}
                                    fill={
                                      sIdx === 0
                                        ? 'rgba(148, 163, 184, 0.28)'
                                        : 'rgba(226, 232, 240, 0.12)'
                                    }
                                    stroke="#cbd5e1"
                                    strokeWidth={1.1}
                                  />
                                );
                              })}
                            </>
                          );
                        }

                        if (extShape === 'pyramid_3side' || extShape === 'corner_L') {
                          return (
                            <>
                              {Array.from({ length: stepsCount + 1 }).map((_, sIdx) => {
                                const frac = (stepsCount + 1 - sIdx) / (stepsCount + 1);
                                const wTier = stepW * (0.58 + 0.42 * frac);
                                const dTier = totalD * frac;
                                const xTier =
                                  extShape === 'corner_L'
                                    ? -stepW / 2
                                    : -wTier / 2;
                                const yTier = outSign > 0 ? 4 : -4 - dTier;
                                return (
                                  <rect
                                    key={sIdx}
                                    x={xTier}
                                    y={yTier}
                                    width={wTier}
                                    height={dTier}
                                    rx={2}
                                    fill={
                                      sIdx === 0
                                        ? 'rgba(148, 163, 184, 0.26)'
                                        : 'rgba(226, 232, 240, 0.1)'
                                    }
                                    stroke="#cbd5e1"
                                    strokeWidth={1.1}
                                  />
                                );
                              })}
                            </>
                          );
                        }

                        if (
                          extShape === 'side_left' ||
                          extShape === 'side_right' ||
                          extShape === 'double_side_T'
                        ) {
                          return (
                            <>
                              <rect
                                x={-stepW / 2}
                                y={yBase}
                                width={stepW}
                                height={totalD}
                                rx={2}
                                fill="rgba(148, 163, 184, 0.32)"
                                stroke="#94a3b8"
                                strokeWidth={1.2}
                              />
                              {Array.from({ length: stepsCount }).map((_, sIdx) => {
                                const xOff =
                                  ((sIdx + 1) / (stepsCount + 1)) * (stepW * 0.42);
                                return (
                                  <React.Fragment key={sIdx}>
                                    {(extShape === 'side_left' ||
                                      extShape === 'double_side_T') && (
                                      <line
                                        x1={-stepW * 0.12 - xOff}
                                        y1={yBase + 2}
                                        x2={-stepW * 0.12 - xOff}
                                        y2={yBase + totalD - 2}
                                        stroke="#e2e8f0"
                                        strokeWidth={1}
                                        strokeDasharray="2 1"
                                      />
                                    )}
                                    {(extShape === 'side_right' ||
                                      extShape === 'double_side_T') && (
                                      <line
                                        x1={stepW * 0.12 + xOff}
                                        y1={yBase + 2}
                                        x2={stepW * 0.12 + xOff}
                                        y2={yBase + totalD - 2}
                                        stroke="#e2e8f0"
                                        strokeWidth={1}
                                        strokeDasharray="2 1"
                                      />
                                    )}
                                  </React.Fragment>
                                );
                              })}
                            </>
                          );
                        }

                        return (
                          <>
                            <rect
                              x={-stepW / 2}
                              y={yBase}
                              width={stepW}
                              height={totalD}
                              rx={2}
                              fill="rgba(148, 163, 184, 0.32)"
                              stroke={
                                extShape === 'kellertreppe_wall' ? '#f8fafc' : '#94a3b8'
                              }
                              strokeWidth={extShape === 'kellertreppe_wall' ? 2.2 : 1.2}
                            />
                            {Array.from({ length: stepsCount }).map((_, sIdx) => {
                              const lineY =
                                outSign > 0
                                  ? 4 + ((sIdx + 1) / (stepsCount + 1)) * totalD
                                  : -4 - ((sIdx + 1) / (stepsCount + 1)) * totalD;
                              return (
                                <line
                                  key={sIdx}
                                  x1={-stepW / 2 + 2}
                                  y1={lineY}
                                  x2={stepW / 2 - 2}
                                  y2={lineY}
                                  stroke="#e2e8f0"
                                  strokeWidth={1}
                                  strokeDasharray="2 1"
                                />
                              );
                            })}
                          </>
                        );
                      })()}
                    </g>
                  )}

                  {op.shutterEntityId && (
                    <rect
                      x={-ow / 2 + 4}
                      y={6.5}
                      width={ow - 8}
                      height={3}
                      fill="#f59e0b"
                      rx={1}
                    />
                  )}

                  {/* Interactive Left & Right Width Resize Handles when Selected in 2D */}
                  {isSelected && !isDrawingMode && !op.locked && (
                    <>
                      {(['left', 'right'] as const).map((side) => (
                        <g
                          key={side}
                          transform={`translate(${side === 'left' ? -ow / 2 : ow / 2}, 0)`}
                          onPointerDown={(e) => {
                            e.stopPropagation();
                            const { wx, wz } = clientToWorld(e.clientX, e.clientY);
                            setDragState({
                              type: 'opening_resize',
                              id: op.id,
                              side,
                              origX: op.x,
                              origZ: op.z,
                              origWidth: op.width,
                              rotationY: op.rotationY,
                              startWorldX: wx,
                              startWorldZ: wz,
                            });
                          }}
                          className="cursor-ew-resize"
                        >
                          <circle
                            r={5.5}
                            fill="#f59e0b"
                            stroke="#090d16"
                            strokeWidth={1.8}
                          />
                        </g>
                      ))}
                    </>
                  )}
                </g>

                {(isSelected ||
                  isHovered ||
                  showDimensions ||
                  resolvedState !== 'closed' ||
                  zoom >= 1.25) && (
                  <text
                    x={0}
                    y={16}
                    textAnchor="middle"
                    fill={
                      isSelected
                        ? '#fde68a'
                        : resolvedState === 'tilted'
                        ? '#fcd34d'
                        : resolvedState === 'open'
                        ? '#38bdf8'
                        : '#7dd3fc'
                    }
                    fontSize={Math.max(6.5, 7.2 * zoom)}
                    fontWeight={isSelected || isDualSensor ? '600' : '500'}
                    className="pointer-events-none"
                  >
                    {op.type === 'garage_door'
                      ? 'Tor'
                      : isDoor
                      ? `Tür (${hingeSide === 'right' ? 'R' : 'L'})`
                      : isPatio
                      ? 'Schiebe'
                      : `Fenster (${hingeSide === 'right' ? 'R' : 'L'})`}{' '}
                    {op.width.toFixed(2)}×{op.height.toFixed(2)}m
                  </text>
                )}
              </g>
            );
          })}

          {/* 3. Render All Placed Smart Home, Hedges, Fences, Walkways, Outdoor & Furniture Assets on Active Floor */}
          {activeAssets.map((asset) => {
            const isSelected = asset.id === selectedAssetId;
            const isHovered = asset.id === hoveredAssetId;
            const ax = asset.position[0] * PIXELS_PER_METER;
            const az = asset.position[2] * PIXELS_PER_METER;
            const rotDeg = (-asset.rotationY * 180) / Math.PI;
            const ent = asset.entityId ? entities[asset.entityId] : undefined;
            const catMeta = ASSET_CATALOG.find((c) => c.id === asset.catalogId);
            const scale = asset.scale || 1;
            const isLinearAsset = isFenceOrHedgeAsset(asset.catalogId);
            const isWalkway = isWalkwayAsset(asset.catalogId);
            const isHedge =
              asset.catalogId === 'cypress_hedge' || asset.catalogId.startsWith('hedge_');
            const isIndoorStair = isStairAsset(asset.catalogId);
            const isOutdoorStair = isExteriorStairAsset(asset.catalogId);

            const isGreenhouse =
              asset.catalogId === 'garage_lean_to_greenhouse' ||
              asset.catalogId === 'glass_greenhouse';

            const effFootprint = getAssetEffectiveFootprint(asset, catMeta);
            const actualLengthM = effFootprint.widthM;
            const actualDepthM = effFootprint.depthM;

            const isRadiator = isRadiatorAsset(asset.catalogId);
            const isAcousticPanel = isAcousticPanelAsset(asset.catalogId);
            const isSofa = isSofaAsset(asset.catalogId);
            const isWallModule = isWallModuleAsset(asset.catalogId);

            const footW = Math.max(
              isRadiator || isAcousticPanel ? 16 : 20,
              actualLengthM * PIXELS_PER_METER
            );
            const footD = Math.max(
              isLinearAsset || isRadiator || isAcousticPanel ? 7 : 18,
              actualDepthM * PIXELS_PER_METER
            );

            const isSmokeOrWater =
              ent?.attributes.device_class === 'smoke' ||
              ent?.attributes.device_class === 'moisture';
            const isPlug =
              asset.catalogId === 'smart_plug' || asset.catalogId === 'power_strip';
            const isLight = asset.category === 'lighting';

            const badgeColor = isSmokeOrWater
              ? '#ef4444'
              : isPlug
              ? '#10b981'
              : isLight
              ? '#f59e0b'
              : isHedge
              ? '#22c55e'
              : isWalkway
              ? '#d97706'
              : isLinearAsset
              ? '#94a3b8'
              : asset.category === 'outdoor_energy'
              ? '#22c55e'
              : '#38bdf8';

            // Compute world Start & End coordinates for linear hedges, fences & walkways
            const halfLenM = actualLengthM / 2;
            const dirCos = Math.cos(-asset.rotationY);
            const dirSin = Math.sin(-asset.rotationY);
            const startWorldX = asset.position[0] - halfLenM * dirCos;
            const startWorldZ = asset.position[2] - halfLenM * dirSin;
            const endWorldX = asset.position[0] + halfLenM * dirCos;
            const endWorldZ = asset.position[2] + halfLenM * dirSin;

            return (
              <g
                key={asset.id}
                transform={`translate(${ax}, ${az})`}
                onPointerEnter={() => setHoveredAssetId(asset.id)}
                onPointerLeave={() =>
                  setHoveredAssetId((prev) => (prev === asset.id ? null : prev))
                }
                onPointerDown={(e) => {
                  if (pendingCatalogItem || isDrawingMode) return;
                  e.stopPropagation();
                  onSelectAsset(asset.id, asset.entityId);
                  if (asset.locked) return;
                  const { wx, wz } = clientToWorld(e.clientX, e.clientY);
                  setDragState({
                    type: 'asset',
                    id: asset.id,
                    startWorldX: wx,
                    startWorldZ: wz,
                    origX: asset.position[0],
                    origZ: asset.position[2],
                  });
                }}
                className={asset.locked ? 'cursor-pointer' : 'cursor-move'}
              >
                <g transform={`rotate(${rotDeg})`}>
                  {isSelected && (
                    <rect
                      x={-footW / 2 - 4}
                      y={-footD / 2 - 4}
                      width={footW + 8}
                      height={footD + 8}
                      rx={asset.mountType === 'ceiling' ? (footW + 8) / 2 : 6}
                      fill="rgba(245, 158, 11, 0.22)"
                      stroke="#f59e0b"
                      strokeWidth={2}
                      strokeDasharray="4 2"
                    />
                  )}
                  <rect
                    x={-footW / 2}
                    y={-footD / 2}
                    width={footW}
                    height={footD}
                    rx={
                      asset.mountType === 'ceiling'
                        ? Math.min(footW, footD) / 2
                        : isHedge
                        ? Math.min(10, footD / 2)
                        : 4
                    }
                    fill={
                      isHedge
                        ? '#14532d'
                        : isWalkway
                        ? asset.catalogId === 'walkway_wood_deck'
                          ? '#78350f'
                          : '#334155'
                        : '#0f172a'
                    }
                    fillOpacity={isLinearAsset ? 0.9 : 0.82}
                    stroke={isSelected || isHovered ? '#f59e0b' : badgeColor}
                    strokeWidth={isSelected || isHovered ? 2.5 : 1.8}
                  />

                  {/* Architectural 7-Bay Greenhouse Blueprint in 2D */}
                  {isGreenhouse && (
                    <g className="pointer-events-none">
                      <rect
                        x={-footW / 2 + 2}
                        y={-footD / 2 + 2}
                        width={footW - 4}
                        height={footD - 4}
                        rx={2}
                        fill="rgba(186, 230, 253, 0.16)"
                        stroke="#9a3412"
                        strokeWidth={2}
                      />
                      {/* Ridge line */}
                      <line
                        x1={-footW / 2 + 2}
                        y1={0}
                        x2={footW / 2 - 2}
                        y2={0}
                        stroke="#38bdf8"
                        strokeWidth={1.4}
                        strokeDasharray="4 2"
                      />
                      {/* 7 vertical glazing bays */}
                      {Array.from({ length: 6 }).map((_, bIdx) => {
                        const bx = -footW / 2 + ((bIdx + 1) / 7) * footW;
                        return (
                          <line
                            key={bIdx}
                            x1={bx}
                            y1={-footD / 2 + 2}
                            x2={bx}
                            y2={footD / 2 - 2}
                            stroke="rgba(148, 163, 184, 0.55)"
                            strokeWidth={1}
                          />
                        );
                      })}
                    </g>
                  )}

                  {/* Interactive 2D Freeform Sun Shade Sail (Sonnensegel) with Draggable Corner Masts */}
                  {asset.catalogId === 'sun_shade_sail' && (() => {
                    const sailPts = getEffectiveSunSailCorners(asset);
                    const polyPointsAttr = sailPts
                      .map(
                        ([lx, lz]) =>
                          `${lx * scale * PIXELS_PER_METER},${lz * scale * PIXELS_PER_METER}`
                      )
                      .join(' ');
                    return (
                      <g>
                        <polygon
                          points={polyPointsAttr}
                          fill={asset.sailColor || '#f5f0e6'}
                          fillOpacity={0.55}
                          stroke="#fbbf24"
                          strokeWidth={isSelected ? 2.5 : 1.8}
                        />
                        {/* Diagonal tension seam lines */}
                        {sailPts.length >= 3 && (
                          <line
                            x1={sailPts[0][0] * scale * PIXELS_PER_METER}
                            y1={sailPts[0][1] * scale * PIXELS_PER_METER}
                            x2={sailPts[2][0] * scale * PIXELS_PER_METER}
                            y2={sailPts[2][1] * scale * PIXELS_PER_METER}
                            stroke="rgba(15, 23, 42, 0.35)"
                            strokeWidth={1.1}
                            strokeDasharray="3 2"
                          />
                        )}
                        {sailPts.length >= 4 && (
                          <line
                            x1={sailPts[1][0] * scale * PIXELS_PER_METER}
                            y1={sailPts[1][1] * scale * PIXELS_PER_METER}
                            x2={sailPts[3][0] * scale * PIXELS_PER_METER}
                            y2={sailPts[3][1] * scale * PIXELS_PER_METER}
                            stroke="rgba(15, 23, 42, 0.35)"
                            strokeWidth={1.1}
                            strokeDasharray="3 2"
                          />
                        )}
                        {/* Draggable Corner Mast Handles */}
                        {sailPts.map(([lx, lz], cIdx) => {
                          const cxPx = lx * scale * PIXELS_PER_METER;
                          const czPx = lz * scale * PIXELS_PER_METER;
                          return (
                            <g
                              key={`sail_c_${cIdx}`}
                              transform={`translate(${cxPx}, ${czPx})`}
                              onPointerDown={(e) => {
                                if (!isSelected || isDrawingMode || asset.locked) return;
                                e.stopPropagation();
                                setDragState({
                                  type: 'sail_corner',
                                  id: asset.id,
                                  cornerIndex: cIdx,
                                });
                              }}
                              className={
                                isSelected && !isDrawingMode && !asset.locked
                                  ? 'cursor-move'
                                  : 'pointer-events-none'
                              }
                            >
                              <circle
                                r={isSelected ? 6.5 : 4}
                                fill={isSelected ? '#f59e0b' : '#cbd5e1'}
                                stroke="#090d16"
                                strokeWidth={1.8}
                              />
                            </g>
                          );
                        })}
                      </g>
                    );
                  })()}

                  {/* 2D Electrical Sub-Distribution Board / Meter Cabinet Symbol (UV / HV) */}
                  {(asset.catalogId === 'sub_distribution_board_1row' ||
                    asset.catalogId === 'sub_distribution_board_3row' ||
                    asset.catalogId === 'electrical_meter_cabinet') && (
                    <g className="pointer-events-none">
                      <rect
                        x={-footW / 2 + 2}
                        y={-footD / 2 + 2}
                        width={footW - 4}
                        height={footD - 4}
                        rx={2}
                        fill="#0f172a"
                        stroke="#10b981"
                        strokeWidth={1.6}
                      />
                      <text
                        x={0}
                        y={3}
                        textAnchor="middle"
                        fill="#34d399"
                        fontSize={Math.max(7, 7.5 * zoom)}
                        fontWeight="800"
                      >
                        {asset.catalogId === 'electrical_meter_cabinet' ? '⚡HV' : '⚡UV'}
                      </text>
                    </g>
                  )}

                  {/* 2D Architectural Blueprint for Sofas (Einzelsofa, L-Form links/rechts, U-Wohnlandschaft + Hocker) */}
                  {isSofa && (() => {
                    const sCfg = asset.sofaConfig || {};
                    const shape = sCfg.shape || 'l_right';
                    const fabricHex = sCfg.fabricColor || asset.customColor || '#4b5563';
                    const hasOttoman = Boolean(sCfg.hasOttoman);
                    const seatD =
                      shape === 'single'
                        ? footD * 0.92
                        : Math.min(footD * 0.44, 1.0 * PIXELS_PER_METER);
                    const backY = -footD / 2 + 1.5;
                    const wingW = Math.min(footW * 0.34, 1.15 * PIXELS_PER_METER);
                    return (
                      <g className="pointer-events-none">
                        {/* Main back sofa bench */}
                        <rect
                          x={-footW / 2 + 1.5}
                          y={backY}
                          width={footW - 3}
                          height={seatD}
                          rx={3}
                          fill={fabricHex}
                          stroke="#f8fafc"
                          strokeOpacity={0.55}
                          strokeWidth={1.2}
                        />
                        {/* Backrest cushion line */}
                        <rect
                          x={-footW / 2 + 2.5}
                          y={backY + 1}
                          width={footW - 5}
                          height={Math.max(3, seatD * 0.22)}
                          rx={1.5}
                          fill="rgba(15, 23, 42, 0.35)"
                        />
                        {/* Left L/U Chaise Extension */}
                        {(shape === 'l_left' || shape === 'u_shape') && (
                          <rect
                            x={-footW / 2 + 1.5}
                            y={backY + seatD - 2}
                            width={wingW}
                            height={Math.max(4, footD - seatD - 1)}
                            rx={3}
                            fill={fabricHex}
                            stroke="#f8fafc"
                            strokeOpacity={0.55}
                            strokeWidth={1.2}
                          />
                        )}
                        {/* Right L/U Chaise Extension */}
                        {(shape === 'l_right' || shape === 'u_shape') && (
                          <rect
                            x={footW / 2 - wingW - 1.5}
                            y={backY + seatD - 2}
                            width={wingW}
                            height={Math.max(4, footD - seatD - 1)}
                            rx={3}
                            fill={fabricHex}
                            stroke="#f8fafc"
                            strokeOpacity={0.55}
                            strokeWidth={1.2}
                          />
                        )}
                        {/* Optional Ottoman / Hocker */}
                        {hasOttoman && (
                          <rect
                            x={
                              shape === 'l_left'
                                ? footW * 0.08
                                : shape === 'l_right'
                                ? -footW * 0.34
                                : -footW * 0.14
                            }
                            y={footD * 0.08}
                            width={Math.max(12, footW * 0.26)}
                            height={Math.max(10, footD * 0.28)}
                            rx={2.5}
                            fill={fabricHex}
                            stroke="#fbbf24"
                            strokeWidth={1.2}
                          />
                        )}
                      </g>
                    );
                  })()}

                  {/* 2D Blueprint for Radiators (Flach-, Rippen-, Bad-Handtuch- & Vertikal-Heizkörper) */}
                  {isRadiator && (() => {
                    const rType = asset.radiatorConfig?.radiatorType || 'flat_panel';
                    const ribCount = Math.max(4, Math.min(20, Math.round(actualLengthM * 9)));
                    return (
                      <g className="pointer-events-none">
                        <rect
                          x={-footW / 2 + 1}
                          y={-footD / 2 + 1}
                          width={footW - 2}
                          height={footD - 2}
                          rx={2}
                          fill={asset.radiatorConfig?.color || asset.customColor || '#f8fafc'}
                          fillOpacity={0.85}
                          stroke="#ef4444"
                          strokeWidth={1.2}
                        />
                        {Array.from({ length: ribCount }).map((_, rIdx) => {
                          const rx = -footW / 2 + 3 + (rIdx / Math.max(1, ribCount - 1)) * (footW - 6);
                          return (
                            <line
                              key={rIdx}
                              x1={rx}
                              y1={-footD / 2 + 1.5}
                              x2={rx}
                              y2={footD / 2 - 1.5}
                              stroke={rType === 'ribbed_classic' ? '#0f172a' : '#64748b'}
                              strokeWidth={rType === 'ribbed_classic' ? 1.5 : 1}
                            />
                          );
                        })}
                      </g>
                    );
                  })()}

                  {/* 2D Blueprint for Acoustic Wood Slat Panels */}
                  {isAcousticPanel && (() => {
                    const tone = asset.acousticPanelConfig?.woodTone || 'oak_natural';
                    const toneColor =
                      tone === 'walnut_dark'
                        ? '#5c3a21'
                        : tone === 'ash_light'
                        ? '#d6c1a3'
                        : tone === 'teak_warm'
                        ? '#9a5b25'
                        : tone === 'charcoal_black'
                        ? '#27272a'
                        : '#b68652';
                    const slatCount = Math.max(5, Math.min(28, Math.round(actualLengthM * 10)));
                    return (
                      <g className="pointer-events-none">
                        <rect
                          x={-footW / 2 + 1}
                          y={-footD / 2 + 1}
                          width={footW - 2}
                          height={footD - 2}
                          rx={1.5}
                          fill={asset.acousticPanelConfig?.feltColor || '#18181b'}
                        />
                        {Array.from({ length: slatCount }).map((_, sIdx) => {
                          const sx = -footW / 2 + 2 + (sIdx / Math.max(1, slatCount - 1)) * (footW - 4);
                          return (
                            <line
                              key={sIdx}
                              x1={sx}
                              y1={-footD / 2 + 1}
                              x2={sx}
                              y2={footD / 2 - 1}
                              stroke={toneColor}
                              strokeWidth={2}
                            />
                          );
                        })}
                      </g>
                    );
                  })()}

                  {/* 2D Architectural Blueprint for Wall-Planner Modules (Küche, Wohnwand, Garderobe, Schränke) */}
                  {isWallModule && (() => {
                    const wm = asset.wallModuleConfig;
                    const mType = wm?.moduleType || 'kitchen_drawers';
                    const frontHex = wm?.frontColor || '#f8fafc';
                    const topHex = wm?.countertopColor || '#b48352';
                    const isKitchen = mType.startsWith('kitchen_');
                    return (
                      <g className="pointer-events-none">
                        <rect
                          x={-footW / 2 + 1}
                          y={-footD / 2 + 1}
                          width={footW - 2}
                          height={footD - 2}
                          rx={2}
                          fill={isKitchen ? topHex : frontHex}
                          fillOpacity={0.85}
                          stroke={frontHex}
                          strokeWidth={1.4}
                        />
                        {/* Front door lip along +Z edge */}
                        <line
                          x1={-footW / 2 + 2}
                          y1={footD / 2 - 2.5}
                          x2={footW / 2 - 2}
                          y2={footD / 2 - 2.5}
                          stroke="#fbbf24"
                          strokeWidth={1.6}
                        />
                        {mType === 'kitchen_sink' && (
                          <>
                            <rect
                              x={-footW * 0.28}
                              y={-footD * 0.25}
                              width={footW * 0.56}
                              height={footD * 0.5}
                              rx={2}
                              fill="#1e293b"
                              stroke="#cbd5e1"
                              strokeWidth={1.1}
                            />
                            <circle cx={0} cy={-footD * 0.3} r={2} fill="#38bdf8" />
                          </>
                        )}
                        {mType === 'kitchen_cooktop' && (
                          <>
                            <rect
                              x={-footW * 0.32}
                              y={-footD * 0.28}
                              width={footW * 0.64}
                              height={footD * 0.56}
                              rx={2}
                              fill="#090d16"
                              stroke="#ef4444"
                              strokeWidth={1}
                            />
                            <circle cx={-footW * 0.14} cy={-footD * 0.1} r={2.5} stroke="#ef4444" strokeWidth={1} fill="none" />
                            <circle cx={footW * 0.14} cy={-footD * 0.1} r={2.2} stroke="#ef4444" strokeWidth={1} fill="none" />
                            <circle cx={-footW * 0.14} cy={footD * 0.12} r={2.2} stroke="#ef4444" strokeWidth={1} fill="none" />
                            <circle cx={footW * 0.14} cy={footD * 0.12} r={2.5} stroke="#ef4444" strokeWidth={1} fill="none" />
                          </>
                        )}
                      </g>
                    );
                  })()}

                  {/* Architectural Detail Pattern for Hedges, Fences & Walkways in 2D */}
                  {isLinearAsset ? (
                    <>
                      {isHedge ? (
                        Array.from({
                          length: Math.max(3, Math.min(18, Math.round(actualLengthM * 2.2))),
                        }).map((_, idx, arr) => {
                          const t = arr.length === 1 ? 0 : idx / (arr.length - 1) - 0.5;
                          return (
                            <circle
                              key={idx}
                              cx={t * (footW - footD * 0.7)}
                              cy={idx % 2 === 0 ? -1.5 : 1.5}
                              r={Math.max(4, footD * 0.36)}
                              fill="#22c55e"
                              fillOpacity={0.55}
                            />
                          );
                        })
                      ) : isWalkway ? (
                        Array.from({
                          length: Math.max(4, Math.min(20, Math.round(actualLengthM * 2.5))),
                        }).map((_, idx, arr) => {
                          const stepW = footW / arr.length;
                          return (
                            <line
                              key={idx}
                              x1={-footW / 2 + idx * stepW}
                              y1={-footD / 2 + 2}
                              x2={-footW / 2 + idx * stepW}
                              y2={footD / 2 - 2}
                              stroke="#fde68a"
                              strokeOpacity={0.45}
                              strokeWidth={1.3}
                            />
                          );
                        })
                      ) : (
                        <>
                          <line
                            x1={-footW / 2 + 2}
                            y1={0}
                            x2={footW / 2 - 2}
                            y2={0}
                            stroke="#cbd5e1"
                            strokeWidth={2}
                          />
                          {Array.from({
                            length: Math.max(2, Math.min(14, Math.round(actualLengthM / 1.5) + 1)),
                          }).map((_, idx, arr) => {
                            const t = arr.length === 1 ? 0 : idx / (arr.length - 1) - 0.5;
                            return (
                              <rect
                                key={idx}
                                x={t * (footW - 6) - 2.5}
                                y={-footD / 2 - 1}
                                width={5}
                                height={footD + 2}
                                rx={1}
                                fill="#e2e8f0"
                              />
                            );
                          })}
                        </>
                      )}

                      {/* Draggable Start & End Handles for Stretching Hedges, Fences & Walkways in 2D */}
                      {isSelected && !isDrawingMode && !asset.locked && (
                        <>
                          <g
                            transform={`translate(${-footW / 2}, 0)`}
                            onPointerDown={(e) => {
                              e.stopPropagation();
                              setDragState({
                                type: 'fence_endpoint',
                                id: asset.id,
                                end: 'start',
                                anchorX: endWorldX,
                                anchorZ: endWorldZ,
                              });
                            }}
                            className="cursor-ew-resize"
                          >
                            <circle
                              r={6.5}
                              fill="#38bdf8"
                              stroke="#090d16"
                              strokeWidth={2}
                            />
                          </g>
                          <g
                            transform={`translate(${footW / 2}, 0)`}
                            onPointerDown={(e) => {
                              e.stopPropagation();
                              setDragState({
                                type: 'fence_endpoint',
                                id: asset.id,
                                end: 'end',
                                anchorX: startWorldX,
                                anchorZ: startWorldZ,
                              });
                            }}
                            className="cursor-ew-resize"
                          >
                            <circle
                              r={6.5}
                              fill="#38bdf8"
                              stroke="#090d16"
                              strokeWidth={2}
                            />
                          </g>
                        </>
                      )}
                    </>
                  ) : isIndoorStair ? (
                    (() => {
                      const sc = asset.stairConfig || {};
                      const shape =
                        sc.shape ||
                        (asset.catalogId === 'staircase_spiral_steel'
                          ? 'spiral'
                          : asset.catalogId === 'staircase_curved_landing'
                          ? 'half_s_curve'
                          : asset.catalogId === 'staircase_u_podest'
                          ? 'u_podest'
                          : asset.catalogId === 'staircase_floating_cantilever'
                          ? 'floating_cantilever'
                          : 'straight');
                      const numSteps = Math.max(8, Math.min(18, sc.stepCount ?? 14));

                      if (shape === 'spiral') {
                        const r = Math.min(footW, footD) * 0.46;
                        return (
                          <g>
                            <circle
                              cx={0}
                              cy={0}
                              r={r}
                              fill="rgba(217, 119, 6, 0.22)"
                              stroke="#fbbf24"
                              strokeWidth={1.6}
                            />
                            {Array.from({ length: 12 }).map((_, i) => {
                              const ang = (i / 12) * Math.PI * 1.75;
                              return (
                                <line
                                  key={i}
                                  x1={0}
                                  y1={0}
                                  x2={Math.cos(ang) * r}
                                  y2={Math.sin(ang) * r}
                                  stroke="#fde68a"
                                  strokeWidth={1.1}
                                />
                              );
                            })}
                            <circle cx={0} cy={0} r={4} fill="#f8fafc" />
                          </g>
                        );
                      }

                      if (shape === 'u_podest' || shape === 'u_winder') {
                        const halfSteps = Math.floor(numSteps / 2);
                        return (
                          <g>
                            {/* Center divider wall/gap */}
                            <line
                              x1={0}
                              y1={-footD / 2 + 4}
                              x2={0}
                              y2={footD * 0.22}
                              stroke="#fbbf24"
                              strokeWidth={2}
                            />
                            {/* Top 180° landing */}
                            <line
                              x1={-footW / 2 + 2}
                              y1={footD * 0.22}
                              x2={footW / 2 - 2}
                              y2={footD * 0.22}
                              stroke="#fde68a"
                              strokeWidth={1.6}
                            />
                            {Array.from({ length: halfSteps }).map((_, i) => {
                              const y =
                                -footD / 2 +
                                4 +
                                ((i + 1) / (halfSteps + 1)) * (footD * 0.72);
                              return (
                                <React.Fragment key={i}>
                                  <line
                                    x1={-footW / 2 + 2}
                                    y1={y}
                                    x2={-2}
                                    y2={y}
                                    stroke="#fde68a"
                                    strokeWidth={1}
                                  />
                                  <line
                                    x1={2}
                                    y1={y}
                                    x2={footW / 2 - 2}
                                    y2={y}
                                    stroke="#fde68a"
                                    strokeWidth={1}
                                  />
                                </React.Fragment>
                              );
                            })}
                            {/* U-turn walking line */}
                            <path
                              d={`M ${-footW * 0.25} ${-footD * 0.35} L ${-footW * 0.25} ${
                                footD * 0.34
                              } L ${footW * 0.25} ${footD * 0.34} L ${footW * 0.25} ${
                                -footD * 0.35
                              }`}
                              fill="none"
                              stroke="#38bdf8"
                              strokeWidth={1.5}
                            />
                          </g>
                        );
                      }

                      return (
                        <g>
                          {Array.from({ length: numSteps }).map((_, i) => {
                            const frac = (i + 1) / (numSteps + 1);
                            const y = -footD / 2 + frac * footD;
                            return (
                              <line
                                key={i}
                                x1={-footW / 2 + 3}
                                y1={y}
                                x2={footW / 2 - 3}
                                y2={y}
                                stroke="#fde68a"
                                strokeOpacity={0.75}
                                strokeWidth={
                                  shape === 'floating_cantilever' ? 1.8 : 1.1
                                }
                                strokeDasharray={
                                  shape === 'floating_cantilever' ? '4 2' : undefined
                                }
                              />
                            );
                          })}
                          {/* Walking direction line (Lauflinie) */}
                          <line
                            x1={
                              shape === 'double_winder_c_left' ||
                              shape === 'double_winder_s_left' ||
                              shape === 'quarter_bottom_left'
                                ? -footW * 0.28
                                : shape === 'double_winder_c_right' ||
                                  shape === 'double_winder_s_right' ||
                                  shape === 'quarter_bottom_right'
                                ? footW * 0.28
                                : 0
                            }
                            y1={-footD * 0.38}
                            x2={
                              shape === 'l_landing_left' ||
                              shape === 'quarter_top_left' ||
                              shape === 'double_winder_c_left' ||
                              shape === 'double_winder_s_right'
                                ? -footW * 0.32
                                : shape === 'l_landing_right' ||
                                  shape === 'quarter_top_right' ||
                                  shape === 'double_winder_c_right' ||
                                  shape === 'double_winder_s_left'
                                ? footW * 0.32
                                : 0
                            }
                            y2={footD * 0.38}
                            stroke="#38bdf8"
                            strokeWidth={1.6}
                          />
                          <circle cx={0} cy={-footD * 0.38} r={2.8} fill="#38bdf8" />
                        </g>
                      );
                    })()
                  ) : isOutdoorStair ? (
                    (() => {
                      const ec = asset.exteriorStairConfig || {};
                      const steps = Math.max(2, Math.min(8, ec.stepCount ?? 3));
                      return (
                        <g>
                          {Array.from({ length: steps }).map((_, i) => {
                            const y =
                              -footD / 2 + ((i + 1) / (steps + 1)) * footD;
                            return (
                              <line
                                key={i}
                                x1={-footW / 2 + 3}
                                y1={y}
                                x2={footW / 2 - 3}
                                y2={y}
                                stroke="#cbd5e1"
                                strokeWidth={1.2}
                                strokeDasharray="3 1"
                              />
                            );
                          })}
                          <line
                            x1={0}
                            y1={-footD * 0.32}
                            x2={0}
                            y2={footD * 0.35}
                            stroke="#fbbf24"
                            strokeWidth={1.5}
                          />
                        </g>
                      );
                    })()
                  ) : (
                    <>
                      <circle r={3.5} fill={isSelected || isHovered ? '#f59e0b' : badgeColor} />
                      <line
                        x1={0}
                        y1={0}
                        x2={0}
                        y2={-footD / 2}
                        stroke={isSelected || isHovered ? '#f59e0b' : badgeColor}
                        strokeWidth={2}
                      />
                    </>
                  )}
                </g>

                {(isSelected || isHovered || (isLinearAsset && showDimensions) || zoom >= 1.35) && (
                  <g className="pointer-events-none">
                    <rect
                      x={-54}
                      y={Math.max(10, footD / 2 + 2)}
                      width={108}
                      height={14}
                      rx={4}
                      fill="#090d16"
                      fillOpacity={0.92}
                      stroke={isSelected ? '#f59e0b' : '#334155'}
                      strokeWidth={0.8}
                    />
                    <text
                      x={0}
                      y={Math.max(19, footD / 2 + 11)}
                      textAnchor="middle"
                      fill={isSelected ? '#fde68a' : '#f8fafc'}
                      fontSize={Math.max(6.8, 7.2 * zoom)}
                      fontWeight={isSelected || isHovered ? '600' : '500'}
                    >
                      {asset.locked ? '🔒 ' : ''}
                      {(() => {
                        const cleanName = asset.name
                          .replace(/\s*\(2-Sensor[^)]*\)/gi, '')
                          .replace(/Raumluftsensor/gi, 'Raumluft')
                          .replace(/Kontaktsensor/gi, 'Kontakt')
                          .replace(/\s*[-–]?\s*Sensor\b/gi, '')
                          .trim();
                        return isLinearAsset
                          ? `${cleanName.split(' ')[0]} · ${actualLengthM.toFixed(2)}m`
                          : cleanName.length > 16
                          ? cleanName.slice(0, 15) + '…'
                          : cleanName;
                      })()}
                    </text>
                  </g>
                )}
              </g>
            );
          })}
        </g>
      </svg>

      {/* Quick Action Bar for Selected Zone, Custom Wall, Asset or Window/Door in 2D */}
      {(selectedZoneId || selectedAssetId || selectedOpeningId || selectedWallId) && (() => {
        const selZone = selectedZoneId ? project.zones.find((z) => z.id === selectedZoneId) : null;
        const selAsset = selectedAssetId ? project.assets.find((a) => a.id === selectedAssetId) : null;
        const selOpening = selectedOpeningId ? project.openings.find((o) => o.id === selectedOpeningId) : null;
        const selWall = selectedWallId ? (project.customWalls || []).find((w) => w.id === selectedWallId) : null;
        const isLocked = Boolean(
          selZone?.locked || selAsset?.locked || selOpening?.locked || selWall?.locked
        );

        const toggleSelectedLock = () => {
          if (selZone) {
            onUpdateZone(selZone.id, { locked: !selZone.locked });
          } else if (selAsset) {
            onUpdateAsset(selAsset.id, { locked: !selAsset.locked });
          } else if (selOpening) {
            onUpdateOpening(selOpening.id, { locked: !selOpening.locked });
          } else if (selWall && onUpdateCustomWall) {
            onUpdateCustomWall(selWall.id, { locked: !selWall.locked });
          }
        };

        return (
          <div className="absolute bottom-24 right-5 z-20 flex flex-wrap items-center gap-2">
            {/* Lock / Unlock Toggle Button (Schloss) */}
            <button
              type="button"
              onClick={toggleSelectedLock}
              title={
                isLocked
                  ? 'Schloss öffnen: Element wieder verschiebbar machen'
                  : 'Element per Schloss sperren (gegen versehentliches Verschieben/Löschen schützen)'
              }
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold shadow-xl border transition-colors ${
                isLocked
                  ? 'bg-amber-500 text-slate-950 border-amber-300 hover:bg-amber-400'
                  : 'bg-slate-900 hover:bg-slate-800 border-amber-400/50 text-amber-300'
              }`}
            >
              {isLocked ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
              <span>{isLocked ? 'Gesperrt (Entsperren)' : 'Fixieren / Sperren'}</span>
            </button>

            {selectedWallId && onDeleteCustomWall && !isLocked && (
              <button
                type="button"
                onClick={() => onDeleteCustomWall(selectedWallId)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-red-500/20 hover:bg-red-500/30 border border-red-400/50 text-red-200 text-xs font-bold shadow-xl"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Freie Wand löschen</span>
              </button>
            )}
            {selectedZoneId && onRotateBuilding && !isLocked && (
              <>
                <button
                  type="button"
                  onClick={() => onRotateBuilding(selectedZoneId, -Math.PI / 12, false)}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-sky-400/50 text-sky-300 text-xs font-bold shadow-xl"
                  title="Diesen Raum / Gebäudeteil um 15° drehen"
                >
                  <RotateCw className="w-3.5 h-3.5" />
                  <span>Raum 15° drehen</span>
                </button>
                <button
                  type="button"
                  onClick={() => onRotateBuilding(selectedZoneId, -Math.PI / 12, true)}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold shadow-xl"
                  title="Alle Räume, Fenster, Türen und Geräte dieses Gebäudes gemeinsam um 15° drehen"
                >
                  <RotateCw className="w-3.5 h-3.5" />
                  <span>Ganzes Gebäude 15° drehen</span>
                </button>
              </>
            )}
            {selectedZoneId && onDeleteZone && !isLocked && (
              <button
                type="button"
                onClick={() => onDeleteZone(selectedZoneId)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-red-500/20 hover:bg-red-500/30 border border-red-400/50 text-red-200 text-xs font-bold shadow-xl"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Raum / Fläche löschen</span>
              </button>
            )}
            {selectedOpeningId && !isLocked && (
              <>
                <button
                  type="button"
                  onClick={() => {
                    const o = project.openings.find((x) => x.id === selectedOpeningId);
                    if (o) {
                      onUpdateOpening(o.id, {
                        hingeSide: (o.hingeSide || 'left') === 'left' ? 'right' : 'left',
                      });
                    }
                  }}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-sky-400/50 text-sky-300 text-xs font-bold shadow-xl"
                >
                  <span>Anschlag wechseln (Links ↔ Rechts)</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const o = project.openings.find((x) => x.id === selectedOpeningId);
                    if (o) {
                      onUpdateOpening(o.id, {
                        openDirection:
                          (o.openDirection || 'inward') === 'inward' ? 'outward' : 'inward',
                      });
                    }
                  }}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-emerald-400/50 text-emerald-300 text-xs font-bold shadow-xl"
                >
                  <span>Öffnungsrichtung (Innen ↔ Außen)</span>
                </button>
              </>
            )}
            {(selectedAssetId || selectedOpeningId) && !isLocked && (
              <button
                type="button"
                onClick={() => {
                  if (selectedAssetId) {
                    const a = project.assets.find((x) => x.id === selectedAssetId);
                    if (a) {
                      onUpdateAsset(a.id, {
                        rotationY: (a.rotationY + Math.PI / 4) % (Math.PI * 2),
                      });
                    }
                  } else if (selectedOpeningId) {
                    const o = project.openings.find((x) => x.id === selectedOpeningId);
                    if (o) {
                      onUpdateOpening(o.id, {
                        rotationY:
                          Math.abs(Math.sin(o.rotationY)) >= 0.6 ? 0 : Math.PI / 2,
                      });
                    }
                  }
                }}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold shadow-xl"
              >
                <RotateCw className="w-4 h-4" />
                <span>
                  {selectedOpeningId
                    ? 'Wand-Achse 90° drehen'
                    : 'Objekt um 45° drehen'}
                </span>
              </button>
            )}
          </div>
        );
      })()}
    </div>
  );
};
