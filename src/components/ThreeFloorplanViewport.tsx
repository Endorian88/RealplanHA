import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { SURFACE_MATERIALS } from '../data/catalogAndInitialState';
import {
  buildOpeningGroup,
  buildPlacedAssetGroup,
  buildZoneRoofGroup,
  DormerDynamicUnitRef,
  evaluateRoofUndersideHeight,
  updateAssetVisualState,
  updateDormerDynamicUnits,
} from '../three/assetBuilder';
import {
  createSurfacePBRMaps,
  createWallFinishTexture,
  getChainlinkMeshTexture,
} from '../three/proceduralTextures';
import {
  ActiveFloorView,
  areZonesInSameBuilding,
  CameraPresetId,
  CatalogItem,
  clampAssetPositionInsideRoomWalls,
  cleanDisplayLabel,
  computeRoofHostFootprintZone,
  computeZoneAreaM2,
  FloorplanProject,
  FloorplanZone,
  getBuildingClusterKey,
  getBuildingHierarchyGroups,
  getKellertreppeDimensions,
  getLinearAssetDefaultWidth,
  getZoneCorners,
  HAEntityState,
  isAcousticPanelAsset,
  isBinaryEntityActive,
  isBuildingMultiStoryRoof,
  isChimneyOrDormerAsset,
  isExteriorStairAsset,
  isFenceOrHedgeAsset,
  isAssetActuatorControllable,
  isInteriorRoomZone,
  isKellertreppeAsset,
  isOpeningActuatorControllable,
  isRadiatorAsset,
  isStairAsset,
  isStreetLampAsset,
  isWallSnapAsset,
  isZoneRotated,
  LiveCockpitConfig,
  PerformanceMode,
  PlacedAsset,
  resolveOpeningSensorState,
  resolveZoneRole,
  RoomStatusCardConfig,
  snapAssetToNearestRoomWall,
  VisualStyleMode,
  WallOpening,
  WallSideId,
  WeatherSimulationMode,
  WorkspaceTab,
} from '../types/floorplan';
import { SmartCockpitCardsOverlay } from './SmartCockpitCardsOverlay';

import {
   Blinds,
  Check,
  ChevronRight,
  DoorOpen,
  Droplets,
  Flame,
  Layers,
  Lightbulb,
  Maximize2,
  Power,
  ShieldAlert,
  Sparkles,
  Sun,
  Thermometer,
  X,
  Zap,
} from 'lucide-react';

const FLOOR_HEIGHT = 2.75;
const MAX_POOLED_POINT_LIGHTS = 8;

type BadgeDomainKind =
  | 'light'
  | 'opening'
  | 'power'
  | 'climate'
  | 'cover'
  | 'alarm'
  | 'water'
  | 'sensor';

interface ProjectedBadge {
  id: string;
  label: string;
  sublabel: string;
  x: number;
  y: number;
  worldPos: [number, number, number];
  colorClass: string;
  dotColorClass: string;
  kind: BadgeDomainKind;
  isActive: boolean;
  zoneId: string | null;
  entityId?: string;
  assetId?: string;
  openingId?: string;
}

interface OffscreenAlertPin {
  id: string;
  label: string;
  sublabel: string;
  edgeX: number;
  edgeY: number;
  arrowDir: 'left' | 'right' | 'up' | 'down';
  severity: 'alarm' | 'warning' | 'info';
  targetWorldPos: [number, number, number];
  zoneId: string | null;
  openingId?: string;
  assetId?: string;
  entityId?: string;
}

interface ProjectedRoomSummary {
  zoneId: string;
  name: string;
  zoneType: 'indoor' | 'outdoor';
  x: number;
  y: number;
  worldPos: [number, number, number];
  tempText: string | null;
  humidityText: string | null;
  lightsOn: number;
  lightsTotal: number;
  lightEntityIds: string[];
  openingsActive: number;
  openingsTotal: number;
  powerWatts: number;
  hasAlarm: boolean;
  totalElements: number;
  customItems: { id: string; label: string; value: string }[];
  config: RoomStatusCardConfig;
}

interface ZoneSharedMaterialEntry {
  mat: THREE.MeshStandardMaterial;
  baseColor: THREE.Color;
  isHeatmapColored?: boolean;
}

interface ThreeFloorplanViewportProps {
  project: FloorplanProject;
  entities: Record<string, HAEntityState>;
  activeTab: WorkspaceTab;
  activeFloor: ActiveFloorView;
  performanceMode: PerformanceMode;
  sunHour: number;
  wallCutaway: boolean;
  showClimateHeatmap: boolean;
  showEnergyFlow: boolean;
  showSensorRadii: boolean;
  showFloatingBadges: boolean;
  visualStyle?: VisualStyleMode;
  weatherMode?: WeatherSimulationMode;
  showPresenceAvatars?: boolean;
  showSmartCockpitCards?: boolean;
  cameraPreset: CameraPresetId;
  focusedZoneId: string | null;
  selectedAssetId: string | null;
  selectedZoneId: string | null;
  selectedWallId?: string | null;
  pendingCatalogItem: CatalogItem | null;
  onSelectAsset: (assetId: string | null, entityId?: string) => void;
  onSelectZone: (zoneId: string | null) => void;
  onSelectWall?: (wallId: string | null) => void;
  onFocusZone?: (zoneId: string | null) => void;
  onSelectOpening?: (openingId: string | null) => void;
  onUpdateAsset?: (assetId: string, patch: Partial<PlacedAsset>) => void;
  onUpdateOpening?: (openingId: string, patch: Partial<WallOpening>) => void;
  onUpdateZone?: (zoneId: string, patch: Partial<FloorplanZone>) => void;
  onPlaceCatalogItemAt: (worldX: number, worldZ: number) => void;
  onQuickToggleEntity: (entityId: string) => void;
  onToggleEnergyFlow?: () => void;
  onToggleSensorRadii?: () => void;
  onTogglePresenceAvatars?: () => void;
  onUpdatePersonRoom?: (entityId: string, roomName: string) => void;
  onUpdateLiveCockpitConfig?: (cfg: LiveCockpitConfig) => void;
  cameraIdleMode?: boolean;
  autoIdleAfterInactivity?: boolean;
  onChangeCameraIdleMode?: (active: boolean) => void;
  onUpdateNorthAngle?: (angleDeg: number) => void;
  pureLiveMode?: boolean;
  hideRoomDirectory?: boolean;
}

const CAMERA_PRESETS: Record<
  CameraPresetId,
  { pos: [number, number, number]; target: [number, number, number] }
> = {
  overview: { pos: [-14.5, 16.5, 21.5], target: [0.0, 0.5, 2.0] },
  living_kitchen: { pos: [-1.5, 6.8, 7.2], target: [-0.5, 0.8, -2.0] },
  garden_pool: { pos: [-10.5, 9.2, 20.5], target: [-1.5, 0.4, 7.8] },
  driveway_solar: { pos: [17.5, 9.5, 10.5], target: [6.8, 1.0, -2.5] },
  top_blueprint: { pos: [0.0, 32.0, 2.01], target: [0.0, 0.0, 2.0] },
};

// Pre-allocated math helpers outside the render loop (Zero-GC discipline)
const _vec3 = new THREE.Vector3();
const _projVec = new THREE.Vector3();
const _targetCamPos = new THREE.Vector3();
const _targetLookAt = new THREE.Vector3();
const _skyDay = new THREE.Color(0xcbd5e1);
const _skyClearDay = new THREE.Color(0x38bdf8);
const _skyGolden = new THREE.Color(0xfde68a);
const _skyNight = new THREE.Color(0x060911);
const _skyFocusDim = new THREE.Color(0x05080f);
const _currentSky = new THREE.Color();
const _targetMeshColor = new THREE.Color();
const _roomLightTint = new THREE.Color();

function disposeGroupGeometries(root: THREE.Object3D | null | undefined) {
  if (!root) return;
  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (mesh.geometry && !mesh.geometry.userData?.isSharedSingleton) {
      mesh.geometry.dispose();
    }
  });
}

function cleanBadgeLabel(raw: string): string {
  return cleanDisplayLabel(raw);
}

function computeAssetGeometrySignature(
  asset: PlacedAsset,
  includeTransformForRoofStairClip: boolean
): string {
  return JSON.stringify({
    c: asset.catalogId,
    l: asset.customLength,
    w: asset.customWidth,
    d: asset.customDepth,
    h: asset.customHeight,
    col: asset.customColor,
    ss: asset.sailShape,
    sc: asset.sailColor,
    scor: asset.sailCorners,
    pvN: asset.pvModuleCount,
    pvT: asset.pvTiltDeg,
    st: asset.stairConfig,
    est: asset.exteriorStairConfig,
    dw: asset.dormerWindowConfig,
    lc: asset.lightConfig,
    rad: asset.radiatorConfig,
    ac: asset.acousticPanelConfig,
    sofa: asset.sofaConfig,
    wm: asset.wallModuleConfig,
    cab: asset.cabinetConfig,
    glb: asset.glbUrl,
    tf: includeTransformForRoofStairClip
      ? [asset.position[0], asset.position[1], asset.position[2], asset.rotationY, asset.scale]
      : undefined,
  });
}

function isPointInsideZone(x: number, z: number, zone: FloorplanZone): boolean {
  if ((zone.points && zone.points.length >= 3) || isZoneRotated(zone)) {
    let inside = false;
    const pts = getZoneCorners(zone);
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const [xi, zi] = pts[i];
      const [xj, zj] = pts[j];
      const intersect =
        zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi + 1e-9) + xi;
      if (intersect) inside = !inside;
      // Also allow 0.35m wall proximity for perimeter sensors/windows
      const dx = xj - xi;
      const dz = zj - zi;
      const lenSq = dx * dx + dz * dz;
      if (lenSq > 0.01) {
        const t = Math.max(0, Math.min(1, ((x - xi) * dx + (z - zi) * dz) / lenSq));
        if (Math.hypot(x - (xi + t * dx), z - (zi + t * dz)) <= 0.38) {
          return true;
        }
      }
    }
    return inside;
  }
  const halfW = zone.width / 2 + 0.35;
  const halfD = zone.depth / 2 + 0.35;
  return (
    x >= zone.x - halfW &&
    x <= zone.x + halfW &&
    z >= zone.z - halfD &&
    z <= zone.z + halfD
  );
}

function findBestZoneForPoint(
  x: number,
  z: number,
  level: number,
  zones: FloorplanZone[]
): FloorplanZone | null {
  let best: FloorplanZone | null = null;
  let bestScore = Infinity;
  for (const zone of zones) {
    if ((zone.level ?? 0) !== level) continue;
    if (!isPointInsideZone(x, z, zone)) continue;
    const isInnerRoom = zone.zoneType === 'indoor' && isInteriorRoomZone(zone, zones);
    const typePriority = isInnerRoom
      ? -500
      : zone.zoneType === 'indoor'
      ? 0
      : zone.surfaceMaterial === 'pool_water'
      ? 1000
      : 10000;
    const area = computeZoneAreaM2(zone);
    const score = typePriority + area;
    if (score < bestScore) {
      bestScore = score;
      best = zone;
    }
  }
  return best;
}

export const ThreeFloorplanViewport: React.FC<ThreeFloorplanViewportProps> = ({
  project,
  entities,
  activeTab,
  activeFloor,
  performanceMode,
  sunHour,
  wallCutaway,
  showClimateHeatmap,
  showEnergyFlow,
  showSensorRadii,
  showFloatingBadges,
  visualStyle = 'archviz',
  weatherMode = 'auto_sun',
  showPresenceAvatars = true,
  showSmartCockpitCards = false,
  cameraPreset,
  focusedZoneId,
  selectedAssetId,
  selectedZoneId,
  selectedWallId = null,
  pendingCatalogItem,
  onSelectAsset,
  onSelectZone,
  onSelectWall,
  onFocusZone,
  onSelectOpening,
  onUpdateAsset,
  onUpdateOpening,
  onUpdateZone,
  onPlaceCatalogItemAt,
  onQuickToggleEntity,
  onToggleEnergyFlow,
  onToggleSensorRadii,
  onTogglePresenceAvatars,
  onUpdatePersonRoom,
  onUpdateLiveCockpitConfig,
  cameraIdleMode = false,
  autoIdleAfterInactivity = false,
  onChangeCameraIdleMode,
  onUpdateNorthAngle,
  pureLiveMode = false,
  hideRoomDirectory = false,
}) => {
  const canvasMountRef = useRef<HTMLDivElement | null>(null);
  const [badges, setBadges] = useState<ProjectedBadge[]>([]);
  const [roomSummaries, setRoomSummaries] = useState<ProjectedRoomSummary[]>([]);
  const [offscreenPins, setOffscreenPins] = useState<OffscreenAlertPin[]>([]);
  const [listSearchQuery, setListSearchQuery] = useState<string>('');
  const [listFilterMode, setListFilterMode] = useState<'all' | 'active' | 'indoor' | 'outdoor'>('all');
  const [expandedRoomIds, setExpandedRoomIds] = useState<Record<string, boolean>>({});
  const [isListMinimized, setIsListMinimized] = useState<boolean>(() =>
    typeof window !== 'undefined' ? window.innerWidth < 768 : false
  );
  const [showFocusedRoomList, setShowFocusedRoomList] = useState<boolean>(false);
  const [showRoomCardConfig, setShowRoomCardConfig] = useState<boolean>(false);
  const [isDragging3D, setIsDragging3D] = useState(false);
  const [floorSwitchRoofMode, setFloorSwitchRoofMode] = useState<'hidden' | 'cutaway' | 'solid'>('hidden');
  const prevBadgeSigRef = useRef<string>('');
  const prevArchBuildSigRef = useRef<string>('');
  const assetGeometryCacheRef = useRef<Map<string, { sig: string; group: THREE.Group }>>(
    new Map()
  );
  const roomPillDomRefs = useRef<Map<string, HTMLButtonElement>>(new Map());
  const badgeDomRefs = useRef<Map<string, HTMLButtonElement>>(new Map());
  const activeRoomSummariesRef = useRef<ProjectedRoomSummary[]>([]);
  const activeBadgesRef = useRef<ProjectedBadge[]>([]);

  const stateRef = useRef({
    project,
    entities,
    activeTab,
    activeFloor,
    performanceMode,
    sunHour,
    wallCutaway,
    showClimateHeatmap,
    showEnergyFlow,
    showSensorRadii,
    showFloatingBadges,
    visualStyle,
    weatherMode,
    showPresenceAvatars,
    focusedZoneId,
    selectedAssetId,
    selectedZoneId,
    selectedWallId,
    pendingCatalogItem,
    cameraIdleMode,
    autoIdleAfterInactivity,
    onSelectAsset,
    onSelectZone,
    onSelectWall,
    onSelectOpening,
    onUpdateAsset,
    onUpdateOpening,
    onPlaceCatalogItemAt,
    onChangeCameraIdleMode,
  });
  stateRef.current = {
    project,
    entities,
    activeTab,
    activeFloor,
    performanceMode,
    sunHour,
    wallCutaway,
    showClimateHeatmap,
    showEnergyFlow,
    showSensorRadii,
    showFloatingBadges,
    visualStyle,
    weatherMode,
    showPresenceAvatars,
    focusedZoneId,
    selectedAssetId,
    selectedZoneId,
    selectedWallId,
    pendingCatalogItem,
    cameraIdleMode,
    autoIdleAfterInactivity,
    onSelectAsset,
    onSelectZone,
    onSelectWall,
    onSelectOpening,
    onUpdateAsset,
    onUpdateOpening,
    onPlaceCatalogItemAt,
    onChangeCameraIdleMode,
  };

  const sceneObjectsRef = useRef<{
    renderer: THREE.WebGLRenderer | null;
    scene: THREE.Scene | null;
    camera: THREE.PerspectiveCamera | null;
    controls: OrbitControls | null;
    architectureGroup: THREE.Group | null;
    assetsGroup: THREE.Group | null;
    openingsGroup: THREE.Group | null;
    energyFlowGroup: THREE.Group | null;
    avatarsGroup: THREE.Group | null;
    skyboxGroup: THREE.Group | null;
    skyDomeMat: THREE.MeshBasicMaterial | null;
    sunOrbMesh: THREE.Mesh | null;
    moonOrbMesh: THREE.Mesh | null;
    starsPoints: THREE.Points | null;
    cloudsGroup: THREE.Group | null;
    weatherPoints: THREE.Points | null;
    estateTerrain: THREE.Mesh | null;
    archGrid: THREE.GridHelper | null;
    selectionRing: THREE.Mesh | null;
    indoorWalls: THREE.Mesh[];
    roofGroups: THREE.Group[];
    poolWaterMaterials: THREE.MeshStandardMaterial[];
    zoneMaterialsMap: Map<string, ZoneSharedMaterialEntry[]>;
    assetMap: Map<string, THREE.Group>;
    assetZoneMap: Map<string, string | null>;
    openingMap: Map<string, THREE.Group>;
    pointLightPool: THREE.PointLight[];
    alarmLight: THREE.PointLight | null;
    focusSpotLight: THREE.SpotLight | null;
    sunLight: THREE.DirectionalLight | null;
    hemiLight: THREE.HemisphereLight | null;
    cameraTransitionActive: boolean;
    tourRoomZoneId: string | null;
    wakeUpUntil: number;
    shadowNeedsUpdate: boolean;
    maxAnisotropy: number;
    isSoftwareGl: boolean;
  }>({
    renderer: null,
    scene: null,
    camera: null,
    controls: null,
    architectureGroup: null,
    assetsGroup: null,
    openingsGroup: null,
    energyFlowGroup: null,
    avatarsGroup: null,
    skyboxGroup: null,
    skyDomeMat: null,
    sunOrbMesh: null,
    moonOrbMesh: null,
    starsPoints: null,
    cloudsGroup: null,
    weatherPoints: null,
    estateTerrain: null,
    archGrid: null,
    selectionRing: null,
    indoorWalls: [],
    roofGroups: [],
    poolWaterMaterials: [],
    zoneMaterialsMap: new Map(),
    assetMap: new Map(),
    assetZoneMap: new Map(),
    openingMap: new Map(),
    pointLightPool: [],
    alarmLight: null,
    focusSpotLight: null,
    sunLight: null,
    hemiLight: null,
    cameraTransitionActive: false,
    tourRoomZoneId: null,
    wakeUpUntil: 0,
    shadowNeedsUpdate: true,
    maxAnisotropy: 4,
    isSoftwareGl: false,
  });

  // Wake up adaptive render loop & schedule shadow refresh when props change
  useEffect(() => {
    sceneObjectsRef.current.wakeUpUntil = performance.now() + 1400;
    sceneObjectsRef.current.shadowNeedsUpdate = true;
  }, [
    project,
    entities,
    activeFloor,
    performanceMode,
    sunHour,
    wallCutaway,
    focusedZoneId,
    showClimateHeatmap,
    showEnergyFlow,
    showSensorRadii,
    showFloatingBadges,
  ]);

  // Apply PerformanceMode settings dynamically without recreating WebGL context
  useEffect(() => {
    const refs = sceneObjectsRef.current;
    if (!refs.renderer || !refs.sunLight) return;

    const dpr = window.devicePixelRatio || 1;
    const targetPixelRatio = refs.isSoftwareGl
      ? 1
      : performanceMode === 'eco'
      ? 1.0
      : performanceMode === 'balanced'
      ? Math.min(dpr, 1.25)
      : Math.min(dpr, 2.0);

    refs.renderer.setPixelRatio(targetPixelRatio);
    const enableShadows = !refs.isSoftwareGl && performanceMode !== 'eco';
    refs.renderer.shadowMap.enabled = enableShadows;
    refs.sunLight.castShadow = enableShadows;

    const targetMapSize = performanceMode === 'ultra' ? 2048 : 1024;
    if (
      enableShadows &&
      (refs.sunLight.shadow.mapSize.width !== targetMapSize ||
        refs.sunLight.shadow.mapSize.height !== targetMapSize)
    ) {
      refs.sunLight.shadow.mapSize.set(targetMapSize, targetMapSize);
      refs.sunLight.shadow.map?.dispose();
      refs.sunLight.shadow.map = null;
    }

    refs.shadowNeedsUpdate = true;
    refs.wakeUpUntil = performance.now() + 1000;
  }, [performanceMode]);

  // Initialize WebGLRenderer & Scene once
  useEffect(() => {
    const container = canvasMountRef.current;
    if (!container) return;

    const isSoftwareGl = (() => {
      const gl = document.createElement('canvas').getContext('webgl2');
      if (!gl) return true;
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
      const gpu = String(gl.getParameter(param));
      gl.getExtension('WEBGL_lose_context')?.loseContext();
      return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
    })();

    const renderer = new THREE.WebGLRenderer({
      antialias: !isSoftwareGl,
      powerPreference: 'high-performance',
    });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.86;
    renderer.setPixelRatio(
      isSoftwareGl ? 1 : Math.min(window.devicePixelRatio || 1, 1.25)
    );
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    // On-demand shadow map updates: avoids re-rendering shadow depth map 60x/sec when static!
    renderer.shadowMap.autoUpdate = false;
    renderer.shadowMap.needsUpdate = true;

    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0b101b);
    scene.fog = new THREE.FogExp2(0x0b101b, 0.013);

    // Subtle Studio IBL Reflections via RoomEnvironment
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    scene.environment = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environmentIntensity = 0.24;
    pmremGenerator.dispose();

    const camera = new THREE.PerspectiveCamera(
      40,
      container.clientWidth / container.clientHeight,
      0.35,
      165
    );
    camera.position.set(-14.5, 16.5, 21.5);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = !isSoftwareGl;
    controls.dampingFactor = 0.08;
    controls.maxPolarAngle = Math.PI / 2 - 0.03;
    controls.minDistance = 2.0;
    controls.maxDistance = 78;
    controls.target.set(0.0, 0.5, 2.0);

    const wakeUp = () => {
      sceneObjectsRef.current.wakeUpUntil = performance.now() + 900;
    };

    controls.addEventListener('start', () => {
      sceneObjectsRef.current.cameraTransitionActive = false;
      wakeUp();
    });
    controls.addEventListener('change', wakeUp);

    // Natural Surrounding Estate Ground (expanded 95m radius for large gardens & outbuildings)
    const estateTerrain = new THREE.Mesh(
      new THREE.CircleGeometry(95, 40),
      new THREE.MeshStandardMaterial({
        color: 0x151d1a,
        roughness: 0.94,
        metalness: 0.0,
        polygonOffset: true,
        polygonOffsetFactor: 3,
        polygonOffsetUnits: 3,
      })
    );
    estateTerrain.rotation.x = -Math.PI / 2;
    estateTerrain.position.y = -0.1;
    estateTerrain.receiveShadow = true;
    scene.add(estateTerrain);

    const archGrid = new THREE.GridHelper(56, 56, 0x263244, 0x161f2e);
    archGrid.position.y = -0.065;
    scene.add(archGrid);

    // 3-Point & Sun Lighting Rig
    const hemiLight = new THREE.HemisphereLight(0xe0f2fe, 0x1e293b, 0.72);
    hemiLight.position.set(0, 25, 0);
    scene.add(hemiLight);

    const sunLight = new THREE.DirectionalLight(0xfffbeb, 2.0);
    sunLight.position.set(14, 20, 12);
    sunLight.castShadow = !isSoftwareGl;
    sunLight.shadow.mapSize.width = 1024;
    sunLight.shadow.mapSize.height = 1024;
    const d = 22;
    sunLight.shadow.camera.left = -d;
    sunLight.shadow.camera.right = d;
    sunLight.shadow.camera.top = d;
    sunLight.shadow.camera.bottom = -d;
    sunLight.shadow.camera.near = 1;
    sunLight.shadow.camera.far = 65;
    sunLight.shadow.bias = -0.0006;
    sunLight.shadow.normalBias = 0.025;
    scene.add(sunLight);

    const fillLight = new THREE.DirectionalLight(0x93c5fd, 0.3);
    fillLight.position.set(-14, 10, -12);
    scene.add(fillLight);

    // Dedicated Room Focus Spotlight (kept visible=false when inactive so fragment shader skips it!)
    const focusSpotLight = new THREE.SpotLight(0xfff7ed, 0, 24, Math.PI / 3.2, 0.65, 1.5);
    focusSpotLight.position.set(0, 8.5, 0);
    focusSpotLight.visible = false;
    scene.add(focusSpotLight);
    scene.add(focusSpotLight.target);

    // Dedicated Smoke/Water Emergency Strobe PointLight (kept visible=false when inactive)
    const alarmLight = new THREE.PointLight(0xef4444, 0, 12, 1.5);
    alarmLight.position.set(0, 2.4, 0);
    alarmLight.visible = false;
    scene.add(alarmLight);

    // Pooled Real-Time PointLights (max 4 in scene graph prevents WebGL shader bloat & recompilation)
    const pointLightPool: THREE.PointLight[] = [];
    for (let i = 0; i < MAX_POOLED_POINT_LIGHTS; i++) {
      const pt = new THREE.PointLight(0xffd699, 0, 9.5, 1.45);
      pt.visible = false;
      scene.add(pt);
      pointLightPool.push(pt);
    }

    // Selection Highlight Ring
    const selectionRing = new THREE.Mesh(
      new THREE.RingGeometry(0.45, 0.56, 28),
      new THREE.MeshBasicMaterial({
        color: 0xf59e0b,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.9,
        depthWrite: false,
      })
    );
    selectionRing.rotation.x = -Math.PI / 2;
    selectionRing.position.y = 0.03;
    selectionRing.visible = false;
    scene.add(selectionRing);

    const architectureGroup = new THREE.Group();
    const openingsGroup = new THREE.Group();
    const assetsGroup = new THREE.Group();
    const energyFlowGroup = new THREE.Group();
    const avatarsGroup = new THREE.Group();
    scene.add(architectureGroup, openingsGroup, assetsGroup, energyFlowGroup, avatarsGroup);

    // =========================================================================
    // ATMOSPHERIC 3D SKYBOX DOME (Sun, Moon, Drifting 3D Clouds & Night Stars)
    // =========================================================================
    const skyboxGroup = new THREE.Group();
    const skyDomeGeo = new THREE.SphereGeometry(125, 32, 20);
    const skyDomeMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
    });
    const skyDomeMesh = new THREE.Mesh(skyDomeGeo, skyDomeMat);
    skyboxGroup.add(skyDomeMesh);

    const sunOrbMesh = new THREE.Mesh(
      new THREE.SphereGeometry(4.2, 24, 24),
      new THREE.MeshBasicMaterial({ color: 0xfef08a, fog: false })
    );
    const sunHalo = new THREE.Mesh(
      new THREE.SphereGeometry(6.8, 20, 20),
      new THREE.MeshBasicMaterial({
        color: 0xfde047,
        transparent: true,
        opacity: 0.28,
        fog: false,
        depthWrite: false,
      })
    );
    sunOrbMesh.add(sunHalo);
    skyboxGroup.add(sunOrbMesh);

    const moonOrbMesh = new THREE.Mesh(
      new THREE.SphereGeometry(2.8, 20, 20),
      new THREE.MeshBasicMaterial({ color: 0xe2e8f0, fog: false })
    );
    skyboxGroup.add(moonOrbMesh);

    // Night Starfield inside Skybox
    const starCount = 180;
    const starPositions = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.random() * Math.PI * 0.44;
      const r = 112;
      starPositions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      starPositions[i * 3 + 1] = Math.max(8, r * Math.cos(phi));
      starPositions[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
    }
    const starsGeo = new THREE.BufferGeometry();
    starsGeo.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
    const starsMat = new THREE.PointsMaterial({
      color: 0xf8fafc,
      size: 0.9,
      transparent: true,
      opacity: 0.0,
      fog: false,
    });
    const starsPoints = new THREE.Points(starsGeo, starsMat);
    skyboxGroup.add(starsPoints);

    // Volumetric 3D Sky Clouds
    const cloudsGroup = new THREE.Group();
    const cloudMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.92,
      metalness: 0.0,
      transparent: true,
      opacity: 0.82,
    });
    const cloudSeeds: [number, number, number, number][] = [
      [-34, 34, -42, 1.2],
      [26, 38, -36, 1.35],
      [-12, 41, -55, 1.5],
      [44, 32, 14, 1.15],
      [-45, 36, 18, 1.25],
      [14, 39, 44, 1.3],
    ];
    for (const [cx, cy, cz, cScale] of cloudSeeds) {
      const cl = new THREE.Group();
      cl.position.set(cx, cy, cz);
      const p1 = new THREE.Mesh(new THREE.DodecahedronGeometry(3.8 * cScale, 1), cloudMat);
      const p2 = new THREE.Mesh(new THREE.DodecahedronGeometry(2.9 * cScale, 1), cloudMat);
      p2.position.set(3.2 * cScale, -0.4, 0.8);
      const p3 = new THREE.Mesh(new THREE.DodecahedronGeometry(2.7 * cScale, 1), cloudMat);
      p3.position.set(-3.1 * cScale, -0.5, -0.6);
      cl.add(p1, p2, p3);
      cl.scale.y = 0.45;
      cloudsGroup.add(cl);
    }
    skyboxGroup.add(cloudsGroup);
    scene.add(skyboxGroup);

    // =========================================================================
    // 3D WEATHER PARTICLE SYSTEM (Rain & Snow)
    // =========================================================================
    const weatherCount = 650;
    const weatherPos = new Float32Array(weatherCount * 3);
    for (let i = 0; i < weatherCount; i++) {
      weatherPos[i * 3] = (Math.random() - 0.5) * 44;
      weatherPos[i * 3 + 1] = Math.random() * 22;
      weatherPos[i * 3 + 2] = (Math.random() - 0.5) * 44;
    }
    const weatherGeo = new THREE.BufferGeometry();
    weatherGeo.setAttribute('position', new THREE.BufferAttribute(weatherPos, 3));
    const weatherMat = new THREE.PointsMaterial({
      color: 0xbae6fd,
      size: 0.18,
      transparent: true,
      opacity: 0.75,
      depthWrite: false,
    });
    const weatherPoints = new THREE.Points(weatherGeo, weatherMat);
    weatherPoints.visible = false;
    scene.add(weatherPoints);

    sceneObjectsRef.current = {
      renderer,
      scene,
      camera,
      controls,
      architectureGroup,
      assetsGroup,
      openingsGroup,
      energyFlowGroup,
      avatarsGroup,
      skyboxGroup,
      skyDomeMat,
      sunOrbMesh,
      moonOrbMesh,
      starsPoints,
      cloudsGroup,
      weatherPoints,
      estateTerrain,
      archGrid,
      selectionRing,
      indoorWalls: [],
      roofGroups: [],
      poolWaterMaterials: [],
      zoneMaterialsMap: new Map(),
      assetMap: new Map(),
      assetZoneMap: new Map(),
      openingMap: new Map(),
      pointLightPool,
      alarmLight,
      focusSpotLight,
      sunLight,
      hemiLight,
      cameraTransitionActive: false,
      tourRoomZoneId: null,
      wakeUpUntil: performance.now() + 2000,
      shadowNeedsUpdate: true,
      maxAnisotropy: Math.min(renderer.capabilities.getMaxAnisotropy(), 4),
      isSoftwareGl,
    };

    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();
    const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const dragPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    let pointerDownPos = { x: 0, y: 0 };
    let activeDrag3D: {
      kind: 'asset' | 'opening';
      id: string;
      offsetX: number;
      offsetZ: number;
      planeY: number;
      lastCommitMs?: number;
      pendingAssetPos?: [number, number, number];
      pendingOpeningPatch?: Partial<WallOpening>;
    } | null = null;

    const handlePointerDown = (e: PointerEvent) => {
      pointerDownPos = { x: e.clientX, y: e.clientY };
      wakeUp();

      // In Editor mode (when not placing a new catalog item), allow direct 3D dragging of any Asset or Opening!
      if (stateRef.current.activeTab === 'editor' && !stateRef.current.pendingCatalogItem && e.button === 0) {
        const rect = renderer.domElement.getBoundingClientRect();
        mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
        raycaster.setFromCamera(mouse, camera);

        const targets = [...assetsGroup.children, ...openingsGroup.children];
        const hits = raycaster.intersectObjects(targets, true);
        if (hits.length > 0) {
          let obj: THREE.Object3D | null = hits[0].object;
          while (obj && !obj.userData?.isInteractiveAsset && !obj.userData?.isInteractiveOpening) {
            obj = obj.parent;
          }
          if (obj?.userData?.isInteractiveAsset) {
            const assetId = obj.userData.assetId as string;
            const asset = stateRef.current.project.assets.find((a) => a.id === assetId);
            if (asset) {
              stateRef.current.onSelectAsset(assetId, obj.userData.entityId);
              if (!asset.locked) {
                const planeY = obj.position.y;
                dragPlane.setComponents(0, 1, 0, -planeY);
                if (raycaster.ray.intersectPlane(dragPlane, _vec3)) {
                  activeDrag3D = {
                    kind: 'asset',
                    id: assetId,
                    offsetX: asset.position[0] - _vec3.x,
                    offsetZ: asset.position[2] - _vec3.z,
                    planeY,
                  };
                  controls.enabled = false;
                  setIsDragging3D(true);
                }
              }
            }
          } else if (obj?.userData?.isInteractiveOpening) {
            const openingId = obj.userData.openingId as string;
            const opening = stateRef.current.project.openings.find((o) => o.id === openingId);
            if (opening) {
              stateRef.current.onSelectOpening?.(openingId);
              if (!opening.locked) {
                const planeY = obj.position.y;
                dragPlane.setComponents(0, 1, 0, -planeY);
                if (raycaster.ray.intersectPlane(dragPlane, _vec3)) {
                  activeDrag3D = {
                    kind: 'opening',
                    id: openingId,
                    offsetX: opening.x - _vec3.x,
                    offsetZ: opening.z - _vec3.z,
                    planeY,
                  };
                  controls.enabled = false;
                  setIsDragging3D(true);
                }
              }
            }
          }
        }
      }
    };

    const handlePointerMove = (e: PointerEvent) => {
      if (!activeDrag3D) return;
      wakeUp();

      const rect = renderer.domElement.getBoundingClientRect();
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(mouse, camera);

      dragPlane.setComponents(0, 1, 0, -activeDrag3D.planeY);
      if (!raycaster.ray.intersectPlane(dragPlane, _vec3)) return;

      // Free smooth movement (0.02m precision), or 0.20m grid snap if holding Shift
      const precision = e.shiftKey ? 5 : 50;
      const newX = Math.round((_vec3.x + activeDrag3D.offsetX) * precision) / precision;
      const newZ = Math.round((_vec3.z + activeDrag3D.offsetZ) * precision) / precision;

      if (activeDrag3D.kind === 'asset') {
        const asset = stateRef.current.project.assets.find((a) => a.id === activeDrag3D!.id);
        if (!asset) return;
        let finalAssetX = newX;
        let finalAssetZ = newZ;

        // Magnetic end-to-end fence/hedge snapping in 3D view
        if (!e.shiftKey && isFenceOrHedgeAsset(asset.catalogId)) {
          const span =
            (asset.customWidth ?? getLinearAssetDefaultWidth(asset.catalogId)) *
            (asset.scale || 1);
          const halfSpan = span / 2;
          const cosR = Math.cos(asset.rotationY || 0);
          const sinR = Math.sin(asset.rotationY || 0);
          const myEnds: [number, number][] = [
            [finalAssetX - cosR * halfSpan, finalAssetZ + sinR * halfSpan],
            [finalAssetX + cosR * halfSpan, finalAssetZ - sinR * halfSpan],
          ];
          let bestDist = 0.55;
          let snapDelta: [number, number] | null = null;
          for (const other of stateRef.current.project.assets) {
            if (other.id === asset.id || !isFenceOrHedgeAsset(other.catalogId)) continue;
            if ((other.level ?? 0) !== (asset.level ?? 0)) continue;
            const oSpan =
              (other.customWidth ?? getLinearAssetDefaultWidth(other.catalogId)) *
              (other.scale || 1);
            const oHalf = oSpan / 2;
            const oCos = Math.cos(other.rotationY || 0);
            const oSin = Math.sin(other.rotationY || 0);
            const oEnds: [number, number][] = [
              [other.position[0] - oCos * oHalf, other.position[2] + oSin * oHalf],
              [other.position[0] + oCos * oHalf, other.position[2] - oSin * oHalf],
            ];
            for (const [mx, mz] of myEnds) {
              for (const [ox, oz] of oEnds) {
                const d = Math.hypot(mx - ox, mz - oz);
                if (d < bestDist) {
                  bestDist = d;
                  snapDelta = [ox - mx, oz - mz];
                }
              }
            }
          }
          if (snapDelta) {
            finalAssetX = +(finalAssetX + snapDelta[0]).toFixed(3);
            finalAssetZ = +(finalAssetZ + snapDelta[1]).toFixed(3);
          }
        }

        let finalAssetRotY = asset.rotationY || 0;

        // Magnetic wall-snap in 3D for Radiators, Acoustic Panels, and Wall-mounted assets
        if (
          !e.shiftKey &&
          (isRadiatorAsset(asset.catalogId) ||
            isAcousticPanelAsset(asset.catalogId) ||
            asset.mountType === 'wall')
        ) {
          const wallSnap = snapAssetToNearestRoomWall(
            finalAssetX,
            finalAssetZ,
            asset,
            stateRef.current.project.zones,
            undefined,
            0.65
          );
          if (wallSnap.snapped) {
            finalAssetX = wallSnap.position[0];
            finalAssetZ = wallSnap.position[1];
            finalAssetRotY = wallSnap.rotationY;
          }
        } else if (
          !e.shiftKey &&
          asset.category === 'furniture' &&
          !isFenceOrHedgeAsset(asset.catalogId)
        ) {
          // Hard wall collision stop for indoor furniture and stairs in 3D
          const [clampedX, clampedZ] = clampAssetPositionInsideRoomWalls(
            finalAssetX,
            finalAssetZ,
            asset.position[0],
            asset.position[2],
            { ...asset, rotationY: finalAssetRotY },
            stateRef.current.project.zones
          );
          finalAssetX = clampedX;
          finalAssetZ = clampedZ;
        }

        const grp = sceneObjectsRef.current.assetMap.get(activeDrag3D.id);
        if (grp) {
          grp.position.x = finalAssetX;
          grp.position.z = finalAssetZ;
          grp.rotation.y = finalAssetRotY;
        }
        if (sceneObjectsRef.current.selectionRing) {
          sceneObjectsRef.current.selectionRing.position.x = finalAssetX;
          sceneObjectsRef.current.selectionRing.position.z = finalAssetZ;
        }
        activeDrag3D.pendingAssetPos = [finalAssetX, asset.position[1], finalAssetZ];
        const nowDrag = performance.now();
        if (nowDrag - (activeDrag3D.lastCommitMs ?? 0) >= 48) {
          activeDrag3D.lastCommitMs = nowDrag;
          stateRef.current.onUpdateAsset?.(activeDrag3D.id, {
            position: activeDrag3D.pendingAssetPos,
            rotationY: finalAssetRotY,
          });
        }
      } else if (activeDrag3D.kind === 'opening') {
        const opening = stateRef.current.project.openings.find((o) => o.id === activeDrag3D!.id);
        let finalX = newX;
        let finalZ = newZ;
        let finalRotY = opening?.rotationY ?? 0;

        // Snap opening smoothly to any nearby indoor wall (rectangular or freeform polygon) unless Shift is held
        if (opening && !e.shiftKey) {
          const opLevel = opening.level ?? 0;
          const halfSpan = Math.max(0.18, opening.width / 2);
          let bestDist = 0.85;
          for (const z of stateRef.current.project.zones) {
            if (z.zoneType !== 'indoor' || (z.level ?? 0) !== opLevel) continue;
            const segments: [number, number, number, number][] = [];
            const zCorners = getZoneCorners(z);
            for (let i = 0; i < zCorners.length; i++) {
              const p1 = zCorners[i];
              const p2 = zCorners[(i + 1) % zCorners.length];
              segments.push([p1[0], p1[1], p2[0], p2[1]]);
            }
            for (const [x1, z1, x2, z2] of segments) {
              const dx = x2 - x1;
              const dz = z2 - z1;
              const segLen = Math.hypot(dx, dz);
              if (segLen < 0.3) continue;
              const tRaw = ((newX - x1) * dx + (newZ - z1) * dz) / (segLen * segLen);
              const margin = Math.min(0.42, halfSpan / segLen);
              const t = Math.max(margin, Math.min(1 - margin, tRaw));
              const projX = x1 + t * dx;
              const projZ = z1 + t * dz;
              const dist = Math.hypot(newX - projX, newZ - projZ);
              if (dist < bestDist) {
                bestDist = dist;
                finalX = Math.round(projX * 50) / 50;
                finalZ = Math.round(projZ * 50) / 50;
                if (Math.abs(dz) < 0.01) {
                  finalRotY = 0;
                } else if (Math.abs(dx) < 0.01) {
                  finalRotY = Math.PI / 2;
                } else {
                  finalRotY = -Math.atan2(dz, dx);
                }
              }
            }
          }
        }

        const grp = sceneObjectsRef.current.openingMap.get(activeDrag3D.id);
        if (grp) {
          grp.position.x = finalX;
          grp.position.z = finalZ;
          grp.rotation.y = finalRotY;
        }
        activeDrag3D.pendingOpeningPatch = {
          x: finalX,
          z: finalZ,
          rotationY: finalRotY,
        };
        const nowDrag = performance.now();
        if (nowDrag - (activeDrag3D.lastCommitMs ?? 0) >= 60) {
          activeDrag3D.lastCommitMs = nowDrag;
          stateRef.current.onUpdateOpening?.(activeDrag3D.id, activeDrag3D.pendingOpeningPatch);
        }
      }
      sceneObjectsRef.current.shadowNeedsUpdate = true;
    };

    const handlePointerUp = (e: PointerEvent) => {
      wakeUp();
      if (activeDrag3D) {
        if (activeDrag3D.kind === 'asset' && activeDrag3D.pendingAssetPos) {
          stateRef.current.onUpdateAsset?.(activeDrag3D.id, {
            position: activeDrag3D.pendingAssetPos,
          });
        } else if (activeDrag3D.kind === 'opening' && activeDrag3D.pendingOpeningPatch) {
          stateRef.current.onUpdateOpening?.(activeDrag3D.id, activeDrag3D.pendingOpeningPatch);
        }
        activeDrag3D = null;
        controls.enabled = true;
        setIsDragging3D(false);
        const dragDist = Math.hypot(e.clientX - pointerDownPos.x, e.clientY - pointerDownPos.y);
        if (dragDist > 5) return;
      }

      const dist = Math.hypot(e.clientX - pointerDownPos.x, e.clientY - pointerDownPos.y);
      if (dist > 6) return;

      const rect = renderer.domElement.getBoundingClientRect();
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(mouse, camera);

      if (stateRef.current.activeTab === 'editor' && stateRef.current.pendingCatalogItem) {
        const placeLevel =
          stateRef.current.activeFloor === 'all_stacked' ? 0 : stateRef.current.activeFloor;
        dragPlane.setComponents(0, 1, 0, -(placeLevel * FLOOR_HEIGHT));
        if (raycaster.ray.intersectPlane(dragPlane, _vec3)) {
          const snappedX = Math.round(_vec3.x * 20) / 20;
          const snappedZ = Math.round(_vec3.z * 20) / 20;
          stateRef.current.onPlaceCatalogItemAt(snappedX, snappedZ);
        }
        return;
      }

      const targets = [...assetsGroup.children, ...openingsGroup.children];
      const hits = raycaster.intersectObjects(targets, true);
      if (hits.length > 0) {
        let obj: THREE.Object3D | null = hits[0].object;
        while (obj && !obj.userData?.isInteractiveAsset && !obj.userData?.isInteractiveOpening) {
          obj = obj.parent;
        }
        if (obj?.userData?.isInteractiveAsset) {
          stateRef.current.onSelectAsset(obj.userData.assetId, obj.userData.entityId);
          return;
        }
        if (obj?.userData?.isInteractiveOpening && obj.userData.openingId) {
          stateRef.current.onSelectOpening?.(obj.userData.openingId);
          return;
        }
      }

      if (stateRef.current.activeTab === 'editor') {
        const zoneHits = raycaster.intersectObjects(architectureGroup.children, true);
        const wallHit = zoneHits.find((h) => h.object.userData?.customWallId);
        if (wallHit && stateRef.current.onSelectWall) {
          stateRef.current.onSelectWall(wallHit.object.userData.customWallId);
          return;
        }
        const floorHits = zoneHits.filter((h) => Boolean(h.object.userData?.zoneId));
        if (floorHits.length > 0) {
          // Prefer interior room hits over parent Wohnraum/Nebengebäude hull hits when overlapping
          const bestFloorHit =
            floorHits.find((h) => h.object.userData?.isInteriorRoom) || floorHits[0];
          stateRef.current.onSelectZone(bestFloorHit.object.userData.zoneId);
          return;
        }
      }

      stateRef.current.onSelectAsset(null, undefined);
    };

    let lastUserInteractionTime = performance.now();
    const recordUserActivity = () => {
      lastUserInteractionTime = performance.now();
      if (stateRef.current.cameraIdleMode && stateRef.current.onChangeCameraIdleMode) {
        stateRef.current.onChangeCameraIdleMode(false);
      }
      wakeUp();
    };

    renderer.domElement.addEventListener('pointerdown', (ev) => {
      recordUserActivity();
      handlePointerDown(ev);
    });
    renderer.domElement.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    renderer.domElement.addEventListener('wheel', recordUserActivity, { passive: true });

    const handleResize = () => {
      if (!container) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      if (w === 0 || h === 0) return;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
      sceneObjectsRef.current.shadowNeedsUpdate = true;
      wakeUp();
    };
    window.addEventListener('resize', handleResize);
    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(container);

    const clock = new THREE.Clock();
    let frameId = 0;
    let idleTimeoutId = 0;
    let lastBadgeUpdate = 0;
    let lastEcoFrameTime = 0;
    let prevSunHour = -1;
    let prevNorthAngle = -999;

    function afterDraw(cb: () => void) {
      const gl = renderer.getContext() as WebGL2RenderingContext;
      const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      gl.flush();
      const poll = () => {
        const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
        if (state === gl.UNSIGNALED) {
          frameId = window.setTimeout(poll, 5);
        } else {
          if (sync) gl.deleteSync(sync);
          frameId = window.setTimeout(cb, 80);
        }
      };
      frameId = window.setTimeout(poll, 5);
    }

    function tick() {
      const now = performance.now();
      const st = stateRef.current;
      const refs = sceneObjectsRef.current;

      // Eco mode caps frame rate at ~30 FPS to keep tablets & low-power laptops cool
      if (st.performanceMode === 'eco' && now - lastEcoFrameTime < 31) {
        frameId = requestAnimationFrame(tick);
        return;
      }
      lastEcoFrameTime = now;

      const dt = Math.min(clock.getDelta(), 0.1);
      const elapsed = clock.getElapsedTime();
      let isAnimating = false;

      // 1. Smooth Camera Preset / Room Focus Damping + Multi-Room Interior & Building Camera Tour
      if (refs.cameraTransitionActive) {
        refs.tourRoomZoneId = null;
        camera.position.lerp(_targetCamPos, 1 - Math.exp(-6.0 * dt));
        controls.target.lerp(_targetLookAt, 1 - Math.exp(-6.0 * dt));
        if (camera.position.distanceTo(_targetCamPos) < 0.05) {
          refs.cameraTransitionActive = false;
        } else {
          isAnimating = true;
        }
      } else {
        const isIdleOrbit =
          Boolean(st.cameraIdleMode) ||
          (Boolean(st.autoIdleAfterInactivity) && now - lastUserInteractionTime > 25000);
        if (isIdleOrbit && !activeDrag3D) {
          const indoorTourZones = st.project.zones
            .filter(
              (z) =>
                z.zoneType === 'indoor' &&
                (st.activeFloor === 'all_stacked' || (z.level ?? 0) === st.activeFloor)
            )
            .sort((a, b) => (a.level ?? 0) - (b.level ?? 0));

          // Compute overall building center for the exterior overview waypoint
          let minX = -6,
            maxX = 6,
            minZ = -6,
            maxZ = 6;
          if (indoorTourZones.length > 0) {
            minX = Infinity;
            maxX = -Infinity;
            minZ = Infinity;
            maxZ = -Infinity;
            for (const tz of indoorTourZones) {
              minX = Math.min(minX, tz.x - tz.width / 2);
              maxX = Math.max(maxX, tz.x + tz.width / 2);
              minZ = Math.min(minZ, tz.z - tz.depth / 2);
              maxZ = Math.max(maxZ, tz.z + tz.depth / 2);
            }
          }
          const cx = (minX + maxX) / 2;
          const cz = (minZ + maxZ) / 2;
          const spanAll = Math.max(10, maxX - minX, maxZ - minZ);

          // Build tour waypoints: [Exterior Overview, ...each Indoor Room (gliding right inside the buildings!), Exterior Back/Garden]
          const waypoints: {
            cam: [number, number, number];
            target: [number, number, number];
            zoneId: string | null;
          }[] = [
            {
              cam: [
                cx + Math.sin(elapsed * 0.22) * spanAll * 0.95,
                Math.max(10.5, spanAll * 0.72),
                cz + Math.cos(elapsed * 0.22) * spanAll * 0.95,
              ],
              target: [cx, 1.4, cz],
              zoneId: null,
            },
          ];

          for (let i = 0; i < indoorTourZones.length; i++) {
            const rz = indoorTourZones[i];
            const rLevel = rz.level ?? 0;
            const rPlinth = rLevel >= 0 ? (rz.plinthHeight ?? 0) : 0;
            const yOff = rLevel * FLOOR_HEIGHT + rPlinth;
            const rSpan = Math.max(3.2, Math.max(rz.width, rz.depth));
            const sway = Math.sin(elapsed * 0.32 + i) * (rSpan * 0.18);
            waypoints.push({
              cam: [
                rz.x + sway,
                yOff + Math.min(3.5, Math.max(2.45, rSpan * 0.54)),
                rz.z + Math.max(3.0, rSpan * 0.7),
              ],
              target: [rz.x - sway * 0.2, yOff + 1.0, rz.z - 0.25],
              zoneId: rz.id,
            });
          }

          const stepDuration = 10.5; // Calmer, slower 10.5s per room/building stop
          const wpIndex = Math.floor(elapsed / stepDuration) % waypoints.length;
          const activeWp = waypoints[wpIndex];
          refs.tourRoomZoneId = activeWp.zoneId;

          _vec3.set(activeWp.cam[0], activeWp.cam[1], activeWp.cam[2]);
          camera.position.lerp(_vec3, 1 - Math.exp(-0.95 * dt));
          _vec3.set(activeWp.target[0], activeWp.target[1], activeWp.target[2]);
          controls.target.lerp(_vec3, 1 - Math.exp(-1.25 * dt));
          camera.lookAt(controls.target);
          isAnimating = true;
        } else {
          refs.tourRoomZoneId = null;
          if (st.autoIdleAfterInactivity) {
            // Keep loop alive at low frequency so auto-idle starts promptly after 25s
            isAnimating = true;
          }
        }
      }
      if (controls.update()) {
        isAnimating = true;
      }

      // 2. Day/Night Sun Trajectory rotated by Project North Compass (Nordstern) & Room Focus Dimming
      const hour = st.sunHour;
      const northAngleDeg = st.project.northAngle ?? 0;
      const northRad = THREE.MathUtils.degToRad(northAngleDeg);
      const cosN = Math.cos(northRad);
      const sinN = Math.sin(northRad);
      const sunAngle = ((hour - 6) / 12) * Math.PI;
      const elevation = Math.sin(sunAngle);
      const horiz = Math.cos(sunAngle);
      const baseSunX = -horiz * 18;
      const baseSunZ = 11;
      const rotSunX = baseSunX * cosN - baseSunZ * sinN;
      const rotSunZ = baseSunX * sinN + baseSunZ * cosN;
      if (
        Math.abs(hour - prevSunHour) > 0.005 ||
        Math.abs(northAngleDeg - prevNorthAngle) > 0.1
      ) {
        prevSunHour = hour;
        prevNorthAngle = northAngleDeg;
        sunLight.position.set(rotSunX, Math.max(2.5, elevation * 22), rotSunZ);
        refs.shadowNeedsUpdate = true;
      }

      const dayFactor = THREE.MathUtils.clamp(elevation, 0, 1);
      const goldenFactor = THREE.MathUtils.clamp(1 - Math.abs(elevation - 0.18) * 3.5, 0, 1);
      const isRoomFocused = Boolean(st.focusedZoneId);

      // Visual Style & Atmospheric Skybox Colors
      if (st.visualStyle === 'blueprint') {
        _currentSky.setHex(0x0a1e3c);
      } else if (st.visualStyle === 'neon') {
        _currentSky.setHex(0x040711);
      } else {
        _currentSky.copy(_skyNight).lerp(_skyClearDay, dayFactor);
        if (goldenFactor > 0.05 && elevation > -0.15) {
          _currentSky.lerp(_skyGolden, goldenFactor * 0.52);
        }
      }
      if (isRoomFocused) {
        _currentSky.lerp(_skyFocusDim, 0.72);
      }
      scene.background = _currentSky;
      if (scene.fog instanceof THREE.FogExp2) {
        scene.fog.color.copy(_currentSky);
      }

      // Sync 3D Skybox Dome, Sun, Moon, Stars & Drifting Clouds
      if (refs.skyboxGroup) {
        refs.skyboxGroup.visible = !isRoomFocused;
        if (refs.skyDomeMat) {
          refs.skyDomeMat.color.copy(_currentSky);
        }
        if (refs.sunOrbMesh) {
          refs.sunOrbMesh.visible = elevation > -0.08 && st.visualStyle === 'archviz';
          const sx = -horiz * 92;
          const sz = -45;
          refs.sunOrbMesh.position.set(
            sx * cosN - sz * sinN,
            Math.max(-8, elevation * 88),
            sx * sinN + sz * cosN
          );
        }
        if (refs.moonOrbMesh) {
          refs.moonOrbMesh.visible = elevation <= 0.05 && st.visualStyle !== 'blueprint';
          const mx = horiz * 88;
          const mz = -48;
          refs.moonOrbMesh.position.set(
            mx * cosN - mz * sinN,
            Math.max(14, -elevation * 78 + 22),
            mx * sinN + mz * cosN
          );
        }
        if (refs.starsPoints) {
          const starMat = refs.starsPoints.material as THREE.PointsMaterial;
          starMat.opacity =
            st.visualStyle === 'neon'
              ? 0.85
              : THREE.MathUtils.clamp(1 - dayFactor * 2.2, 0, 0.88);
        }
        if (refs.cloudsGroup) {
          const wMode = st.weatherMode || 'auto_sun';
          refs.cloudsGroup.visible =
            st.visualStyle === 'archviz' && wMode !== 'clear';
          refs.cloudsGroup.rotation.y = elapsed * 0.008;
        }
      }

      // Animate 3D Rain / Snow Weather Particles
      if (refs.weatherPoints) {
        const wMode = st.weatherMode || 'auto_sun';
        const isRain = wMode === 'rain';
        const isSnow = wMode === 'snow';
        refs.weatherPoints.visible = !isRoomFocused && (isRain || isSnow);
        if (refs.weatherPoints.visible) {
          isAnimating = true;
          const pMat = refs.weatherPoints.material as THREE.PointsMaterial;
          pMat.color.setHex(isSnow ? 0xffffff : 0x7dd3fc);
          pMat.size = isSnow ? 0.24 : 0.14;
          const posAttr = refs.weatherPoints.geometry.getAttribute(
            'position'
          ) as THREE.BufferAttribute;
          const fallSpeed = isSnow ? 2.4 : 14.5;
          for (let i = 0; i < posAttr.count; i++) {
            let py = posAttr.getY(i) - fallSpeed * dt;
            let px = posAttr.getX(i);
            if (isSnow) {
              px += Math.sin(elapsed * 1.5 + i) * 0.6 * dt;
            }
            if (py < 0) {
              py = 21;
            }
            posAttr.setXY(i, px, py);
          }
          posAttr.needsUpdate = true;
        }
      }

      const globalLightScale = isRoomFocused ? 0.2 : 1.0;
      const targetSunInt = THREE.MathUtils.lerp(0.06, 1.28, dayFactor) * globalLightScale;
      const targetHemiInt = THREE.MathUtils.lerp(0.11, 0.38, dayFactor) * globalLightScale;
      if (Math.abs(sunLight.intensity - targetSunInt) > 0.01) isAnimating = true;
      sunLight.intensity = THREE.MathUtils.damp(sunLight.intensity, targetSunInt, 6, dt);
      hemiLight.intensity = THREE.MathUtils.damp(hemiLight.intensity, targetHemiInt, 6, dt);

      // Dedicated Room Focus Spotlight overhead
      if (refs.focusSpotLight) {
        const focusedZone = st.focusedZoneId
          ? st.project.zones.find((z) => z.id === st.focusedZoneId)
          : null;
        if (focusedZone) {
          const zLevelOffset =
            st.activeFloor === 'all_stacked' ? (focusedZone.level ?? 0) * FLOOR_HEIGHT : 0;
          refs.focusSpotLight.position.set(
            focusedZone.x,
            zLevelOffset + 8.8,
            focusedZone.z + 1.5
          );
          refs.focusSpotLight.target.position.set(focusedZone.x, zLevelOffset, focusedZone.z);
          refs.focusSpotLight.angle = Math.max(
            Math.PI / 5,
            Math.atan2(Math.max(focusedZone.width, focusedZone.depth) * 0.85, 8.8)
          );
          refs.focusSpotLight.intensity = THREE.MathUtils.damp(
            refs.focusSpotLight.intensity,
            1.65,
            6,
            dt
          );
        } else {
          refs.focusSpotLight.intensity = THREE.MathUtils.damp(
            refs.focusSpotLight.intensity,
            0,
            6,
            dt
          );
        }
        refs.focusSpotLight.visible = refs.focusSpotLight.intensity > 0.015;
      }

      // 3. Animate Pool Water Caustics & Underwater RGB Illumination
      const poolLightEnt = st.entities['light.pool_unterwasser_rgb'];
      const isPoolLightOn = poolLightEnt && poolLightEnt.state === 'on';
      const [poolR, poolG, poolB] = poolLightEnt?.attributes.rgb_color || [14, 165, 233];
      const poolBri = ((poolLightEnt?.attributes.brightness ?? 245) / 255) * (isPoolLightOn ? 1 : 0);

      for (const waterMat of refs.poolWaterMaterials) {
        if (waterMat.map) {
          waterMat.map.offset.x = (elapsed * 0.024) % 1;
          waterMat.map.offset.y = Math.sin(elapsed * 0.65) * 0.018;
        }
        if (waterMat.bumpMap) {
          waterMat.bumpMap.offset.x = (-elapsed * 0.019) % 1;
          waterMat.bumpMap.offset.y = Math.cos(elapsed * 0.55) * 0.016;
        }
        if (isPoolLightOn) {
          waterMat.emissive.setRGB(poolR / 255, poolG / 255, poolB / 255);
          waterMat.emissiveIntensity = 0.25 + poolBri * 0.42;
        } else {
          waterMat.emissive.setHex(0x0369a1);
          waterMat.emissiveIntensity = 0.12 * dayFactor;
        }
      }

      // 4. Compute Active Room Lighting per Zone & Drive Per-Fixture Pooled PointLights
      const candidateLights: {
        x: number;
        y: number;
        z: number;
        r: number;
        g: number;
        b: number;
        intensity: number;
        distance: number;
      }[] = [];

      // Collect every active light fixture at its exact 3D world coordinates (Indoor + Outdoor + Pool + Street Lamps!)
      const isDuskOrNight = hour < 7.2 || hour > 18.2;
      for (const asset of st.project.assets) {
        const assetLevel = asset.level ?? 0;
        const isKellertreppeOrBasementStair =
          isKellertreppeAsset(asset) || (isStairAsset(asset.catalogId) && assetLevel === -1);
        if (
          st.activeFloor !== 'all_stacked' &&
          assetLevel !== st.activeFloor &&
          !(st.activeFloor === 0 && isKellertreppeOrBasementStair)
        ) {
          continue;
        }
        const isStreetLamp = isStreetLampAsset(asset.catalogId);
        // Street lamps strictly only turn on at dusk/night!
        if (isStreetLamp && !isDuskOrNight) continue;
        const isOutdoorBollard =
          asset.catalogId === 'garden_bollard_light' ||
          asset.catalogId === 'outdoor_bollard_corten_louvre' ||
          asset.catalogId === 'outdoor_path_mushroom_modern' ||
          asset.catalogId === 'outdoor_solar_stone_globe';
        if (isOutdoorBollard && !asset.entityId && !isDuskOrNight) continue;
        const ent = asset.entityId
          ? st.entities[asset.entityId]
          : isStreetLamp
          ? st.entities['light.strassenbeleuchtung']
          : undefined;
        // Street lamps & unbound garden bollards turn on automatically at night
        const autoNightLampOn =
          isDuskOrNight &&
          ((isStreetLamp && (!ent || ent.state !== 'off')) ||
            (isOutdoorBollard && !asset.entityId));
        if (!autoNightLampOn && (!ent || ent.domain !== 'light' || ent.state !== 'on')) continue;

        const assetZoneId = refs.assetZoneMap.get(asset.id);
        const isLightInFocusedZone = !st.focusedZoneId || assetZoneId === st.focusedZoneId;
        const bRatio = ent ? (ent.attributes.brightness ?? 255) / 255 : 0.96;
        const [r, g, b] = ent?.attributes.rgb_color || [255, 214, 153];
        const grp = refs.assetMap.get(asset.id);
        const emissionOffsetX = (grp?.userData?.lightEmissionOffsetX as number | undefined) ?? 0;
        const emissionOffsetY = (grp?.userData?.lightEmissionOffsetY as number | undefined) ?? -0.25;
        const emissionOffsetZ = (grp?.userData?.lightEmissionOffsetZ as number | undefined) ?? 0;
        const yLevelOff = st.activeFloor === 'all_stacked' ? assetLevel * FLOOR_HEIGHT : 0;
        const rotY = asset.rotationY || 0;
        const sc = asset.scale || 1;
        const worldOffX =
          (emissionOffsetX * Math.cos(rotY) + emissionOffsetZ * Math.sin(rotY)) * sc;
        const worldOffZ =
          (-emissionOffsetX * Math.sin(rotY) + emissionOffsetZ * Math.cos(rotY)) * sc;

        const isPoolLight = asset.catalogId === 'pool_underwater_light';
        const baseMaxInt = isPoolLight
          ? 2.8
          : isStreetLamp
          ? 2.6
          : isOutdoorBollard
          ? 1.9
          : asset.lightConfig?.maxIntensity
          ? Math.min(2.6, asset.lightConfig.maxIntensity * 0.42)
          : 2.1;
        const dist = isPoolLight
          ? 8.5
          : isStreetLamp
          ? 12.5
          : isOutdoorBollard
          ? 6.5
          : asset.lightConfig?.distance || 8.5;

        candidateLights.push({
          x: asset.position[0] + worldOffX,
          y: Math.max(0.25, yLevelOff + asset.position[1] + emissionOffsetY * sc),
          z: asset.position[2] + worldOffZ,
          r: r / 255,
          g: g / 255,
          b: b / 255,
          intensity: bRatio * baseMaxInt * (isLightInFocusedZone ? 1.0 : 0.15),
          distance: dist,
        });
      }

      // Pre-aggregate room lighting in a single O(Assets) pass instead of O(Zones * Assets)
      const zoneLightStats = new Map<
        string,
        { maxRatio: number; sumR: number; sumG: number; sumB: number; count: number }
      >();
      for (const asset of st.project.assets) {
        if (!asset.entityId) continue;
        const zId = refs.assetZoneMap.get(asset.id);
        if (!zId) continue;
        const ent = st.entities[asset.entityId];
        if (ent && ent.domain === 'light' && ent.state === 'on') {
          const bRatio = (ent.attributes.brightness ?? 255) / 255;
          const [r, g, b] = ent.attributes.rgb_color || [255, 214, 153];
          let entry = zoneLightStats.get(zId);
          if (!entry) {
            entry = { maxRatio: 0, sumR: 0, sumG: 0, sumB: 0, count: 0 };
            zoneLightStats.set(zId, entry);
          }
          if (bRatio > entry.maxRatio) entry.maxRatio = bRatio;
          entry.sumR += r / 255;
          entry.sumG += g / 255;
          entry.sumB += b / 255;
          entry.count++;
        }
      }

      const zoneTypeById = new Map<string, 'indoor' | 'outdoor'>();
      for (const z of st.project.zones) {
        zoneTypeById.set(z.id, z.zoneType);
      }

      for (const [zId, matEntries] of refs.zoneMaterialsMap.entries()) {
        const zType = zoneTypeById.get(zId);
        const isThisFocused = !st.focusedZoneId || st.focusedZoneId === zId;
        const lightStat = zoneLightStats.get(zId);

        // Update only the 2-3 shared materials per zone instead of 20+ cloned meshes!
        for (const entry of matEntries) {
          if (entry.isHeatmapColored) continue;
          _targetMeshColor.copy(entry.baseColor);

          if (zType === 'indoor') {
            if (lightStat && lightStat.count > 0) {
              _roomLightTint.setRGB(
                lightStat.sumR / lightStat.count,
                lightStat.sumG / lightStat.count,
                lightStat.sumB / lightStat.count
              );
              _targetMeshColor.lerp(_roomLightTint, lightStat.maxRatio * 0.22);
              _targetMeshColor.multiplyScalar(1.0 + lightStat.maxRatio * 0.2);
            } else {
              const unlitShade = THREE.MathUtils.lerp(0.5, 0.78, dayFactor);
              _targetMeshColor.multiplyScalar(unlitShade);
            }
          }

          if (!isThisFocused) {
            _targetMeshColor.multiplyScalar(0.18);
          }
          entry.mat.color.lerp(_targetMeshColor, 1 - Math.exp(-7 * dt));
        }
      }

      // Assign the top MAX_POOLED_POINT_LIGHTS active fixtures to the hardware PointLight pool
      const maxActivePool = st.performanceMode === 'eco' ? 4 : MAX_POOLED_POINT_LIGHTS;
      candidateLights.sort((a, b) => b.intensity - a.intensity);
      for (let i = 0; i < refs.pointLightPool.length; i++) {
        const pt = refs.pointLightPool[i];
        const cand = i < maxActivePool ? candidateLights[i] : undefined;
        if (cand && cand.intensity > 0.02) {
          pt.visible = true;
          pt.position.set(cand.x, cand.y, cand.z);
          pt.color.setRGB(cand.r, cand.g, cand.b);
          pt.distance = cand.distance;
          pt.intensity = THREE.MathUtils.damp(pt.intensity, cand.intensity, 8, dt);
        } else {
          pt.intensity = THREE.MathUtils.damp(pt.intensity, 0, 8, dt);
          pt.visible = pt.intensity > 0.015;
        }
      }

      // 4. Camera-Direction-Aware Wall Cutaway, Room Focus & Interior Camera Tour Wall Lowering
      const activeInspectZoneId = st.focusedZoneId || refs.tourRoomZoneId;
      const inspectedZoneObj = activeInspectZoneId
        ? st.project.zones.find((z) => z.id === activeInspectZoneId) || null
        : null;

      // Helper: determine whether a world point (wx, wz) sits on a camera-facing (lowered) wall of `zone`
      const isPointOnCameraFacingWall = (
        wx: number,
        wz: number,
        zone: FloorplanZone
      ): boolean => {
        const corners = getZoneCorners(zone);
        if (corners.length < 3) return false;
        let bestDist = Infinity;
        let bestOutNx = 0;
        let bestOutNz = 1;
        let bestMidX = zone.x;
        let bestMidZ = zone.z;

        for (let i = 0; i < corners.length; i++) {
          const p1 = corners[i];
          const p2 = corners[(i + 1) % corners.length];
          const dx = p2[0] - p1[0];
          const dz = p2[1] - p1[1];
          const len = Math.hypot(dx, dz);
          if (len < 0.1) continue;
          const t = Math.max(0, Math.min(1, ((wx - p1[0]) * dx + (wz - p1[1]) * dz) / (len * len)));
          const projX = p1[0] + t * dx;
          const projZ = p1[1] + t * dz;
          const dist = Math.hypot(wx - projX, wz - projZ);
          if (dist < bestDist) {
            bestDist = dist;
            const midX = (p1[0] + p2[0]) / 2;
            const midZ = (p1[1] + p2[1]) / 2;
            let outNx = -dz / len;
            let outNz = dx / len;
            // Ensure (outNx, outNz) points OUTWARD away from room center (zone.x, zone.z)
            if (outNx * (midX - zone.x) + outNz * (midZ - zone.z) < 0) {
              outNx = -outNx;
              outNz = -outNz;
            }
            bestOutNx = outNx;
            bestOutNz = outNz;
            bestMidX = midX;
            bestMidZ = midZ;
          }
        }
        if (bestDist > 0.62) return false;
        const toCamX = camera.position.x - bestMidX;
        const toCamZ = camera.position.z - bestMidZ;
        const camLen = Math.hypot(toCamX, toCamZ) || 1;
        const dotCam = (toCamX / camLen) * bestOutNx + (toCamZ / camLen) * bestOutNz;
        return dotCam > 0.15;
      };

      for (const wallMesh of refs.indoorWalls) {
        const wallZoneId = wallMesh.userData.zoneId as string | undefined;
        const wCx = (wallMesh.userData.wallCenterX as number) ?? wallMesh.position.x;
        const wCz = (wallMesh.userData.wallCenterZ as number) ?? wallMesh.position.z;
        const wNx = (wallMesh.userData.wallNormalX as number) ?? 0;
        const wNz = (wallMesh.userData.wallNormalZ as number) ?? 1;
        const toCamX = camera.position.x - wCx;
        const toCamZ = camera.position.z - wCz;
        const camLen = Math.hypot(toCamX, toCamZ) || 1;
        const dotCam = (toCamX / camLen) * wNx + (toCamZ / camLen) * wNz;
        const isCameraFacingWall = dotCam > 0.15;

        // Shared partition walls between two rooms may belong to the adjacent room (seamless wall deduplication)
        // and have their normal pointing INTO the inspected room. Check geometry relative to inspectedZoneObj!
        let isFrontWallOfInspectedRoom = false;
        let isBlockingTourLineOfSight = false;
        if (inspectedZoneObj) {
          const touchesInspectedRoom =
            wallZoneId === inspectedZoneObj.id ||
            (Math.abs(wCx - inspectedZoneObj.x) <= inspectedZoneObj.width / 2 + 0.38 &&
              Math.abs(wCz - inspectedZoneObj.z) <= inspectedZoneObj.depth / 2 + 0.38);

          if (touchesInspectedRoom) {
            // Vector from the inspected room center to this wall segment
            const outRx = wCx - inspectedZoneObj.x;
            const outRz = wCz - inspectedZoneObj.z;
            const outLen = Math.hypot(outRx, outRz) || 1;
            const roomToCamX = camera.position.x - inspectedZoneObj.x;
            const roomToCamZ = camera.position.z - inspectedZoneObj.z;
            const roomToCamLen = Math.hypot(roomToCamX, roomToCamZ) || 1;
            const dotRoomCam =
              (outRx / outLen) * (roomToCamX / roomToCamLen) +
              (outRz / outLen) * (roomToCamZ / roomToCamLen);
            // If this wall is on the camera-facing side of the inspected room, lower it so the room is never blocked!
            if (dotRoomCam > 0.12) {
              isFrontWallOfInspectedRoom = true;
            }
          }

          if (refs.tourRoomZoneId) {
            const segX = inspectedZoneObj.x - camera.position.x;
            const segZ = inspectedZoneObj.z - camera.position.z;
            const segLenSq = segX * segX + segZ * segZ;
            if (segLenSq > 0.25) {
              // Project wall center onto the 2D line segment from camera -> inspected room center
              const tProj = ((wCx - camera.position.x) * segX + (wCz - camera.position.z) * segZ) / segLenSq;
              if (tProj > 0.1 && tProj < 1.02) {
                const closestX = camera.position.x + tProj * segX;
                const closestZ = camera.position.z + tProj * segZ;
                const perpDist = Math.hypot(wCx - closestX, wCz - closestZ);
                const corridorHalfW = Math.max(inspectedZoneObj.width, inspectedZoneObj.depth) * 0.68;
                if (perpDist <= corridorHalfW) {
                  isBlockingTourLineOfSight = true;
                }
              }
            }
          }
        }

        // During Room Focus, lower other rooms' walls AND the camera-facing walls of the focused room
        const shouldLowerForFocus =
          Boolean(st.focusedZoneId) &&
          (isFrontWallOfInspectedRoom ||
            (wallZoneId === st.focusedZoneId ? isCameraFacingWall : true));

        // During Camera Tour (Kamerafahrt), lower front walls of the toured room (including shared partition walls!)
        // and any interior/exterior wall standing in the camera's sightline corridor
        const shouldLowerForTour =
          Boolean(refs.tourRoomZoneId) &&
          (isFrontWallOfInspectedRoom ||
            (wallZoneId === refs.tourRoomZoneId && isCameraFacingWall) ||
            isBlockingTourLineOfSight);

        const shouldLowerForCutaway = Boolean(st.wallCutaway) && isCameraFacingWall;

        const targetWallScaleY =
          shouldLowerForCutaway || shouldLowerForFocus || shouldLowerForTour ? 0.14 : 1.0;
        wallMesh.userData.isCurrentlyLowered = targetWallScaleY < 0.5;

        if (Math.abs(wallMesh.scale.y - targetWallScaleY) > 0.004) {
          wallMesh.scale.y = THREE.MathUtils.damp(wallMesh.scale.y, targetWallScaleY, 7, dt);
          const pieceH = wallMesh.userData.fullHeight || 2.6;
          const baseY = wallMesh.userData.baseY || 0;
          const yOffset = wallMesh.userData.yOffset || 0;
          if (baseY > 0.2) {
            wallMesh.visible = wallMesh.scale.y > 0.65;
            wallMesh.position.y = yOffset + baseY + (pieceH * wallMesh.scale.y) / 2;
          } else {
            wallMesh.visible = true;
            wallMesh.position.y = yOffset + baseY + (pieceH * wallMesh.scale.y) / 2;
          }
          isAnimating = true;
          refs.shadowNeedsUpdate = true;
        }
      }

      // 5. Sync Placed Assets (including Strictly Nighttime Street Lanterns & Selective Cutaway Hiding)
      let activeAlarmAssetPos: [number, number, number] | null = null;
      for (const asset of st.project.assets) {
        const group = refs.assetMap.get(asset.id);
        if (!group) continue;
        const isStreetLamp = isStreetLampAsset(asset.catalogId);
        const rawEntity = asset.entityId
          ? st.entities[asset.entityId]
          : isStreetLamp
          ? st.entities['light.strassenbeleuchtung']
          : undefined;
        const isOutdoorBollard =
          asset.catalogId === 'garden_bollard_light' ||
          asset.catalogId === 'outdoor_bollard_corten_louvre' ||
          asset.catalogId === 'outdoor_path_mushroom_modern' ||
          asset.catalogId === 'outdoor_solar_stone_globe';
        const isNightStreetOrGardenLamp =
          isDuskOrNight &&
          ((isStreetLamp && (!rawEntity || rawEntity.state !== 'off')) ||
            (isOutdoorBollard && !asset.entityId));
        // Street lamps strictly turn OFF during daytime (!isDuskOrNight), even if the entity is 'on'
        const entity: HAEntityState | undefined =
          isStreetLamp && !isDuskOrNight
            ? {
                entity_id: rawEntity?.entity_id || 'light.strassenbeleuchtung',
                domain: 'light',
                state: 'off',
                attributes: {
                  friendly_name: asset.name,
                  brightness: 0,
                  ...rawEntity?.attributes,
                },
              }
            : isNightStreetOrGardenLamp
            ? {
                entity_id: rawEntity?.entity_id || 'light.strassenbeleuchtung',
                domain: 'light',
                state: 'on',
                attributes: {
                  friendly_name: asset.name,
                  brightness: 245,
                  rgb_color: [255, 206, 135],
                  ...rawEntity?.attributes,
                },
              }
            : rawEntity;
        const assetZoneId = refs.assetZoneMap.get(asset.id);
        const isAssetInFocusedRoom =
          !st.focusedZoneId || assetZoneId === st.focusedZoneId;
        const dimFactor = isAssetInFocusedRoom ? 1.0 : 0.1;

        // Selective Hiding during Camera Tour / Room Focus / Wall Cutaway:
        // Hide ceiling-mounted assets (smoke detectors, ceiling lamps) in the inspected room so they don't float in mid-air,
        // and hide wall-mounted / wall-snapped assets (wall lamps, coat racks/wardrobes, radiators) ONLY if they sit on a lowered camera-facing wall!
        let shouldHideAssetForCutaway = false;
        if (inspectedZoneObj && assetZoneId === inspectedZoneObj.id) {
          const isCeilingItem =
            asset.mountType === 'ceiling' ||
            asset.catalogId === 'smoke_detector' ||
            asset.catalogId.includes('ceiling') ||
            asset.catalogId.includes('pendant') ||
            asset.catalogId.includes('recessed_spot');
          const isWallItem =
            asset.mountType === 'wall' ||
            isWallSnapAsset(asset) ||
            asset.catalogId === 'coat_rack_wardrobe' ||
            asset.catalogId.includes('wall_');
          if (isCeilingItem) {
            shouldHideAssetForCutaway = true;
          } else if (
            isWallItem &&
            isPointOnCameraFacingWall(asset.position[0], asset.position[2], inspectedZoneObj)
          ) {
            shouldHideAssetForCutaway = true;
          }
        } else if (st.wallCutaway && assetZoneId) {
          const hostZ = st.project.zones.find((z) => z.id === assetZoneId);
          if (hostZ) {
            const isWallItem =
              asset.mountType === 'wall' ||
              isWallSnapAsset(asset) ||
              asset.catalogId === 'coat_rack_wardrobe' ||
              asset.catalogId.includes('wall_');
            if (isWallItem && isPointOnCameraFacingWall(asset.position[0], asset.position[2], hostZ)) {
              shouldHideAssetForCutaway = true;
            }
          }
        }
        if (group.visible === shouldHideAssetForCutaway) {
          group.visible = !shouldHideAssetForCutaway;
          refs.shadowNeedsUpdate = true;
          isAnimating = true;
        }

        group.userData.customOpenPct = asset.customOpenPct;
        const assetMoving = updateAssetVisualState(
          group,
          entity,
          st.showSensorRadii,
          elapsed,
          dimFactor,
          dt,
          st.entities
        );
        if (assetMoving) {
          isAnimating = true;
          refs.shadowNeedsUpdate = true;
        }

        if (entity && (entity.state === 'open' || entity.state === 'on') && entity.domain === 'valve') {
          isAnimating = true;
        }

        if (
          entity &&
          (entity.attributes.device_class === 'smoke' ||
            entity.attributes.device_class === 'moisture') &&
          (entity.state === 'detected' || entity.attributes.alarm_test_active)
        ) {
          const yOff =
            st.activeFloor === 'all_stacked' ? (asset.level ?? 0) * FLOOR_HEIGHT : 0;
          activeAlarmAssetPos = [
            asset.position[0],
            asset.position[1] + yOff,
            asset.position[2],
          ];
          isAnimating = true;
        }
      }

      // 5B. Sync Roof Dormer Windows, Dormer Roller Shutters & Skylight Sashes + Temporarily hide roofs during Room Tour / Room Focus!
      for (const rg of refs.roofGroups) {
        const shouldHideRoofForTour = Boolean(activeInspectZoneId);
        if (rg.visible === shouldHideRoofForTour) {
          rg.visible = !shouldHideRoofForTour;
          refs.shadowNeedsUpdate = true;
          isAnimating = true;
        }
        const dUnits = rg.userData.dormerDynamicUnits as DormerDynamicUnitRef[] | undefined;
        if (dUnits && dUnits.length > 0 && rg.visible) {
          if (updateDormerDynamicUnits(dUnits, st.entities, dt)) {
            isAnimating = true;
            refs.shadowNeedsUpdate = true;
          }
        }
      }

      if (refs.alarmLight) {
        if (activeAlarmAssetPos) {
          refs.alarmLight.visible = true;
          refs.alarmLight.position.set(
            activeAlarmAssetPos[0],
            Math.max(0.6, activeAlarmAssetPos[1] - 0.15),
            activeAlarmAssetPos[2]
          );
          refs.alarmLight.intensity = Math.sin(elapsed * 14) > 0 ? 2.5 : 0.2;
        } else {
          refs.alarmLight.intensity = 0;
          refs.alarmLight.visible = false;
        }
      }

      // 6. Animate Doors, Two-Sensor Tilt/Open Windows, Handles, Patio Sliders, Sectional Garage Doors & Shutters
      const allowPreviewOverride = st.activeTab !== 'live';
      for (const opening of st.project.openings) {
        const opGroup = refs.openingMap.get(opening.id);
        if (!opGroup) continue;

        // Only hide doors, windows & gates that sit on a camera-facing lowered wall!
        // Windows, doors, and garage doors on the non-lowered back/side walls remain 100% visible!
        let shouldHideOpening = false;
        if (inspectedZoneObj) {
          const opLvl = opening.level ?? 0;
          const zLvl = inspectedZoneObj.level ?? 0;
          const inRoomX =
            Math.abs(opening.x - inspectedZoneObj.x) <= inspectedZoneObj.width / 2 + 0.55;
          const inRoomZ =
            Math.abs(opening.z - inspectedZoneObj.z) <= inspectedZoneObj.depth / 2 + 0.55;
          const inInspectedRoom = opLvl === zLvl && inRoomX && inRoomZ;

          if (st.focusedZoneId && !inInspectedRoom) {
            // In isolated Room Focus mode, hide openings belonging to other rooms
            shouldHideOpening = true;
          } else if (inInspectedRoom) {
            // Inside the focused or toured room: ONLY hide openings on the lowered camera-facing wall!
            shouldHideOpening = isPointOnCameraFacingWall(opening.x, opening.z, inspectedZoneObj);
          }
        } else if (st.wallCutaway) {
          const opLvl = opening.level ?? 0;
          const hostZ = findBestZoneForPoint(opening.x, opening.z, opLvl, st.project.zones);
          if (hostZ) {
            shouldHideOpening = isPointOnCameraFacingWall(opening.x, opening.z, hostZ);
          }
        }
        if (opGroup.visible === shouldHideOpening) {
          opGroup.visible = !shouldHideOpening;
          refs.shadowNeedsUpdate = true;
          isAnimating = true;
        }

        const primaryEntity = opening.entityId ? st.entities[opening.entityId] : undefined;
        const shutterEntity = opening.shutterEntityId
          ? st.entities[opening.shutterEntityId]
          : undefined;

        const resolvedState = resolveOpeningSensorState(
          opening,
          st.entities,
          allowPreviewOverride
        );
        const isOpen = resolvedState === 'open';
        const isTilted = resolvedState === 'tilted';
        const isControllable = isOpeningActuatorControllable(opening, st.entities);
        const hingeSign = (opening.hingeSide || 'left') === 'right' ? 1 : -1;
        const dirSign = (opening.openDirection || 'inward') === 'outward' ? 1 : -1;
        const swingSign = hingeSign * dirSign;

        // Continuous opening ratio (0.0 .. 1.0):
        // In Live view, read-only contact sensors (`!isControllable`) strictly follow the live HA sensor state (`isOpen ? 1 : 0`)
        // and never stay stuck open from a stale editor `openPositionPct`!
        const rawPosPct =
          (!allowPreviewOverride && !isControllable)
            ? isOpen
              ? 100
              : 0
            : opening.openPositionPct !== undefined
            ? opening.openPositionPct
            : primaryEntity?.attributes?.current_position !== undefined
            ? primaryEntity.attributes.current_position
            : isOpen
            ? 100
            : 0;
        const openRatio = isOpen
          ? Math.max(0.15, rawPosPct / 100)
          : allowPreviewOverride &&
            opening.openPositionPct !== undefined &&
            opening.openPositionPct > 0 &&
            !isTilted
          ? opening.openPositionPct / 100
          : 0;

        if (opGroup.userData.swingDoor) {
          const targetRot =
            openRatio > 0.01
              ? swingSign * Math.PI * 0.48 * openRatio
              : isTilted
              ? swingSign * Math.PI * 0.14
              : 0;
          const rotDiff = Math.abs(opGroup.userData.swingDoor.rotation.y - targetRot);
          if (rotDiff > 0.003) {
            opGroup.userData.swingDoor.rotation.y = THREE.MathUtils.damp(
              opGroup.userData.swingDoor.rotation.y,
              targetRot,
              6.2,
              dt
            );
            isAnimating = true;
            refs.shadowNeedsUpdate = true;
          }
          // Depress door handle lever while unlatching/moving
          if (opGroup.userData.doorHandlePivot) {
            const targetLeverZ = rotDiff > 0.04 ? -hingeSign * 0.44 : 0;
            if (Math.abs(opGroup.userData.doorHandlePivot.rotation.z - targetLeverZ) > 0.003) {
              opGroup.userData.doorHandlePivot.rotation.z = THREE.MathUtils.damp(
                opGroup.userData.doorHandlePivot.rotation.z,
                targetLeverZ,
                10,
                dt
              );
              isAnimating = true;
            }
          }
        }

        if (opGroup.userData.tiltPivot) {
          const targetTiltX = isTilted ? dirSign * 0.25 : 0;
          if (Math.abs(opGroup.userData.tiltPivot.rotation.x - targetTiltX) > 0.003) {
            opGroup.userData.tiltPivot.rotation.x = THREE.MathUtils.damp(
              opGroup.userData.tiltPivot.rotation.x,
              targetTiltX,
              7,
              dt
            );
            isAnimating = true;
          }
        }

        if (opGroup.userData.windowSwingPivot) {
          const targetWinSwingY =
            openRatio > 0.01 ? swingSign * Math.PI * 0.44 * openRatio : 0;
          if (Math.abs(opGroup.userData.windowSwingPivot.rotation.y - targetWinSwingY) > 0.003) {
            opGroup.userData.windowSwingPivot.rotation.y = THREE.MathUtils.damp(
              opGroup.userData.windowSwingPivot.rotation.y,
              targetWinSwingY,
              6.5,
              dt
            );
            isAnimating = true;
            refs.shadowNeedsUpdate = true;
          }
          if (opGroup.userData.windowSwingPivotSecondary) {
            const targetSecY = -targetWinSwingY * 0.88;
            opGroup.userData.windowSwingPivotSecondary.rotation.y = THREE.MathUtils.damp(
              opGroup.userData.windowSwingPivotSecondary.rotation.y,
              targetSecY,
              6.0,
              dt
            );
          }
        }

        if (opGroup.userData.winHandlePivot) {
          const targetHandleRot =
            openRatio > 0.01 ? Math.PI * 0.92 : isTilted ? Math.PI * 0.5 : 0;
          if (Math.abs(opGroup.userData.winHandlePivot.rotation.z - targetHandleRot) > 0.004) {
            opGroup.userData.winHandlePivot.rotation.z = THREE.MathUtils.damp(
              opGroup.userData.winHandlePivot.rotation.z,
              targetHandleRot,
              9,
              dt
            );
            isAnimating = true;
          }
        }

        if (opGroup.userData.slidingPane) {
          const baseX = (opGroup.userData.slidingBaseX as number | undefined) ?? 0;
          const slideDir = (opGroup.userData.slidingDir as number | undefined) ?? 1;
          const targetX = baseX + slideDir * openRatio * (opening.width * 0.43);
          const targetLiftY = openRatio > 0.02 ? 0.068 : 0.06;
          if (Math.abs(opGroup.userData.slidingPane.position.x - targetX) > 0.002) {
            opGroup.userData.slidingPane.position.x = THREE.MathUtils.damp(
              opGroup.userData.slidingPane.position.x,
              targetX,
              6,
              dt
            );
            opGroup.userData.slidingPane.position.y = THREE.MathUtils.damp(
              opGroup.userData.slidingPane.position.y,
              targetLiftY,
              8,
              dt
            );
            isAnimating = true;
          }
          if (opGroup.userData.patioHandlePivot) {
            const targetPatioHandle = openRatio > 0.02 ? Math.PI * 0.5 : 0;
            opGroup.userData.patioHandlePivot.rotation.z = THREE.MathUtils.damp(
              opGroup.userData.patioHandlePivot.rotation.z,
              targetPatioHandle,
              9,
              dt
            );
          }
        }

        // 4-Panel Articulated Overhead Sectional Garage Door + Up-and-Over / Roller / Double-Wing Garage Gate Kinematics
        if (
          opGroup.userData.garagePanels ||
          opGroup.userData.upAndOverLeaf ||
          opGroup.userData.garageRollerCurtain ||
          opGroup.userData.doubleWingLeft
        ) {
          const curProg = (opGroup.userData.garageOpenProgress as number) ?? 0;
          const targetProg = openRatio;
          if (Math.abs(curProg - targetProg) > 0.002 || opGroup.userData.garageNeedsInit) {
            const nextProg = opGroup.userData.garageNeedsInit
              ? curProg
              : THREE.MathUtils.damp(curProg, targetProg, 4.8, dt);
            opGroup.userData.garageOpenProgress = nextProg;
            opGroup.userData.garageNeedsInit = false;

            const innerH = (opGroup.userData.garageInnerH as number) || opening.height - 0.08;
            if (opGroup.userData.garagePanels) {
              const panels = opGroup.userData.garagePanels as THREE.Group[];
              const travel = nextProg * (innerH * 0.94);
              const R = 0.22;
              // Keep straightH === innerH so when travel === 0 (closed), all 4 panels stand 100% vertical and completely shut!
              const straightH = innerH;
              const curveLen = (Math.PI / 2) * R;
              const zTrackOffset = dirSign * 0.036;

              const sampleJTrack = (s: number): [number, number] => {
                if (s <= straightH) {
                  return [s, zTrackOffset];
                }
                if (s <= straightH + curveLen) {
                  const angle = (s - straightH) / R;
                  return [
                    straightH - R * (1 - Math.sin(angle)),
                    zTrackOffset + dirSign * (1 - Math.cos(angle)) * R,
                  ];
                }
                const over = s - (straightH + curveLen);
                return [straightH, zTrackOffset + dirSign * (R + over)];
              };

              for (const pGroup of panels) {
                const panelH = (pGroup.userData.panelHeight as number) || innerH / 4;
                const idx = (pGroup.userData.panelIndex as number) ?? 0;
                const sBot = idx * panelH + travel;
                const sTop = sBot + panelH;
                const [yBot, zBot] = sampleJTrack(sBot);
                const [yTop, zTop] = sampleJTrack(sTop);
                pGroup.position.y = (yBot + yTop) / 2;
                pGroup.position.z = (zBot + zTop) / 2;
                pGroup.rotation.x = Math.atan2(zTop - zBot, yTop - yBot);
              }
            }

            if (opGroup.userData.upAndOverLeaf) {
              const leaf = opGroup.userData.upAndOverLeaf as THREE.Object3D;
              leaf.rotation.x = nextProg * dirSign * (Math.PI * 0.48);
              leaf.position.z = dirSign * 0.03 + nextProg * dirSign * (innerH * 0.36);
            }

            if (opGroup.userData.garageRollerCurtain) {
              const curtain = opGroup.userData.garageRollerCurtain as THREE.Object3D;
              const scaleY = Math.max(0.04, 1 - nextProg * 0.94);
              curtain.scale.y = scaleY;
              curtain.position.y = innerH - (innerH * scaleY) / 2;
            }

            if (opGroup.userData.doubleWingLeft && opGroup.userData.doubleWingRight) {
              const leftLeaf = opGroup.userData.doubleWingLeft as THREE.Object3D;
              const rightLeaf = opGroup.userData.doubleWingRight as THREE.Object3D;
              const wingAngle = nextProg * (Math.PI * 0.48);
              leftLeaf.rotation.y = -wingAngle * dirSign;
              rightLeaf.rotation.y = wingAngle * dirSign;
            }

            if (!opGroup.userData.garageNeedsInit && Math.abs(curProg - targetProg) > 0.002) {
              isAnimating = true;
              refs.shadowNeedsUpdate = true;
            }
          }
        }

        if (opGroup.userData.shutterMesh && (opening.shutterClosedPct !== undefined || shutterEntity)) {
          const openPct =
            opening.shutterClosedPct !== undefined
              ? 100 - opening.shutterClosedPct
              : shutterEntity?.attributes.current_position ?? 100;
          const closedFraction = Math.max(0.03, 1 - openPct / 100);
          const shutter = opGroup.userData.shutterMesh as THREE.Object3D;
          if (Math.abs(shutter.scale.y - closedFraction) > 0.003) {
            shutter.scale.y = THREE.MathUtils.damp(shutter.scale.y, closedFraction, 6, dt);
            isAnimating = true;
          }
        }
      }

      // 7. Projected 2D Smart Badges & Architectural Room Summary Headers (Zero-GC Signature Diffing)
      if (elapsed - lastBadgeUpdate > 0.16) {
        lastBadgeUpdate = elapsed;
        if (!st.showFloatingBadges) {
          activeRoomSummariesRef.current = [];
          activeBadgesRef.current = [];
          if (prevBadgeSigRef.current !== '') {
            prevBadgeSigRef.current = '';
            setBadges([]);
            setRoomSummaries([]);
          }
        } else {
          const nextBadges: ProjectedBadge[] = [];
          const nextRooms: ProjectedRoomSummary[] = [];
          const w = container?.clientWidth || 1;
          const h = container?.clientHeight || 1;

          const floorZones = st.project.zones.filter((z) => {
            const zLevel = z.level ?? 0;
            return st.activeFloor === 'all_stacked' || zLevel === st.activeFloor;
          });

          // Helper to find which zone an opening belongs to
          const findOpeningZoneId = (op: WallOpening): string | null => {
            const opLevel = op.level ?? 0;
            if (st.focusedZoneId) {
              const fz = floorZones.find((z) => z.id === st.focusedZoneId);
              if (
                fz &&
                (fz.level ?? 0) === opLevel &&
                Math.abs(op.x - fz.x) <= fz.width / 2 + 0.65 &&
                Math.abs(op.z - fz.z) <= fz.depth / 2 + 0.65
              ) {
                return fz.id;
              }
              return null;
            }
            const bestZ = findBestZoneForPoint(op.x, op.z, opLevel, floorZones);
            if (bestZ) return bestZ.id;
            for (const z of floorZones) {
              if ((z.level ?? 0) !== opLevel) continue;
              const halfW = z.width / 2 + 0.65;
              const halfD = z.depth / 2 + 0.65;
              if (
                op.x >= z.x - halfW &&
                op.x <= z.x + halfW &&
                op.z >= z.z - halfD &&
                op.z <= z.z + halfD
              ) {
                return z.id;
              }
            }
            return null;
          };

          // Project Floating 3D Room Status Mini-Cards for active Tour/Focused rooms (or rooms set to 'always')
          for (const z of floorZones) {
            if (z.zoneType !== 'indoor') continue;
            const zLevel = z.level ?? 0;
            // Skip enclosing Wohnraum container hulls unless directly focused
            const isContainerHull =
              !isInteriorRoomZone(z, floorZones) &&
              floorZones.some(
                (other) =>
                  other.id !== z.id &&
                  other.zoneType === 'indoor' &&
                  (other.level ?? 0) === zLevel &&
                  isInteriorRoomZone(other, floorZones) &&
                  isPointInsideZone(other.x, other.z, z)
              );
            if (isContainerHull && st.focusedZoneId !== z.id) continue;

            const cardCfg: RoomStatusCardConfig = z.roomStatusCardConfig || {};
            const showMode = cardCfg.showMode || 'tour_and_focus';
            if (showMode === 'off') continue;
            const isTouringOrFocused =
              st.focusedZoneId === z.id || refs.tourRoomZoneId === z.id;
            const shouldProjectRoomCard =
              showMode === 'always' || (showMode === 'tour_and_focus' && isTouringOrFocused);
            if (!shouldProjectRoomCard) continue;

            const yOff = zLevel * FLOOR_HEIGHT + (z.plinthHeight ?? 0);
            _projVec.set(z.x, yOff + 1.45, z.z);
            _projVec.project(camera);
            if (_projVec.z > 1 || _projVec.z < -1) continue;

            const sx = Math.round(((_projVec.x + 1) / 2) * w);
            const sy = Math.round(((-_projVec.y + 1) / 2) * h);
            if (sx < 40 || sx > w - 40 || sy < 50 || sy > h - 60) continue;

            let lightsOn = 0;
            let lightsTotal = 0;
            const lightEntityIds: string[] = [];
            let powerWatts = 0;
            let hasAlarm = false;
            let humidityText: string | null = null;
            let totalElements = 0;

            for (const asset of st.project.assets) {
              if ((asset.level ?? 0) !== zLevel) continue;
              const aZoneId = refs.assetZoneMap.get(asset.id);
              if (aZoneId !== z.id) continue;
              totalElements++;
              const entId = asset.entityId || asset.actuatorEntityId;
              const ent = entId ? st.entities[entId] : undefined;
              if (!ent) continue;
              if (ent.domain === 'light') {
                lightsTotal++;
                if (entId) lightEntityIds.push(entId);
                if (ent.state === 'on') lightsOn++;
              }
              if (typeof ent.attributes.current_power_w === 'number' && ent.state !== 'off') {
                powerWatts += ent.attributes.current_power_w;
              }
              if (
                ent.attributes.device_class === 'humidity' ||
                ent.attributes.unit_of_measurement === '%'
              ) {
                const numVal = parseFloat(ent.state);
                if (!Number.isNaN(numVal)) {
                  humidityText = `${Math.round(numVal)}%`;
                }
              }
              if (
                (ent.attributes.device_class === 'smoke' ||
                  ent.attributes.device_class === 'moisture') &&
                (ent.state === 'detected' || ent.attributes.alarm_test_active)
              ) {
                hasAlarm = true;
              }
            }

            let openingsActive = 0;
            let openingsTotal = 0;
            const halfW = z.width / 2 + 0.65;
            const halfD = z.depth / 2 + 0.65;
            for (const op of st.project.openings) {
              if ((op.level ?? 0) !== zLevel) continue;
              if (
                op.x >= z.x - halfW &&
                op.x <= z.x + halfW &&
                op.z >= z.z - halfD &&
                op.z <= z.z + halfD
              ) {
                openingsTotal++;
                totalElements++;
                const opSt = resolveOpeningSensorState(op, st.entities);
                if (opSt === 'open' || opSt === 'tilted') openingsActive++;
              }
            }

            const climateEnt = z.climateEntityId ? st.entities[z.climateEntityId] : undefined;
            const tempText =
              climateEnt?.attributes.current_temperature !== undefined
                ? `${Number(climateEnt.attributes.current_temperature).toFixed(1)}°C`
                : null;
            if (!humidityText && climateEnt?.attributes.current_humidity !== undefined) {
              humidityText = `${Math.round(Number(climateEnt.attributes.current_humidity))}%`;
            }

            const customItems: { id: string; label: string; value: string }[] = [];
            if (cardCfg.customEntityIds && cardCfg.customEntityIds.length > 0) {
              for (const cid of cardCfg.customEntityIds) {
                const cEnt = st.entities[cid];
                if (!cEnt) continue;
                const unit = cEnt.attributes.unit_of_measurement
                  ? ` ${cEnt.attributes.unit_of_measurement}`
                  : '';
                customItems.push({
                  id: cid,
                  label: cleanBadgeLabel(cEnt.attributes.friendly_name || cid),
                  value: `${cEnt.state}${unit}`,
                });
              }
            }

            nextRooms.push({
              zoneId: z.id,
              name: z.name,
              zoneType: z.zoneType,
              x: sx,
              y: sy,
              worldPos: [z.x, yOff + 1.45, z.z],
              tempText,
              humidityText,
              lightsOn,
              lightsTotal,
              lightEntityIds,
              openingsActive,
              openingsTotal,
              powerWatts: Math.round(powerWatts),
              hasAlarm,
              totalElements,
              customItems,
              config: cardCfg,
            });
          }

          // ONLY project floating 3D element labels when zoomed into a specific room (st.focusedZoneId !== null)!
          if (st.focusedZoneId) {
              for (const op of st.project.openings) {
                const opLevel = op.level ?? 0;
                if (st.activeFloor !== 'all_stacked' && opLevel !== st.activeFloor) continue;

                const opZoneId = findOpeningZoneId(op);
                if (opZoneId !== st.focusedZoneId) continue;

                const state = resolveOpeningSensorState(op, st.entities);
                const yOff = opLevel * FLOOR_HEIGHT;
                const opWy = yOff + op.sillHeight + op.height * 0.65;
                _projVec.set(op.x, opWy, op.z);
                _projVec.project(camera);
                if (_projVec.z > 1 || _projVec.z < -1) continue;

                const sx = ((_projVec.x + 1) / 2) * w;
                const sy = ((-_projVec.y + 1) / 2) * h;
                if (sx < 30 || sx > w - 30 || sy < 40 || sy > h - 65) continue;

                const sublabel =
                  state === 'tilted'
                    ? 'GEKIPPT'
                    : state === 'open'
                    ? 'OFFEN'
                    : 'ZU';
                const isActive = state === 'open' || state === 'tilted';
                const colorClass =
                  state === 'tilted'
                    ? 'border-amber-400/80 bg-slate-950/95 text-amber-200'
                    : state === 'open'
                    ? 'border-sky-400/80 bg-slate-950/95 text-sky-200'
                    : 'border-slate-700/80 bg-slate-950/90 text-slate-300';
                const dotColorClass =
                  state === 'tilted'
                    ? 'bg-amber-400'
                    : state === 'open'
                    ? 'bg-sky-400'
                    : 'bg-emerald-400/70';

                nextBadges.push({
                  id: `op_${op.id}`,
                  label: cleanBadgeLabel(op.name),
                  sublabel,
                  x: sx,
                  y: sy,
                  worldPos: [op.x, opWy, op.z],
                  colorClass,
                  dotColorClass,
                  kind: 'opening',
                  isActive,
                  zoneId: opZoneId,
                  entityId: op.entityId,
                  openingId: op.id,
                });
              }

              for (const asset of st.project.assets) {
                const assetLevel = asset.level ?? 0;
                if (st.activeFloor !== 'all_stacked' && assetLevel !== st.activeFloor) continue;

                const assetZoneId = refs.assetZoneMap.get(asset.id) || null;
                if (assetZoneId !== st.focusedZoneId) continue;

                const ent = asset.entityId ? st.entities[asset.entityId] : undefined;
                if (!ent && asset.statusBadgeMode !== 'always') continue;

                const yOff = assetLevel * FLOOR_HEIGHT;
                _projVec.set(
                  asset.position[0],
                  asset.position[1] + yOff + 0.55,
                  asset.position[2]
                );
              _projVec.project(camera);
              if (_projVec.z > 1 || _projVec.z < -1) continue;

              const sx = Math.round(((_projVec.x + 1) / 2) * w);
              const sy = Math.round(((-_projVec.y + 1) / 2) * h);
              if (sx < 30 || sx > w - 30 || sy < 40 || sy > h - 65) continue;

              let sublabel = ent ? ent.state.toUpperCase() : 'BEREIT';
              let colorClass = 'border-slate-700/80 bg-slate-950/90 text-slate-200';
              let dotColorClass = 'bg-slate-400';
              let kind: BadgeDomainKind = 'sensor';
              let isActive = Boolean(ent && (ent.state === 'on' || ent.state === 'open'));

              if (ent) {
                if (
                  ent.attributes.device_class === 'smoke' ||
                  ent.attributes.device_class === 'moisture'
                ) {
                  const isAlarm = Boolean(
                    ent.state === 'detected' || ent.attributes.alarm_test_active
                  );
                  kind = 'alarm';
                  isActive = isAlarm;
                  sublabel = isAlarm ? 'ALARM!' : `OK · ${ent.attributes.battery_level ?? 98}%`;
                  colorClass = isAlarm
                    ? 'border-red-400 bg-red-950/95 text-red-200'
                    : 'border-slate-700/80 bg-slate-950/90 text-emerald-300';
                  dotColorClass = isAlarm ? 'bg-red-500 animate-ping' : 'bg-emerald-400';
                } else if (ent.domain === 'switch' && ent.attributes.current_power_w !== undefined) {
                  kind = 'power';
                  isActive = ent.state === 'on';
                  sublabel =
                    ent.state === 'on'
                      ? `${ent.attributes.current_power_w} W`
                      : '0 W';
                  colorClass =
                    ent.state === 'on'
                      ? 'border-emerald-500/60 bg-slate-950/95 text-emerald-300'
                      : 'border-slate-700/70 bg-slate-950/85 text-slate-400';
                  dotColorClass = ent.state === 'on' ? 'bg-emerald-400' : 'bg-slate-600';
                } else if (ent.domain === 'light') {
                  kind = 'light';
                  isActive = ent.state === 'on';
                  const pct = Math.round(((ent.attributes.brightness ?? 255) / 255) * 100);
                  sublabel = ent.state === 'on' ? `${pct}%` : 'AUS';
                  colorClass =
                    ent.state === 'on'
                      ? 'border-amber-400/75 bg-slate-950/95 text-amber-200'
                      : 'border-slate-700/70 bg-slate-950/85 text-slate-400';
                  dotColorClass = ent.state === 'on' ? 'bg-amber-400' : 'bg-slate-600';
                } else if (ent.domain === 'climate') {
                  kind = 'climate';
                  isActive = true;
                  sublabel = `${ent.attributes.current_temperature ?? 21}°C`;
                  colorClass = 'border-amber-500/50 bg-slate-950/95 text-amber-200';
                  dotColorClass = 'bg-amber-400';
                } else if (ent.domain === 'valve') {
                  kind = 'water';
                  isActive = ent.state === 'open';
                  sublabel =
                    ent.state === 'open'
                      ? `${ent.attributes.water_flow_lmin ?? 14} L/m`
                      : 'ZU';
                  colorClass =
                    ent.state === 'open'
                      ? 'border-sky-400/70 bg-slate-950/95 text-sky-200'
                      : 'border-slate-700/70 bg-slate-950/85 text-slate-400';
                  dotColorClass = ent.state === 'open' ? 'bg-sky-400' : 'bg-slate-600';
                } else if (ent.domain === 'cover') {
                  kind = 'cover';
                  const posPct =
                    ent.attributes.current_position ?? (ent.state === 'open' ? 100 : 0);
                  isActive = posPct > 10;
                  sublabel = posPct > 10 ? `${posPct}%` : 'ZU';
                  colorClass =
                    posPct > 10
                      ? 'border-amber-400/70 bg-slate-950/95 text-amber-200'
                      : 'border-slate-700/80 bg-slate-950/90 text-emerald-300';
                  dotColorClass = posPct > 10 ? 'bg-amber-400' : 'bg-emerald-400';
                } else if (ent.domain === 'sensor' && ent.attributes.current_power_w !== undefined) {
                  kind = 'power';
                  isActive = (ent.attributes.current_power_w ?? 0) > 0;
                  sublabel = `${ent.attributes.current_power_w} W`;
                  colorClass = 'border-emerald-400/60 bg-slate-950/95 text-emerald-300';
                  dotColorClass = 'bg-emerald-400';
                }
              }

              nextBadges.push({
                id: asset.id,
                label: cleanBadgeLabel(asset.name),
                sublabel,
                x: sx,
                y: sy,
                worldPos: [asset.position[0], asset.position[1] + yOff + 0.55, asset.position[2]],
                colorClass,
                dotColorClass,
                kind,
                isActive,
                zoneId: assetZoneId,
                entityId: asset.entityId,
                assetId: asset.id,
              });
            }
          }

          // Project Active Status / Warning Badges (e.g. Open Garage Door, Open Doors/Windows, Smoke/Water Alarms)
          // both as floating 3D status icons when in view AND as Off-Screen Viewport Edge Pins when outside camera view!
          const nextOffscreenPins: OffscreenAlertPin[] = [];
          const showOffscreenEdgePins =
            st.project.liveCockpitConfig?.showOffscreenAlertPins !== false;
          const showTopWarningPills =
            st.project.liveCockpitConfig?.showActiveAlertPills !== false;

          const projectAlertPoint = (
            id: string,
            label: string,
            sublabel: string,
            wx: number,
            wy: number,
            wz: number,
            severity: 'alarm' | 'warning' | 'info',
            zoneId: string | null,
            meta?: { openingId?: string; assetId?: string; entityId?: string }
          ) => {
            _projVec.set(wx, wy, wz);
            _projVec.project(camera);

            // Handle points behind camera plane (z > 1) by flipping NDC direction toward screen border
            const behindCam = _projVec.z > 1;
            const ndcX = behindCam ? -_projVec.x : _projVec.x;
            const ndcY = behindCam ? -_projVec.y : _projVec.y;
            const rawSx = ((ndcX + 1) / 2) * w;
            const rawSy = ((-ndcY + 1) / 2) * h;

            const marginX = 56;
            const marginTop = 68;
            const marginBottom = 96;
            const isInsideViewport =
              !behindCam &&
              rawSx >= marginX &&
              rawSx <= w - marginX &&
              rawSy >= marginTop &&
              rawSy <= h - marginBottom;

            if (isInsideViewport) {
              // When in overview mode (not already showing focused room badges), show a floating status icon above active garage doors / alarms!
              if (!st.focusedZoneId && showTopWarningPills) {
                nextBadges.push({
                  id: `alert_${id}`,
                  label,
                  sublabel,
                  x: rawSx,
                  y: rawSy,
                  worldPos: [wx, wy, wz],
                  colorClass:
                    severity === 'alarm'
                      ? 'border-red-400 bg-red-950/95 text-red-100 animate-pulse'
                      : 'border-amber-400 bg-slate-950/95 text-amber-200 ring-2 ring-amber-400/25',
                  dotColorClass:
                    severity === 'alarm' ? 'bg-red-500 animate-ping' : 'bg-amber-400 animate-pulse',
                  kind: severity === 'alarm' ? 'alarm' : 'opening',
                  isActive: true,
                  zoneId,
                  openingId: meta?.openingId,
                  assetId: meta?.assetId,
                  entityId: meta?.entityId,
                });
              }
            } else if (showOffscreenEdgePins) {
              const clampedX = Math.max(marginX, Math.min(w - marginX, rawSx));
              const clampedY = Math.max(marginTop, Math.min(h - marginBottom, rawSy));
              let arrowDir: 'left' | 'right' | 'up' | 'down' = 'right';
              if (rawSx < marginX) arrowDir = 'left';
              else if (rawSx > w - marginX) arrowDir = 'right';
              else if (rawSy < marginTop) arrowDir = 'up';
              else arrowDir = 'down';

              nextOffscreenPins.push({
                id: `edge_${id}`,
                label,
                sublabel,
                edgeX: clampedX,
                edgeY: clampedY,
                arrowDir,
                severity,
                targetWorldPos: [wx, wy, wz],
                zoneId,
                openingId: meta?.openingId,
                assetId: meta?.assetId,
                entityId: meta?.entityId,
              });
            }
          };

          if (st.activeTab === 'live') {
            const customIconEntities = new Set(
              (st.project.liveCockpitConfig?.customCards || [])
                .filter((c) => c.showFloating3DIcon && c.entityId)
                .map((c) => c.entityId!)
            );

            for (const op of st.project.openings) {
              const badgeMode = op.statusBadgeMode || 'auto';
              if (badgeMode === 'hidden') continue;
              const opState = resolveOpeningSensorState(op, st.entities, false);
              const isOpenOrTilted = opState === 'open' || opState === 'tilted';
              const hasCustomCardIcon = Boolean(op.entityId && customIconEntities.has(op.entityId));
              const shouldShowBadge =
                badgeMode === 'always' || isOpenOrTilted || hasCustomCardIcon;

              if (shouldShowBadge) {
                const opLevel = op.level ?? 0;
                const yOff = opLevel * FLOOR_HEIGHT;
                const opZoneId = findOpeningZoneId(op);
                const isGarage = op.type === 'garage_door';
                projectAlertPoint(
                  `op_${op.id}`,
                  cleanBadgeLabel(op.name),
                  opState === 'tilted'
                    ? 'GEKIPPT'
                    : opState === 'open'
                    ? isGarage
                      ? 'TOR OFFEN'
                      : 'OFFEN'
                    : 'GESCHLOSSEN',
                  op.x,
                  yOff + op.sillHeight + op.height + 0.35,
                  op.z,
                  isOpenOrTilted ? (isGarage ? 'warning' : 'info') : 'info',
                  opZoneId,
                  { openingId: op.id, entityId: op.actuatorEntityId || op.entityId }
                );
              }
            }

            for (const asset of st.project.assets) {
              const badgeMode = asset.statusBadgeMode || 'auto';
              if (badgeMode === 'hidden') continue;
              const entId = asset.entityId || asset.actuatorEntityId;
              const ent = entId ? st.entities[entId] : undefined;
              const isSmokeOrMoistureAlarm = Boolean(
                ent &&
                  (ent.attributes.device_class === 'smoke' ||
                    ent.attributes.device_class === 'moisture') &&
                  (ent.state === 'detected' || ent.attributes.alarm_test_active)
              );
              const isGateOpen = Boolean(
                ent &&
                  (asset.catalogId === 'electric_roller_gate' ||
                    asset.catalogId === 'sliding_driveway_gate' ||
                    asset.catalogId === 'garage_door_opener') &&
                  isBinaryEntityActive(ent)
              );
              const isActive = Boolean(ent && isBinaryEntityActive(ent));
              const hasCustomCardIcon = Boolean(entId && customIconEntities.has(entId));
              const shouldShowAssetBadge =
                badgeMode === 'always' ||
                (badgeMode === 'when_active' && isActive) ||
                (badgeMode === 'auto' && (isSmokeOrMoistureAlarm || isGateOpen)) ||
                hasCustomCardIcon;

              if (shouldShowAssetBadge) {
                const aLevel = asset.level ?? 0;
                const yOff = aLevel * FLOOR_HEIGHT;
                const aZoneId = refs.assetZoneMap.get(asset.id) || null;
                const rawStateText = isSmokeOrMoistureAlarm
                  ? 'ALARM!'
                  : isGateOpen
                  ? 'OFFEN'
                  : ent
                  ? ent.state.toUpperCase()
                  : isActive
                  ? 'AKTIV'
                  : 'BEREIT';
                projectAlertPoint(
                  `asset_${asset.id}`,
                  cleanBadgeLabel(asset.name),
                  rawStateText,
                  asset.position[0],
                  asset.position[1] + yOff + 0.9,
                  asset.position[2],
                  isSmokeOrMoistureAlarm ? 'alarm' : isActive ? 'warning' : 'info',
                  aZoneId,
                  { assetId: asset.id, entityId: asset.actuatorEntityId || asset.entityId }
                );
              }
            }
          }

          const slicedBadges = nextBadges.slice(0, 64);
          activeRoomSummariesRef.current = nextRooms;
          activeBadgesRef.current = slicedBadges;

          // Only trigger a React state update when the set of visible badges/rooms or their text/state values change
          const nextSig =
            (st.focusedZoneId || 'overview') +
            '::' +
            slicedBadges
              .map((b) => `${b.id}:${b.sublabel}:${b.isActive ? 1 : 0}`)
              .join('|') +
            '||' +
            nextRooms
              .map(
                (r) =>
                  `${r.zoneId}:${r.tempText || ''}:${r.lightsOn}:${r.openingsActive}:${r.powerWatts}:${r.hasAlarm ? 1 : 0}`
              )
              .join('|') +
            '||' +
            nextOffscreenPins
              .map((p) => `${p.id}:${p.arrowDir}:${Math.round(p.edgeX / 12)}:${Math.round(p.edgeY / 12)}`)
              .join('|');
          if (nextSig !== prevBadgeSigRef.current) {
            prevBadgeSigRef.current = nextSig;
            setBadges(slicedBadges);
            setRoomSummaries(nextRooms);
            setOffscreenPins(nextOffscreenPins);
          }
        }
      }

      // Smooth 60/120 FPS sub-pixel DOM projection on EVERY frame (never throttled to 0.16s!)
      // so floating 3D cards & badges glide with zero stutter during camera orbit, pan, and Kamerafahrt!
      if (st.showFloatingBadges && container) {
        const cw = container.clientWidth;
        const ch = container.clientHeight;
        if (cw > 0 && ch > 0) {
          for (const r of activeRoomSummariesRef.current) {
            const el = roomPillDomRefs.current.get(r.zoneId);
            if (!el) continue;
            _projVec.set(r.worldPos[0], r.worldPos[1], r.worldPos[2]);
            _projVec.project(camera);
            if (_projVec.z > 1 || _projVec.z < -1) {
              el.style.opacity = '0';
              continue;
            }
            const sx = ((_projVec.x + 1) / 2) * cw;
            const sy = ((-_projVec.y + 1) / 2) * ch;
            r.x = sx;
            r.y = sy;
            el.style.opacity = '1';
            el.style.transform = `translate3d(${sx.toFixed(1)}px, ${sy.toFixed(1)}px, 0) translate(-50%, -100%)`;
          }
          for (const b of activeBadgesRef.current) {
            const el = badgeDomRefs.current.get(b.id);
            if (!el) continue;
            _projVec.set(b.worldPos[0], b.worldPos[1], b.worldPos[2]);
            _projVec.project(camera);
            if (_projVec.z > 1 || _projVec.z < -1) {
              el.style.opacity = '0';
              continue;
            }
            const sx = ((_projVec.x + 1) / 2) * cw;
            const sy = ((-_projVec.y + 1) / 2) * ch;
            b.x = sx;
            b.y = sy;
            el.style.opacity = '1';
            el.style.transform = `translate3d(${sx.toFixed(1)}px, ${sy.toFixed(1)}px, 0) translate(-50%, -50%)`;
          }
        }
      }

      if (refs.shadowNeedsUpdate && renderer.shadowMap.enabled) {
        renderer.shadowMap.needsUpdate = true;
        refs.shadowNeedsUpdate = false;
      }

      renderer.render(scene, camera);

      if (isSoftwareGl) {
        afterDraw(tick);
      } else if (isAnimating || now < refs.wakeUpUntil) {
        frameId = requestAnimationFrame(tick);
      } else {
        // Smart Idle Sleep: when camera & animations are stationary, drop to low-power 6 FPS check
        idleTimeoutId = window.setTimeout(() => {
          frameId = requestAnimationFrame(tick);
        }, 160);
      }
    }

    frameId = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      clearTimeout(idleTimeoutId);
      resizeObserver.disconnect();
      window.removeEventListener('resize', handleResize);
      renderer.domElement.removeEventListener('pointerdown', handlePointerDown);
      renderer.domElement.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      renderer.domElement.removeEventListener('wheel', wakeUp);
      renderer.dispose();
    };
  }, []);

  // Rebuild architecture, openings, and placed assets whenever project structure, activeFloor, or focusedZoneId changes
  useEffect(() => {
    const refs = sceneObjectsRef.current;
    if (
      !refs.scene ||
      !refs.architectureGroup ||
      !refs.assetsGroup ||
      !refs.openingsGroup ||
      !refs.energyFlowGroup
    ) {
      return;
    }

    // Determine whether architectural structure (zones, walls, roofs, openings, or structural stair/gate cutouts) changed.
    // Moving, rotating, or editing regular furniture/lighting/outdoor assets skips rebuilding walls, floors, roofs & openings!
    const structuralAssetsForArch = project.assets
      .filter(
        (a) =>
          isStairAsset(a.catalogId) ||
          isExteriorStairAsset(a.catalogId) ||
          a.catalogId === 'electric_roller_gate'
      )
      .map((a) => ({
        id: a.id,
        c: a.catalogId,
        lvl: a.level ?? 0,
        p: a.position,
        r: a.rotationY,
        s: a.scale,
        st: a.stairConfig,
        est: a.exteriorStairConfig,
        h: a.customHeight,
      }));

    const archBuildSig = JSON.stringify({
      zones: project.zones,
      openings: project.openings,
      customWalls: project.customWalls,
      structuralAssets: structuralAssetsForArch,
      activeFloor,
      showClimateHeatmap,
      focusedZoneId,
      floorSwitchRoofMode,
      wallCutaway,
      visualStyle,
      selectedWallId,
    });
    const needArchRebuild = archBuildSig !== prevArchBuildSigRef.current;

    // Preserve active animation states for openings & roller gates across scene rebuilds so they never jump/clip
    const prevOpeningAnimState = new Map<
      string,
      {
        swingDoorRotY?: number;
        tiltRotX?: number;
        winSwingRotY?: number;
        winSwingSecRotY?: number;
        slidingPaneX?: number;
        garageOpenProgress?: number;
        shutterScaleY?: number;
      }
    >();
    if (needArchRebuild) {
      for (const [opId, oldGrp] of refs.openingMap.entries()) {
        prevOpeningAnimState.set(opId, {
          swingDoorRotY: oldGrp.userData.swingDoor?.rotation?.y,
          tiltRotX: oldGrp.userData.tiltPivot?.rotation?.x,
          winSwingRotY: oldGrp.userData.windowSwingPivot?.rotation?.y,
          winSwingSecRotY: oldGrp.userData.windowSwingPivotSecondary?.rotation?.y,
          slidingPaneX: oldGrp.userData.slidingPane?.position?.x,
          garageOpenProgress: oldGrp.userData.garageOpenProgress,
          shutterScaleY: oldGrp.userData.shutterMesh?.scale?.y,
        });
      }
      disposeGroupGeometries(refs.architectureGroup);
      disposeGroupGeometries(refs.openingsGroup);
      refs.architectureGroup.clear();
      refs.openingsGroup.clear();
      refs.indoorWalls = [];
      refs.roofGroups = [];
      refs.poolWaterMaterials = [];
      refs.zoneMaterialsMap.clear();
      refs.openingMap.clear();
      prevArchBuildSigRef.current = archBuildSig;
    }

    const prevAssetAnimState = new Map<
      string,
      { rollerScaleY?: number; slidingGateX?: number; carriageZ?: number }
    >();
    for (const [aId, oldAssetGrp] of refs.assetMap.entries()) {
      prevAssetAnimState.set(aId, {
        rollerScaleY: oldAssetGrp.userData.rollerGateCurtain?.scale?.y,
        slidingGateX: oldAssetGrp.userData.slidingDrivewayGate?.position?.x,
        carriageZ: oldAssetGrp.userData.openerCarriage?.position?.z,
      });
    }

    disposeGroupGeometries(refs.energyFlowGroup);
    refs.assetsGroup.clear();
    refs.energyFlowGroup.clear();
    refs.assetMap.clear();
    refs.assetZoneMap.clear();

    // When switching to a specific floor (e.g. 1. OG), keep lower floors (lvl <= activeFloor) and outdoor zones visible
    // at their true stacked 3D elevation so the user still sees the house & garden context with the active floor in focus!
    const floorZones = project.zones.filter((z) => {
      if (activeFloor === 'all_stacked') return true;
      if (z.zoneType === 'outdoor') return true;
      const lvl = z.level ?? 0;
      if (activeFloor === -1) return lvl === -1;
      return lvl >= 0 && lvl <= activeFloor;
    });
    const focusedZoneObj = focusedZoneId
      ? project.zones.find((z) => z.id === focusedZoneId) || null
      : null;

    // When zoomed into a room or building (focusedZoneObj), isolate that room (or if it is a Wohnraum/Nebengebäude building shell, also include its interior child rooms on the same floor)
    const visibleZones = focusedZoneObj
      ? !isInteriorRoomZone(focusedZoneObj, floorZones)
        ? floorZones.filter(
            (z) =>
              z.id === focusedZoneObj.id ||
              (z.zoneType === 'indoor' &&
                (z.level ?? 0) === (focusedZoneObj.level ?? 0) &&
                areZonesInSameBuilding(z, focusedZoneObj, floorZones))
          )
        : [focusedZoneObj]
      : floorZones;

    const visibleOpenings = project.openings.filter((o) => {
      const oLevel = o.level ?? 0;
      if (activeFloor !== 'all_stacked') {
        if (activeFloor === -1 && oLevel !== -1) return false;
        if (activeFloor >= 0 && (oLevel < 0 || oLevel > activeFloor)) return false;
      }
      if (focusedZoneObj) {
        if (oLevel !== (focusedZoneObj.level ?? 0)) return false;
        const halfW = focusedZoneObj.width / 2 + 0.65;
        const halfD = focusedZoneObj.depth / 2 + 0.65;
        return (
          o.x >= focusedZoneObj.x - halfW &&
          o.x <= focusedZoneObj.x + halfW &&
          o.z >= focusedZoneObj.z - halfD &&
          o.z <= focusedZoneObj.z + halfD
        );
      }
      return true;
    });

    const visibleAssets = project.assets.filter((a) => {
      const aLevel = a.level ?? 0;
      const isBasementToGroundStair =
        isKellertreppeAsset(a) || (isStairAsset(a.catalogId) && aLevel === -1);
      if (activeFloor !== 'all_stacked') {
        if (activeFloor === -1 && aLevel !== -1 && !isKellertreppeAsset(a)) return false;
        if (
          activeFloor >= 0 &&
          (aLevel < 0 || aLevel > activeFloor) &&
          !(activeFloor === 0 && isBasementToGroundStair)
        ) {
          return false;
        }
      }
      if (focusedZoneObj) {
        if (aLevel !== (focusedZoneObj.level ?? 0) && !isKellertreppeAsset(a)) return false;
        const bestZone = findBestZoneForPoint(a.position[0], a.position[2], aLevel, floorZones);
        if (bestZone) {
          return bestZone.id === focusedZoneObj.id;
        }
        return isPointInsideZone(a.position[0], a.position[2], focusedZoneObj);
      }
      return true;
    });

    if (refs.estateTerrain && refs.archGrid) {
      // Hide surrounding lawn terrain when isolating a single room so only the focused room floats cleanly over the CAD grid
      refs.estateTerrain.visible = !focusedZoneObj;
      // Automatically place surrounding estate terrain & CAD grid below the deepest swimming pool basin or basement
      let maxPoolDepth = 0.65;
      for (const z of visibleZones) {
        if (z.surfaceMaterial === 'pool_water') {
          const d = z.poolConfig?.basinDepth ?? 0.65;
          if (d + 0.16 > maxPoolDepth) maxPoolDepth = d + 0.16;
        }
      }
      const hasBasementVisible = visibleZones.some((z) => (z.level ?? 0) < 0);
      const groundBaseY = hasBasementVisible ? -FLOOR_HEIGHT - maxPoolDepth : -maxPoolDepth;
      refs.estateTerrain.position.y = groundBaseY;
      refs.archGrid.position.y = groundBaseY + 0.02;
    }

    // Helper to cut out recessed swimming pool footprints from overlapping outdoor lawn/patio slabs
    interface Rect2D {
      minX: number;
      maxX: number;
      minZ: number;
      maxZ: number;
    }
    const subtractRect2D = (rect: Rect2D, hole: Rect2D): Rect2D[] => {
      if (
        hole.maxX <= rect.minX + 0.005 ||
        hole.minX >= rect.maxX - 0.005 ||
        hole.maxZ <= rect.minZ + 0.005 ||
        hole.minZ >= rect.maxZ - 0.005
      ) {
        return [rect];
      }
      const res: Rect2D[] = [];
      const cMinX = Math.max(rect.minX, hole.minX);
      const cMaxX = Math.min(rect.maxX, hole.maxX);
      const cMinZ = Math.max(rect.minZ, hole.minZ);
      const cMaxZ = Math.min(rect.maxZ, hole.maxZ);

      if (cMinX > rect.minX + 0.02) {
        res.push({ minX: rect.minX, maxX: cMinX, minZ: rect.minZ, maxZ: rect.maxZ });
      }
      if (cMaxX < rect.maxX - 0.02) {
        res.push({ minX: cMaxX, maxX: rect.maxX, minZ: rect.minZ, maxZ: rect.maxZ });
      }
      if (cMinZ > rect.minZ + 0.02) {
        res.push({ minX: cMinX, maxX: cMaxX, minZ: rect.minZ, maxZ: cMinZ });
      }
      if (cMaxZ < rect.maxZ - 0.02) {
        res.push({ minX: cMinX, maxX: cMaxX, minZ: cMaxZ, maxZ: rect.maxZ });
      }
      return res;
    };

    const poolZonesByLevel = new Map<number, FloorplanZone[]>();
    for (const pz of visibleZones) {
      if (pz.surfaceMaterial === 'pool_water') {
        const lvl = pz.level ?? 0;
        const list = poolZonesByLevel.get(lvl) || [];
        list.push(pz);
        poolZonesByLevel.set(lvl, list);
      }
    }

    const POOL_PALETTES = {
      azure: {
        floor: 0x0284c7,
        wall: 0x0ea5e9,
        water: 0x38bdf8,
        emissive: 0x0284c7,
        step: 0x7dd3fc,
      },
      turquoise: {
        floor: 0x0d9488,
        wall: 0x14b8a6,
        water: 0x2dd4bf,
        emissive: 0x0f766e,
        step: 0x99f6e4,
      },
      sand: {
        floor: 0xd6d3d1,
        wall: 0xe7e5e4,
        water: 0x38bdf8,
        emissive: 0x0284c7,
        step: 0xf5f5f4,
      },
      anthracite: {
        floor: 0x1e293b,
        wall: 0x334155,
        water: 0x0284c7,
        emissive: 0x0369a1,
        step: 0x64748b,
      },
      emerald: {
        floor: 0x047857,
        wall: 0x059669,
        water: 0x34d399,
        emissive: 0x065f46,
        step: 0x6ee7b7,
      },
    };

    // Compute deterministic Layer-Ordnung (Z-Order) for all outdoor zones so background lawns ("Große Freizeitfläche"),
    // secondary lawns ("Gartenrasen 1"), gravel beds, terraces, and pathways NEVER clip or Z-fight!
    const getOutdoorLayerTier = (z: FloorplanZone): number => {
      if (z.layerOrder !== undefined) return z.layerOrder;
      if (
        z.surfaceMaterial === 'pathway_stone' ||
        z.surfaceMaterial === 'pathway_wood' ||
        z.surfaceMaterial === 'pathway_stepping' ||
        z.surfaceMaterial === 'pathway_cobble'
      ) {
        return 3; // Top pathway layer
      }
      if (
        z.surfaceMaterial === 'wpc_decking' ||
        z.surfaceMaterial === 'travertine_stone' ||
        z.surfaceMaterial === 'polished_concrete' ||
        z.surfaceMaterial === 'anthracite_tile' ||
        z.surfaceMaterial === 'driveway_pavers'
      ) {
        return 2; // Terrace & driveway layer
      }
      if (z.surfaceMaterial === 'gravel_bed') {
        return 1; // Decorative bed layer
      }
      const area = computeZoneAreaM2(z);
      return area >= 85 ? -1 : 0; // Large base plots sit at -1 underneath smaller garden lawns at 0
    };

    const sortedOutdoorZones = visibleZones
      .filter((z) => z.zoneType === 'outdoor' && z.surfaceMaterial !== 'pool_water')
      .slice()
      .sort((a, b) => {
        const tierDiff = getOutdoorLayerTier(a) - getOutdoorLayerTier(b);
        if (tierDiff !== 0) return tierDiff;
        // Larger background zones sit below smaller foreground zones
        const areaDiff = computeZoneAreaM2(b) - computeZoneAreaM2(a);
        if (Math.abs(areaDiff) > 0.2) return areaDiff;
        return a.id.localeCompare(b.id);
      });

    const outdoorLayerRankMap = new Map<string, number>();
    sortedOutdoorZones.forEach((z, idx) => {
      outdoorLayerRankMap.set(z.id, idx);
    });

    const sortedIndoorZones = visibleZones
      .filter((z) => z.zoneType === 'indoor')
      .slice()
      .sort((a, b) => {
        // Parent building shells (Wohnraum / Nebengebäude) always sit at the bottom (tier 0);
        // Interior rooms (Räume) sit above them (tier 1), sorted from largest to smallest area
        const tierA = isInteriorRoomZone(a, visibleZones) ? 1 : 0;
        const tierB = isInteriorRoomZone(b, visibleZones) ? 1 : 0;
        if (tierA !== tierB) return tierA - tierB;
        const areaDiff = computeZoneAreaM2(b) - computeZoneAreaM2(a);
        if (Math.abs(areaDiff) > 0.05) return areaDiff;
        return a.id.localeCompare(b.id);
      });
    const indoorLayerRankMap = new Map<string, number>();
    sortedIndoorZones.forEach((z, idx) => {
      indoorLayerRankMap.set(z.id, idx);
    });

    // Pre-collect multi-story roof envelopes (where roof sits on EG and encloses 1. OG / DG)
    const multiStoryRoofMap = new Map<string, FloorplanZone>();
    const renderedRoofKeys = new Set<string>();
    const renderedMultiStoryHosts: FloorplanZone[] = [];
    for (const z of project.zones) {
      if (z.zoneType !== 'indoor' || !z.roofConfig || z.roofConfig.type === 'none') continue;
      if (isBuildingMultiStoryRoof(z, project.zones)) {
        const host = computeRoofHostFootprintZone(z, project.zones);
        const alreadyHasHost = Array.from(multiStoryRoofMap.values()).some((existing) =>
          areZonesInSameBuilding(existing, host, project.zones)
        );
        const key = getBuildingClusterKey(z, project.zones);
        if (!alreadyHasHost && !multiStoryRoofMap.has(key)) {
          multiStoryRoofMap.set(key, host);
        }
      }
    }
    const multiStoryRoofEnvelopes = Array.from(multiStoryRoofMap.values());

    // Compute per-building raised basement plinth height (e.g. 0.30m when Kellergeschoss or an exterior staircase elevates the building)
    const buildingPlinthMap = new Map<string, number>();
    const findClosestIndoorZoneOnLevel = (
      wx: number,
      wz: number,
      lvl: number,
      maxDist = 2.5
    ): FloorplanZone | null => {
      const direct = findBestZoneForPoint(
        wx,
        wz,
        lvl,
        project.zones.filter((z) => z.zoneType === 'indoor')
      );
      if (direct) return direct;
      let closestIndoor: FloorplanZone | null = null;
      let bestEdgeDist = maxDist;
      for (const z of project.zones) {
        if (z.zoneType !== 'indoor' || (z.level ?? 0) !== lvl) continue;
        const corners = getZoneCorners(z);
        for (let i = 0; i < corners.length; i++) {
          const p1 = corners[i];
          const p2 = corners[(i + 1) % corners.length];
          const l2 = (p2[0] - p1[0]) ** 2 + (p2[1] - p1[1]) ** 2;
          const t =
            l2 > 1e-6
              ? Math.max(
                  0,
                  Math.min(
                    1,
                    ((wx - p1[0]) * (p2[0] - p1[0]) + (wz - p1[1]) * (p2[1] - p1[1])) / l2
                  )
                )
              : 0;
          const px = p1[0] + t * (p2[0] - p1[0]);
          const pz = p1[1] + t * (p2[1] - p1[1]);
          const dist = Math.hypot(wx - px, wz - pz);
          if (dist < bestEdgeDist) {
            bestEdgeDist = dist;
            closestIndoor = z;
          }
        }
      }
      return closestIndoor;
    };

    for (const z of project.zones) {
      if (z.zoneType !== 'indoor') continue;
      const bKey = getBuildingClusterKey(z, project.zones);
      const ph = z.plinthHeight ?? 0;
      if (ph > (buildingPlinthMap.get(bKey) ?? 0)) {
        buildingPlinthMap.set(bKey, ph);
      }
    }
    for (const op of project.openings) {
      if (op.hasExteriorSteps && (op.exteriorPlinthHeight ?? 0.3) > 0) {
        const hostZ = findClosestIndoorZoneOnLevel(op.x, op.z, op.level ?? 0, 2.0);
        if (hostZ && hostZ.zoneType === 'indoor') {
          const bKey = getBuildingClusterKey(hostZ, project.zones);
          const ph = op.exteriorPlinthHeight ?? 0.3;
          if (ph > (buildingPlinthMap.get(bKey) ?? 0)) {
            buildingPlinthMap.set(bKey, ph);
          }
        }
      }
    }
    // Also detect standalone Exterior Stair catalog assets (`entrance_steps_plinth`, `outdoor_stairs_curved_fan`, `outdoor_stairs_pyramid`)
    // placed at or adjacent to an indoor building on EG so ALL rooms and upper floors of that building rise together!
    for (const a of project.assets) {
      if (
        isExteriorStairAsset(a.catalogId) &&
        a.catalogId !== 'outdoor_stairs_kellertreppe' &&
        (a.level ?? 0) === 0
      ) {
        const ph = a.exteriorStairConfig?.plinthHeight ?? a.customHeight ?? 0.35;
        if (ph <= 0.02) continue;
        const closestIndoor = findClosestIndoorZoneOnLevel(
          a.position[0],
          a.position[2],
          0,
          2.5
        );
        if (closestIndoor) {
          const bKey = getBuildingClusterKey(closestIndoor, project.zones);
          if (ph > (buildingPlinthMap.get(bKey) ?? 0)) {
            buildingPlinthMap.set(bKey, ph);
          }
        }
      }
    }
    const getZonePlinthOffset = (z: FloorplanZone): number => {
      if (z.zoneType !== 'indoor' || (z.level ?? 0) < 0) return 0;
      const bKey = getBuildingClusterKey(z, project.zones);
      return buildingPlinthMap.get(bKey) ?? (z.plinthHeight ?? 0);
    };

    // Compute unified wall height per building cluster & floor level so outer building shells and inner rooms on EG
    // always share the exact same top edge and match the roof eave height seamlessly without any height steps!
    const buildingFloorWallHeightMap = new Map<string, number>();
    for (const z of project.zones) {
      if (z.zoneType !== 'indoor') continue;
      const zLvl = z.level ?? 0;
      const bKey = getBuildingClusterKey(z, project.zones);
      const mapKey = `${bKey}::${zLvl}`;
      const hasUpperOrMulti =
        project.zones.some(
          (uz) =>
            uz.zoneType === 'indoor' &&
            (uz.level ?? 0) > zLvl &&
            areZonesInSameBuilding(z, uz, project.zones)
        ) ||
        (zLvl === 0 &&
          multiStoryRoofEnvelopes.some((env) => areZonesInSameBuilding(z, env, project.zones)));
      const candidateH = hasUpperOrMulti
        ? Math.max(z.wallHeight || FLOOR_HEIGHT, FLOOR_HEIGHT)
        : z.wallHeight || FLOOR_HEIGHT;
      if (candidateH > (buildingFloorWallHeightMap.get(mapKey) ?? 0)) {
        buildingFloorWallHeightMap.set(mapKey, candidateH);
      }
    }
    const getUnifiedBuildingFloorWallHeight = (z: FloorplanZone, lvl: number): number => {
      const bKey = getBuildingClusterKey(z, project.zones);
      return buildingFloorWallHeightMap.get(`${bKey}::${lvl}`) ?? (z.wallHeight || FLOOR_HEIGHT);
    };

    // Helper: returns maximum allowed room wall height at world (wx, wz) on floor `lvl` inside a multi-story roof
    const getRoofMaxWallHeightAt = (
      wx: number,
      wz: number,
      lvl: number,
      defaultH: number
    ): number => {
      if (lvl < 1 || multiStoryRoofEnvelopes.length === 0) return defaultH;
      for (const host of multiStoryRoofEnvelopes) {
        const cfg = host.roofConfig;
        if (!cfg || cfg.type === 'none' || cfg.type === 'flat') continue;
        // If roof sits on top of 1. OG ('dg_on_og'), then 1. OG (lvl === 1) is a full floor below the roof!
        if (cfg.roofSpanMode === 'dg_on_og' && lvl <= 1) continue;

        const roofUnderY = evaluateRoofUndersideHeight(host, wx, wz);
        if (roofUnderY === null) continue;

        let floorOffsetAboveRoofBase = (lvl - 1) * FLOOR_HEIGHT;
        if (cfg.roofSpanMode === 'dg_on_og') {
          floorOffsetAboveRoofBase = (lvl - 2) * FLOOR_HEIGHT;
        } else if (lvl === 2 && cfg.roofSpanMode === 'og_and_dg_in_roof') {
          floorOffsetAboveRoofBase = cfg.spitzbodenHeight ?? 2.65;
        }
        // 1.2cm clearance inside the 8cm roof slab so sloped walls meet the roof underside cleanly without gaps or pokes!
        const availH = roofUnderY - floorOffsetAboveRoofBase - 0.012;
        return Math.min(defaultH, Math.max(0.0, availH));
      }
      return defaultH;
    };

    // Helper: clips a 2D floor slab rectangle on `1. OG` / `DG` to the horizontal envelope where the sloped roof is above the floor
    // so upper-floor rooms ("Dachgeschoss") NEVER protrude through the sloped roof tiles ("riesen Viereck auf dem Dach")!
    const clipRectToRoofEnvelope = (
      rect: Rect2D,
      lvl: number,
      zone: FloorplanZone
    ): Rect2D | null => {
      if (lvl < 1 || multiStoryRoofEnvelopes.length === 0) return rect;
      for (const host of multiStoryRoofEnvelopes) {
        const cfg = host.roofConfig;
        if (!cfg || cfg.type === 'none' || cfg.type === 'flat') continue;
        if (cfg.roofSpanMode === 'dg_on_og' && lvl <= 1) continue;
        if (!areZonesInSameBuilding(zone, host, project.zones)) continue;

        const cz = (rect.minZ + rect.maxZ) / 2;
        const cx = (rect.minX + rect.maxX) / 2;
        // Sample along X and Z to find the span where available roof height >= 0.08m
        let clippedMinX = rect.minX;
        let clippedMaxX = rect.maxX;
        let clippedMinZ = rect.minZ;
        let clippedMaxZ = rect.maxZ;
        const steps = 28;
        let firstValidX: number | null = null;
        let lastValidX: number | null = null;
        for (let i = 0; i <= steps; i++) {
          const sx = rect.minX + ((rect.maxX - rect.minX) * i) / steps;
          if (getRoofMaxWallHeightAt(sx, cz, lvl, 2.6) >= 0.08) {
            if (firstValidX === null) firstValidX = sx;
            lastValidX = sx;
          }
        }
        if (firstValidX === null || lastValidX === null) return null;
        clippedMinX = Math.max(rect.minX, firstValidX + 0.04);
        clippedMaxX = Math.min(rect.maxX, lastValidX - 0.04);

        let firstValidZ: number | null = null;
        let lastValidZ: number | null = null;
        for (let i = 0; i <= steps; i++) {
          const sz = rect.minZ + ((rect.maxZ - rect.minZ) * i) / steps;
          if (getRoofMaxWallHeightAt(cx, sz, lvl, 2.6) >= 0.08) {
            if (firstValidZ === null) firstValidZ = sz;
            lastValidZ = sz;
          }
        }
        if (firstValidZ === null || lastValidZ === null) return null;
        clippedMinZ = Math.max(rect.minZ, firstValidZ + 0.04);
        clippedMaxZ = Math.min(rect.maxZ, lastValidZ - 0.04);

        if (clippedMaxX - clippedMinX < 0.15 || clippedMaxZ - clippedMinZ < 0.15) return null;
        return {
          minX: clippedMinX,
          maxX: clippedMaxX,
          minZ: clippedMinZ,
          maxZ: clippedMaxZ,
        };
      }
      return rect;
    };

    // Helper: builds a wall BoxGeometry whose top surface slopes smoothly from hStart (-X) to hEnd (+X)
    // so gable walls and eaves walls follow the pitched roof plane with zero stepped corners!
    const buildSlopedWallGeometry = (
      lenX: number,
      hStart: number,
      hEnd: number,
      thickZ: number,
      slopeAlongZ = false
    ): THREE.BoxGeometry => {
      const maxH = Math.max(0.04, hStart, hEnd);
      const geo = new THREE.BoxGeometry(
        slopeAlongZ ? thickZ : lenX,
        maxH,
        slopeAlongZ ? lenX : thickZ
      );
      if (Math.abs(hStart - hEnd) > 0.005) {
        const pos = geo.attributes.position as THREE.BufferAttribute;
        for (let i = 0; i < pos.count; i++) {
          const vy = pos.getY(i);
          if (vy > 0) {
            const coord = slopeAlongZ ? pos.getZ(i) : pos.getX(i);
            const t = THREE.MathUtils.clamp(coord / Math.max(0.01, lenX) + 0.5, 0, 1);
            const targetH = Math.max(0.02, hStart + (hEnd - hStart) * t);
            // Vertex bottom is at -maxH / 2, so top at targetH above bottom is -maxH / 2 + targetH
            pos.setY(i, -maxH / 2 + targetH);
          }
        }
        pos.needsUpdate = true;
        geo.computeVertexNormals();
      }
      return geo;
    };

    // Pre-collect multi-story Stairwell Ceiling Cutouts (Treppenaugen) so any indoor staircase on level L
    // automatically punches an architectural opening into the indoor floor slab of level L + 1!
    interface StairwellHoleSpec {
      minX: number;
      maxX: number;
      minZ: number;
      maxZ: number;
      corners: [number, number][];
      stairAsset: PlacedAsset;
    }
    const stairHolesByUpperLevel = new Map<number, StairwellHoleSpec[]>();
    const kellertreppeGroundHoles: StairwellHoleSpec[] = [];
    for (const asset of project.assets) {
      const isKellerStair = isKellertreppeAsset(asset);
      if (!isStairAsset(asset.catalogId) && !isKellerStair) continue;
      const sc = asset.scale || 1;
      const isSpiral = asset.catalogId.includes('spiral');
      const isQuarter = asset.catalogId.includes('l_quarter');
      const isHalf = asset.catalogId.includes('u_half');
      const kDims = isKellerStair ? getKellertreppeDimensions(asset) : null;
      const rawW = kDims
        ? kDims.width * sc
        : (asset.stairConfig?.width ?? (isSpiral ? 1.85 : isQuarter || isHalf ? 2.1 : 1.12)) * sc;
      const rawD = kDims
        ? kDims.depth * sc
        : (asset.stairConfig?.totalRun ?? (isSpiral ? 1.85 : isHalf ? 2.6 : 3.05)) * sc;
      const cosR = Math.cos(asset.rotationY || 0);
      const sinR = Math.sin(asset.rotationY || 0);
      const hw = rawW / 2;
      const hd = rawD / 2;
      const localCorners: [number, number][] = [
        [-hw, -hd],
        [hw, -hd],
        [hw, hd],
        [-hw, hd],
      ];
      const worldCorners: [number, number][] = localCorners.map(([lx, lz]) => [
        asset.position[0] + lx * cosR + lz * sinR,
        asset.position[2] - lx * sinR + lz * cosR,
      ]);
      const xs = worldCorners.map((c) => c[0]);
      const zs = worldCorners.map((c) => c[1]);
      const spec: StairwellHoleSpec = {
        minX: Math.min(...xs),
        maxX: Math.max(...xs),
        minZ: Math.min(...zs),
        maxZ: Math.max(...zs),
        corners: worldCorners,
        stairAsset: asset,
      };
      if (isKellerStair) {
        kellertreppeGroundHoles.push(spec);
      } else {
        const upperLvl = (asset.level ?? 0) + 1;
        const list = stairHolesByUpperLevel.get(upperLvl) || [];
        list.push(spec);
        stairHolesByUpperLevel.set(upperLvl, list);
      }
    }

    // 1. Build Indoor Rooms & Outdoor Landscaping Zones with Shared Zone Materials (only when needArchRebuild is true!)
    if (needArchRebuild) {
      // Pre-compute Effective Wall-Aligned Bounds for rectangular indoor zones so that:
      // 1) Child interior rooms (`Raum`) inside a parent building shell (`Wohnraum`) never poke their floor slabs or foundation plinths out through the exterior facade walls (even when their outer wall was deduplicated or hidden).
      // 2) Zones whose walls are hidden (`mode === 'hidden'`) or deduplicated (`<= 0.26m`) snap their effective edge to the standing wall coordinate.
      interface EffectiveZoneBounds {
        minX: number;
        maxX: number;
        minZ: number;
        maxZ: number;
        x: number;
        z: number;
        width: number;
        depth: number;
      }
      const effectiveIndoorBoundsMap = new Map<string, EffectiveZoneBounds>();
      for (const z of visibleZones) {
        if (z.zoneType !== 'indoor' || (z.points && z.points.length >= 3) || isZoneRotated(z)) {
          continue;
        }
        const zLvl = z.level ?? 0;
        const zIsInterior = isInteriorRoomZone(z, visibleZones);
        const zArea = computeZoneAreaM2(z);
        let minX = z.x - z.width / 2;
        let maxX = z.x + z.width / 2;
        let minZ = z.z - z.depth / 2;
        let maxZ = z.z + z.depth / 2;

        // Pass A: If `z` is a child interior room inside a larger parent building shell (`!isInteriorRoomZone`),
        // clamp `z`'s edges so they never protrude outside the parent shell's visible exterior walls!
        if (zIsInterior) {
          for (const shell of visibleZones) {
            if (
              shell.id === z.id ||
              shell.zoneType !== 'indoor' ||
              (shell.level ?? 0) !== zLvl ||
              (shell.points && shell.points.length >= 3) ||
              isZoneRotated(shell) ||
              isInteriorRoomZone(shell, visibleZones)
            ) {
              continue;
            }
            const shellArea = computeZoneAreaM2(shell);
            if (shellArea <= zArea + 0.1) continue;
            const sMinX = shell.x - shell.width / 2;
            const sMaxX = shell.x + shell.width / 2;
            const sMinZ = shell.z - shell.depth / 2;
            const sMaxZ = shell.z + shell.depth / 2;
            const ovX = Math.max(0, Math.min(maxX, sMaxX) - Math.max(minX, sMinX));
            const ovZ = Math.max(0, Math.min(maxZ, sMaxZ) - Math.max(minZ, sMinZ));
            if (ovX * ovZ < zArea * 0.45 && !isPointInsideZone(z.x, z.z, shell)) continue;

            if (shell.wallSides?.west?.mode !== 'hidden') {
              const westHidden = z.wallSides?.west?.mode === 'hidden';
              if (
                (minX < sMinX && (sMinX - minX <= 0.85 || westHidden)) ||
                Math.abs(minX - sMinX) <= 0.26
              ) {
                minX = sMinX;
              }
            }
            if (shell.wallSides?.east?.mode !== 'hidden') {
              const eastHidden = z.wallSides?.east?.mode === 'hidden';
              if (
                (maxX > sMaxX && (maxX - sMaxX <= 0.85 || eastHidden)) ||
                Math.abs(maxX - sMaxX) <= 0.26
              ) {
                maxX = sMaxX;
              }
            }
            if (shell.wallSides?.north?.mode !== 'hidden') {
              const northHidden = z.wallSides?.north?.mode === 'hidden';
              if (
                (minZ < sMinZ && (sMinZ - minZ <= 0.85 || northHidden)) ||
                Math.abs(minZ - sMinZ) <= 0.26
              ) {
                minZ = sMinZ;
              }
            }
            if (shell.wallSides?.south?.mode !== 'hidden') {
              const southHidden = z.wallSides?.south?.mode === 'hidden';
              if (
                (maxZ > sMaxZ && (maxZ - sMaxZ <= 0.85 || southHidden)) ||
                Math.abs(maxZ - sMaxZ) <= 0.26
              ) {
                maxZ = sMaxZ;
              }
            }
          }
        }

        // Pass B: If `z` has a hidden outer wall (`mode === 'hidden'`) on any side while overlapping indoor rooms provide the visible exterior wall inside `z`,
        // pull `z`'s hidden edge in to match the outermost visible overlapping wall so `z`'s floor/plinth never sticks out in front of the facade!
        const overlappingIndoor = visibleZones.filter((c) => {
          if (
            c.id === z.id ||
            c.zoneType !== 'indoor' ||
            (c.level ?? 0) !== zLvl ||
            (c.points && c.points.length >= 3) ||
            isZoneRotated(c)
          ) {
            return false;
          }
          const cMinX = c.x - c.width / 2;
          const cMaxX = c.x + c.width / 2;
          const cMinZ = c.z - c.depth / 2;
          const cMaxZ = c.z + c.depth / 2;
          const ovX = Math.max(0, Math.min(maxX, cMaxX) - Math.max(minX, cMinX));
          const ovZ = Math.max(0, Math.min(maxZ, cMaxZ) - Math.max(minZ, cMinZ));
          return ovX * ovZ > 0.25 || isPointInsideZone(c.x, c.z, z);
        });
        if (overlappingIndoor.length > 0) {
          if (z.wallSides?.west?.mode === 'hidden') {
            const hasFurtherWest = overlappingIndoor.some((c) => c.x - c.width / 2 < minX - 0.05);
            const westCandidates = overlappingIndoor
              .filter((c) => c.wallSides?.west?.mode !== 'hidden')
              .map((c) => c.x - c.width / 2)
              .filter((coord) => coord > minX && coord - minX <= 0.85);
            if (!hasFurtherWest && westCandidates.length > 0) minX = Math.min(...westCandidates);
          }
          if (z.wallSides?.east?.mode === 'hidden') {
            const hasFurtherEast = overlappingIndoor.some((c) => c.x + c.width / 2 > maxX + 0.05);
            const eastCandidates = overlappingIndoor
              .filter((c) => c.wallSides?.east?.mode !== 'hidden')
              .map((c) => c.x + c.width / 2)
              .filter((coord) => coord < maxX && maxX - coord <= 0.85);
            if (!hasFurtherEast && eastCandidates.length > 0) maxX = Math.max(...eastCandidates);
          }
          if (z.wallSides?.north?.mode === 'hidden') {
            const hasFurtherNorth = overlappingIndoor.some((c) => c.z - c.depth / 2 < minZ - 0.05);
            const northCandidates = overlappingIndoor
              .filter((c) => c.wallSides?.north?.mode !== 'hidden')
              .map((c) => c.z - c.depth / 2)
              .filter((coord) => coord > minZ && coord - minZ <= 0.85);
            if (!hasFurtherNorth && northCandidates.length > 0) minZ = Math.min(...northCandidates);
          }
          if (z.wallSides?.south?.mode === 'hidden') {
            const hasFurtherSouth = overlappingIndoor.some((c) => c.z + c.depth / 2 > maxZ + 0.05);
            const southCandidates = overlappingIndoor
              .filter((c) => c.wallSides?.south?.mode !== 'hidden')
              .map((c) => c.z + c.depth / 2)
              .filter((coord) => coord < maxZ && maxZ - coord <= 0.85);
            if (!hasFurtherSouth && southCandidates.length > 0) maxZ = Math.max(...southCandidates);
          }
        }

        // Pass C: Snap any side of `z` that is deduplicated with a winning zone's wall (`otherWins`, within 0.25m):
        // - For same-facing walls (e.g. both `west` walls or both `south` walls), snap whenever parallel overlap > 0.15m.
        // - For opposite-facing walls (e.g. `north` against `south`), snap the whole edge when parallel overlap >= 65% of side length.
        for (const otherZ of visibleZones) {
          if (
            otherZ.id === z.id ||
            otherZ.zoneType !== 'indoor' ||
            (otherZ.level ?? 0) !== zLvl ||
            (otherZ.points && otherZ.points.length >= 3) ||
            isZoneRotated(otherZ)
          ) {
            continue;
          }
          const otherArea = computeZoneAreaM2(otherZ);
          const otherWins =
            otherArea > zArea + 0.05 ||
            (Math.abs(otherArea - zArea) <= 0.05 && otherZ.id < z.id);
          if (!otherWins) continue;

          const oMinX = otherZ.x - otherZ.width / 2;
          const oMaxX = otherZ.x + otherZ.width / 2;
          const oMinZ = otherZ.z - otherZ.depth / 2;
          const oMaxZ = otherZ.z + otherZ.depth / 2;

          const ovX = Math.max(0, Math.min(maxX, oMaxX) - Math.max(minX, oMinX));
          const ovZ = Math.max(0, Math.min(maxZ, oMaxZ) - Math.max(minZ, oMinZ));
          const curW = Math.max(0.2, maxX - minX);
          const curD = Math.max(0.2, maxZ - minZ);

          for (const cand of [
            { coord: oMinZ, side: 'north' as WallSideId },
            { coord: oMaxZ, side: 'south' as WallSideId },
          ]) {
            if (otherZ.wallSides?.[cand.side]?.mode === 'hidden') continue;
            const minReqForNorth = cand.side === 'north' ? 0.15 : curW * 0.65;
            if (ovX >= minReqForNorth && Math.abs(cand.coord - minZ) <= 0.25 && cand.coord < maxZ - 0.35) {
              minZ = cand.coord;
            }
            const minReqForSouth = cand.side === 'south' ? 0.15 : curW * 0.65;
            if (ovX >= minReqForSouth && Math.abs(cand.coord - maxZ) <= 0.25 && cand.coord > minZ + 0.35) {
              maxZ = cand.coord;
            }
          }

          for (const cand of [
            { coord: oMinX, side: 'west' as WallSideId },
            { coord: oMaxX, side: 'east' as WallSideId },
          ]) {
            if (otherZ.wallSides?.[cand.side]?.mode === 'hidden') continue;
            const minReqForWest = cand.side === 'west' ? 0.15 : curD * 0.65;
            if (ovZ >= minReqForWest && Math.abs(cand.coord - minX) <= 0.25 && cand.coord < maxX - 0.35) {
              minX = cand.coord;
            }
            const minReqForEast = cand.side === 'east' ? 0.15 : curD * 0.65;
            if (ovZ >= minReqForEast && Math.abs(cand.coord - maxX) <= 0.25 && cand.coord > minX + 0.35) {
              maxX = cand.coord;
            }
          }
        }

        if (maxX - minX < 0.25) {
          minX = z.x - z.width / 2;
          maxX = z.x + z.width / 2;
        }
        if (maxZ - minZ < 0.25) {
          minZ = z.z - z.depth / 2;
          maxZ = z.z + z.depth / 2;
        }

        effectiveIndoorBoundsMap.set(z.id, {
          minX,
          maxX,
          minZ,
          maxZ,
          x: (minX + maxX) / 2,
          z: (minZ + maxZ) / 2,
          width: maxX - minX,
          depth: maxZ - minZ,
        });
      }

      for (const zone of visibleZones) {
        const zoneLevel = zone.level ?? 0;
        const plinthOff = getZonePlinthOffset(zone);
        const yOffset = zoneLevel * FLOOR_HEIGHT + plinthOff;
        const outdoorRank = outdoorLayerRankMap.get(zone.id) ?? 0;
        const indoorRank = indoorLayerRankMap.get(zone.id) ?? 0;
        const isInteriorRoom =
          zone.zoneType === 'indoor' && isInteriorRoomZone(zone, visibleZones);
        const effBounds = effectiveIndoorBoundsMap.get(zone.id) ?? {
          minX: zone.x - zone.width / 2,
          maxX: zone.x + zone.width / 2,
          minZ: zone.z - zone.depth / 2,
          maxZ: zone.z + zone.depth / 2,
          x: zone.x,
          z: zone.z,
          width: zone.width,
          depth: zone.depth,
        };

        // Render Flush Architectural Foundation Plinth (Sockel) beneath EG indoor rooms from outdoor ground (-0.044m) up to yOffset
        // so exterior walls never hover or expose any floor slab underneath!
        if (zone.zoneType === 'indoor' && zoneLevel === 0) {
          const baseBottomY = -0.044;
          const totalPlinthH = Math.max(0.046, yOffset - baseBottomY);
          const plinthMat = new THREE.MeshStandardMaterial({
            color: 0x64748b,
            roughness: 0.78,
            metalness: 0.08,
          });
          if (zone.points && zone.points.length >= 3) {
            const plinthShape = new THREE.Shape();
            zone.points.forEach(([px, pz], idx) => {
              if (idx === 0) plinthShape.moveTo(px - zone.x, -(pz - zone.z));
              else plinthShape.lineTo(px - zone.x, -(pz - zone.z));
            });
            plinthShape.closePath();
            const plinthGeo = new THREE.ExtrudeGeometry(plinthShape, {
              depth: totalPlinthH,
              bevelEnabled: false,
            });
            plinthGeo.rotateX(-Math.PI / 2);
            const plinthBlock = new THREE.Mesh(plinthGeo, plinthMat);
            plinthBlock.position.set(zone.x, baseBottomY, zone.z);
            plinthBlock.receiveShadow = true;
            plinthBlock.castShadow = true;
            refs.architectureGroup.add(plinthBlock);
          } else {
            // Skip redundant plinthBlock if this child room is already inside a parent building shell on EG with >= plinth height
            const coveredByParentShell =
              isInteriorRoom &&
              visibleZones.some((shell) => {
                if (
                  shell.id === zone.id ||
                  shell.zoneType !== 'indoor' ||
                  (shell.level ?? 0) !== 0 ||
                  isInteriorRoomZone(shell, visibleZones)
                ) {
                  return false;
                }
                if (getZonePlinthOffset(shell) < plinthOff - 0.005) return false;
                const sEff = effectiveIndoorBoundsMap.get(shell.id);
                if (!sEff) return false;
                return (
                  effBounds.minX >= sEff.minX - 0.03 &&
                  effBounds.maxX <= sEff.maxX + 0.03 &&
                  effBounds.minZ >= sEff.minZ - 0.03 &&
                  effBounds.maxZ <= sEff.maxZ + 0.03
                );
              });

            if (!coveredByParentShell) {
              // Align plinth with effective wall bounds (inset by 2mm behind the 7cm outer wall face so it never pokes through!)
              const plinthExpand = isInteriorRoom ? 0.055 : 0.066;
              const plinthBlock = new THREE.Mesh(
                new THREE.BoxGeometry(
                  effBounds.width + plinthExpand * 2,
                  totalPlinthH,
                  effBounds.depth + plinthExpand * 2
                ),
                plinthMat
              );
              plinthBlock.position.set(effBounds.x, baseBottomY + totalPlinthH / 2, effBounds.z);
              plinthBlock.rotation.y = zone.rotationY ?? 0;
              plinthBlock.receiveShadow = true;
              plinthBlock.castShadow = true;
              refs.architectureGroup.add(plinthBlock);
            }
          }
        }

      const sharedMaterials: ZoneSharedMaterialEntry[] = [];
      const matMeta =
        SURFACE_MATERIALS.find((m) => m.id === zone.surfaceMaterial) || SURFACE_MATERIALS[0];
      const pbr = createSurfacePBRMaps(
        zone.surfaceMaterial,
        zone.width / 2.0,
        zone.depth / 2.0,
        refs.maxAnisotropy
      );

      let floorColor = 0xffffff;
      const isHeatmapColored = Boolean(
        showClimateHeatmap && zone.zoneType === 'indoor' && zone.climateEntityId
      );
      if (isHeatmapColored && zone.climateEntityId) {
        const clim = entities[zone.climateEntityId];
        const temp = clim?.attributes.current_temperature ?? 21.5;
        floorColor = temp >= 23 ? 0xfdba74 : temp >= 21 ? 0xfde68a : 0x93c5fd;
      }

      const isPoolZone = zone.surfaceMaterial === 'pool_water';
      // Interior rooms sit physically & graphically on top of the parent Wohnraum/Nebengebäude floor slab
      const indoorTopOffset = isInteriorRoom ? 0.012 + (indoorRank + 1) * 0.004 : 0;
      const pCfg = zone.poolConfig || {};
      const poolPalette = POOL_PALETTES[pCfg.tilePreset || 'azure'] || POOL_PALETTES.azure;

      // Fast single-lobe MeshStandardMaterial with PBR map & bumpMap + hardware polygonOffset for outdoor layers AND interior room floors
      const usePolyOffset =
        (zone.zoneType === 'outdoor' && !isPoolZone) || isInteriorRoom;
      const polyOffsetVal = isInteriorRoom
        ? -(indoorRank + 2) * 2
        : zone.zoneType === 'outdoor' && !isPoolZone
        ? -outdoorRank * 2
        : 0;
      const floorMat = new THREE.MeshStandardMaterial({
        map: pbr.map,
        bumpMap: pbr.bumpMap,
        bumpScale: matMeta.bumpScale,
        color: isPoolZone ? poolPalette.floor : floorColor,
        roughness: isPoolZone ? 0.18 : matMeta.roughness,
        metalness: isPoolZone ? 0.08 : matMeta.metalness,
        polygonOffset: usePolyOffset,
        polygonOffsetFactor: polyOffsetVal,
        polygonOffsetUnits: polyOffsetVal,
      });
      sharedMaterials.push({
        mat: floorMat,
        baseColor: floorMat.color.clone(),
        isHeatmapColored,
      });

      if (isPoolZone) {
        // =====================================================================
        // FREELY CONFIGURABLE 3D SWIMMING POOL (Freeform Polygon OR Rectangular/Shaped)
        // =====================================================================
        const isPolyPool = Boolean(zone.points && zone.points.length >= 3);
        const poolShape = pCfg.shape || 'rect';
        const basinDepth = THREE.MathUtils.clamp(pCfg.basinDepth ?? 0.65, 0.35, 2.2);
        const waterOffset = THREE.MathUtils.clamp(pCfg.waterLevelOffset ?? 0.004, -0.18, 0.02);
        const stepsPos = pCfg.stepsPosition ?? 'west';
        const stepsW = THREE.MathUtils.clamp(
          pCfg.stepsWidth ?? Math.min(1.6, zone.depth - 0.5),
          0.6,
          Math.max(zone.width, zone.depth) - 0.4
        );
        const stepsCount = THREE.MathUtils.clamp(pCfg.stepsCount ?? 3, 2, 5);
        const ladderPos = pCfg.ladderPosition ?? 'east';

        const poolWallMat = new THREE.MeshStandardMaterial({
          map: pbr.map,
          color: poolPalette.wall,
          roughness: 0.2,
          metalness: 0.08,
        });
        sharedMaterials.push({ mat: poolWallMat, baseColor: poolWallMat.color.clone() });

        const wallH = basinDepth + 0.04;
        const wallY = yOffset - basinDepth / 2 + 0.01;

        const waterVolumeMat = new THREE.MeshStandardMaterial({
          color: poolPalette.floor,
          emissive: poolPalette.emissive,
          emissiveIntensity: 0.22,
          roughness: 0.1,
          metalness: 0.05,
          transparent: true,
          opacity: 0.34,
          depthWrite: false,
        });

        const waterMat = new THREE.MeshStandardMaterial({
          map: pbr.map,
          bumpMap: pbr.bumpMap,
          bumpScale: 0.038,
          color: poolPalette.water,
          emissive: poolPalette.emissive,
          emissiveIntensity: 0.28,
          roughness: 0.05,
          metalness: 0.18,
          envMapIntensity: 1.75,
          transparent: true,
          opacity: 0.84,
          depthWrite: false,
          side: THREE.DoubleSide,
        });
        refs.poolWaterMaterials.push(waterMat);

        if (isPolyPool && zone.points) {
          // 1. Freeform Polygon Pool Basin Floor, Inner Walls, Volumetric Water & Shimmering Water Surface
          const pts = zone.points;
          const polyShape = new THREE.Shape();
          polyShape.moveTo(pts[0][0], -pts[0][1]);
          for (let i = 1; i < pts.length; i++) {
            polyShape.lineTo(pts[i][0], -pts[i][1]);
          }
          polyShape.closePath();

          const floorGeo = new THREE.ExtrudeGeometry(polyShape, {
            depth: 0.08,
            bevelEnabled: false,
          });
          floorGeo.rotateX(-Math.PI / 2);
          const fUv = floorGeo.attributes.uv;
          if (fUv) {
            for (let i = 0; i < fUv.count; i++) {
              fUv.setXY(i, fUv.getX(i) * 0.35, fUv.getY(i) * 0.35);
            }
            fUv.needsUpdate = true;
          }
          const basinFloor = new THREE.Mesh(floorGeo, floorMat);
          basinFloor.position.set(0, yOffset - basinDepth - 0.04, 0);
          basinFloor.receiveShadow = true;
          basinFloor.userData = { zoneId: zone.id };
          refs.architectureGroup.add(basinFloor);

          // Polygon Inner Tiled Basin Walls along every vertex edge
          for (let i = 0; i < pts.length; i++) {
            const p1 = pts[i];
            const p2 = pts[(i + 1) % pts.length];
            const dx = p2[0] - p1[0];
            const dz = p2[1] - p1[1];
            const edgeLen = Math.hypot(dx, dz);
            if (edgeLen < 0.1) continue;
            const midX = (p1[0] + p2[0]) / 2;
            const midZ = (p1[1] + p2[1]) / 2;
            const rotY = -Math.atan2(dz, dx);
            let nx = -dz / edgeLen;
            let nz = dx / edgeLen;
            if (nx * (zone.x - midX) + nz * (zone.z - midZ) < 0) {
              nx = -nx;
              nz = -nz;
            }
            const segWall = new THREE.Mesh(
              new THREE.BoxGeometry(edgeLen + 0.06, wallH, 0.14),
              poolWallMat
            );
            segWall.position.set(midX + nx * 0.06, wallY, midZ + nz * 0.06);
            segWall.rotation.y = rotY;
            refs.architectureGroup.add(segWall);
          }

          // Extruded Freeform Underwater Volume
          const volDepth = Math.max(0.15, basinDepth - 0.06);
          const volGeo = new THREE.ExtrudeGeometry(polyShape, {
            depth: volDepth,
            bevelEnabled: false,
          });
          volGeo.rotateX(-Math.PI / 2);
          const waterVolume = new THREE.Mesh(volGeo, waterVolumeMat);
          waterVolume.position.set(0, yOffset - basinDepth + 0.02 + waterOffset, 0);
          waterVolume.renderOrder = 1;
          waterVolume.userData = { zoneId: zone.id };
          refs.architectureGroup.add(waterVolume);

          // Freeform Polygon Shimmering Water Surface
          const surfGeo = new THREE.ShapeGeometry(polyShape);
          surfGeo.rotateX(-Math.PI / 2);
          const sUv = surfGeo.attributes.uv;
          if (sUv) {
            for (let i = 0; i < sUv.count; i++) {
              sUv.setXY(i, sUv.getX(i) * 0.25, sUv.getY(i) * 0.25);
            }
            sUv.needsUpdate = true;
          }
          const waterSurface = new THREE.Mesh(surfGeo, waterMat);
          waterSurface.position.set(0, yOffset + waterOffset, 0);
          waterSurface.renderOrder = 2;
          waterSurface.userData = { zoneId: zone.id };
          refs.architectureGroup.add(waterSurface);
        } else {
          // 2. Rectangular / Shaped ('rect', 'oval', 'l_shape', 'roman') Pool Basin
          const basinFloor = new THREE.Mesh(
            new THREE.BoxGeometry(zone.width - 0.16, 0.08, zone.depth - 0.16),
            floorMat
          );
          basinFloor.position.set(zone.x, yOffset - basinDepth, zone.z);
          basinFloor.receiveShadow = true;
          basinFloor.userData = { zoneId: zone.id };
          refs.architectureGroup.add(basinFloor);

          const pWallN = new THREE.Mesh(
            new THREE.BoxGeometry(zone.width - 0.06, wallH, 0.14),
            poolWallMat
          );
          pWallN.position.set(zone.x, wallY, zone.z - zone.depth / 2 + 0.07);
          const pWallS = pWallN.clone();
          pWallS.position.z = zone.z + zone.depth / 2 - 0.07;
          const pWallW = new THREE.Mesh(
            new THREE.BoxGeometry(0.14, wallH, zone.depth - 0.2),
            poolWallMat
          );
          pWallW.position.set(zone.x - zone.width / 2 + 0.07, wallY, zone.z);
          const pWallE = pWallW.clone();
          pWallE.position.x = zone.x + zone.width / 2 - 0.07;
          refs.architectureGroup.add(pWallN, pWallS, pWallW, pWallE);

          // Shape-Specific Architectural Pool Modifiers ('l_shape', 'oval', 'roman')
          const copingColorHex = pCfg.copingColor || zone.wallColor || '#e5dfd6';
          const shapeDeckMat = new THREE.MeshStandardMaterial({
            color: copingColorHex,
            roughness: 0.34,
            metalness: 0.04,
          });
          sharedMaterials.push({ mat: shapeDeckMat, baseColor: shapeDeckMat.color.clone() });

          if (poolShape === 'l_shape') {
            const cutW = zone.width * 0.4;
            const cutD = zone.depth * 0.44;
            const lBlock = new THREE.Mesh(
              new THREE.BoxGeometry(cutW, wallH + 0.05, cutD),
              shapeDeckMat
            );
            lBlock.position.set(
              zone.x + zone.width / 2 - cutW / 2,
              wallY + 0.025,
              zone.z - zone.depth / 2 + cutD / 2
            );
            lBlock.receiveShadow = true;
            lBlock.userData = { zoneId: zone.id };
            refs.architectureGroup.add(lBlock);
          } else if (poolShape === 'oval') {
            const r = Math.min(zone.width, zone.depth) * 0.28;
            for (const [sx, sz] of [
              [-1, -1],
              [1, -1],
              [-1, 1],
              [1, 1],
            ]) {
              const cornerInfill = new THREE.Mesh(
                new THREE.CylinderGeometry(r, r, wallH + 0.05, 16),
                shapeDeckMat
              );
              cornerInfill.position.set(
                zone.x + sx * (zone.width / 2 - r * 0.38),
                wallY + 0.025,
                zone.z + sz * (zone.depth / 2 - r * 0.38)
              );
              refs.architectureGroup.add(cornerInfill);
            }
          } else if (poolShape === 'roman') {
            const apseR = Math.min(1.1, zone.depth * 0.36);
            const apseStep = new THREE.Mesh(
              new THREE.CylinderGeometry(apseR, apseR * 1.15, wallH * 0.55, 24, 1, false, 0, Math.PI),
              new THREE.MeshStandardMaterial({ color: poolPalette.step, roughness: 0.25 })
            );
            apseStep.position.set(
              zone.x - zone.width / 2 + 0.14,
              yOffset - basinDepth + (wallH * 0.55) / 2,
              zone.z
            );
            refs.architectureGroup.add(apseStep);
          }

          const waterVolume = new THREE.Mesh(
            new THREE.BoxGeometry(zone.width - 0.24, basinDepth - 0.08, zone.depth - 0.24),
            waterVolumeMat
          );
          waterVolume.position.set(zone.x, yOffset - basinDepth / 2 + waterOffset, zone.z);
          waterVolume.renderOrder = 1;
          waterVolume.userData = { zoneId: zone.id };
          refs.architectureGroup.add(waterVolume);

          const waterSurface = new THREE.Mesh(
            new THREE.PlaneGeometry(zone.width - 0.18, zone.depth - 0.18, 16, 12),
            waterMat
          );
          waterSurface.rotation.x = -Math.PI / 2;
          waterSurface.position.set(zone.x, yOffset + waterOffset, zone.z);
          waterSurface.renderOrder = 2;
          waterSurface.userData = { zoneId: zone.id };
          refs.architectureGroup.add(waterSurface);
        }

        // Configurable Submerged Pool Entry Steps ('west' | 'east' | 'north' | 'south' | 'none')
        if (stepsPos !== 'none') {
          const stepMat = new THREE.MeshStandardMaterial({
            color: poolPalette.step,
            roughness: 0.24,
            metalness: 0.06,
          });
          const stepTread = 0.32;
          const unitStepH = (basinDepth * 0.78) / stepsCount;

          if (isPolyPool && zone.points && zone.points.length >= 3) {
            // Place steps inside the first polygon edge
            const p1 = zone.points[0];
            const p2 = zone.points[1];
            const dx = p2[0] - p1[0];
            const dz = p2[1] - p1[1];
            const edgeLen = Math.hypot(dx, dz);
            if (edgeLen > 0.6) {
              const midX = (p1[0] + p2[0]) / 2;
              const midZ = (p1[1] + p2[1]) / 2;
              const rotY = -Math.atan2(dz, dx);
              let nx = -dz / edgeLen;
              let nz = dx / edgeLen;
              if (nx * (zone.x - midX) + nz * (zone.z - midZ) < 0) {
                nx = -nx;
                nz = -nz;
              }
              const actualW = Math.min(stepsW, edgeLen - 0.35);
              for (let s = 0; s < stepsCount; s++) {
                const stepH = (stepsCount - s) * unitStepH;
                const inset = 0.18 + stepTread / 2 + s * stepTread;
                const stepMesh = new THREE.Mesh(
                  new THREE.BoxGeometry(actualW, stepH, stepTread),
                  stepMat
                );
                stepMesh.position.set(
                  midX + nx * inset,
                  yOffset - basinDepth + 0.04 + stepH / 2,
                  midZ + nz * inset
                );
                stepMesh.rotation.y = rotY;
                refs.architectureGroup.add(stepMesh);
              }
            }
          } else {
            for (let s = 0; s < stepsCount; s++) {
              const stepH = (stepsCount - s) * unitStepH;
              const isEW = stepsPos === 'west' || stepsPos === 'east';
              const w = isEW ? stepTread : Math.min(stepsW, zone.width - 0.45);
              const d = isEW ? Math.min(stepsW, zone.depth - 0.45) : stepTread;

              const stepMesh = new THREE.Mesh(
                new THREE.BoxGeometry(w, stepH, d),
                stepMat
              );
              let sx = zone.x;
              let sz = zone.z;
              if (stepsPos === 'west') {
                sx = zone.x - zone.width / 2 + 0.16 + stepTread / 2 + s * stepTread;
              } else if (stepsPos === 'east') {
                sx = zone.x + zone.width / 2 - 0.16 - stepTread / 2 - s * stepTread;
              } else if (stepsPos === 'north') {
                sz = zone.z - zone.depth / 2 + 0.16 + stepTread / 2 + s * stepTread;
              } else if (stepsPos === 'south') {
                sz = zone.z + zone.depth / 2 - 0.16 - stepTread / 2 - s * stepTread;
              }
              stepMesh.position.set(sx, yOffset - basinDepth + 0.04 + stepH / 2, sz);
              refs.architectureGroup.add(stepMesh);
            }
          }
        }

        // Configurable Brushed Stainless Steel Pool Ladder ('east' | 'west' | 'north' | 'south' | 'none')
        if (ladderPos !== 'none') {
          const steelLadderMat = new THREE.MeshStandardMaterial({
            color: 0xe2e8f0,
            roughness: 0.16,
            metalness: 0.92,
          });
          const ladderGroup = new THREE.Group();
          for (const offset of [-0.26, 0.26]) {
            const railVert = new THREE.Mesh(
              new THREE.CylinderGeometry(0.018, 0.018, Math.min(1.1, basinDepth + 0.36), 12),
              steelLadderMat
            );
            railVert.position.set(0, 0.04, offset);
            const railTop = new THREE.Mesh(
              new THREE.TorusGeometry(0.14, 0.018, 10, 20, Math.PI),
              steelLadderMat
            );
            railTop.position.set(0.14, 0.48, offset);
            ladderGroup.add(railVert, railTop);
          }
          if (isPolyPool && zone.points && zone.points.length >= 3) {
            const edgeIdx = Math.min(2, zone.points.length - 1);
            const p1 = zone.points[edgeIdx];
            const p2 = zone.points[(edgeIdx + 1) % zone.points.length];
            const midX = (p1[0] + p2[0]) / 2;
            const midZ = (p1[1] + p2[1]) / 2;
            const dx = p2[0] - p1[0];
            const dz = p2[1] - p1[1];
            ladderGroup.position.set(midX, yOffset, midZ);
            ladderGroup.rotation.y = -Math.atan2(dz, dx) + Math.PI / 2;
          } else if (ladderPos === 'east') {
            ladderGroup.position.set(zone.x + zone.width / 2 - 0.18, yOffset, zone.z);
          } else if (ladderPos === 'west') {
            ladderGroup.position.set(zone.x - zone.width / 2 + 0.18, yOffset, zone.z);
            ladderGroup.rotation.y = Math.PI;
          } else if (ladderPos === 'north') {
            ladderGroup.position.set(zone.x, yOffset, zone.z - zone.depth / 2 + 0.18);
            ladderGroup.rotation.y = Math.PI / 2;
          } else if (ladderPos === 'south') {
            ladderGroup.position.set(zone.x, yOffset, zone.z + zone.depth / 2 - 0.18);
            ladderGroup.rotation.y = -Math.PI / 2;
          }
          refs.architectureGroup.add(ladderGroup);
        }

        // Optional Stainless Steel Waterfall Massage Jet (Schwalldusche / Fontäne)
        if (pCfg.hasWaterfallJet) {
          const jetSteelMat = new THREE.MeshStandardMaterial({
            color: 0xe2e8f0,
            roughness: 0.15,
            metalness: 0.94,
          });
          const jetGroup = new THREE.Group();
          if (isPolyPool && zone.points && zone.points.length >= 3) {
            jetGroup.position.set(zone.points[0][0], yOffset + 0.04, zone.points[0][1]);
          } else {
            jetGroup.position.set(zone.x - zone.width * 0.2, yOffset + 0.04, zone.z - zone.depth / 2 - 0.05);
          }
          const column = new THREE.Mesh(
            new THREE.BoxGeometry(0.32, 0.72, 0.12),
            jetSteelMat
          );
          column.position.y = 0.36;
          const hood = new THREE.Mesh(
            new THREE.BoxGeometry(0.34, 0.06, 0.36),
            jetSteelMat
          );
          hood.position.set(0, 0.7, 0.14);
          hood.rotation.x = 0.22;
          const waterSheet = new THREE.Mesh(
            new THREE.BoxGeometry(0.3, 0.68, 0.025),
            new THREE.MeshStandardMaterial({
              color: 0x7dd3fc,
              emissive: 0x0ea5e9,
              emissiveIntensity: 0.35,
              transparent: true,
              opacity: 0.72,
              depthWrite: false,
            })
          );
          waterSheet.position.set(0, 0.33, 0.42);
          waterSheet.rotation.x = -0.35;
          jetGroup.add(column, hood, waterSheet);
          refs.architectureGroup.add(jetGroup);
        }

        // Optional Motorized Slatted Solar Pool Cover (Rollladenabdeckung 0..100%)
        if (pCfg.hasPoolCover && !isPolyPool) {
          const coverPct = THREE.MathUtils.clamp(pCfg.coverPositionPct ?? 35, 0, 100) / 100;
          const coverHousing = new THREE.Mesh(
            new THREE.BoxGeometry(0.32, 0.14, zone.depth - 0.12),
            new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.3, metalness: 0.7 })
          );
          coverHousing.position.set(
            zone.x + zone.width / 2 - 0.22,
            yOffset + 0.05,
            zone.z
          );
          refs.architectureGroup.add(coverHousing);

          if (coverPct > 0.02) {
            const coverLen = (zone.width - 0.42) * coverPct;
            const coverMesh = new THREE.Mesh(
              new THREE.BoxGeometry(coverLen, 0.024, zone.depth - 0.24),
              new THREE.MeshStandardMaterial({
                color: 0x334155,
                roughness: 0.28,
                metalness: 0.62,
              })
            );
            coverMesh.position.set(
              zone.x + zone.width / 2 - 0.36 - coverLen / 2,
              yOffset + waterOffset + 0.018,
              zone.z
            );
            coverMesh.userData = { zoneId: zone.id };
            refs.architectureGroup.add(coverMesh);
          }
        }
      } else if (
        (zone.points && zone.points.length >= 3) ||
        isZoneRotated(zone) ||
        (zone.zoneType === 'outdoor' &&
          (poolZonesByLevel.get(zoneLevel) || []).some(
            (pz) => (pz.points && pz.points.length >= 3) || isZoneRotated(pz)
          ))
      ) {
        // Freeform Polygon OR Rotated Rectangular Slab Placement
        // Indoor floor slabs are 2.4cm thin and sit ABOVE yOffset (inside the walls) and inset by 6cm from the wall centerlines
        const floorThickness = zone.zoneType === 'indoor' ? 0.024 : 0.065;
        const outdoorTopY = yOffset - 0.042 + outdoorRank * 0.0045;
        const floorBottomY =
          zone.zoneType === 'indoor'
            ? yOffset + indoorTopOffset + 0.002
            : outdoorTopY - floorThickness;

        const rawPts: [number, number][] = getZoneCorners(zone);
        const outerPts: [number, number][] =
          zone.zoneType === 'indoor'
            ? rawPts.map(([px, pz]) => {
                const dx = px - zone.x;
                const dz = pz - zone.z;
                const dist = Math.hypot(dx, dz) || 1;
                const inset = Math.min(0.06, dist * 0.15);
                return [px - (dx / dist) * inset, pz - (dz / dist) * inset];
              })
            : rawPts;

        const shape = new THREE.Shape();
        shape.moveTo(outerPts[0][0], -outerPts[0][1]);
        for (let i = 1; i < outerPts.length; i++) {
          shape.lineTo(outerPts[i][0], -outerPts[i][1]);
        }
        shape.closePath();

        // Punch out any overlapping swimming pool footprints OR Kellertreppe stairwell cutouts on the same floor level
        if (zone.zoneType === 'outdoor') {
          const sameLevelPools = poolZonesByLevel.get(zoneLevel) || [];
          for (const poolZ of sameLevelPools) {
            if (
              Math.abs(poolZ.x - zone.x) > (poolZ.width + zone.width) / 2 ||
              Math.abs(poolZ.z - zone.z) > (poolZ.depth + zone.depth) / 2
            ) {
              continue;
            }
            const holePts: [number, number][] = getZoneCorners(poolZ);
            const holePath = new THREE.Path();
            holePath.moveTo(holePts[0][0], -holePts[0][1]);
            for (let i = 1; i < holePts.length; i++) {
              holePath.lineTo(holePts[i][0], -holePts[i][1]);
            }
            holePath.closePath();
            shape.holes.push(holePath);
          }
          if (zoneLevel === 0) {
            for (const kh of kellertreppeGroundHoles) {
              const cx = (kh.minX + kh.maxX) / 2;
              const cz = (kh.minZ + kh.maxZ) / 2;
              if (!isPointInsideZone(cx, cz, zone)) continue;
              const holePath = new THREE.Path();
              holePath.moveTo(kh.corners[0][0], -kh.corners[0][1]);
              for (let i = 1; i < kh.corners.length; i++) {
                holePath.lineTo(kh.corners[i][0], -kh.corners[i][1]);
              }
              holePath.closePath();
              shape.holes.push(holePath);
            }
          }
        } else if (zone.zoneType === 'indoor') {
          // Punch out any multi-story stairwell openings (Treppenaugen) arriving on this floor level
          const stairHoles = stairHolesByUpperLevel.get(zoneLevel) || [];
          for (const sh of stairHoles) {
            const cx = (sh.minX + sh.maxX) / 2;
            const cz = (sh.minZ + sh.maxZ) / 2;
            if (!isPointInsideZone(cx, cz, zone)) continue;
            const holePath = new THREE.Path();
            holePath.moveTo(sh.corners[0][0], -sh.corners[0][1]);
            for (let i = 1; i < sh.corners.length; i++) {
              holePath.lineTo(sh.corners[i][0], -sh.corners[i][1]);
            }
            holePath.closePath();
            shape.holes.push(holePath);
          }
        }

        const polyGeo = new THREE.ExtrudeGeometry(shape, {
          depth: floorThickness,
          bevelEnabled: false,
        });
        polyGeo.rotateX(-Math.PI / 2);

        // Normalize UVs for procedural PBR floor textures
        const uvAttr = polyGeo.attributes.uv;
        if (uvAttr) {
          for (let i = 0; i < uvAttr.count; i++) {
            uvAttr.setXY(i, uvAttr.getX(i) * 0.4, uvAttr.getY(i) * 0.4);
          }
          uvAttr.needsUpdate = true;
        }

        const floorMesh = new THREE.Mesh(polyGeo, floorMat);
        floorMesh.position.set(0, floorBottomY, 0);
        floorMesh.receiveShadow = true;
        if (isInteriorRoom) {
          floorMesh.renderOrder = 10 + indoorRank;
        }
        floorMesh.userData = { zoneId: zone.id, isHeatmapColored, isInteriorRoom };
        refs.architectureGroup.add(floorMesh);
      } else {
        // Zero-Z-Fighting Rectangular Slab Placement with Flush Wall/Plinth Alignment:
        // All indoor floor slabs are 2.4cm thin, positioned ABOVE yOffset (inside the walls) and inset by 12cm (6cm per side) behind the 14cm walls!
        const floorThickness = zone.zoneType === 'indoor' ? 0.024 : 0.065;
        const outdoorTopY = yOffset - 0.042 + outdoorRank * 0.0045;
        const floorY =
          zone.zoneType === 'indoor'
            ? yOffset + indoorTopOffset + floorThickness / 2 + 0.002
            : outdoorTopY - floorThickness / 2;

        // Inset indoor slabs by 14cm (7cm per side = full half-thickness of the 14cm wall) behind the effective wall bounds
        // so the floor slab edge NEVER pokes out of any exterior facade, gable wall, or foundation plinth!
        const slabInset = zone.zoneType === 'indoor' ? 0.14 : 0.012;

        // Subtract any recessed swimming pool zones, Kellertreppe stairwell cutouts, OR child interior rooms on this floor level
        let slabRects: Rect2D[] = [
          {
            minX: effBounds.x - Math.max(0.2, effBounds.width - slabInset) / 2,
            maxX: effBounds.x + Math.max(0.2, effBounds.width - slabInset) / 2,
            minZ: effBounds.z - Math.max(0.2, effBounds.depth - slabInset) / 2,
            maxZ: effBounds.z + Math.max(0.2, effBounds.depth - slabInset) / 2,
          },
        ];
        if (zone.zoneType === 'outdoor') {
          const sameLevelPools = poolZonesByLevel.get(zoneLevel) || [];
          for (const poolZ of sameLevelPools) {
            const hole: Rect2D = {
              minX: poolZ.x - poolZ.width / 2,
              maxX: poolZ.x + poolZ.width / 2,
              minZ: poolZ.z - poolZ.depth / 2,
              maxZ: poolZ.z + poolZ.depth / 2,
            };
            slabRects = slabRects.flatMap((r) => subtractRect2D(r, hole));
          }
          if (zoneLevel === 0) {
            for (const kh of kellertreppeGroundHoles) {
              const hole: Rect2D = {
                minX: kh.minX,
                maxX: kh.maxX,
                minZ: kh.minZ,
                maxZ: kh.maxZ,
              };
              slabRects = slabRects.flatMap((r) => subtractRect2D(r, hole));
            }
          }
        } else if (zone.zoneType === 'indoor') {
          const myArea = computeZoneAreaM2(zone);

          // 0. Bridge partial wall deduplication gaps & clip side-by-side room overlaps so:
          //    - When a portion of `zone`'s wall was merged into a nearby winning wall (`<= 0.25m` outside `effBounds`),
          //      a floor bridge strip extends `zone`'s floor right up to the standing wall (fixing gaps in front of walls!).
          //    - When `zone` overlaps slightly into a side-by-side room `otherZ` that owns the shared wall (`otherWins`),
          //      `otherZ`'s footprint (up to the shared wall centerline) is subtracted from `zone`'s floor so `zone`'s floor
          //      NEVER pokes through the shared wall or doorway into `otherZ`!
          for (const otherZ of visibleZones) {
            if (
              otherZ.id === zone.id ||
              otherZ.zoneType !== 'indoor' ||
              (otherZ.level ?? 0) !== zoneLevel ||
              (otherZ.points && otherZ.points.length >= 3) ||
              isZoneRotated(otherZ)
            ) {
              continue;
            }
            const otherArea = computeZoneAreaM2(otherZ);
            const otherWins =
              otherArea > myArea + 0.05 ||
              (Math.abs(otherArea - myArea) <= 0.05 && otherZ.id < zone.id);
            if (!otherWins) continue;

            const oEff = effectiveIndoorBoundsMap.get(otherZ.id) ?? {
              minX: otherZ.x - otherZ.width / 2,
              maxX: otherZ.x + otherZ.width / 2,
              minZ: otherZ.z - otherZ.depth / 2,
              maxZ: otherZ.z + otherZ.depth / 2,
              x: otherZ.x,
              z: otherZ.z,
              width: otherZ.width,
              depth: otherZ.depth,
            };

            const ovMinX = Math.max(effBounds.minX, oEff.minX);
            const ovMaxX = Math.min(effBounds.maxX, oEff.maxX);
            const ovMinZ = Math.max(effBounds.minZ, oEff.minZ);
            const ovMaxZ = Math.min(effBounds.maxZ, oEff.maxZ);
            const ovW = Math.max(0, ovMaxX - ovMinX);
            const ovD = Math.max(0, ovMaxZ - ovMinZ);
            const ovArea = ovW * ovD;

            // Side-by-side room overlap (not a parent building hull): clip `zone`'s floor against `otherZ`!
            if (ovArea > 0.005 && ovArea < Math.min(myArea, otherArea) * 0.65) {
              const neighborClip: Rect2D = {
                minX: oEff.minX - 0.06,
                maxX: oEff.maxX + 0.06,
                minZ: oEff.minZ - 0.06,
                maxZ: oEff.maxZ + 0.06,
              };
              slabRects = slabRects.flatMap((r) => subtractRect2D(r, neighborClip));
            }

            // Bridge partial gap (<= 0.25m) where `zone`'s wall was deduplicated into `otherZ`'s standing wall
            if (ovW > 0.25) {
              const bMinX = ovMinX + 0.065;
              const bMaxX = ovMaxX - 0.065;
              if (bMaxX > bMinX + 0.08) {
                // North side of `zone` merged into `oEff.maxZ` just north of `effBounds.minZ`
                if (
                  otherZ.wallSides?.south?.mode !== 'hidden' &&
                  oEff.maxZ < effBounds.minZ &&
                  effBounds.minZ - oEff.maxZ <= 0.25
                ) {
                  slabRects.push({
                    minX: bMinX,
                    maxX: bMaxX,
                    minZ: oEff.maxZ + 0.06,
                    maxZ: effBounds.minZ + 0.08,
                  });
                }
                // South side of `zone` merged into `oEff.minZ` just south of `effBounds.maxZ`
                if (
                  otherZ.wallSides?.north?.mode !== 'hidden' &&
                  oEff.minZ > effBounds.maxZ &&
                  oEff.minZ - effBounds.maxZ <= 0.25
                ) {
                  slabRects.push({
                    minX: bMinX,
                    maxX: bMaxX,
                    minZ: effBounds.maxZ - 0.08,
                    maxZ: oEff.minZ - 0.06,
                  });
                }
              }
            }
            if (ovD > 0.25) {
              const bMinZ = ovMinZ + 0.065;
              const bMaxZ = ovMaxZ - 0.065;
              if (bMaxZ > bMinZ + 0.08) {
                // West side of `zone` merged into `oEff.maxX` just west of `effBounds.minX`
                if (
                  otherZ.wallSides?.east?.mode !== 'hidden' &&
                  oEff.maxX < effBounds.minX &&
                  effBounds.minX - oEff.maxX <= 0.25
                ) {
                  slabRects.push({
                    minX: oEff.maxX + 0.06,
                    maxX: effBounds.minX + 0.08,
                    minZ: bMinZ,
                    maxZ: bMaxZ,
                  });
                }
                // East side of `zone` merged into `oEff.minX` just east of `effBounds.maxX`
                if (
                  otherZ.wallSides?.west?.mode !== 'hidden' &&
                  oEff.minX > effBounds.maxX &&
                  oEff.minX - effBounds.maxX <= 0.25
                ) {
                  slabRects.push({
                    minX: effBounds.maxX - 0.08,
                    maxX: oEff.minX - 0.06,
                    minZ: bMinZ,
                    maxZ: bMaxZ,
                  });
                }
              }
            }
          }

          // 1. Clip upper-floor slabs (1. OG / DG) to the sloped roof envelope so no rectangular floor pokes out through the roof tiles!
          if (zoneLevel >= 1) {
            slabRects = slabRects
              .map((r) => clipRectToRoofEnvelope(r, zoneLevel, zone))
              .filter((r): r is Rect2D => r !== null);
          }

          // 2. If this zone is a parent building shell (`Wohnraum` / `!isInteriorRoom`), subtract all child interior rooms (`Raum`)
          // on the same floor so the parent building's floor texture never peeks out at doorways, thresholds, or exterior edges!
          if (!isInteriorRoom) {
            for (const otherZ of visibleZones) {
              if (
                otherZ.id === zone.id ||
                otherZ.zoneType !== 'indoor' ||
                (otherZ.level ?? 0) !== zoneLevel ||
                !isInteriorRoomZone(otherZ, visibleZones)
              ) {
                continue;
              }
              const oEff = effectiveIndoorBoundsMap.get(otherZ.id) ?? {
                minX: otherZ.x - otherZ.width / 2,
                maxX: otherZ.x + otherZ.width / 2,
                minZ: otherZ.z - otherZ.depth / 2,
                maxZ: otherZ.z + otherZ.depth / 2,
                x: otherZ.x,
                z: otherZ.z,
                width: otherZ.width,
                depth: otherZ.depth,
              };
              const ovX = Math.max(0, Math.min(effBounds.maxX, oEff.maxX) - Math.max(effBounds.minX, oEff.minX));
              const ovZ = Math.max(0, Math.min(effBounds.maxZ, oEff.maxZ) - Math.max(effBounds.minZ, oEff.minZ));
              if (ovX * ovZ < 0.05 && !isPointInsideZone(otherZ.x, otherZ.z, zone)) continue;
              const childHole: Rect2D = {
                minX:
                  Math.abs(oEff.minX - effBounds.minX) <= 0.32
                    ? effBounds.minX - 0.15
                    : oEff.minX - 0.065,
                maxX:
                  Math.abs(oEff.maxX - effBounds.maxX) <= 0.32
                    ? effBounds.maxX + 0.15
                    : oEff.maxX + 0.065,
                minZ:
                  Math.abs(oEff.minZ - effBounds.minZ) <= 0.32
                    ? effBounds.minZ - 0.15
                    : oEff.minZ - 0.065,
                maxZ:
                  Math.abs(oEff.maxZ - effBounds.maxZ) <= 0.32
                    ? effBounds.maxZ + 0.15
                    : oEff.maxZ + 0.065,
              };
              slabRects = slabRects.flatMap((r) => subtractRect2D(r, childHole));
            }
          }

          const stairHoles = stairHolesByUpperLevel.get(zoneLevel) || [];
          for (const sh of stairHoles) {
            const hole: Rect2D = {
              minX: sh.minX,
              maxX: sh.maxX,
              minZ: sh.minZ,
              maxZ: sh.maxZ,
            };
            slabRects = slabRects.flatMap((r) => subtractRect2D(r, hole));

            // Render a sleek 3D stairwell rim & safety glass/oak gallery balustrade around the cutout if inside this zone
            const shCx = (sh.minX + sh.maxX) / 2;
            const shCz = (sh.minZ + sh.maxZ) / 2;
            if (isPointInsideZone(shCx, shCz, zone)) {
              const holeW = sh.maxX - sh.minX;
              const holeD = sh.maxZ - sh.minZ;
              const railH = 0.92;
              const glassRailMat = new THREE.MeshStandardMaterial({
                color: 0xcffafe,
                roughness: 0.12,
                metalness: 0.1,
                transparent: true,
                opacity: 0.36,
              });
              const oakHandrailMat = new THREE.MeshStandardMaterial({
                color: 0xb47b48,
                roughness: 0.45,
                metalness: 0.05,
              });
              // Left & Right side gallery railings along Z
              for (const sideSign of [-1, 1]) {
                const rx = shCx + sideSign * (holeW / 2 + 0.03);
                const glassPane = new THREE.Mesh(
                  new THREE.BoxGeometry(0.024, railH, holeD),
                  glassRailMat
                );
                glassPane.position.set(rx, yOffset + railH / 2, shCz);
                const topRail = new THREE.Mesh(
                  new THREE.BoxGeometry(0.055, 0.04, holeD + 0.06),
                  oakHandrailMat
                );
                topRail.position.set(rx, yOffset + railH + 0.02, shCz);
                refs.architectureGroup.add(glassPane, topRail);
              }
            }
          }
        }

        for (const rect of slabRects) {
          const subW = rect.maxX - rect.minX;
          const subD = rect.maxZ - rect.minZ;
          if (subW < 0.05 || subD < 0.05) continue;
          const floorMesh = new THREE.Mesh(
            new THREE.BoxGeometry(subW, floorThickness, subD),
            floorMat
          );
          floorMesh.position.set(
            (rect.minX + rect.maxX) / 2,
            floorY,
            (rect.minZ + rect.maxZ) / 2
          );
          floorMesh.receiveShadow = true;
          if (isInteriorRoom) {
            floorMesh.renderOrder = 10 + indoorRank;
          }
          floorMesh.userData = { zoneId: zone.id, isHeatmapColored, isInteriorRoom };
          refs.architectureGroup.add(floorMesh);
        }
      }

      if (zone.zoneType === 'indoor') {
        const wallColorObj = new THREE.Color(zone.wallColor || '#e4e0d8');
        wallColorObj.multiplyScalar(0.84);
        const wallMat = new THREE.MeshStandardMaterial({
          color: wallColorObj,
          roughness: 0.78,
          metalness: 0.01,
        });
        const baseboardMat = new THREE.MeshStandardMaterial({
          color: 0xd6d3cd,
          roughness: 0.45,
          metalness: 0.02,
        });
        sharedMaterials.push(
          { mat: wallMat, baseColor: wallMat.color.clone() },
          { mat: baseboardMat, baseColor: baseboardMat.color.clone() }
        );

        const wallT = 0.14;
        // Zero wallInset so walls sit centered on the 2D boundary lines and merge seamlessly with adjacent rooms!
        const wallInset = 0;
        // Extend lower-floor walls up to FLOOR_HEIGHT (2.75m) whenever the building has upper floors or a multi-story roof,
        // and allow upper-floor walls inside a pitched roof to rise smoothly up to the roof underside!
        const hasUpperStoryOrMultiRoof =
          project.zones.some(
            (uz) =>
              uz.zoneType === 'indoor' &&
              (uz.level ?? 0) > zoneLevel &&
              areZonesInSameBuilding(zone, uz, project.zones)
          ) ||
          (zoneLevel === 0 &&
            multiStoryRoofEnvelopes.some((env) => areZonesInSameBuilding(zone, env, project.zones)));
        const isInsideMultiRoof =
          zoneLevel >= 1 &&
          multiStoryRoofEnvelopes.some((env) => areZonesInSameBuilding(zone, env, project.zones));
        const unifiedFloorH = getUnifiedBuildingFloorWallHeight(zone, zoneLevel);
        const h = isInsideMultiRoof
          ? Math.max(unifiedFloorH, 3.8)
          : hasUpperStoryOrMultiRoof
          ? Math.max(unifiedFloorH, FLOOR_HEIGHT)
          : unifiedFloorH;

        const myArea = computeZoneAreaM2(zone);

        if ((zone.points && zone.points.length >= 3) || isZoneRotated(zone)) {
          const pts = getZoneCorners(zone);
          for (let i = 0; i < pts.length; i++) {
            const p1 = pts[i];
            const p2 = pts[(i + 1) % pts.length];
            const dx = p2[0] - p1[0];
            const dz = p2[1] - p1[1];
            const edgeLen = Math.hypot(dx, dz);
            if (edgeLen < 0.15) continue;

            const ux = dx / edgeLen;
            const uz = dz / edgeLen;
            const midX = (p1[0] + p2[0]) / 2;
            const midZ = (p1[1] + p2[1]) / 2;
            const rotY = -Math.atan2(dz, dx);

            // Compute inward normal toward room centroid (zone.x, zone.z)
            let nx = -dz / edgeLen;
            let nz = dx / edgeLen;
            const toCenterX = zone.x - midX;
            const toCenterZ = zone.z - midZ;
            if (nx * toCenterX + nz * toCenterZ < 0) {
              nx = -nx;
              nz = -nz;
            }

            const startX = p1[0] + nx * wallInset;
            const startZ = p1[1] + nz * wallInset;
            const isSouthOrEast = midZ > zone.z + 0.15 || midX > zone.x + 0.15;

            // Deduplicate shared collinear edges with any other indoor room on the same level so shared walls are drawn once!
            const polyMergedSpans: { start: number; end: number }[] = [];
            for (const otherZone of visibleZones) {
              if (otherZone.id === zone.id || otherZone.zoneType !== 'indoor') continue;
              if ((otherZone.level ?? 0) !== zoneLevel) continue;
              const otherArea = computeZoneAreaM2(otherZone);
              const otherWins =
                otherArea > myArea + 0.05 ||
                (Math.abs(otherArea - myArea) <= 0.05 && otherZone.id < zone.id);
              if (!otherWins) continue;

              const oPts = getZoneCorners(otherZone);
              for (let j = 0; j < oPts.length; j++) {
                const q1 = oPts[j];
                const q2 = oPts[(j + 1) % oPts.length];
                const odx = q2[0] - q1[0];
                const odz = q2[1] - q1[1];
                const oLen = Math.hypot(odx, odz);
                if (oLen < 0.15) continue;
                const oux = odx / oLen;
                const ouz = odz / oLen;
                // Check parallel or anti-parallel collinearity
                if (Math.abs(ux * oux + uz * ouz) < 0.985) continue;
                const perpDist = Math.abs((q1[0] - p1[0]) * nx + (q1[1] - p1[1]) * nz);
                if (perpDist > 0.22) continue;

                const s1 = (q1[0] - p1[0]) * ux + (q1[1] - p1[1]) * uz;
                const s2 = (q2[0] - p1[0]) * ux + (q2[1] - p1[1]) * uz;
                const ovMin = Math.max(-wallT / 2, Math.min(s1, s2));
                const ovMax = Math.min(edgeLen + wallT / 2, Math.max(s1, s2));
                if (ovMax - ovMin > 0.08) {
                  polyMergedSpans.push({ start: ovMin - 0.02, end: ovMax + 0.02 });
                }
              }
            }
            polyMergedSpans.sort((a, b) => a.start - b.start);

            const polyActiveIntervals: { start: number; end: number }[] = [];
            let polySpanCursor = -wallT / 2;
            const polySpanMax = edgeLen + wallT / 2;
            for (const ms of polyMergedSpans) {
              if (ms.end <= polySpanCursor + 0.02) continue;
              if (ms.start > polySpanCursor + 0.04) {
                polyActiveIntervals.push({ start: polySpanCursor, end: ms.start });
              }
              polySpanCursor = Math.max(polySpanCursor, ms.end);
            }
            if (polySpanCursor < polySpanMax - 0.04) {
              polyActiveIntervals.push({ start: polySpanCursor, end: polySpanMax });
            }

            // Collect openings & electric roller gates along this polygon/rotated wall edge
            const polyCutouts: {
              center: number;
              width: number;
              height: number;
              sillHeight: number;
            }[] = [];

            for (const op of visibleOpenings) {
              if ((op.level ?? 0) !== zoneLevel) continue;
              const relX = op.x - p1[0];
              const relZ = op.z - p1[1];
              const along = relX * ux + relZ * uz;
              const perp = Math.abs(relX * nx + relZ * nz);
              if (
                perp <= 0.48 &&
                along + op.width / 2 > 0.04 &&
                along - op.width / 2 < edgeLen - 0.04
              ) {
                polyCutouts.push({
                  center: along,
                  width: op.width,
                  height: op.height,
                  sillHeight: op.sillHeight,
                });
              }
            }

            for (const asset of visibleAssets) {
              if (asset.catalogId !== 'electric_roller_gate') continue;
              if ((asset.level ?? 0) !== zoneLevel) continue;
              const relX = asset.position[0] - p1[0];
              const relZ = asset.position[2] - p1[1];
              const along = relX * ux + relZ * uz;
              const perp = Math.abs(relX * nx + relZ * nz);
              const gateW = 3.16 * (asset.scale || 1);
              const gateH = 2.38 * (asset.scale || 1);
              if (
                perp <= 0.55 &&
                along + gateW / 2 > 0.04 &&
                along - gateW / 2 < edgeLen - 0.04
              ) {
                polyCutouts.push({
                  center: along,
                  width: gateW,
                  height: gateH,
                  sillHeight: 0,
                });
              }
            }

            polyCutouts.sort((a, b) => a.center - b.center);

            const addPolyWallPiece = (
              segStart: number,
              segEnd: number,
              baseY: number,
              pieceH: number,
              withBaseboard: boolean
            ) => {
              const totalLen = segEnd - segStart;
              if (totalLen < 0.05 || pieceH < 0.04) return;
              const steps =
                zoneLevel >= 1 && multiStoryRoofEnvelopes.length > 0 && totalLen > 0.35
                  ? Math.min(20, Math.ceil(totalLen / 0.32))
                  : 1;
              const stepLen = totalLen / steps;
              const halfT = wallT * 0.55;

              for (let s = 0; s < steps; s++) {
                const subStart = segStart + s * stepLen;
                const subEnd = subStart + stepLen;
                const segLen = subEnd - subStart;
                const segMid = (subStart + subEnd) / 2;
                const px = startX + ux * segMid;
                const pz = startZ + uz * segMid;

                const sx = startX + ux * subStart;
                const sz = startZ + uz * subStart;
                const ex = startX + ux * subEnd;
                const ez = startZ + uz * subEnd;

                // Sample roof underside across BOTH wall faces (±nx * halfT) at start and end so no corner ever pokes through!
                const maxTopStart = Math.min(
                  getRoofMaxWallHeightAt(sx - nx * halfT, sz - nz * halfT, zoneLevel, baseY + pieceH),
                  getRoofMaxWallHeightAt(sx + nx * halfT, sz + nz * halfT, zoneLevel, baseY + pieceH)
                );
                const maxTopEnd = Math.min(
                  getRoofMaxWallHeightAt(ex - nx * halfT, ez - nz * halfT, zoneLevel, baseY + pieceH),
                  getRoofMaxWallHeightAt(ex + nx * halfT, ez + nz * halfT, zoneLevel, baseY + pieceH)
                );
                const hStart = Math.min(pieceH, maxTopStart - baseY);
                const hEnd = Math.min(pieceH, maxTopEnd - baseY);
                const maxClampedH = Math.max(hStart, hEnd);
                if (maxClampedH < 0.04) continue;

                const skirtH = 0.088;
                const hasSkirt =
                  withBaseboard && baseY < 0.02 && Math.min(hStart, hEnd) > skirtH + 0.05;
                const actualBaseY = hasSkirt ? baseY + skirtH + 0.002 : baseY;
                const actualHStart = Math.max(0.02, hasSkirt ? hStart - skirtH - 0.002 : hStart);
                const actualHEnd = Math.max(0.02, hasSkirt ? hEnd - skirtH - 0.002 : hEnd);
                const actualMaxH = Math.max(actualHStart, actualHEnd);

                if (hasSkirt) {
                  const skirt = new THREE.Mesh(
                    new THREE.BoxGeometry(segLen, skirtH, wallT),
                    baseboardMat
                  );
                  skirt.position.set(px, yOffset + 0.002 + skirtH / 2, pz);
                  skirt.rotation.y = rotY;
                  refs.architectureGroup!.add(skirt);
                }

                const wallGeo = buildSlopedWallGeometry(
                  segLen,
                  actualHStart,
                  actualHEnd,
                  wallT,
                  false
                );
                const wallMesh = new THREE.Mesh(wallGeo, wallMat);
                wallMesh.position.set(px, yOffset + actualBaseY + actualMaxH / 2, pz);
                wallMesh.rotation.y = rotY;
                wallMesh.castShadow = true;
                wallMesh.receiveShadow = true;
                wallMesh.userData = {
                  fullHeight: actualMaxH,
                  baseY: actualBaseY,
                  yOffset,
                  zoneId: zone.id,
                  isSouthOrEastWall: isSouthOrEast,
                  wallNormalX: -nx,
                  wallNormalZ: -nz,
                  wallCenterX: px,
                  wallCenterZ: pz,
                };
                refs.architectureGroup!.add(wallMesh);
                refs.indoorWalls.push(wallMesh);
              }
            };

            for (const interval of polyActiveIntervals) {
              let cursor = interval.start;
              for (const op of polyCutouts) {
                const rawStart = op.center - op.width / 2;
                const rawEnd = op.center + op.width / 2;
                if (rawEnd <= interval.start + 0.02 || rawStart >= interval.end - 0.02) continue;

                const opStart = Math.max(cursor, Math.max(interval.start, rawStart));
                const opEnd = Math.min(interval.end, rawEnd);
                if (opEnd <= opStart + 0.02) continue;

                if (opStart > cursor + 0.04) {
                  addPolyWallPiece(cursor, opStart, 0, h, true);
                }
                if (op.sillHeight > 0.05) {
                  addPolyWallPiece(opStart, opEnd, 0, op.sillHeight, true);
                }
                const topY = op.sillHeight + op.height;
                if (topY < h - 0.04) {
                  addPolyWallPiece(opStart, opEnd, topY, h - topY, false);
                }
                cursor = Math.max(cursor, opEnd);
              }
              if (cursor < interval.end - 0.04) {
                addPolyWallPiece(cursor, interval.end, 0, h, true);
              }
            }
          }
        } else {
          const wallSpecs: {
            sideId: WallSideId;
            x: number;
            z: number;
            boundaryCoord: number;
            w: number;
            d: number;
            isSouthOrEast: boolean;
          }[] = [
            // North Wall (centered on effective boundary line & extended +wallT so outer corners close flush!)
            {
              sideId: 'north',
              x: effBounds.x,
              z: effBounds.minZ + wallInset,
              boundaryCoord: effBounds.minZ,
              w: Math.max(0.4, effBounds.width + wallT),
              d: wallT,
              isSouthOrEast: false,
            },
            // South Wall (centered on effective boundary line & extended +wallT so outer corners close flush!)
            {
              sideId: 'south',
              x: effBounds.x,
              z: effBounds.maxZ - wallInset,
              boundaryCoord: effBounds.maxZ,
              w: Math.max(0.4, effBounds.width + wallT),
              d: wallT,
              isSouthOrEast: true,
            },
            // West Wall (centered on effective boundary line & meeting North/South walls flush with zero gap!)
            {
              sideId: 'west',
              x: effBounds.minX + wallInset,
              z: effBounds.z,
              boundaryCoord: effBounds.minX,
              w: wallT,
              d: Math.max(0.2, effBounds.depth - wallT + 0.004),
              isSouthOrEast: false,
            },
            // East Wall (centered on effective boundary line & meeting North/South walls flush with zero gap!)
            {
              sideId: 'east',
              x: effBounds.maxX - wallInset,
              z: effBounds.z,
              boundaryCoord: effBounds.maxX,
              w: wallT,
              d: Math.max(0.2, effBounds.depth - wallT + 0.004),
              isSouthOrEast: true,
            },
          ];

          for (const ws of wallSpecs) {
            const sideCfg = zone.wallSides?.[ws.sideId];
            if (sideCfg?.mode === 'hidden') {
              // Offene Küche / Wandseite ausgeblendet!
              continue;
            }

            const effectiveSideH =
              sideCfg?.mode === 'half_height' ? Math.min(h, 1.1) : h;
            const sideThick = sideCfg?.thickness ?? wallT;

            // Optional per-wall-side surface finish (Akustik-Holzlamellen, Klinker, Naturstein, Sichtbeton, Akzent-Tapete) or custom color
            let activeSideWallMat = wallMat;
            if (
              (sideCfg?.finish && sideCfg.finish !== 'plaster') ||
              sideCfg?.color ||
              visualStyle !== 'archviz'
            ) {
              const sideHex =
                visualStyle === 'blueprint'
                  ? '#1e3a8a'
                  : visualStyle === 'neon'
                  ? '#0f172a'
                  : sideCfg?.color || zone.wallColor || '#e4e0d8';
              const finishTex =
                sideCfg?.finish && sideCfg.finish !== 'plaster'
                  ? createWallFinishTexture(
                      sideCfg.finish,
                      sideHex,
                      Math.max(ws.w, ws.d) / 1.8,
                      effectiveSideH / 1.8
                    )
                  : null;
              const isGlassBlockFinish = sideCfg?.finish === 'glass_block';
              activeSideWallMat = new THREE.MeshStandardMaterial({
                map: finishTex || undefined,
                color: finishTex ? 0xffffff : new THREE.Color(sideHex).multiplyScalar(0.88),
                roughness: isGlassBlockFinish
                  ? 0.14
                  : sideCfg?.finish === 'stone_tile'
                  ? 0.35
                  : 0.75,
                metalness: isGlassBlockFinish ? 0.1 : visualStyle === 'neon' ? 0.35 : 0.02,
                transparent: isGlassBlockFinish,
                opacity: isGlassBlockFinish ? 0.84 : 1.0,
                emissive:
                  visualStyle === 'neon'
                    ? new THREE.Color(0x06b6d4)
                    : visualStyle === 'blueprint'
                    ? new THREE.Color(0x38bdf8)
                    : new THREE.Color(0x000000),
                emissiveIntensity:
                  visualStyle === 'neon' ? 0.14 : visualStyle === 'blueprint' ? 0.18 : 0,
              });
            }

            const isHoriz = ws.w >= ws.d;
            const spanMin = isHoriz ? ws.x - ws.w / 2 : ws.z - ws.d / 2;
            const spanMax = isHoriz ? ws.x + ws.w / 2 : ws.z + ws.d / 2;

            // Collect standard openings + any electric_roller_gate asset mounted on this wall!
            const cutoutSpecs: {
              center: number;
              width: number;
              height: number;
              sillHeight: number;
            }[] = [];
            // Separate full-height wall deduplication intervals so window lintels/sills are NEVER re-drawn inside a merged span!
            const mergedWallSpans: { start: number; end: number }[] = [];

            // If Wall Designer mode is 'archway' (Wanddurchbruch / Offener Bogen), automatically cut a central portal
            if (sideCfg?.mode === 'archway') {
              const spanLen = spanMax - spanMin;
              cutoutSpecs.push({
                center: (spanMin + spanMax) / 2,
                width: Math.max(0.9, spanLen * 0.62),
                height: Math.min(2.15, effectiveSideH - 0.32),
                sillHeight: 0,
              });
            }

            // Seamless Wall Merging: deduplicate co-linear walls when rooms are placed inside a larger indoor hull/garage/outbuilding
            // or adjacent to other indoor rooms (both rectangular AND freeform polygon rooms!) on the same floor level!
            const oppositeSideMap: Record<WallSideId, WallSideId> = {
              north: 'south',
              south: 'north',
              west: 'east',
              east: 'west',
            };
            for (const otherZone of visibleZones) {
              if (otherZone.id === zone.id || otherZone.zoneType !== 'indoor') continue;
              if ((otherZone.level ?? 0) !== zoneLevel) continue;
              const otherArea = computeZoneAreaM2(otherZone);

              if ((otherZone.points && otherZone.points.length >= 3) || isZoneRotated(otherZone)) {
                const otherWins =
                  otherArea > myArea + 0.05 ||
                  (Math.abs(otherArea - myArea) <= 0.05 && otherZone.id < zone.id);
                if (!otherWins) continue;
                const oPts = getZoneCorners(otherZone);
                for (let j = 0; j < oPts.length; j++) {
                  const q1 = oPts[j];
                  const q2 = oPts[(j + 1) % oPts.length];
                  if (isHoriz) {
                    if (
                      Math.abs(q1[1] - q2[1]) < 0.08 &&
                      Math.abs((q1[1] + q2[1]) / 2 - ws.boundaryCoord) <= 0.24
                    ) {
                      const ovMin = Math.max(spanMin, Math.min(q1[0], q2[0]) - wallT / 2);
                      const ovMax = Math.min(spanMax, Math.max(q1[0], q2[0]) + wallT / 2);
                      if (ovMax - ovMin > 0.08) {
                        mergedWallSpans.push({ start: ovMin - 0.02, end: ovMax + 0.02 });
                      }
                    }
                  } else {
                    if (
                      Math.abs(q1[0] - q2[0]) < 0.08 &&
                      Math.abs((q1[0] + q2[0]) / 2 - ws.boundaryCoord) <= 0.24
                    ) {
                      const ovMin = Math.max(spanMin, Math.min(q1[1], q2[1]) - wallT / 2);
                      const ovMax = Math.min(spanMax, Math.max(q1[1], q2[1]) + wallT / 2);
                      if (ovMax - ovMin > 0.08) {
                        mergedWallSpans.push({ start: ovMin - 0.02, end: ovMax + 0.02 });
                      }
                    }
                  }
                }
                continue;
              }

              const oEff = effectiveIndoorBoundsMap.get(otherZone.id) ?? {
                minX: otherZone.x - otherZone.width / 2,
                maxX: otherZone.x + otherZone.width / 2,
                minZ: otherZone.z - otherZ.depth / 2,
                maxZ: otherZone.z + otherZ.depth / 2,
                x: otherZone.x,
                z: otherZone.z,
                width: otherZone.width,
                depth: otherZone.depth,
              };

              const candidateSides: {
                side: WallSideId;
                coord: number;
                spanA: number;
                spanB: number;
              }[] = isHoriz
                ? [
                    {
                      side: ws.sideId,
                      coord: ws.sideId === 'north' ? oEff.minZ : oEff.maxZ,
                      spanA: oEff.minX - wallT / 2,
                      spanB: oEff.maxX + wallT / 2,
                    },
                    {
                      side: oppositeSideMap[ws.sideId],
                      coord: ws.sideId === 'north' ? oEff.maxZ : oEff.minZ,
                      spanA: oEff.minX - wallT / 2,
                      spanB: oEff.maxX + wallT / 2,
                    },
                  ]
                : [
                    {
                      side: ws.sideId,
                      coord: ws.sideId === 'west' ? oEff.minX : oEff.maxX,
                      spanA: oEff.minZ - wallT / 2,
                      spanB: oEff.maxZ + wallT / 2,
                    },
                    {
                      side: oppositeSideMap[ws.sideId],
                      coord: ws.sideId === 'west' ? oEff.maxX : oEff.minX,
                      spanA: oEff.minZ - wallT / 2,
                      spanB: oEff.maxZ + wallT / 2,
                    },
                  ];

              for (const cand of candidateSides) {
                if (Math.abs(cand.coord - ws.boundaryCoord) > 0.24) continue;
                const ovMin = Math.max(spanMin, cand.spanA);
                const ovMax = Math.min(spanMax, cand.spanB);
                if (ovMax - ovMin <= 0.08) continue;

                const otherSideCfg = otherZone.wallSides?.[cand.side];
                // Never let a smaller inner room with 'hidden' wall delete the outer building hull's exterior wall!
                const otherHiddenWins =
                  otherSideCfg?.mode === 'hidden' &&
                  cand.side === oppositeSideMap[ws.sideId] &&
                  otherArea >= myArea * 0.7;
                // Skip deduplication if the winning zone has that wall side hidden (otherwise an exterior facade would vanish)
                if (otherSideCfg?.mode === 'hidden' && !otherHiddenWins) {
                  continue;
                }
                const otherWins =
                  otherHiddenWins ||
                  otherArea > myArea + 0.05 ||
                  (Math.abs(otherArea - myArea) <= 0.05 && otherZone.id < zone.id);

                if (otherWins) {
                  mergedWallSpans.push({
                    start: Math.max(spanMin, ovMin - 0.02),
                    end: Math.min(spanMax, ovMax + 0.02),
                  });
                }
              }
            }

            for (const op of visibleOpenings) {
              if ((op.level ?? 0) !== zoneLevel) continue;
              const opIsVert = Math.abs(Math.sin(op.rotationY)) >= 0.6;
              if (isHoriz && opIsVert) continue;
              if (!isHoriz && !opIsVert) continue;
              const distFromWallLine = isHoriz
                ? Math.abs(op.z - ws.boundaryCoord)
                : Math.abs(op.x - ws.boundaryCoord);
              if (distFromWallLine > 0.48) continue;
              const opCenter = isHoriz ? op.x : op.z;
              if (
                opCenter + op.width / 2 > spanMin + 0.04 &&
                opCenter - op.width / 2 < spanMax - 0.04
              ) {
                cutoutSpecs.push({
                  center: opCenter,
                  width: op.width,
                  height: op.height,
                  sillHeight: op.sillHeight,
                });
              }
            }

            // Automatically cut the wall for any electric_roller_gate asset placed on a garage/Nebengebäude wall!
            for (const asset of visibleAssets) {
              if (asset.catalogId !== 'electric_roller_gate') continue;
              if ((asset.level ?? 0) !== zoneLevel) continue;
              const gateIsVert = Math.abs(Math.sin(asset.rotationY)) >= 0.6;
              if (isHoriz && gateIsVert) continue;
              if (!isHoriz && !gateIsVert) continue;
              const distFromWallLine = isHoriz
                ? Math.abs(asset.position[2] - ws.boundaryCoord)
                : Math.abs(asset.position[0] - ws.boundaryCoord);
              if (distFromWallLine > 0.55) continue;
              const gateCenter = isHoriz ? asset.position[0] : asset.position[2];
              const gateW = 3.16 * (asset.scale || 1);
              const gateH = 2.38 * (asset.scale || 1);
              if (
                gateCenter + gateW / 2 > spanMin + 0.04 &&
                gateCenter - gateW / 2 < spanMax - 0.04
              ) {
                cutoutSpecs.push({
                  center: gateCenter,
                  width: gateW,
                  height: gateH,
                  sillHeight: 0,
                });
              }
            }

            cutoutSpecs.sort((a, b) => a.center - b.center);
            mergedWallSpans.sort((a, b) => a.start - b.start);

            // Subtract mergedWallSpans from [spanMin, spanMax] to obtain active non-deduplicated wall intervals
            const activeWallIntervals: { start: number; end: number }[] = [];
            let spanCursor = spanMin;
            for (const ms of mergedWallSpans) {
              if (ms.end <= spanCursor + 0.02) continue;
              if (ms.start > spanCursor + 0.04) {
                activeWallIntervals.push({ start: spanCursor, end: ms.start });
              }
              spanCursor = Math.max(spanCursor, ms.end);
            }
            if (spanCursor < spanMax - 0.04) {
              activeWallIntervals.push({ start: spanCursor, end: spanMax });
            }

            const addWallPiece = (
              segStart: number,
              segEnd: number,
              baseY: number,
              pieceH: number,
              withBaseboard: boolean
            ) => {
              const totalLen = segEnd - segStart;
              if (totalLen < 0.05 || pieceH < 0.04) return;
              const steps =
                zoneLevel >= 1 && multiStoryRoofEnvelopes.length > 0 && totalLen > 0.28
                  ? Math.min(24, Math.ceil(totalLen / 0.28))
                  : 1;
              const stepLen = totalLen / steps;
              const halfT = sideThick * 0.55;

              for (let s = 0; s < steps; s++) {
                const subStart = segStart + s * stepLen;
                const subEnd = subStart + stepLen;
                const segLen = subEnd - subStart;
                const segCenter = (subStart + subEnd) / 2;
                const pieceW = isHoriz ? segLen : sideThick;
                const pieceD = isHoriz ? sideThick : segLen;
                const px = isHoriz ? segCenter : ws.x;
                const pz = isHoriz ? ws.z : segCenter;

                // Evaluate roof height at BOTH ends AND midpoint of this segment across BOTH faces of the wall thickness
                const startTopY = isHoriz
                  ? Math.min(
                      getRoofMaxWallHeightAt(subStart, ws.z - halfT, zoneLevel, baseY + pieceH),
                      getRoofMaxWallHeightAt(subStart, ws.z + halfT, zoneLevel, baseY + pieceH)
                    )
                  : Math.min(
                      getRoofMaxWallHeightAt(ws.x - halfT, subStart, zoneLevel, baseY + pieceH),
                      getRoofMaxWallHeightAt(ws.x + halfT, subStart, zoneLevel, baseY + pieceH)
                    );
                const midTopY = isHoriz
                  ? Math.min(
                      getRoofMaxWallHeightAt(segCenter, ws.z - halfT, zoneLevel, baseY + pieceH),
                      getRoofMaxWallHeightAt(segCenter, ws.z + halfT, zoneLevel, baseY + pieceH)
                    )
                  : Math.min(
                      getRoofMaxWallHeightAt(ws.x - halfT, segCenter, zoneLevel, baseY + pieceH),
                      getRoofMaxWallHeightAt(ws.x + halfT, segCenter, zoneLevel, baseY + pieceH)
                    );
                const endTopY = isHoriz
                  ? Math.min(
                      getRoofMaxWallHeightAt(subEnd, ws.z - halfT, zoneLevel, baseY + pieceH),
                      getRoofMaxWallHeightAt(subEnd, ws.z + halfT, zoneLevel, baseY + pieceH)
                    )
                  : Math.min(
                      getRoofMaxWallHeightAt(ws.x - halfT, subEnd, zoneLevel, baseY + pieceH),
                      getRoofMaxWallHeightAt(ws.x + halfT, subEnd, zoneLevel, baseY + pieceH)
                    );

                let hStart = Math.min(pieceH, startTopY - baseY);
                let hEnd = Math.min(pieceH, endTopY - baseY);
                const hMid = Math.min(pieceH, midTopY - baseY);
                // If this sub-segment crosses a steep dormer cheek or hip step, prevent diagonal bridging above the lower roof slope!
                if (Math.abs(hStart - hEnd) > segLen * 1.35 || (hStart + hEnd) / 2 > hMid + 0.03) {
                  const safeH = Math.min(hStart, hEnd, hMid);
                  hStart = safeH;
                  hEnd = safeH;
                }
                const maxClampedH = Math.max(hStart, hEnd);
                if (maxClampedH < 0.04) continue;

                const skirtH = 0.088;
                const hasSkirt =
                  withBaseboard && baseY < 0.02 && Math.min(hStart, hEnd) > skirtH + 0.05;
                const actualBaseY = hasSkirt ? baseY + skirtH + 0.002 : baseY;
                const actualHStart = Math.max(0.02, hasSkirt ? hStart - skirtH - 0.002 : hStart);
                const actualHEnd = Math.max(0.02, hasSkirt ? hEnd - skirtH - 0.002 : hEnd);
                const actualMaxH = Math.max(actualHStart, actualHEnd);

                if (hasSkirt) {
                  const skirt = new THREE.Mesh(
                    new THREE.BoxGeometry(pieceW, skirtH, pieceD),
                    baseboardMat
                  );
                  skirt.position.set(px, yOffset + 0.002 + skirtH / 2, pz);
                  refs.architectureGroup!.add(skirt);
                }

                // Build sloped top wall geometry so 1. OG gable & eaves walls never poke stepped corners through the roof!
                const wallGeo = buildSlopedWallGeometry(
                  segLen,
                  actualHStart,
                  actualHEnd,
                  sideThick,
                  !isHoriz
                );
                const wallMesh = new THREE.Mesh(wallGeo, activeSideWallMat);
                wallMesh.position.set(px, yOffset + actualBaseY + actualMaxH / 2, pz);
                wallMesh.castShadow = true;
                wallMesh.receiveShadow = true;
                wallMesh.userData = {
                  fullHeight: actualMaxH,
                  baseY: actualBaseY,
                  yOffset,
                  zoneId: zone.id,
                  isSouthOrEastWall: ws.isSouthOrEast,
                  wallNormalX: ws.sideId === 'west' ? -1 : ws.sideId === 'east' ? 1 : 0,
                  wallNormalZ: ws.sideId === 'north' ? -1 : ws.sideId === 'south' ? 1 : 0,
                  wallCenterX: px,
                  wallCenterZ: pz,
                  sideId: ws.sideId,
                };
                refs.architectureGroup!.add(wallMesh);
                refs.indoorWalls.push(wallMesh);
              }
            };

            for (const interval of activeWallIntervals) {
              let cursor = interval.start;
              for (const op of cutoutSpecs) {
                const rawStart = op.center - op.width / 2;
                const rawEnd = op.center + op.width / 2;
                if (rawEnd <= interval.start + 0.02 || rawStart >= interval.end - 0.02) continue;

                const opStart = Math.max(cursor, Math.max(interval.start, rawStart));
                const opEnd = Math.min(interval.end, rawEnd);
                if (opEnd <= opStart + 0.02) continue;

                if (opStart > cursor + 0.04) {
                  addWallPiece(cursor, opStart, 0, effectiveSideH, true);
                }
                if (op.sillHeight > 0.05 && op.sillHeight < effectiveSideH) {
                  addWallPiece(opStart, opEnd, 0, op.sillHeight, true);
                }
                const topY = op.sillHeight + op.height;
                if (topY < effectiveSideH - 0.04) {
                  addWallPiece(opStart, opEnd, topY, effectiveSideH - topY, false);
                }
                cursor = Math.max(cursor, opEnd);
              }

              if (cursor < interval.end - 0.04) {
                addWallPiece(cursor, interval.end, 0, effectiveSideH, true);
              }
            }
          }
        }

        // Render Configurable 3D Roof & Roof Dormers (Dachgauben) on top of indoor building part.
        // Respect fixed per-building roof visibility (`zone.roofConfig.visibilityMode`: 'auto' | 'always_visible' | 'always_hidden')!
        const roofVisMode = zone.roofConfig?.visibilityMode || 'auto';
        const shouldRenderRoof =
          zone.roofConfig &&
          zone.roofConfig.type !== 'none' &&
          !focusedZoneObj &&
          roofVisMode !== 'always_hidden' &&
          (roofVisMode === 'always_visible' ||
            (!wallCutaway && (activeFloor === 'all_stacked' || floorSwitchRoofMode !== 'hidden')));

        if (shouldRenderRoof && zone.roofConfig) {
          const isMultiStory = isBuildingMultiStoryRoof(zone, project.zones);
          const isBuildingFootprint =
            isMultiStory || zone.roofConfig.footprintScope === 'building';
          const bldgKey = getBuildingClusterKey(zone, project.zones);

          // If this building already has a multi-story roof spanning from EG over 1. OG / DG,
          // skip legacy single-floor roofs on upper floors of the same building so they don't collide
          const supersededByMultiStory =
            !isMultiStory &&
            zoneLevel >= 1 &&
            multiStoryRoofEnvelopes.some((env) =>
              areZonesInSameBuilding(zone, env, project.zones)
            );

          const alreadyRenderedMultiHost =
            isMultiStory &&
            renderedMultiStoryHosts.some((existing) =>
              areZonesInSameBuilding(existing, zone, project.zones)
            );

          const dedupeKey = isBuildingFootprint
            ? `bldg:${bldgKey}:${isMultiStory ? 'multi' : zoneLevel}`
            : `zone:${zone.id}`;

          if (
            !supersededByMultiStory &&
            !alreadyRenderedMultiHost &&
            !renderedRoofKeys.has(dedupeKey)
          ) {
            renderedRoofKeys.add(dedupeKey);
            const hostZone = computeRoofHostFootprintZone(zone, project.zones);
            if (isMultiStory) {
              renderedMultiStoryHosts.push(hostZone);
            }
            const hasVisibleUpperRooms =
              isMultiStory &&
              (activeFloor === 'all_stacked' || activeFloor >= 1) &&
              visibleZones.some(
                (uz) =>
                  uz.zoneType === 'indoor' &&
                  (uz.level ?? 0) >= 1 &&
                  areZonesInSameBuilding(zone, uz, project.zones)
              );
            const roofGroup = buildZoneRoofGroup(hostZone, {
              hasUpperFloorRoomsInsideRoof: hasVisibleUpperRooms,
              floorFocusCutaway:
                roofVisMode !== 'always_visible' &&
                activeFloor !== 'all_stacked' &&
                floorSwitchRoofMode === 'cutaway',
              entities: stateRef.current.entities,
            });
            // Sync gable wall material into sharedMaterials so gable sides always have the exact same wall color & day/night shading as the facade!
            if (roofGroup.userData?.gableWallMat instanceof THREE.MeshStandardMaterial) {
              sharedMaterials.push({
                mat: roofGroup.userData.gableWallMat,
                baseColor: roofGroup.userData.gableWallMat.color.clone(),
              });
            }
            const egClusterWallH = getUnifiedBuildingFloorWallHeight(hostZone, 0);
            const ogClusterWallH = getUnifiedBuildingFloorWallHeight(hostZone, 1);
            const roofBaseY = isMultiStory
              ? hostZone.roofConfig?.roofSpanMode === 'dg_on_og'
                ? FLOOR_HEIGHT + ogClusterWallH + plinthOff
                : egClusterWallH + plinthOff
              : yOffset + h;
            roofGroup.position.set(hostZone.x, roofBaseY, hostZone.z);
            roofGroup.rotation.y = hostZone.rotationY ?? 0;
            roofGroup.userData = {
              ...roofGroup.userData,
              zoneId: zone.id,
              isRoofGroup: true,
            };
            refs.architectureGroup.add(roofGroup);
            refs.roofGroups.push(roofGroup);
          }
        }
      } else {
        if (zone.outdoorPerimeter === 'stone_curb' || zone.surfaceMaterial === 'pool_water') {
          const isPool = zone.surfaceMaterial === 'pool_water';
          const rimThick = isPool ? (pCfg.copingWidth ?? 0.28) : 0.22;
          if (rimThick > 0.01) {
            const curbMat = new THREE.MeshStandardMaterial({
              color: isPool ? (pCfg.copingColor || zone.wallColor || '#e5dfd6') : 0xcbd5e1,
              roughness: isPool ? 0.34 : 0.48,
            });
            sharedMaterials.push({ mat: curbMat, baseColor: curbMat.color.clone() });
            const rimH = isPool ? 0.08 : 0.14;
            const rimY = yOffset + (isPool ? 0.02 : 0.04);

            if (zone.points && zone.points.length >= 3) {
              // Polygon coping rim stones along every freeform pool/zone edge + miter corner caps
              for (let i = 0; i < zone.points.length; i++) {
                const p1 = zone.points[i];
                const p2 = zone.points[(i + 1) % zone.points.length];
                const dx = p2[0] - p1[0];
                const dz = p2[1] - p1[1];
                const edgeLen = Math.hypot(dx, dz);
                if (edgeLen < 0.1) continue;
                const midX = (p1[0] + p2[0]) / 2;
                const midZ = (p1[1] + p2[1]) / 2;
                const rotY = -Math.atan2(dz, dx);
                const segRim = new THREE.Mesh(
                  new THREE.BoxGeometry(edgeLen, rimH, rimThick),
                  curbMat
                );
                segRim.position.set(midX, rimY, midZ);
                segRim.rotation.y = rotY;
                const cornerCap = new THREE.Mesh(
                  new THREE.CylinderGeometry(rimThick * 0.52, rimThick * 0.52, rimH, 12),
                  curbMat
                );
                cornerCap.position.set(p1[0], rimY, p1[1]);
                refs.architectureGroup.add(segRim, cornerCap);
              }
            } else {
              const rimN = new THREE.Mesh(
                new THREE.BoxGeometry(zone.width + rimThick, rimH, rimThick),
                curbMat
              );
              rimN.position.set(zone.x, rimY, zone.z - zone.depth / 2);
              const rimS = new THREE.Mesh(
                new THREE.BoxGeometry(zone.width + rimThick, rimH, rimThick),
                curbMat
              );
              rimS.position.set(zone.x, rimY, zone.z + zone.depth / 2);
              const rimW = new THREE.Mesh(
                new THREE.BoxGeometry(rimThick, rimH, zone.depth + rimThick),
                curbMat
              );
              rimW.position.set(zone.x - zone.width / 2, rimY, zone.z);
              const rimE = new THREE.Mesh(
                new THREE.BoxGeometry(rimThick, rimH, zone.depth + rimThick),
                curbMat
              );
              rimE.position.set(zone.x + zone.width / 2, rimY, zone.z);
              refs.architectureGroup.add(rimN, rimS, rimW, rimE);
            }
          }
        } else if (zone.outdoorPerimeter === 'hedge') {
          const hedgeMat = new THREE.MeshStandardMaterial({
            color: 0x265c29,
            roughness: 0.82,
          });
          sharedMaterials.push({ mat: hedgeMat, baseColor: hedgeMat.color.clone() });
          const southHedge = new THREE.Mesh(
            new THREE.BoxGeometry(zone.width, 1.15, 0.45),
            hedgeMat
          );
          southHedge.position.set(zone.x, yOffset + 0.57, zone.z + zone.depth / 2);
          southHedge.castShadow = true;
          const westHedge = new THREE.Mesh(
            new THREE.BoxGeometry(0.45, 1.15, zone.depth),
            hedgeMat
          );
          westHedge.position.set(zone.x - zone.width / 2, yOffset + 0.57, zone.z);
          westHedge.castShadow = true;
          refs.architectureGroup.add(southHedge, westHedge);
        } else if (zone.outdoorPerimeter === 'carport_roof') {
          const steelMat = new THREE.MeshStandardMaterial({
            color: 0x1e293b,
            roughness: 0.28,
            metalness: 0.78,
          });
          sharedMaterials.push({ mat: steelMat, baseColor: steelMat.color.clone() });
          const roof = new THREE.Mesh(
            new THREE.BoxGeometry(zone.width - 0.2, 0.16, zone.depth * 0.62),
            steelMat
          );
          roof.position.set(zone.x, yOffset + 2.55, zone.z - 1.2);
          roof.castShadow = true;
          refs.architectureGroup.add(roof);

          const postCoords: [number, number][] = [
            [zone.x + zone.width / 2 - 0.25, zone.z - 3.8],
            [zone.x + zone.width / 2 - 0.25, zone.z + 1.4],
          ];
          for (const [px, pz] of postCoords) {
            const post = new THREE.Mesh(
              new THREE.BoxGeometry(0.14, 2.55, 0.14),
              steelMat
            );
            post.position.set(px, yOffset + 1.275, pz);
            post.castShadow = true;
            refs.architectureGroup.add(post);
          }
        } else if (zone.outdoorPerimeter === 'chainlink_fence') {
          const fenceH = 1.25;
          const postMat = new THREE.MeshStandardMaterial({
            color: 0x166534,
            roughness: 0.35,
            metalness: 0.65,
          });
          const meshTex = getChainlinkMeshTexture('#15803d').clone();
          meshTex.needsUpdate = true;

          const addFenceSide = (
            fx: number,
            fz: number,
            len: number,
            rotY: number
          ) => {
            if (len < 0.4) return;
            const sideTex = meshTex.clone();
            sideTex.needsUpdate = true;
            sideTex.repeat.set(Math.max(1, len * 3.8), Math.max(1, fenceH * 3.8));
            const fenceMeshMat = new THREE.MeshStandardMaterial({
              map: sideTex,
              alphaMap: sideTex,
              transparent: true,
              alphaTest: 0.15,
              side: THREE.DoubleSide,
              roughness: 0.4,
              metalness: 0.55,
            });
            const plane = new THREE.Mesh(
              new THREE.PlaneGeometry(len, fenceH - 0.06),
              fenceMeshMat
            );
            plane.position.set(fx, yOffset + fenceH / 2, fz);
            plane.rotation.y = rotY;
            const topWire = new THREE.Mesh(
              new THREE.CylinderGeometry(0.01, 0.01, len, 8),
              postMat
            );
            topWire.rotation.z = Math.PI / 2;
            topWire.rotation.y = rotY;
            topWire.position.set(fx, yOffset + fenceH, fz);
            refs.architectureGroup?.add(plane, topWire);
          };

          addFenceSide(zone.x, zone.z + zone.depth / 2, zone.width, 0);
          addFenceSide(zone.x - zone.width / 2, zone.z, zone.depth, Math.PI / 2);
          addFenceSide(zone.x + zone.width / 2, zone.z, zone.depth, Math.PI / 2);
        }
      }

      refs.zoneMaterialsMap.set(zone.id, sharedMaterials);
    }

    // 1B. Build Free-Standing Custom Partition Walls (2D/3D Wand-Designer: project.customWalls)
    if (project.customWalls && project.customWalls.length > 0 && !focusedZoneObj) {
      for (const cw of project.customWalls) {
        if (cw.mode === 'hidden') continue;
        const cwLevel = cw.level ?? 0;
        if (activeFloor !== 'all_stacked') {
          if (activeFloor === -1 && cwLevel !== -1) continue;
          if (activeFloor >= 0 && (cwLevel < 0 || cwLevel > activeFloor)) continue;
        }
        const dx = cw.x2 - cw.x1;
        const dz = cw.z2 - cw.z1;
        const len = Math.hypot(dx, dz);
        if (len < 0.15) continue;

        const midX = (cw.x1 + cw.x2) / 2;
        const midZ = (cw.z1 + cw.z2) / 2;
        const rotY = -Math.atan2(dz, dx);
        const cwHostZone = findBestZoneForPoint(
          midX,
          midZ,
          cwLevel,
          project.zones.filter((z) => z.zoneType === 'indoor')
        );
        const cwPlinthOff = cwHostZone ? getZonePlinthOffset(cwHostZone) : 0;
        const yOff = cwLevel * FLOOR_HEIGHT + cwPlinthOff;
        const rawH = cw.mode === 'half_height' ? Math.min(cw.height || 1.1, 1.15) : cw.height || 2.6;
        const clampedH = getRoofMaxWallHeightAt(midX, midZ, cwLevel, rawH);
        const thick = cw.thickness || 0.14;

        const finishTex =
          cw.finish && cw.finish !== 'plaster'
            ? createWallFinishTexture(cw.finish, cw.color || '#e4e0d8', len / 1.8, clampedH / 1.8)
            : null;
        const isCwGlassBlock = cw.finish === 'glass_block';
        const cwMat = new THREE.MeshStandardMaterial({
          map: finishTex || undefined,
          color: finishTex
            ? 0xffffff
            : new THREE.Color(cw.color || '#e4e0d8').multiplyScalar(0.88),
          roughness: isCwGlassBlock ? 0.14 : cw.finish === 'stone_tile' ? 0.35 : 0.72,
          metalness: isCwGlassBlock ? 0.1 : 0.04,
          transparent: isCwGlassBlock,
          opacity: isCwGlassBlock ? 0.84 : 1.0,
          emissive: selectedWallId === cw.id ? new THREE.Color(0xf59e0b) : new THREE.Color(0x000000),
          emissiveIntensity: selectedWallId === cw.id ? 0.22 : 0,
        });

        if (cw.mode === 'archway' && len > 1.2) {
          const pillarLen = len * 0.22;
          const archH = Math.min(2.1, clampedH - 0.35);
          const ux = dx / len;
          const uz = dz / len;
          for (const sign of [-1, 1]) {
            const pOffset = sign * (len / 2 - pillarLen / 2);
            const pMesh = new THREE.Mesh(
              new THREE.BoxGeometry(pillarLen, clampedH, thick),
              cwMat
            );
            pMesh.position.set(midX + ux * pOffset, yOff + clampedH / 2, midZ + uz * pOffset);
            pMesh.rotation.y = rotY;
            pMesh.castShadow = true;
            pMesh.receiveShadow = true;
            pMesh.userData = {
              customWallId: cw.id,
              zoneId: cwHostZone?.id,
              wallCenterX: midX + ux * pOffset,
              wallCenterZ: midZ + uz * pOffset,
              wallNormalX: -dz / len,
              wallNormalZ: dx / len,
              fullHeight: clampedH,
              baseY: 0,
              yOffset: yOff,
            };
            refs.architectureGroup.add(pMesh);
            refs.indoorWalls.push(pMesh);
          }
          const lintelH = Math.max(0.2, clampedH - archH);
          const lintel = new THREE.Mesh(
            new THREE.BoxGeometry(len - pillarLen * 2, lintelH, thick),
            cwMat
          );
          lintel.position.set(midX, yOff + archH + lintelH / 2, midZ);
          lintel.rotation.y = rotY;
          lintel.userData = {
            customWallId: cw.id,
            zoneId: cwHostZone?.id,
            wallCenterX: midX,
            wallCenterZ: midZ,
            wallNormalX: -dz / len,
            wallNormalZ: dx / len,
            fullHeight: lintelH,
            baseY: archH,
            yOffset: yOff,
          };
          refs.architectureGroup.add(lintel);
          refs.indoorWalls.push(lintel);
        } else {
          const cwMesh = new THREE.Mesh(
            new THREE.BoxGeometry(len, clampedH, thick),
            cwMat
          );
          cwMesh.position.set(midX, yOff + clampedH / 2, midZ);
          cwMesh.rotation.y = rotY;
          cwMesh.castShadow = true;
          cwMesh.receiveShadow = true;
          cwMesh.userData = {
            customWallId: cw.id,
            zoneId: cwHostZone?.id,
            wallCenterX: midX,
            wallCenterZ: midZ,
            wallNormalX: -dz / len,
            wallNormalZ: dx / len,
            fullHeight: clampedH,
            baseY: 0,
            yOffset: yOff,
          };
          refs.architectureGroup.add(cwMesh);
          refs.indoorWalls.push(cwMesh);
        }
      }
    }

    // Also render any multi-story house roof configured on EG when viewing 1. OG or DG if roof visibility is enabled
    if (!focusedZoneObj) {
      for (const [bldgKey, hostZone] of multiStoryRoofMap.entries()) {
        const hostVisMode = hostZone.roofConfig?.visibilityMode || 'auto';
        if (hostVisMode === 'always_hidden') continue;
        const allowMultiRoof =
          hostVisMode === 'always_visible' ||
          (!wallCutaway && (activeFloor === 'all_stacked' || floorSwitchRoofMode !== 'hidden'));
        if (!allowMultiRoof) continue;

        const dedupeKey = `bldg:${bldgKey}:multi`;
        if (renderedRoofKeys.has(dedupeKey)) continue;
        renderedRoofKeys.add(dedupeKey);
        const hasVisibleUpperRooms =
          (activeFloor === 'all_stacked' || activeFloor >= 1) &&
          visibleZones.some(
            (uz) =>
              uz.zoneType === 'indoor' &&
              (uz.level ?? 0) >= 1 &&
              areZonesInSameBuilding(hostZone, uz, project.zones)
          );
        const roofGroup = buildZoneRoofGroup(hostZone, {
          hasUpperFloorRoomsInsideRoof: hasVisibleUpperRooms,
          floorFocusCutaway:
            hostVisMode !== 'always_visible' &&
            activeFloor !== 'all_stacked' &&
            floorSwitchRoofMode === 'cutaway',
          entities: stateRef.current.entities,
        });
        if (roofGroup.userData?.gableWallMat instanceof THREE.MeshStandardMaterial) {
          const hostMatList = refs.zoneMaterialsMap.get(hostZone.id) || [];
          hostMatList.push({
            mat: roofGroup.userData.gableWallMat,
            baseColor: roofGroup.userData.gableWallMat.color.clone(),
          });
          refs.zoneMaterialsMap.set(hostZone.id, hostMatList);
        }
        const hostPlinth = getZonePlinthOffset(hostZone);
        const egClusterWallH = getUnifiedBuildingFloorWallHeight(hostZone, 0);
        const ogClusterWallH = getUnifiedBuildingFloorWallHeight(hostZone, 1);
        const roofBaseY =
          hostZone.roofConfig?.roofSpanMode === 'dg_on_og'
            ? FLOOR_HEIGHT + ogClusterWallH + hostPlinth
            : egClusterWallH + hostPlinth;
        roofGroup.position.set(hostZone.x, roofBaseY, hostZone.z);
        roofGroup.rotation.y = hostZone.rotationY ?? 0;
        roofGroup.userData = {
          ...roofGroup.userData,
          zoneId: hostZone.id,
          isRoofGroup: true,
        };
        refs.architectureGroup.add(roofGroup);
        refs.roofGroups.push(roofGroup);
      }
    }

    // 2. Build Doors, Windows, Shutters & Garage Gate (aligned flush with their boundary-centered host wall & clamped to roof slope!)
    const wallInsetFlush = 0;
    for (const opening of visibleOpenings) {
      const opLevel = opening.level ?? 0;
      const hostZoneForOp = findBestZoneForPoint(opening.x, opening.z, opLevel, visibleZones);
      const opPlinth = hostZoneForOp ? getZonePlinthOffset(hostZoneForOp) : 0;
      const yOffset = opLevel * FLOOR_HEIGHT + opPlinth;

      // Adapt 1. OG / DG windows and doors to the roof slope if they sit under a multi-story roof
      let effectiveOp = opening;
      if (opLevel >= 1 && multiStoryRoofEnvelopes.length > 0) {
        const maxWallH = getRoofMaxWallHeightAt(opening.x, opening.z, opLevel, 2.6);
        if (opening.sillHeight + opening.height > maxWallH - 0.06) {
          const clampedH = Math.max(0.45, Math.min(opening.height, maxWallH - 0.18));
          const clampedSill = Math.max(0.0, Math.min(opening.sillHeight, maxWallH - clampedH - 0.06));
          effectiveOp = {
            ...opening,
            height: +clampedH.toFixed(2),
            sillHeight: +clampedSill.toFixed(2),
          };
        }
      }

      const opGroup = buildOpeningGroup(effectiveOp, refs.isSoftwareGl);

      // Align opening perpendicular coordinate flush with its host room wall (both rectangular and polygon walls)
      let flushX = opening.x;
      let flushZ = opening.z;
      const opIsVert = Math.abs(Math.sin(opening.rotationY)) >= 0.6;
      for (const z of visibleZones) {
        if (z.zoneType !== 'indoor' || (z.level ?? 0) !== opLevel) continue;
        if ((z.points && z.points.length >= 3) || isZoneRotated(z)) {
          const zPts = getZoneCorners(z);
          let matchedPoly = false;
          for (let i = 0; i < zPts.length; i++) {
            const p1 = zPts[i];
            const p2 = zPts[(i + 1) % zPts.length];
            const dx = p2[0] - p1[0];
            const dz = p2[1] - p1[1];
            const edgeLen = Math.hypot(dx, dz);
            if (edgeLen < 0.15) continue;
            const ux = dx / edgeLen;
            const uz = dz / edgeLen;
            let nx = -dz / edgeLen;
            let nz = dx / edgeLen;
            const midX = (p1[0] + p2[0]) / 2;
            const midZ = (p1[1] + p2[1]) / 2;
            if (nx * (z.x - midX) + nz * (z.z - midZ) < 0) {
              nx = -nx;
              nz = -nz;
            }
            const relX = opening.x - p1[0];
            const relZ = opening.z - p1[1];
            const along = relX * ux + relZ * uz;
            const perp = Math.abs(relX * nx + relZ * nz);
            if (perp < 0.35 && along >= -0.2 && along <= edgeLen + 0.2) {
              flushX = p1[0] + ux * along + nx * wallInsetFlush;
              flushZ = p1[1] + uz * along + nz * wallInsetFlush;
              matchedPoly = true;
              break;
            }
          }
          if (matchedPoly) break;
        } else if (!opIsVert) {
          if (
            opening.x >= z.x - z.width / 2 - 0.2 &&
            opening.x <= z.x + z.width / 2 + 0.2
          ) {
            if (Math.abs(opening.z - (z.z - z.depth / 2)) < 0.35) {
              flushZ = z.z - z.depth / 2 + wallInsetFlush;
              break;
            }
            if (Math.abs(opening.z - (z.z + z.depth / 2)) < 0.35) {
              flushZ = z.z + z.depth / 2 - wallInsetFlush;
              break;
            }
          }
        } else {
          if (
            opening.z >= z.z - z.depth / 2 - 0.2 &&
            opening.z <= z.z + z.depth / 2 + 0.2
          ) {
            if (Math.abs(opening.x - (z.x - z.width / 2)) < 0.35) {
              flushX = z.x - z.width / 2 + wallInsetFlush;
              break;
            }
            if (Math.abs(opening.x - (z.x + z.width / 2)) < 0.35) {
              flushX = z.x + z.width / 2 - wallInsetFlush;
              break;
            }
          }
        }
      }

      // Restore previous animation progress so scene rebuilds never reset/clip moving doors or shutters
      const prevAnim = prevOpeningAnimState.get(opening.id);
      if (prevAnim) {
        if (prevAnim.swingDoorRotY !== undefined && opGroup.userData.swingDoor) {
          opGroup.userData.swingDoor.rotation.y = prevAnim.swingDoorRotY;
        }
        if (prevAnim.tiltRotX !== undefined && opGroup.userData.tiltPivot) {
          opGroup.userData.tiltPivot.rotation.x = prevAnim.tiltRotX;
        }
        if (prevAnim.winSwingRotY !== undefined && opGroup.userData.windowSwingPivot) {
          opGroup.userData.windowSwingPivot.rotation.y = prevAnim.winSwingRotY;
        }
        if (prevAnim.winSwingSecRotY !== undefined && opGroup.userData.windowSwingPivotSecondary) {
          opGroup.userData.windowSwingPivotSecondary.rotation.y = prevAnim.winSwingSecRotY;
        }
        if (prevAnim.slidingPaneX !== undefined && opGroup.userData.slidingPane) {
          opGroup.userData.slidingPane.position.x = prevAnim.slidingPaneX;
        }
        if (prevAnim.garageOpenProgress !== undefined && opGroup.userData.garagePanels) {
          opGroup.userData.garageOpenProgress = prevAnim.garageOpenProgress;
          opGroup.userData.garageNeedsInit = true;
        }
        if (prevAnim.shutterScaleY !== undefined && opGroup.userData.shutterMesh) {
          opGroup.userData.shutterMesh.scale.y = prevAnim.shutterScaleY;
        }
      } else if (
        opGroup.userData.shutterMesh &&
        (opening.shutterClosedPct !== undefined || opening.shutterEntityId)
      ) {
        const shEnt = opening.shutterEntityId
          ? stateRef.current.entities[opening.shutterEntityId]
          : undefined;
        const openPct =
          opening.shutterClosedPct !== undefined
            ? 100 - opening.shutterClosedPct
            : shEnt?.attributes.current_position ?? 100;
        opGroup.userData.shutterMesh.scale.y = Math.max(0.03, 1 - openPct / 100);
      }

      opGroup.position.set(flushX, yOffset + effectiveOp.sillHeight, flushZ);
      refs.openingsGroup.add(opGroup);
      refs.openingMap.set(opening.id, opGroup);
    }

    // 2B. When inspecting the Basement (`KG`, activeFloor === -1), render subtle 3D ghost outlines of the Ground Floor (`EG`, level === 0) above
    if (activeFloor === -1 && !focusedZoneObj) {
      const egIndoorZones = project.zones.filter(
        (z) => z.zoneType === 'indoor' && (z.level ?? 0) === 0
      );
      const ghostMat = new THREE.LineBasicMaterial({
        color: 0x38bdf8,
        transparent: true,
        opacity: 0.45,
      });
      for (const ez of egIndoorZones) {
        const corners = getZoneCorners(ez);
        if (corners.length < 3) continue;
        const pts3D = corners.map(([cx, cz]) => new THREE.Vector3(cx, 0.03, cz));
        pts3D.push(pts3D[0].clone());
        const lineGeo = new THREE.BufferGeometry().setFromPoints(pts3D);
        const lineLoop = new THREE.Line(lineGeo, ghostMat);
        refs.architectureGroup.add(lineLoop);
      }
    }
    } // end if (needArchRebuild)

    // Prune deleted assets from the 3D geometry cache and dispose their GPU geometries
    const currentAssetIds = new Set(project.assets.map((a) => a.id));
    for (const [cachedId, cachedEntry] of assetGeometryCacheRef.current.entries()) {
      if (!currentAssetIds.has(cachedId)) {
        disposeGroupGeometries(cachedEntry.group);
        assetGeometryCacheRef.current.delete(cachedId);
      }
    }

    // 3. Build or Reuse Cached Placed Smart Home, Outdoor & Furniture Assets
    for (const asset of visibleAssets) {
      const assetLevel = asset.level ?? 0;
      const containingZone =
        focusedZoneObj ||
        findBestZoneForPoint(asset.position[0], asset.position[2], assetLevel, floorZones);
      // Exterior stairs sit on the natural terrain (Y = 0) and bridge up to the elevated building plinth (`plinthOff`)
      // Kellertreppen (KG -> EG) always have their top step flush with EG terrain (Y = 0) and descend into the basement!
      const isKellerStair = isKellertreppeAsset(asset);
      const isExtStair = isExteriorStairAsset(asset.catalogId) && !isKellerStair;
      const assetPlinth =
        isExtStair || isKellerStair
          ? 0
          : containingZone
          ? getZonePlinthOffset(containingZone)
          : 0;
      const yOffset = isKellerStair ? 0 : assetLevel * FLOOR_HEIGHT + assetPlinth;

      // Auto-align standalone catalog dormers, chimneys, skylights (`isChimneyOrDormerAsset`) AND freely placed PV arrays (`solar_panel_array`)
      // with the underlying zone or multi-story building roof surface & slope angle!
      let effectiveAsset = asset;
      let autoRoofY: number | null = null;
      if (isChimneyOrDormerAsset(asset.catalogId) || asset.catalogId === 'solar_panel_array') {
        const roofZone =
          containingZone?.roofConfig && containingZone.roofConfig.type !== 'none'
            ? containingZone
            : multiStoryRoofEnvelopes.find((env) =>
                containingZone
                  ? areZonesInSameBuilding(containingZone, env, project.zones)
                  : isPointInsideZone(asset.position[0], asset.position[2], env)
              );
        if (roofZone?.roofConfig && roofZone.roofConfig.type !== 'none') {
          const hostFootprint = computeRoofHostFootprintZone(roofZone, project.zones);
          const roofRelY =
            roofZone.roofConfig.type === 'flat'
              ? 0.08
              : evaluateRoofUndersideHeight(
                  hostFootprint,
                  asset.position[0],
                  asset.position[2]
                );
          if (roofRelY !== null) {
            const isMulti = isBuildingMultiStoryRoof(roofZone, project.zones);
            const roofBaseY = isMulti
              ? roofZone.roofConfig.roofSpanMode === 'dg_on_og'
                ? FLOOR_HEIGHT * 2 + assetPlinth
                : FLOOR_HEIGHT + assetPlinth
              : yOffset + (roofZone.wallHeight ?? 2.5);
            const isChimney = asset.catalogId.includes('chimney');
            autoRoofY = roofBaseY + roofRelY + (isChimney ? -0.15 : 0.04);
            const autoPitchDeg =
              roofZone.roofConfig.type === 'flat'
                ? 12
                : roofZone.roofConfig.type === 'mono_pitch'
                ? Math.round((roofZone.roofConfig.pitchDegrees ?? 18) * 0.65)
                : Math.round(roofZone.roofConfig.pitchDegrees ?? 28);
            if (
              asset.catalogId.startsWith('roof_dormer_') &&
              asset.dormerWindowConfig?.roofSlopeAngleDeg === undefined
            ) {
              effectiveAsset = {
                ...asset,
                dormerWindowConfig: {
                  ...asset.dormerWindowConfig,
                  roofSlopeAngleDeg: autoPitchDeg,
                },
              };
            } else if (
              asset.catalogId === 'solar_panel_array' &&
              asset.pvTiltDeg === undefined
            ) {
              effectiveAsset = {
                ...asset,
                pvTiltDeg: autoPitchDeg,
              };
            }
          }
        }
      }

      const needsRoofStairClip =
        isStairAsset(asset.catalogId) && assetLevel >= 1 && multiStoryRoofEnvelopes.length > 0;
      const isInteriorStair = isStairAsset(asset.catalogId);
      if (isInteriorStair && containingZone) {
        const zRot = containingZone.rotationY || 0;
        const relAngle = (asset.rotationY || 0) - zRot;
        const isRotated90 = Math.abs(Math.sin(relAngle)) > 0.707;
        const maxRoomRun = Math.max(
          1.4,
          (isRotated90 ? containingZone.width : containingZone.depth) - 0.16
        );
        const maxRoomWidth = Math.max(
          0.75,
          (isRotated90 ? containingZone.depth : containingZone.width) - 0.16
        );
        const curRun = effectiveAsset.stairConfig?.totalRun ?? effectiveAsset.customLength ?? 3.1;
        const curWidth = effectiveAsset.stairConfig?.width ?? effectiveAsset.customWidth ?? 1.06;
        if (curRun > maxRoomRun || curWidth > maxRoomWidth) {
          const clampedRun = Math.min(curRun, +maxRoomRun.toFixed(2));
          const clampedWidth = Math.min(curWidth, +maxRoomWidth.toFixed(2));
          effectiveAsset = {
            ...effectiveAsset,
            customLength: clampedRun,
            customWidth: clampedWidth,
            stairConfig: {
              ...effectiveAsset.stairConfig,
              totalRun: clampedRun,
              width: clampedWidth,
            },
          };
        }
      }
      const geomSig = computeAssetGeometrySignature(effectiveAsset, needsRoofStairClip);
      const cachedAssetEntry = assetGeometryCacheRef.current.get(asset.id);
      let group: THREE.Group;

      if (cachedAssetEntry && cachedAssetEntry.sig === geomSig) {
        group = cachedAssetEntry.group;
        // Keep metadata fresh on reused group
        group.userData.entityId = asset.entityId;
        group.userData.lightConfig = asset.lightConfig;
      } else {
        if (cachedAssetEntry) {
          disposeGroupGeometries(cachedAssetEntry.group);
        }
        group = buildPlacedAssetGroup(effectiveAsset, refs.isSoftwareGl);

        // Clip interior stair railings against the sloped roof underside (`Dachschräge`) so railings never poke through the roof!
        if (needsRoofStairClip) {
          const sc = asset.scale || 1;
          const cosA = Math.cos(asset.rotationY || 0);
          const sinA = Math.sin(asset.rotationY || 0);
          group.traverse((child) => {
            if (child.userData?.isStairStepGroup) {
              const stepY = (child.userData.stepY as number) ?? 0;
              const localX = child.position.x * sc;
              const localZ = child.position.z * sc;
              const stepRotY = (asset.rotationY || 0) + (child.rotation.y || 0);
              const cosS = Math.cos(stepRotY);
              const sinS = Math.sin(stepRotY);

              for (const sub of child.children) {
                if (!sub.userData?.isStairRailing) continue;
                const railX = ((sub.userData.railX as number) ?? sub.position.x) * sc;
                const wx =
                  asset.position[0] + localX * cosA + localZ * sinA + railX * cosS;
                const wz =
                  asset.position[2] - localX * sinA + localZ * cosA - railX * sinS;
                const maxRoofH = getRoofMaxWallHeightAt(wx, wz, assetLevel, 99);
                const availAboveStep = maxRoofH - stepY - 0.03;
                const baseH = (sub.userData.baseH as number) ?? 0.92;
                if (availAboveStep < 0.16) {
                  sub.visible = false;
                } else if (availAboveStep < baseH) {
                  if (sub.userData.isRailingPostOrPane) {
                    const ratio = Math.max(0.15, availAboveStep / baseH);
                    sub.scale.y = ratio;
                    sub.position.y = (baseH * ratio) / 2;
                  } else if (sub.userData.isHandrailCap) {
                    sub.position.y = availAboveStep;
                  }
                }
              }
            }
          });
        }

        assetGeometryCacheRef.current.set(asset.id, { sig: geomSig, group });
      }

      const prevA = prevAssetAnimState.get(asset.id);
      if (prevA) {
        if (prevA.rollerScaleY !== undefined && group.userData.rollerGateCurtain) {
          group.userData.rollerGateCurtain.scale.y = prevA.rollerScaleY;
        }
        if (prevA.slidingGateX !== undefined && group.userData.slidingDrivewayGate) {
          group.userData.slidingDrivewayGate.position.x = prevA.slidingGateX;
        }
        if (prevA.carriageZ !== undefined && group.userData.openerCarriage) {
          group.userData.openerCarriage.position.z = prevA.carriageZ;
        }
      }
      const assetMountY = asset.wallModuleConfig?.mountHeightM ?? asset.position[1] ?? 0;
      const finalY =
        autoRoofY !== null && Math.abs(assetMountY - 2.6) < 0.25
          ? autoRoofY
          : yOffset + assetMountY;
      group.position.set(asset.position[0], finalY, asset.position[2]);
      group.rotation.y = asset.rotationY;
      group.scale.setScalar(asset.scale || 1);
      refs.assetsGroup.add(group);
      refs.assetMap.set(asset.id, group);

      refs.assetZoneMap.set(asset.id, containingZone?.id || null);
    }

    // Also map all floor assets in assetZoneMap so room summaries in overview mode stay accurate
    for (const asset of project.assets) {
      if (refs.assetZoneMap.has(asset.id)) continue;
      const assetLevel = asset.level ?? 0;
      if (activeFloor !== 'all_stacked' && assetLevel !== activeFloor) continue;
      const containingZone = findBestZoneForPoint(
        asset.position[0],
        asset.position[2],
        assetLevel,
        floorZones
      );
      refs.assetZoneMap.set(asset.id, containingZone?.id || null);
    }

    // 4. Build 3D Live Energy Flow Conduit Lines (only in full house overview)
    if (!focusedZoneObj && showEnergyFlow && (activeFloor === 0 || activeFloor === 'all_stacked')) {
      const solarAsset = project.assets.find((a) => a.catalogId === 'solar_panel_array');
      const batteryAsset = project.assets.find((a) => a.catalogId === 'home_battery_inverter');
      const wallboxAsset = project.assets.find((a) => a.catalogId === 'ev_wallbox');

      const hubPos = new THREE.Vector3(
        batteryAsset ? batteryAsset.position[0] : 6.0,
        1.1,
        batteryAsset ? batteryAsset.position[2] : -4.5
      );

      const addEnergyCurve = (from: THREE.Vector3, to: THREE.Vector3, colorHex: number) => {
        const mid = from.clone().lerp(to, 0.5);
        mid.y += 1.2;
        const curve = new THREE.QuadraticBezierCurve3(from, mid, to);
        const tubeGeo = new THREE.TubeGeometry(curve, 18, 0.045, 6, false);
        const tubeMat = new THREE.MeshBasicMaterial({
          color: colorHex,
          transparent: true,
          opacity: 0.85,
        });
        const mesh = new THREE.Mesh(tubeGeo, tubeMat);
        refs.energyFlowGroup?.add(mesh);
      };

      if (solarAsset) {
        addEnergyCurve(
          new THREE.Vector3(
            solarAsset.position[0],
            solarAsset.position[1] + 0.2,
            solarAsset.position[2]
          ),
          hubPos,
          0x10b981
        );
      }
      if (wallboxAsset) {
        addEnergyCurve(
          hubPos,
          new THREE.Vector3(
            wallboxAsset.position[0],
            wallboxAsset.position[1],
            wallboxAsset.position[2]
          ),
          0x0ea5e9
        );
      }
      for (const plug of visibleAssets.filter(
        (a) => a.catalogId === 'smart_plug' || a.catalogId === 'power_strip'
      )) {
        addEnergyCurve(
          hubPos,
          new THREE.Vector3(plug.position[0], plug.position[1] + 0.1, plug.position[2]),
          0xf59e0b
        );
      }
    }

    refs.shadowNeedsUpdate = true;
    refs.wakeUpUntil = performance.now() + 1400;
  }, [
    project,
    activeFloor,
    showClimateHeatmap,
    showEnergyFlow,
    focusedZoneId,
    floorSwitchRoofMode,
    wallCutaway,
    visualStyle,
    selectedWallId,
  ]);

  // Lightweight live update for Presence Avatars & Climate Heatmap colors when `entities` change
  // NEVER rebuilds 3D architecture, walls, roofs, or furniture when toggling lights/covers/switches!
  useEffect(() => {
    const refs = sceneObjectsRef.current;
    if (!refs.avatarsGroup) return;

    // 1. Update Climate Heatmap floor tint in-place if heatmap is enabled
    if (showClimateHeatmap) {
      for (const z of project.zones) {
        if (z.zoneType !== 'indoor' || !z.climateEntityId) continue;
        const matList = refs.zoneMaterialsMap.get(z.id);
        if (!matList) continue;
        const clim = entities[z.climateEntityId];
        const temp = clim?.attributes.current_temperature ?? 21.5;
        let heatColorHex = 0x34d399;
        if (temp < 19.5) heatColorHex = 0x38bdf8;
        else if (temp > 23.0) heatColorHex = 0xfb923c;
        else if (temp > 21.8) heatColorHex = 0xfbbf24;
        for (const entry of matList) {
          if (entry.isHeatmapColored) {
            entry.baseColor.setHex(heatColorHex);
          }
        }
      }
    }

    // 2. Update 3D Live Presence Avatars
    refs.avatarsGroup.clear();
    if (showPresenceAvatars) {
      const floorZones = project.zones.filter((z) => {
        if (activeFloor === 'all_stacked') return true;
        if (z.zoneType === 'outdoor') return true;
        const lvl = z.level ?? 0;
        if (activeFloor === -1) return lvl === -1;
        return lvl >= 0 && lvl <= activeFloor;
      });
      const focusedZoneObj = focusedZoneId
        ? project.zones.find((z) => z.id === focusedZoneId) || null
        : null;
      const visibleZones = focusedZoneObj ? [focusedZoneObj] : floorZones;

      // Combine configured persons (`project.liveCockpitConfig?.persons`), HA `person.*` entities, and active room `presenceEntityId` sensors
      const configuredPersons = project.liveCockpitConfig?.persons || [];
      const avatarDescriptors: {
        name: string;
        roomName: string;
        colorStr: string;
      }[] = [];

      if (configuredPersons.length > 0) {
        for (const pCfg of configuredPersons) {
          const pEnt = pCfg.entityId ? entities[pCfg.entityId] : undefined;
          // If bound to a person/device_tracker entity, only render inside house when 'home' / 'on' / active (or if no entity is bound)
          const isHome = !pEnt || isBinaryEntityActive(pEnt);
          if (!isHome) continue;
          const roomEnt = pCfg.roomEntityId ? entities[pCfg.roomEntityId] : undefined;
          const resolvedRoom =
            (roomEnt?.state && roomEnt.state !== 'unknown' && roomEnt.state !== 'unavailable'
              ? roomEnt.state
              : undefined) ||
            (pEnt?.attributes?.room_name as string) ||
            (pEnt?.attributes?.room as string) ||
            pCfg.defaultRoomName ||
            'Wohn- & Essbereich';
          avatarDescriptors.push({
            name: pCfg.name,
            roomName: resolvedRoom,
            colorStr: pCfg.avatarColor || '#38bdf8',
          });
        }
      } else {
        const personList = Object.values(entities).filter(
          (e) => e.domain === 'person' && isBinaryEntityActive(e)
        );
        for (const person of personList) {
          const roomName =
            (person.attributes.room_name as string) ||
            (person.attributes.room as string) ||
            'Wohn- & Essbereich';
          avatarDescriptors.push({
            name: person.attributes.friendly_name || person.entity_id,
            roomName,
            colorStr: (person.attributes.avatar_color as string) || '#38bdf8',
          });
        }
      }

      // Also add presence avatar indicator for any room whose `presenceEntityId` (e.g. mmWave / PIR motion sensor) is active
      for (const z of visibleZones) {
        if (!z.presenceEntityId) continue;
        const presEnt = entities[z.presenceEntityId];
        if (presEnt && isBinaryEntityActive(presEnt)) {
          const alreadyInRoom = avatarDescriptors.some(
            (a) => a.roomName.toLowerCase() === z.name.toLowerCase()
          );
          if (!alreadyInRoom) {
            avatarDescriptors.push({
              name: `${z.name} Präsenz`,
              roomName: z.name,
              colorStr: '#10b981',
            });
          }
        }
      }

      avatarDescriptors.forEach((av, idx) => {
        const targetZone =
          visibleZones.find(
            (z) => z.name.toLowerCase() === av.roomName.toLowerCase()
          ) ||
          visibleZones.find((z) =>
            z.name.toLowerCase().includes(av.roomName.toLowerCase())
          ) ||
          visibleZones.find((z) => z.zoneType === 'indoor');
        if (!targetZone) return;

        const zLevel = targetZone.level ?? 0;
        const plinth = targetZone.plinthHeight ?? 0;
        const yOff = zLevel * FLOOR_HEIGHT + plinth;
        const avatarColor = new THREE.Color(av.colorStr);

        const avGroup = new THREE.Group();
        const spreadX = (idx - (avatarDescriptors.length - 1) / 2) * 0.75;
        avGroup.position.set(targetZone.x + spreadX, yOff, targetZone.z + 0.25);

        const ring = new THREE.Mesh(
          new THREE.RingGeometry(0.28, 0.38, 24),
          new THREE.MeshBasicMaterial({
            color: avatarColor,
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 0.75,
          })
        );
        ring.rotation.x = -Math.PI / 2;
        ring.position.y = 0.025;

        const avatarMat = new THREE.MeshStandardMaterial({
          color: avatarColor,
          emissive: avatarColor,
          emissiveIntensity: 0.35,
          roughness: 0.25,
          metalness: 0.2,
          transparent: true,
          opacity: 0.9,
        });

        const body = new THREE.Mesh(
          new THREE.CylinderGeometry(0.16, 0.11, 1.18, 16),
          avatarMat
        );
        body.position.y = 0.64;

        const shoulders = new THREE.Mesh(
          new THREE.SphereGeometry(0.18, 16, 12),
          avatarMat
        );
        shoulders.scale.set(1.2, 0.65, 0.85);
        shoulders.position.y = 1.22;

        const head = new THREE.Mesh(
          new THREE.SphereGeometry(0.14, 16, 16),
          new THREE.MeshStandardMaterial({
            color: 0xf8fafc,
            emissive: avatarColor,
            emissiveIntensity: 0.25,
            roughness: 0.2,
          })
        );
        head.position.y = 1.54;

        avGroup.add(ring, body, shoulders, head);
        refs.avatarsGroup?.add(avGroup);
      });
    }

    refs.wakeUpUntil = performance.now() + 900;
  }, [
    entities,
    showClimateHeatmap,
    showPresenceAvatars,
    project.zones,
    project.liveCockpitConfig,
    activeFloor,
    focusedZoneId,
  ]);

  // Update Selection Highlight Ring position
  useEffect(() => {
    const ring = sceneObjectsRef.current.selectionRing;
    if (!ring) return;
    sceneObjectsRef.current.wakeUpUntil = performance.now() + 600;
    if (selectedAssetId) {
      const asset = project.assets.find((a) => a.id === selectedAssetId);
      if (asset) {
        const yOff = isKellertreppeAsset(asset) ? 0 : (asset.level ?? 0) * FLOOR_HEIGHT;
        ring.visible = true;
        ring.position.set(asset.position[0], yOff + 0.03, asset.position[2]);
        return;
      }
    }
    ring.visible = false;
  }, [selectedAssetId, project.assets, activeFloor]);

  // Trigger Smooth Camera Preset Transition or Active Floor / Room Focus Elevation
  // Dynamically adapts to the user's actual building coordinates so custom floorplans are always centered!
  useEffect(() => {
    sceneObjectsRef.current.wakeUpUntil = performance.now() + 1600;
    const allZones = stateRef.current.project.zones;
    const indoorZones = allZones.filter((z) => z.zoneType === 'indoor');
    let cx = 0;
    let cz = 0;
    let span = 12;
    if (indoorZones.length > 0) {
      let minX = Infinity,
        maxX = -Infinity,
        minZ = Infinity,
        maxZ = -Infinity;
      for (const iz of indoorZones) {
        minX = Math.min(minX, iz.x - iz.width / 2);
        maxX = Math.max(maxX, iz.x + iz.width / 2);
        minZ = Math.min(minZ, iz.z - iz.depth / 2);
        maxZ = Math.max(maxZ, iz.z + iz.depth / 2);
      }
      cx = (minX + maxX) / 2;
      cz = (minZ + maxZ) / 2;
      span = Math.max(8, maxX - minX, maxZ - minZ);
    }

    if (!focusedZoneId) {
      const floorElevOffset =
        activeFloor === 'all_stacked' ? 0 : Math.max(0, activeFloor) * FLOOR_HEIGHT;
      if (cameraPreset === 'overview') {
        _targetCamPos.set(
          cx - span * 0.92,
          Math.max(12.5, span * 0.98) + floorElevOffset * 0.65,
          cz + span * 1.25
        );
        _targetLookAt.set(cx, 0.8 + floorElevOffset * 0.85, cz);
      } else if (cameraPreset === 'living_kitchen') {
        const mainRoom =
          indoorZones.find((z) => (z.level ?? 0) === (activeFloor === 'all_stacked' ? 0 : activeFloor)) ||
          indoorZones[0];
        const rx = mainRoom ? mainRoom.x : cx;
        const rz = mainRoom ? mainRoom.z : cz;
        const rSpan = mainRoom ? Math.max(4.5, mainRoom.width, mainRoom.depth) : 6.5;
        _targetCamPos.set(rx - rSpan * 0.3, 6.2 + floorElevOffset * 0.85, rz + rSpan * 1.15);
        _targetLookAt.set(rx, 0.9 + floorElevOffset * 0.85, rz);
      } else if (cameraPreset === 'driveway_solar') {
        const garageZone = indoorZones.find((z) =>
          z.name.toLowerCase().includes('garage') || z.name.toLowerCase().includes('carport')
        );
        const gx = garageZone ? garageZone.x : cx + span * 0.45;
        const gz = garageZone ? garageZone.z : cz;
        _targetCamPos.set(gx + 9.5, 8.8 + floorElevOffset * 0.65, gz + 9.5);
        _targetLookAt.set(gx, 1.2 + floorElevOffset * 0.65, gz);
      } else if (cameraPreset === 'top_blueprint') {
        _targetCamPos.set(cx, Math.max(24, span * 1.85) + floorElevOffset, cz + 0.01);
        _targetLookAt.set(cx, floorElevOffset * 0.85, cz);
      } else {
        const preset = CAMERA_PRESETS[cameraPreset] || CAMERA_PRESETS.overview;
        _targetCamPos.set(
          cx + preset.pos[0] * 0.75,
          preset.pos[1] + floorElevOffset * 0.65,
          cz + preset.pos[2] * 0.85
        );
        _targetLookAt.set(cx, preset.target[1] + floorElevOffset * 0.85, cz + 2.0);
      }
      sceneObjectsRef.current.cameraTransitionActive = true;
      return;
    }

    const zone = allZones.find((z) => z.id === focusedZoneId);
    if (!zone) return;

    if (zone.savedCameraView) {
      _targetCamPos.set(
        zone.savedCameraView.position[0],
        zone.savedCameraView.position[1],
        zone.savedCameraView.position[2]
      );
      _targetLookAt.set(
        zone.savedCameraView.target[0],
        zone.savedCameraView.target[1],
        zone.savedCameraView.target[2]
      );
      sceneObjectsRef.current.cameraTransitionActive = true;
      return;
    }

    const zLevel = zone.level ?? 0;
    const zPlinth = zLevel >= 0 && zone.zoneType === 'indoor' ? (zone.plinthHeight ?? 0) : 0;
    const yOff = zLevel * FLOOR_HEIGHT + zPlinth;
    const zSpan = Math.max(3.6, zone.width, zone.depth);
    const camHeight = yOff + Math.max(4.2, zSpan * 0.88);
    const camDistZ = Math.max(4.4, zSpan * 0.98);
    _targetCamPos.set(zone.x - zSpan * 0.28, camHeight, zone.z + camDistZ);
    _targetLookAt.set(zone.x, yOff + 0.75, zone.z);
    sceneObjectsRef.current.cameraTransitionActive = true;
  }, [cameraPreset, focusedZoneId, activeFloor]);

  // Helper: Compute a true FRONTAL 3D camera position for any opening, gate, or smart asset
  // so event auto-jumps and alert clicks never view a door/window/gate/sensor from behind its wall!
  const flyCameraFrontallyToTarget = React.useCallback(
    (
      wx: number,
      wy: number,
      wz: number,
      opts?: { openingId?: string; assetId?: string }
    ) => {
      let matchedOp = opts?.openingId
        ? project.openings.find((o) => o.id === opts.openingId)
        : undefined;
      let matchedAsset = opts?.assetId
        ? project.assets.find((a) => a.id === opts.assetId)
        : undefined;

      if (!matchedOp && !matchedAsset) {
        matchedOp = project.openings.find(
          (o) => Math.hypot(o.x - wx, o.z - wz) < 0.65
        );
        if (!matchedOp) {
          matchedAsset = project.assets.find(
            (a) => Math.hypot(a.position[0] - wx, a.position[2] - wz) < 0.65
          );
        }
      }

      let frontX = 0.25;
      let frontZ = 0.96;
      const dist = 7.2;
      const heightOff = 3.35;

      if (matchedOp) {
        const rotY = matchedOp.rotationY || 0;
        // Normal perpendicular to the opening's wall plane
        let nx = Math.sin(rotY);
        let nz = Math.cos(rotY);

        // Determine outward/frontal sign relative to the containing room or building center
        const opLevel = matchedOp.level ?? 0;
        const levelZones = project.zones.filter((z) => (z.level ?? 0) === opLevel);
        const hostZone = findBestZoneForPoint(
          matchedOp.x,
          matchedOp.z,
          opLevel,
          levelZones
        );
        if (hostZone) {
          const outX = matchedOp.x - hostZone.x;
          const outZ = matchedOp.z - hostZone.z;
          const dot = outX * nx + outZ * nz;
          if (Math.abs(dot) > 0.12) {
            const sign = dot >= 0 ? 1 : -1;
            nx *= sign;
            nz *= sign;
          }
        }
        // Slight 14° perspective angle so 3D depth is visible while staying strictly frontal
        const sideX = nz * 0.22;
        const sideZ = -nx * 0.22;
        const len = Math.hypot(nx + sideX, nz + sideZ) || 1;
        frontX = (nx + sideX) / len;
        frontZ = (nz + sideZ) / len;
      } else if (matchedAsset) {
        const rotY = matchedAsset.rotationY || 0;
        let nx = Math.sin(rotY);
        let nz = Math.cos(rotY);

        // If wall-mounted or near room perimeter, ensure camera stays on the unobstructed front side
        const aLevel = matchedAsset.level ?? 0;
        const levelZones = project.zones.filter((z) => (z.level ?? 0) === aLevel);
        const hostZone = findBestZoneForPoint(
          matchedAsset.position[0],
          matchedAsset.position[2],
          aLevel,
          levelZones
        );
        if (hostZone && matchedAsset.mountType !== 'wall') {
          const toCenterX = hostZone.x - matchedAsset.position[0];
          const toCenterZ = hostZone.z - matchedAsset.position[2];
          if (Math.hypot(toCenterX, toCenterZ) > 0.8) {
            const dot = toCenterX * nx + toCenterZ * nz;
            if (dot < -0.25) {
              nx = -nx;
              nz = -nz;
            }
          }
        }
        const sideX = nz * 0.2;
        const sideZ = -nx * 0.2;
        const len = Math.hypot(nx + sideX, nz + sideZ) || 1;
        frontX = (nx + sideX) / len;
        frontZ = (nz + sideZ) / len;
      }

      _targetLookAt.set(wx, wy, wz);
      _targetCamPos.set(
        wx + frontX * dist,
        Math.max(1.8, wy + heightOff),
        wz + frontZ * dist
      );
      sceneObjectsRef.current.cameraTransitionActive = true;
      sceneObjectsRef.current.wakeUpUntil = performance.now() + 1800;
    },
    [project.openings, project.assets, project.zones]
  );

  // Auto-Jump 3D Camera when a single Live Event occurs (e.g. Garage door opens or Smoke/Water alarm triggers)
  const prevActiveEventSigRef = useRef<string>('');
  useEffect(() => {
    if (activeTab !== 'live') return;
    if (project.liveCockpitConfig?.autoJumpToActiveEvents === false) return;

    const activeTargets: {
      id: string;
      wx: number;
      wy: number;
      wz: number;
      openingId?: string;
      assetId?: string;
    }[] = [];
    for (const op of project.openings) {
      const st = resolveOpeningSensorState(op, entities, false);
      if (st === 'open' || st === 'tilted') {
        const yOff = (op.level ?? 0) * FLOOR_HEIGHT;
        activeTargets.push({
          id: `op_${op.id}:${st}`,
          wx: op.x,
          wy: yOff + op.sillHeight + op.height * 0.5,
          wz: op.z,
          openingId: op.id,
        });
      }
    }
    for (const asset of project.assets) {
      const entId = asset.entityId || asset.actuatorEntityId;
      const ent = entId ? entities[entId] : undefined;
      if (!ent) continue;
      const isAlarm =
        (ent.attributes.device_class === 'smoke' ||
          ent.attributes.device_class === 'moisture') &&
        (ent.state === 'detected' || ent.attributes.alarm_test_active);
      const isGateOpen =
        (asset.catalogId === 'electric_roller_gate' ||
          asset.catalogId === 'sliding_driveway_gate' ||
          asset.catalogId === 'garage_door_opener') &&
        isBinaryEntityActive(ent);
      if (isAlarm || isGateOpen) {
        const yOff = (asset.level ?? 0) * FLOOR_HEIGHT;
        activeTargets.push({
          id: `asset_${asset.id}:${ent.state}`,
          wx: asset.position[0],
          wy: yOff + asset.position[1] + 0.8,
          wz: asset.position[2],
          assetId: asset.id,
        });
      }
    }

    const nextSig = activeTargets.map((t) => t.id).join('|');
    const prevSig = prevActiveEventSigRef.current;
    prevActiveEventSigRef.current = nextSig;

    // When a single event is active (or a new event just triggered), fly the 3D camera frontally to it!
    if (activeTargets.length === 1 && nextSig !== prevSig) {
      const target = activeTargets[0];
      flyCameraFrontallyToTarget(target.wx, target.wy, target.wz, {
        openingId: target.openingId,
        assetId: target.assetId,
      });
    }
  }, [
    activeTab,
    entities,
    project.openings,
    project.assets,
    project.liveCockpitConfig?.autoJumpToActiveEvents,
    flyCameraFrontallyToTarget,
  ]);

  const focusedZone = focusedZoneId
    ? project.zones.find((z) => z.id === focusedZoneId) || null
    : null;

  const renderBadgeIcon = (kind: BadgeDomainKind, isActive: boolean) => {
    switch (kind) {
      case 'light':
        return (
          <Lightbulb
            className={`w-3 h-3 shrink-0 ${
              isActive ? 'text-amber-400' : 'text-slate-400'
            }`}
          />
        );
      case 'opening':
        return (
          <DoorOpen
            className={`w-3 h-3 shrink-0 ${
              isActive ? 'text-sky-400' : 'text-slate-400'
            }`}
          />
        );
      case 'power':
        return (
          <Zap
            className={`w-3 h-3 shrink-0 ${
              isActive ? 'text-emerald-400' : 'text-slate-400'
            }`}
          />
        );
      case 'climate':
        return <Thermometer className="w-3 h-3 shrink-0 text-amber-400" />;
      case 'cover':
        return (
          <Blinds
            className={`w-3 h-3 shrink-0 ${
              isActive ? 'text-amber-400' : 'text-emerald-400'
            }`}
          />
        );
      case 'water':
        return (
          <Droplets
            className={`w-3 h-3 shrink-0 ${
              isActive ? 'text-sky-400' : 'text-slate-400'
            }`}
          />
        );
      case 'alarm':
        return (
          <ShieldAlert
            className={`w-3 h-3 shrink-0 ${
              isActive ? 'text-red-400 animate-pulse' : 'text-emerald-400'
            }`}
          />
        );
      default:
        return <Sparkles className="w-3 h-3 shrink-0 text-sky-400" />;
    }
  };

  // Precompute structured Room & Elements Directory for the active floor
  const roomDirectory = React.useMemo(() => {
    const floorZones = project.zones.filter(
      (z) => activeFloor === 'all_stacked' || (z.level ?? 0) === activeFloor
    );

    const floorAssets = project.assets.filter(
      (a) => activeFloor === 'all_stacked' || (a.level ?? 0) === activeFloor
    );

    const assetsByZone = new Map<string, PlacedAsset[]>();
    for (const a of floorAssets) {
      const aLevel = a.level ?? 0;
      const bestZ = findBestZoneForPoint(a.position[0], a.position[2], aLevel, floorZones);
      if (bestZ) {
        const arr = assetsByZone.get(bestZ.id) || [];
        arr.push(a);
        assetsByZone.set(bestZ.id, arr);
      }
    }

    const q = listSearchQuery.trim().toLowerCase();

    return floorZones
      .map((zone) => {
        const zLevel = zone.level ?? 0;
        const zoneAssets = assetsByZone.get(zone.id) || [];
        const halfW = zone.width / 2 + 0.65;
        const halfD = zone.depth / 2 + 0.65;
        const zoneOpenings = project.openings.filter(
          (op) =>
            (op.level ?? 0) === zLevel &&
            op.x >= zone.x - halfW &&
            op.x <= zone.x + halfW &&
            op.z >= zone.z - halfD &&
            op.z <= zone.z + halfD
        );

        let lightsOn = 0;
        let lightsTotal = 0;
        let powerWatts = 0;
        let activeAssetsCount = 0;

        for (const asset of zoneAssets) {
          if (!asset.entityId) continue;
          const ent = entities[asset.entityId];
          if (!ent) continue;
          if (ent.domain === 'light') {
            lightsTotal++;
            if (ent.state === 'on') lightsOn++;
          }
          if (typeof ent.attributes.current_power_w === 'number' && ent.state !== 'off') {
            powerWatts += ent.attributes.current_power_w;
          }
          if (ent.state === 'on' || ent.state === 'open' || ent.state === 'detected') {
            activeAssetsCount++;
          }
        }

        let openingsActive = 0;
        for (const op of zoneOpenings) {
          const st = resolveOpeningSensorState(op, entities);
          if (st === 'open' || st === 'tilted') openingsActive++;
        }

        const climateEnt = zone.climateEntityId ? entities[zone.climateEntityId] : undefined;
        const tempText =
          climateEnt?.attributes.current_temperature !== undefined
            ? `${Number(climateEnt.attributes.current_temperature).toFixed(1)}°C`
            : null;

        const filteredAssets = q
          ? zoneAssets.filter(
              (a) =>
                a.name.toLowerCase().includes(q) ||
                zone.name.toLowerCase().includes(q) ||
                (a.entityId && a.entityId.toLowerCase().includes(q))
            )
          : zoneAssets;

        const filteredOpenings = q
          ? zoneOpenings.filter(
              (o) =>
                o.name.toLowerCase().includes(q) || zone.name.toLowerCase().includes(q)
            )
          : zoneOpenings;

        const bldgGroups = getBuildingHierarchyGroups(project.zones);
        const parentBldg =
          zone.zoneType === 'indoor'
            ? bldgGroups.find((g) => g.zones.some((z) => z.id === zone.id))
            : undefined;

        return {
          zone,
          buildingLabel:
            zone.zoneType === 'indoor'
              ? parentBldg?.label || 'Hauptgebäude'
              : 'Außenanlagen & Garten',
          assets: filteredAssets,
          openings: filteredOpenings,
          totalElements: zoneAssets.length + zoneOpenings.length,
          lightsOn,
          lightsTotal,
          openingsActive,
          powerWatts: Math.round(powerWatts),
          hasActive: activeAssetsCount > 0 || openingsActive > 0,
          tempText,
        };
      })
      .filter((entry) => {
        if (listFilterMode === 'indoor' && entry.zone.zoneType !== 'indoor') return false;
        if (listFilterMode === 'outdoor' && entry.zone.zoneType !== 'outdoor') return false;
        if (listFilterMode === 'active' && !entry.hasActive) return false;
        if (q) {
          const nameMatches =
            entry.zone.name.toLowerCase().includes(q) ||
            entry.buildingLabel.toLowerCase().includes(q);
          return nameMatches || entry.assets.length > 0 || entry.openings.length > 0;
        }
        return entry.totalElements > 0 || entry.zone.zoneType === 'indoor';
      });
  }, [project.zones, project.assets, project.openings, activeFloor, entities, listSearchQuery, listFilterMode]);

  const focusedRoomEntry = React.useMemo(() => {
    if (!focusedZone) return null;
    const zLevel = focusedZone.level ?? 0;
    const floorZones = project.zones.filter(
      (z) => activeFloor === 'all_stacked' || (z.level ?? 0) === activeFloor
    );
    const assets = project.assets.filter((a) => {
      if ((a.level ?? 0) !== zLevel) return false;
      const best = findBestZoneForPoint(a.position[0], a.position[2], zLevel, floorZones);
      return best ? best.id === focusedZone.id : isPointInsideZone(a.position[0], a.position[2], focusedZone);
    });
    const halfW = focusedZone.width / 2 + 0.65;
    const halfD = focusedZone.depth / 2 + 0.65;
    const openings = project.openings.filter(
      (op) =>
        (op.level ?? 0) === zLevel &&
        op.x >= focusedZone.x - halfW &&
        op.x <= focusedZone.x + halfW &&
        op.z >= focusedZone.z - halfD &&
        op.z <= focusedZone.z + halfD
    );
    return { zone: focusedZone, assets, openings };
  }, [focusedZone, project.zones, project.assets, project.openings, activeFloor]);

  return (
    <div className="relative w-full h-full overflow-hidden">
      <div
        ref={canvasMountRef}
        className={`w-full h-full touch-none ${
          activeTab === 'editor' && pendingCatalogItem
            ? 'cursor-crosshair'
            : 'cursor-grab active:cursor-grabbing'
        }`}
      />

      {activeTab === 'editor' && pendingCatalogItem && (
        <div className="absolute top-16 sm:top-20 left-1/2 -translate-x-1/2 z-20 pointer-events-none max-w-[92vw]">
          <div className="px-3.5 py-2 rounded-lg bg-amber-500 text-slate-950 text-xs font-semibold shadow-lg truncate">
            Tippe/klicke in das 3D-Haus oder die Außenanlage, um „{pendingCatalogItem.name}“ zu platzieren
          </div>
        </div>
      )}

      {/* Quick Roof Visibility Switcher when inspecting an individual floor (EG, 1. OG, DG, KG) */}
      {!pureLiveMode && activeFloor !== 'all_stacked' && (
        <div className="absolute top-3 sm:top-4 right-2.5 sm:right-4 z-20 flex items-center gap-1 sm:gap-1.5 px-2 sm:px-2.5 py-1.5 rounded-xl bg-[#090d16]/95 border border-white/15 shadow-xl max-w-[calc(100vw-1.25rem)] overflow-x-auto no-scrollbar">
          <span className="text-[10px] font-semibold text-slate-300 pr-0.5 whitespace-nowrap shrink-0">
            Dach:
          </span>
          {(
            [
              ['hidden', 'Ausgeblendet (Freier Blick)'],
              ['cutaway', 'Transparent'],
              ['solid', 'Sichtbar'],
            ] as const
          ).map(([mode, label]) => (
            <button
              key={mode}
              type="button"
              onClick={() => setFloorSwitchRoofMode(mode)}
              className={`px-2 py-0.5 rounded-lg text-[10px] font-medium transition-colors whitespace-nowrap shrink-0 ${
                floorSwitchRoofMode === mode
                  ? 'bg-amber-500 text-slate-950 font-semibold'
                  : 'bg-slate-800/90 text-slate-300 hover:text-white border border-white/10'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {/* Projected 3D Active Status Badges, Floating Room Status Mini-Cards & Off-Screen Edge Pins */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden z-10">
        {/* 1. Floating 3D Room Status Mini-Cards (shown during Haus- & Raum-Tour, Room Focus, or when configured as 'always') */}
        {roomSummaries.map((room) => {
          const cfg = room.config || {};
          const showTemp = cfg.showTemperature !== false && Boolean(room.tempText);
          const showHum = cfg.showHumidity !== false && Boolean(room.humidityText);
          const showLights = cfg.showLights !== false && room.lightsTotal > 0;
          const showOpenings = cfg.showOpenings !== false && room.openingsTotal > 0;
          const showPower = cfg.showPowerWatts !== false && room.powerWatts > 0;
          return (
            <div
              key={`room_card_${room.zoneId}`}
              ref={(el) => {
                if (el) roomPillDomRefs.current.set(room.zoneId, el as unknown as HTMLButtonElement);
                else roomPillDomRefs.current.delete(room.zoneId);
              }}
              style={{
                transform: `translate3d(${room.x}px, ${room.y}px, 0) translate(-50%, -100%)`,
              }}
              className="pointer-events-auto absolute top-0 left-0 z-20 flex flex-col items-center will-change-transform"
            >
              <div
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectZone(room.zoneId);
                  if (onFocusZone && focusedZoneId !== room.zoneId) {
                    onFocusZone(room.zoneId);
                  }
                }}
                className={`cursor-pointer min-w-[168px] max-w-[240px] rounded-2xl px-3 py-2 backdrop-blur-md border shadow-2xl transition-all ${
                  room.hasAlarm
                    ? 'bg-red-950/92 border-red-400 text-red-100 ring-2 ring-red-500/40 animate-pulse'
                    : 'bg-slate-950/88 border-amber-400/45 text-slate-100 hover:border-amber-400/80'
                }`}
              >
                <div className="flex items-center justify-between gap-2 border-b border-white/10 pb-1 mb-1.5">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0 shadow-[0_0_8px_#fbbf24]" />
                    <span className="text-[11px] font-bold tracking-tight text-white truncate">
                      {room.name}
                    </span>
                  </div>
                  {showLights && room.lightEntityIds.length > 0 && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        for (const lid of room.lightEntityIds) {
                          onQuickToggleEntity(lid);
                        }
                      }}
                      title="Raumlicht direkt ein-/ausschalten"
                      className={`px-1.5 py-0.5 rounded-md text-[9px] font-mono font-bold transition-colors ${
                        room.lightsOn > 0
                          ? 'bg-amber-400 text-slate-950 shadow'
                          : 'bg-slate-800 text-slate-300 border border-white/10 hover:text-white'
                      }`}
                    >
                      💡 {room.lightsOn}/{room.lightsTotal}
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-x-2.5 gap-y-1 text-[10px]">
                  {showTemp && (
                    <div className="flex items-center gap-1 text-amber-200 font-mono">
                      <Thermometer className="w-3 h-3 text-amber-400 shrink-0" />
                      <span>{room.tempText}</span>
                    </div>
                  )}
                  {showHum && (
                    <div className="flex items-center gap-1 text-sky-200 font-mono">
                      <Droplets className="w-3 h-3 text-sky-400 shrink-0" />
                      <span>{room.humidityText}</span>
                    </div>
                  )}
                  {showOpenings && (
                    <div
                      className={`flex items-center gap-1 font-mono ${
                        room.openingsActive > 0 ? 'text-sky-300 font-semibold' : 'text-slate-400'
                      }`}
                    >
                      <DoorOpen className="w-3 h-3 shrink-0" />
                      <span>
                        {room.openingsActive > 0
                          ? `${room.openingsActive} offen`
                          : 'Fenster/Türen zu'}
                      </span>
                    </div>
                  )}
                  {showPower && (
                    <div className="flex items-center gap-1 text-emerald-300 font-mono">
                      <Zap className="w-3 h-3 text-emerald-400 shrink-0" />
                      <span>{room.powerWatts} W</span>
                    </div>
                  )}
                </div>

                {room.customItems.length > 0 && (
                  <div className="mt-1.5 pt-1 border-t border-white/10 space-y-0.5">
                    {room.customItems.map((ci) => (
                      <div
                        key={ci.id}
                        className="flex items-center justify-between gap-2 text-[9.5px]"
                      >
                        <span className="text-slate-400 truncate">{ci.label}</span>
                        <span className="font-mono font-semibold text-slate-200 shrink-0">
                          {ci.value}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="w-0.5 h-3.5 bg-gradient-to-b from-amber-400/70 to-transparent" />
              <div className="w-2 h-2 rounded-full bg-amber-400/80 shadow-[0_0_8px_#fbbf24]" />
            </div>
          );
        })}

        {/* 2. Floating 3D Element Labels & Active Status Badges (e.g. Open Garage Door, Alarms, Room Zoom Labels) */}
        {badges.map((b) => {
            const shortLabel = b.label.length > 20 ? b.label.slice(0, 19) + '…' : b.label;
            return (
              <button
                key={b.id}
                ref={(el) => {
                  if (el) badgeDomRefs.current.set(b.id, el);
                  else badgeDomRefs.current.delete(b.id);
                }}
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  if (b.openingId) {
                    const op = project.openings.find((o) => o.id === b.openingId);
                    if (op && activeTab === 'live' && isOpeningActuatorControllable(op, entities)) {
                      const targetEntId = op.actuatorEntityId || op.entityId || op.shutterEntityId;
                      if (targetEntId) {
                        onQuickToggleEntity(targetEntId);
                      }
                    }
                    if (onSelectOpening) {
                      onSelectOpening(b.openingId);
                    }
                  } else if (b.assetId) {
                    const asset = project.assets.find((a) => a.id === b.assetId);
                    if (
                      asset &&
                      activeTab === 'live' &&
                      isAssetActuatorControllable(asset, entities)
                    ) {
                      const targetEntId = asset.actuatorEntityId || asset.entityId;
                      if (targetEntId) {
                        onQuickToggleEntity(targetEntId);
                      }
                    }
                    onSelectAsset(b.assetId, b.entityId);
                  } else if (b.entityId) {
                    onQuickToggleEntity(b.entityId);
                  }
                }}
                style={{
                  transform: `translate3d(${b.x}px, ${b.y}px, 0) translate(-50%, -50%)`,
                }}
                className={`pointer-events-auto group absolute top-0 left-0 flex items-center gap-1.5 px-2.5 py-1 rounded-full border transition-colors duration-150 shadow-lg whitespace-nowrap hover:z-30 will-change-transform ${b.colorClass}`}
              >
                <span className="relative flex items-center justify-center">
                  {renderBadgeIcon(b.kind, b.isActive)}
                  <span
                    className={`absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full ${b.dotColorClass}`}
                  />
                </span>
                <span className="inline-flex items-center gap-1 text-[9.5px] leading-tight">
                  <span className="font-medium">{shortLabel}</span>
                  <span className="opacity-50">·</span>
                  <span className="font-mono text-[9px] font-semibold tabular-nums">
                    {b.sublabel}
                  </span>
                </span>
              </button>
            );
          })}

        {/* 3. Off-Screen Viewport Edge Indicator Pins (e.g. when Garage Door is open outside the current 3D camera view!) */}
        {activeTab === 'live' &&
          offscreenPins.map((pin) => {
            const arrowChar =
              pin.arrowDir === 'left'
                ? '←'
                : pin.arrowDir === 'right'
                ? '→'
                : pin.arrowDir === 'up'
                ? '↑'
                : '↓';
            return (
              <button
                key={pin.id}
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  // Smoothly pan/focus camera FRONTALLY onto the off-screen open garage door / alert
                  const [wx, wy, wz] = pin.targetWorldPos;
                  flyCameraFrontallyToTarget(wx, wy, wz, {
                    openingId: pin.openingId,
                    assetId: pin.assetId,
                  });
                  if (pin.openingId && onSelectOpening) {
                    onSelectOpening(pin.openingId);
                  } else if (pin.assetId) {
                    onSelectAsset(pin.assetId, pin.entityId);
                  }
                }}
                style={{
                  transform: `translate3d(${pin.edgeX}px, ${pin.edgeY}px, 0) translate(-50%, -50%)`,
                }}
                title={`${pin.label} (${pin.sublabel}) liegt außerhalb des Blickfelds — Klicken zum Hinzoomen`}
                className={`pointer-events-auto absolute top-0 left-0 z-30 flex items-center gap-1.5 px-2.5 py-1.5 rounded-full border shadow-2xl whitespace-nowrap transition-transform hover:scale-105 ${
                  pin.severity === 'alarm'
                    ? 'bg-red-950/95 border-red-400 text-red-100 animate-bounce'
                    : pin.severity === 'warning'
                    ? 'bg-amber-950/95 border-amber-400 text-amber-200 ring-2 ring-amber-400/35'
                    : 'bg-slate-950/95 border-sky-400/80 text-sky-200'
                }`}
              >
                <span className="font-bold text-xs">{arrowChar}</span>
                <DoorOpen className="w-3.5 h-3.5 text-amber-300 shrink-0" />
                <span className="text-[10px] font-bold">{pin.label}</span>
                <span className="px-1.5 py-0.2 rounded bg-amber-400/20 text-amber-300 font-mono text-[9px] font-bold">
                  {pin.sublabel}
                </span>
              </button>
            );
          })}
      </div>

      {/* ===================================================================== */}
      {/* MODE A: ZOOMED INTO A ROOM (focusedZone !== null) -> Isolated 3D Room HUD */}
      {/* ===================================================================== */}
      {focusedRoomEntry && (
        <aside className="absolute top-14 sm:top-4 left-2.5 sm:left-4 z-20 w-[calc(100vw-1.25rem)] sm:w-80 max-h-[55dvh] sm:max-h-[calc(100dvh-11rem)] flex flex-col rounded-2xl bg-[#090d16]/95 border border-amber-400/35 shadow-2xl overflow-hidden">
          <div className="px-3.5 py-3 border-b border-white/10 bg-slate-900/80 space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => onFocusZone && onFocusZone(null)}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-[10.5px] font-bold transition-colors shadow"
              >
                <span>← Alle Räume & Liste</span>
              </button>

              <button
                type="button"
                onClick={() => setShowFocusedRoomList((prev) => !prev)}
                className={`px-2.5 py-1 rounded-lg text-[10px] font-medium border transition-colors ${
                  showFocusedRoomList
                    ? 'bg-slate-800 text-amber-300 border-amber-400/50'
                    : 'bg-slate-900 text-slate-300 border-white/10 hover:text-white'
                }`}
              >
                {showFocusedRoomList ? 'Liste ausblenden' : `Liste (${focusedRoomEntry.assets.length + focusedRoomEntry.openings.length})`}
              </button>
            </div>

            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0" />
                  <h3 className="text-xs font-bold text-white truncate">
                    Raum-Fokus: {focusedRoomEntry.zone.name}
                  </h3>
                  {focusedRoomEntry.zone.savedCameraView && (
                    <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 text-[9px] font-semibold">
                      Kamera-Preset aktiv
                    </span>
                  )}
                </div>
                <p className="text-[10px] text-slate-400 font-mono mt-0.5 tabular-nums">
                  {(focusedRoomEntry.zone.width * focusedRoomEntry.zone.depth).toFixed(1)} m² ·{' '}
                  {focusedRoomEntry.assets.length} Geräte/Objekte · {focusedRoomEntry.openings.length} Öffnungen
                </p>
              </div>
              {onUpdateZone && (
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => setShowRoomCardConfig((prev) => !prev)}
                    title="Konfigurieren, welche Status-Werte auf der schwebenden 3D-Raum-Mini-Card angezeigt werden"
                    className={`px-2 py-1 rounded-lg border text-[10px] font-semibold transition-colors ${
                      showRoomCardConfig
                        ? 'bg-amber-500 text-slate-950 border-amber-400'
                        : 'bg-slate-800/90 hover:bg-slate-700 border-white/15 text-amber-200'
                    }`}
                  >
                    📋 Raum-Card
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const cam = sceneObjectsRef.current.camera;
                      const ctrl = sceneObjectsRef.current.controls;
                      if (!cam || !ctrl) return;
                      onUpdateZone(focusedRoomEntry.zone.id, {
                        savedCameraView: {
                          position: [
                            +cam.position.x.toFixed(2),
                            +cam.position.y.toFixed(2),
                            +cam.position.z.toFixed(2),
                          ],
                          target: [
                            +ctrl.target.x.toFixed(2),
                            +ctrl.target.y.toFixed(2),
                            +ctrl.target.z.toFixed(2),
                          ],
                        },
                      });
                    }}
                    title="Aktuellen 3D-Kamerawinkel für diesen Raum als Fokus-Preset speichern"
                    className="px-2 py-1 rounded-lg bg-sky-500/20 hover:bg-sky-500/35 border border-sky-400/40 text-sky-200 text-[10px] font-semibold transition-colors"
                  >
                    📷 Blickwinkel
                  </button>
                  {focusedRoomEntry.zone.savedCameraView && (
                    <button
                      type="button"
                      onClick={() => {
                        onUpdateZone(focusedRoomEntry.zone.id, {
                          savedCameraView: undefined,
                        });
                      }}
                      title="Gespeichertes Kamera-Preset für diesen Raum zurücksetzen"
                      className="px-1.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 border border-white/10 text-slate-300 text-[10px] transition-colors"
                    >
                      ↺
                    </button>
                  )}
                </div>
              )}
            </div>

            {showRoomCardConfig && onUpdateZone && (
              <div className="p-2.5 rounded-xl bg-slate-950/90 border border-amber-400/30 space-y-2 text-[10.5px]">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-amber-300">
                    Schwebende 3D-Raum-Card:
                  </span>
                  <select
                    value={focusedRoomEntry.zone.roomStatusCardConfig?.showMode || 'tour_and_focus'}
                    onChange={(e) =>
                      onUpdateZone(focusedRoomEntry.zone.id, {
                        roomStatusCardConfig: {
                          ...focusedRoomEntry.zone.roomStatusCardConfig,
                          showMode: e.target.value as 'tour_and_focus' | 'always' | 'off',
                        },
                      })
                    }
                    className="px-2 py-0.5 rounded bg-slate-900 border border-white/15 text-[10px] text-white"
                  >
                    <option value="tour_and_focus">Bei Kamerafahrt & Raum-Zoom</option>
                    <option value="always">Immer im Raum einblenden</option>
                    <option value="off">Ausgeblendet</option>
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-1.5 pt-1">
                  {(
                    [
                      ['showTemperature', '🌡️ Temperatur'],
                      ['showHumidity', '💧 Luftfeuchte'],
                      ['showLights', '💡 Licht-Status'],
                      ['showOpenings', '🚪 Fenster/Türen'],
                      ['showPowerWatts', '⚡ Leistung (W)'],
                    ] as const
                  ).map(([fieldKey, label]) => {
                    const currentVal =
                      focusedRoomEntry.zone.roomStatusCardConfig?.[fieldKey] !== false;
                    return (
                      <label
                        key={fieldKey}
                        className="flex items-center gap-1.5 text-slate-200 cursor-pointer select-none"
                      >
                        <input
                          type="checkbox"
                          checked={currentVal}
                          onChange={(e) =>
                            onUpdateZone(focusedRoomEntry.zone.id, {
                              roomStatusCardConfig: {
                                ...focusedRoomEntry.zone.roomStatusCardConfig,
                                [fieldKey]: e.target.checked,
                              },
                            })
                          }
                          className="rounded border-white/20 bg-slate-900 text-amber-500"
                        />
                        <span>{label}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Quick Room Switcher Pills while zoomed in (strictly indoor rooms!) */}
          <div className="px-3 py-2 border-b border-white/10 flex items-center gap-1 overflow-x-auto no-scrollbar bg-slate-950/70">
            {project.zones
              .filter(
                (z) =>
                  z.zoneType === 'indoor' &&
                  (activeFloor === 'all_stacked' || (z.level ?? 0) === activeFloor)
              )
              .map((z) => {
                const active = z.id === focusedRoomEntry.zone.id;
                return (
                  <button
                    key={z.id}
                    type="button"
                    onClick={() => {
                      onSelectZone(z.id);
                      if (onFocusZone) onFocusZone(z.id);
                    }}
                    className={`px-2 py-1 rounded-lg text-[10px] font-medium whitespace-nowrap transition-colors ${
                      active
                        ? 'bg-amber-500 text-slate-950 font-semibold'
                        : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-white/5'
                    }`}
                  >
                    {z.name}
                  </button>
                );
              })}
          </div>

          {/* Optional Expandable Element List inside Room Zoom */}
          {showFocusedRoomList && (
            <div className="p-3 overflow-y-auto space-y-2.5 text-xs">
              {focusedRoomEntry.assets.map((asset) => {
                const ent = asset.entityId ? entities[asset.entityId] : undefined;
                const isOn =
                  ent?.state === 'on' ||
                  ent?.state === 'open' ||
                  ent?.state === 'detected';
                return (
                  <div
                    key={asset.id}
                    onClick={() => onSelectAsset(asset.id, asset.entityId)}
                    className="flex items-center justify-between p-2 rounded-xl bg-slate-900/85 hover:bg-slate-800 border border-white/10 cursor-pointer"
                  >
                    <div className="min-w-0 pr-2">
                      <div className="text-[11px] font-medium text-slate-100 truncate">
                        {cleanDisplayLabel(asset.name)}
                      </div>
                      <div className="text-[9.5px] font-mono text-slate-400 tabular-nums">
                        {ent ? ent.state.toUpperCase() : '3D-Einrichtung'}
                      </div>
                    </div>
                    {asset.entityId && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onQuickToggleEntity(asset.entityId!);
                        }}
                        className={`px-2 py-1 rounded-lg text-[10px] font-mono font-semibold ${
                          isOn
                            ? 'bg-amber-500 text-slate-950'
                            : 'bg-slate-800 text-slate-300 border border-white/10'
                        }`}
                      >
                        {isOn ? 'EIN' : 'AUS'}
                      </button>
                    )}
                  </div>
                );
              })}

              {focusedRoomEntry.openings.map((op) => {
                const st = resolveOpeningSensorState(op, entities);
                return (
                  <div
                    key={op.id}
                    onClick={() => onSelectOpening && onSelectOpening(op.id)}
                    className="flex items-center justify-between p-2 rounded-xl bg-slate-900/85 hover:bg-slate-800 border border-white/10 cursor-pointer"
                  >
                    <div className="min-w-0 pr-2">
                      <div className="text-[11px] font-medium text-slate-200 truncate">
                        {cleanDisplayLabel(op.name)}
                      </div>
                      <div className="text-[9.5px] font-mono text-slate-400 tabular-nums">
                        {op.width.toFixed(2)}×{op.height.toFixed(2)}m
                      </div>
                    </div>
                    <span
                      className={`px-2 py-0.5 rounded-md text-[9.5px] font-mono font-semibold ${
                        st === 'tilted'
                          ? 'bg-amber-500/20 text-amber-300 border border-amber-400/40'
                          : st === 'open'
                          ? 'bg-sky-500/20 text-sky-300 border border-sky-400/40'
                          : 'bg-emerald-500/15 text-emerald-300'
                      }`}
                    >
                      {st === 'tilted' ? 'GEKIPPT' : st === 'open' ? 'OFFEN' : 'ZU'}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </aside>
      )}

      {/* ===================================================================== */}
      {/* MODE B: OVERVIEW MODE (focusedZone === null) -> Structured Room & Elements Directory List */}
      {/* ===================================================================== */}
      {!focusedZone && !pureLiveMode && !hideRoomDirectory && showFloatingBadges && activeTab === 'live' && (
        <aside className="absolute top-14 sm:top-4 left-2.5 sm:left-4 z-20 w-[calc(100vw-1.25rem)] sm:w-80 max-h-[55dvh] sm:max-h-[calc(100dvh-11rem)] flex flex-col rounded-2xl bg-[#090d16]/95 border border-white/15 shadow-2xl overflow-hidden">
          {/* Directory Header */}
          <div className="px-3.5 py-2.5 border-b border-white/10 flex items-center justify-between bg-slate-900/80">
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <h3 className="text-xs font-bold text-white truncate">
                  Raum- & Elemente-Liste
                </h3>
              </div>
              <p className="text-[10px] text-slate-400 font-mono mt-0.5 tabular-nums">
                {roomDirectory.length} Bereiche · Klicke „Zoom“ für 3D-Raum-Labels
              </p>
            </div>

            <button
              type="button"
              onClick={() => setIsListMinimized((prev) => !prev)}
              className="px-2 py-1 rounded-lg bg-slate-800/90 hover:bg-slate-700 text-slate-300 hover:text-white border border-white/10 text-[10px] font-medium"
              title={isListMinimized ? 'Raumliste ausklappen' : 'Raumliste minimieren'}
            >
              {isListMinimized ? 'Aufklappen' : 'Minimieren'}
            </button>
          </div>

          {!isListMinimized && (
            <>
              {/* Search & Filter Bar */}
              <div className="p-2.5 border-b border-white/10 bg-slate-950/60 space-y-2">
                <input
                  type="text"
                  value={listSearchQuery}
                  onChange={(e) => setListSearchQuery(e.target.value)}
                  placeholder="Raum, Licht, Fenster oder Sensor suchen..."
                  className="w-full px-2.5 py-1.5 rounded-lg bg-slate-900 border border-white/10 text-[11px] text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-amber-400/70"
                />

                <div className="flex items-center gap-1">
                  {(
                    [
                      ['all', 'Alle'],
                      ['active', 'Aktiv'],
                      ['indoor', 'Innen'],
                      ['outdoor', 'Außen'],
                    ] as const
                  ).map(([mode, label]) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => setListFilterMode(mode)}
                      className={`flex-1 py-1 rounded-lg text-[10px] font-medium transition-colors ${
                        listFilterMode === mode
                          ? 'bg-amber-500 text-slate-950 font-semibold'
                          : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-white/5'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Scrollable Accordion of Rooms & Contained Elements */}
              <div className="p-2.5 overflow-y-auto space-y-2 text-xs">
                {roomDirectory.length === 0 ? (
                  <div className="p-4 rounded-xl bg-slate-900/50 border border-white/5 text-center text-[11px] text-slate-400">
                    Keine passenden Räume oder Elemente gefunden.
                  </div>
                ) : (
                  roomDirectory.map((entry, idx) => {
                    const prevBuildingLabel =
                      idx > 0 ? roomDirectory[idx - 1].buildingLabel : null;
                    const showBuildingHeader = entry.buildingLabel !== prevBuildingLabel;
                    const isExpanded =
                      Boolean(listSearchQuery.trim()) ||
                      Boolean(expandedRoomIds[entry.zone.id]);

                    return (
                      <React.Fragment key={entry.zone.id}>
                        {showBuildingHeader && (
                          <div className="px-2 pt-1.5 pb-0.5 flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-amber-300/90">
                            <span>{entry.buildingLabel}</span>
                            <span className="text-[9px] font-mono text-slate-400">
                              {
                                roomDirectory.filter(
                                  (r) => r.buildingLabel === entry.buildingLabel
                                ).length
                              }{' '}
                              Räume
                            </span>
                          </div>
                        )}
                        <div className="rounded-xl border border-white/10 bg-slate-900/70 overflow-hidden">
                        {/* Room Row Header */}
                        <div
                          onClick={() =>
                            setExpandedRoomIds((prev) => ({
                              ...prev,
                              [entry.zone.id]: !prev[entry.zone.id],
                            }))
                          }
                          className="px-2.5 py-2 flex items-center justify-between gap-2 cursor-pointer hover:bg-slate-800/70 transition-colors"
                        >
                          <div className="flex items-center gap-1.5 min-w-0">
                            <ChevronRight
                              className={`w-3.5 h-3.5 text-slate-400 shrink-0 transition-transform ${
                                isExpanded ? 'rotate-90 text-amber-400' : ''
                              }`}
                            />
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5">
                                <span className="text-[11px] font-semibold text-slate-100 truncate">
                                  {entry.zone.name}
                                </span>
                                {entry.tempText && (
                                  <span className="px-1.5 py-0.2 rounded bg-amber-500/15 text-amber-300 font-mono text-[9px] tabular-nums">
                                    {entry.tempText}
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-2 text-[9.5px] font-mono text-slate-400 tabular-nums mt-0.5">
                                <span>{entry.totalElements} Elem.</span>
                                {entry.lightsTotal > 0 && (
                                  <span
                                    className={
                                      entry.lightsOn > 0 ? 'text-amber-300 font-semibold' : ''
                                    }
                                  >
                                    · {entry.lightsOn}/{entry.lightsTotal} Licht
                                  </span>
                                )}
                                {entry.openingsActive > 0 && (
                                  <span className="text-sky-300 font-semibold">
                                    · {entry.openingsActive} Offen
                                  </span>
                                )}
                                {entry.powerWatts > 0 && (
                                  <span className="text-emerald-300">
                                    · {entry.powerWatts}W
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* 1-Click 3D Room Zoom & Isolation Button */}
                          {onFocusZone && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onSelectZone(entry.zone.id);
                                onFocusZone(entry.zone.id);
                              }}
                              className="shrink-0 inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-amber-500/15 hover:bg-amber-500 text-amber-300 hover:text-slate-950 border border-amber-400/40 text-[10px] font-semibold transition-colors"
                              title={`Auf „${entry.zone.name}“ zoomen und nur diesen Raum + seine 3D-Labels anzeigen`}
                            >
                              <Maximize2 className="w-3 h-3" />
                              <span>Zoom</span>
                            </button>
                          )}
                        </div>

                        {/* Expanded Elements inside this Room */}
                        {isExpanded && (
                          <div className="px-2.5 pb-2.5 pt-1 border-t border-white/5 bg-slate-950/60 space-y-1.5">
                            {entry.assets.map((asset) => {
                              const ent = asset.entityId ? entities[asset.entityId] : undefined;
                              const isSelected = selectedAssetId === asset.id;
                              const isOn =
                                ent?.state === 'on' ||
                                ent?.state === 'open' ||
                                ent?.state === 'detected';

                              return (
                                <div
                                  key={asset.id}
                                  onClick={() => onSelectAsset(asset.id, asset.entityId)}
                                  className={`flex items-center justify-between p-1.5 rounded-lg border cursor-pointer transition-colors ${
                                    isSelected
                                      ? 'bg-amber-500/15 border-amber-400/60 text-white'
                                      : 'bg-slate-900/90 hover:bg-slate-800 border-white/5 text-slate-200'
                                  }`}
                                >
                                  <div className="flex items-center gap-2 min-w-0">
                                    <div
                                      className={`w-5 h-5 rounded-md flex items-center justify-center shrink-0 ${
                                        isOn
                                          ? 'bg-amber-500/20 text-amber-300 border border-amber-400/40'
                                          : 'bg-slate-800 text-slate-400'
                                      }`}
                                    >
                                      {asset.category === 'lighting' ? (
                                        <Lightbulb className="w-3 h-3" />
                                      ) : asset.category === 'shading' ? (
                                        <Blinds className="w-3 h-3" />
                                      ) : (
                                        <Zap className="w-3 h-3" />
                                      )}
                                    </div>
                                    <div className="min-w-0">
                                      <div className="text-[10.5px] font-medium truncate">
                                        {cleanDisplayLabel(asset.name)}
                                      </div>
                                      <div className="text-[9px] font-mono text-slate-400 truncate tabular-nums">
                                        {ent
                                          ? `${ent.state.toUpperCase()}${
                                              ent.attributes.current_power_w !== undefined
                                                ? ` · ${ent.attributes.current_power_w} W`
                                                : ''
                                            }${
                                              ent.attributes.brightness !== undefined &&
                                              ent.state === 'on'
                                                ? ` · ${Math.round(
                                                    (ent.attributes.brightness / 255) * 100
                                                  )}%`
                                                : ''
                                            }`
                                          : '3D-Einrichtung'}
                                      </div>
                                    </div>
                                  </div>

                                  {asset.entityId && (
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        onQuickToggleEntity(asset.entityId!);
                                      }}
                                      className={`px-2 py-0.5 rounded-md text-[9.5px] font-mono font-semibold transition-colors ${
                                        isOn
                                          ? 'bg-amber-500 text-slate-950 hover:bg-amber-400'
                                          : 'bg-slate-800 text-slate-300 hover:bg-slate-700 border border-white/10'
                                      }`}
                                    >
                                      {isOn ? 'EIN' : 'AUS'}
                                    </button>
                                  )}
                                </div>
                              );
                            })}

                            {entry.openings.map((op) => {
                              const st = resolveOpeningSensorState(op, entities);
                              return (
                                <div
                                  key={op.id}
                                  onClick={() => onSelectOpening && onSelectOpening(op.id)}
                                  className="flex items-center justify-between p-1.5 rounded-lg bg-slate-900/90 hover:bg-slate-800 border border-white/5 cursor-pointer transition-colors"
                                >
                                  <div className="flex items-center gap-2 min-w-0">
                                    <div
                                      className={`w-5 h-5 rounded-md flex items-center justify-center shrink-0 ${
                                        st === 'tilted'
                                          ? 'bg-amber-500/20 text-amber-300 border border-amber-400/40'
                                          : st === 'open'
                                          ? 'bg-sky-500/20 text-sky-300 border border-sky-400/40'
                                          : 'bg-slate-800 text-emerald-400'
                                      }`}
                                    >
                                      <DoorOpen className="w-3 h-3" />
                                    </div>
                                    <div className="min-w-0">
                                      <div className="text-[10.5px] font-medium text-slate-200 truncate">
                                        {cleanDisplayLabel(op.name)}
                                      </div>
                                      <div className="text-[9px] font-mono text-slate-400 tabular-nums">
                                        {op.width.toFixed(2)}×{op.height.toFixed(2)}m · Anschlag{' '}
                                        {(op.hingeSide || 'left') === 'right' ? 'Rechts' : 'Links'}
                                      </div>
                                    </div>
                                  </div>

                                  <span
                                    className={`px-1.5 py-0.5 rounded text-[9px] font-mono font-semibold ${
                                      st === 'tilted'
                                        ? 'bg-amber-500/20 text-amber-300 border border-amber-400/40'
                                        : st === 'open'
                                        ? 'bg-sky-500/20 text-sky-300 border border-sky-400/40'
                                        : 'bg-emerald-500/15 text-emerald-300'
                                    }`}
                                  >
                                    {st === 'tilted'
                                      ? 'GEKIPPT'
                                      : st === 'open'
                                      ? 'OFFEN'
                                      : 'ZU'}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        )}
                        </div>
                      </React.Fragment>
                    );
                  })
                )}
              </div>
            </>
          )}
        </aside>
      )}

      {/* ===================================================================== */}
      {/* SMART-COCKPIT DISPLAY CARDS OVERLAY (Raum-Cards, Energie-Pro, Kameras, Geräte) */}
      {/* ===================================================================== */}
      {showSmartCockpitCards && (
        <div className="absolute top-14 sm:top-16 right-2.5 sm:right-4 z-20 pointer-events-none">
          <SmartCockpitCardsOverlay
            project={project}
            entities={entities}
            activeFloorFilter={activeFloor}
            showEnergyFlow={showEnergyFlow}
            showSensorCones={showSensorRadii}
            showPresenceAvatars={showPresenceAvatars}
            onToggleEnergyFlow={() => onToggleEnergyFlow?.()}
            onToggleSensorCones={() => onToggleSensorRadii?.()}
            onTogglePresenceAvatars={() => onTogglePresenceAvatars?.()}
            onToggleEntity={onQuickToggleEntity}
            onUpdatePersonRoom={onUpdatePersonRoom}
            onSelectOpening={(opId) => onSelectOpening?.(opId)}
            onUpdateLiveCockpitConfig={onUpdateLiveCockpitConfig}
            onUpdateZone={onUpdateZone}
            onFocusZone={(zoneId) => {
              onSelectZone(zoneId);
              if (onFocusZone) onFocusZone(zoneId);
            }}
            onFlyToWorldPos={(wx, wy, wz) => {
              flyCameraFrontallyToTarget(wx, wy, wz);
            }}
          />
        </div>
      )}

      {/* Interactive 3D North Star (Nordstern) & Camera Idle Status Badge */}
      <div className="absolute bottom-20 sm:bottom-28 right-3 sm:right-4 z-15 flex flex-col items-end gap-2 pointer-events-none">
        {cameraIdleMode && (
          <button
            type="button"
            onClick={() => onChangeCameraIdleMode?.(false)}
            className="pointer-events-auto flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/95 text-slate-950 text-xs font-bold shadow-xl border border-amber-300"
            title="Langsame Kamerafahrt aktiv — Klicken zum Pausieren"
          >
            <span className="w-2 h-2 rounded-full bg-slate-950 animate-ping" />
            <span>Kamerafahrt (Idle) aktiv · Stopp</span>
          </button>
        )}

        <button
          type="button"
          onClick={() => {
            if (onUpdateNorthAngle) {
              const nextAngle = ((project.northAngle ?? 0) + 45) % 360;
              onUpdateNorthAngle(nextAngle);
            }
          }}
          onContextMenu={(e) => {
            e.preventDefault();
            if (onUpdateNorthAngle) onUpdateNorthAngle(0);
          }}
          title="Nordstern (Haus-Ausrichtung & Sonnenbahn): Klicken = +45° drehen · Rechtsklick = 0° Nord oben"
          className="pointer-events-auto group flex items-center gap-2 px-2.5 py-1.5 rounded-xl bg-[#090d16]/90 hover:bg-slate-900 border border-white/15 shadow-xl text-xs text-slate-200 transition-colors"
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
              stroke="rgba(245, 158, 11, 0.45)"
              strokeWidth="1.2"
            />
            {/* North Red/Amber Star Point */}
            <polygon points="18,3 21.5,18 18,15 14.5,18" fill="#f59e0b" />
            {/* South Point */}
            <polygon points="18,33 21,18 18,21 15,18" fill="#64748b" />
            {/* East/West Points */}
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
          <div className="text-left leading-tight pr-0.5">
            <div className="text-[10px] font-bold text-amber-300">Nordstern</div>
            <div className="text-[10px] font-mono text-slate-300 tabular-nums">
              {Math.round(project.northAngle ?? 0)}° Nord
            </div>
          </div>
        </button>
      </div>
    </div>
  );
};
