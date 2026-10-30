import React, { useRef, useState } from 'react';
import {
  Box,
  Building2,
  Columns,
  Copy,
  DoorOpen,
  FolderUp,
  Grid,
  Home,
  Lock,
  Redo2,
  RotateCw,
  Search,
  Sliders,
  Trash2,
  Trees,
  Undo2,
  Unlock,
} from 'lucide-react';
import { ASSET_CATALOG, SURFACE_MATERIALS } from '../data/catalogAndInitialState';
import { getEffectiveRoofDormers } from '../three/assetBuilder';
import {
  ActiveFloorView,
  AcousticWoodTone,
  AssetCategory,
  BUILDING_PRESETS,
  BuildingTechEntityConfig,
  CatalogItem,
  cleanDisplayLabel,
  computePolygonBounds,
  computeRoofHostFootprintZone,
  computeZoneAreaM2,
  CustomWallSegment,
  DormerWindowStyle,
  DormerWindowUnit,
  EditorViewMode,
  ExteriorStepsShapeType,
  fitStairAssetToRoomWalls,
  FloorLevelId,
  FloorplanProject,
  FloorplanZone,
  getAssetEffectiveFootprint,
  getAvailableBuildingOptions,
  getBuildingHierarchyGroups,
  getConnectedBuildingCluster,
  getEffectiveDormerWindows,
  HAEntityState,
  IndoorZoneRole,
  isAcousticPanelAsset,
  isBuildingTechAsset,
  isChimneyOrDormerAsset,
  isDormerOrSkylightAsset,
  isDrivewayGateAsset,
  isExteriorStairAsset,
  isFenceOrHedgeAsset,
  isInteriorRoomZone,
  isRadiatorAsset,
  isSofaAsset,
  isStairAsset,
  isStreetLampAsset,
  isStreetOrSidewalkAsset,
  isTreeAsset,
  isWalkwayAsset,
  isWallDecorAsset,
  isWallModuleAsset,
  OpeningFrameColor,
  PlacedAsset,
  RadiatorType,
  resolveOpeningSensorState,
  resolveZoneRole,
  RoofChimneyItem,
  RoofChimneyStyle,
  RoofDormerItem,
  RoofDormerType,
  RoofFootprintScope,
  RoofMaterialStyle,
  RoofSkylightItem,
  RoofSkylightStyle,
  RoofSpanMode,
  RoofType,
  snapAssetToNearestRoomWall,
  SofaShapeType,
  StairRailingSide,
  StairRailingStyle,
  StairRiserStyle,
  StairShapeType,
  StairTreadMaterial,
  SurfaceMaterialId,
  UnderStairClosureType,
  WallOpening,
  WallOpeningType,
  WallPlannerCategory,
  WallSegmentMode,
  WallSideConfig,
  WallSideId,
  WallSurfaceFinish,
} from '../types/floorplan';

interface EditorWorkspacePanelProps {
  project: FloorplanProject;
  entities: Record<string, HAEntityState>;
  activeFloor: ActiveFloorView;
  onChangeActiveFloor: (floor: ActiveFloorView) => void;
  editorViewMode: EditorViewMode;
  onChangeEditorViewMode: (mode: EditorViewMode) => void;
  selectedAssetId: string | null;
  selectedZoneId: string | null;
  selectedOpeningId: string | null;
  selectedWallId?: string | null;
  pendingCatalogItem: CatalogItem | null;
  onSelectCatalogItemToPlace: (item: CatalogItem | null) => void;
  onSelectAsset?: (assetId: string | null) => void;
  onSelectZone: (zoneId: string | null) => void;
  onSelectOpening: (openingId: string | null) => void;
  onSelectWall?: (wallId: string | null) => void;
  onUpdateAsset: (assetId: string, patch: Partial<PlacedAsset>) => void;
  onDeleteAsset: (assetId: string) => void;
  onDuplicateAsset: (assetId: string) => void;
  onImportCustomGlb: (file: File) => void;
  onAddZone: (
    zoneType: 'indoor' | 'outdoor' | 'outbuilding' | 'room',
    targetBuildingId?: string
  ) => void;
  onUpdateZone: (zoneId: string, patch: Partial<FloorplanZone>) => void;
  onDeleteZone: (zoneId: string) => void;
  onAddCustomWall?: () => void;
  onUpdateCustomWall?: (wallId: string, patch: Partial<CustomWallSegment>) => void;
  onDeleteCustomWall?: (wallId: string) => void;
  onAddOpening: (presetType: WallOpeningType) => void;
  onUpdateOpening: (openingId: string, patch: Partial<WallOpening>) => void;
  onDeleteOpening: (openingId: string) => void;
  onSetDualSensorTestState?: (
    openingId: string,
    targetState: 'closed' | 'tilted' | 'open'
  ) => void;
  onRotateBuilding?: (zoneId: string, deltaRad: number, wholeBuilding: boolean) => void;
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

const CATEGORY_TABS: {
  id:
    | AssetCategory
    | 'all'
    | 'highlights_new'
    | 'trees_only'
    | 'streets_lamps'
    | 'wall_decor'
    | 'stairs_only';
  label: string;
}[] = [
  { id: 'all', label: `Alle (${ASSET_CATALOG.length})` },
  {
    id: 'highlights_new',
    label: '✨ Neu: Lampen, Sonnensegel, Sitzgruppen & UV',
  },
  { id: 'lighting', label: '💡 Lichter & Parkleuchten (Innen/Außen)' },
  { id: 'outdoor_energy', label: '☀️ Sonnensegel, Sitzgruppen, PV & Garten' },
  { id: 'sensors_plugs', label: '⚡ Unterverteilungen, Steckdosen & Sensoren' },
  { id: 'streets_lamps', label: '🛣️ Straße, Gehweg, Laternen & Tore' },
  { id: 'stairs_only', label: '🪜 Innen- & Außentreppen (Alle Formen)' },
  { id: 'trees_only', label: '🌳 Bäume & Pflanzen (7)' },
  { id: 'fences_hedges', label: 'Maschendrahtzaun, Zäune & Hecken' },
  { id: 'wall_decor', label: '🖼️ Wand-TV, Bilder & Paneele' },
  { id: 'furniture', label: 'Küchen, Möbel & Bad' },
  { id: 'climate_appliance', label: 'Klima & Haushalt' },
  { id: 'media_camera', label: 'Kameras & TV' },
];

const FLOOR_OPTIONS: { level: FloorLevelId; short: string; label: string }[] = [
  { level: -1, short: 'KG', label: 'Keller (KG)' },
  { level: 0, short: 'EG', label: 'Erdgeschoss (EG)' },
  { level: 1, short: '1. OG', label: '1. Obergeschoss (OG)' },
  { level: 2, short: 'DG', label: 'Dachgeschoss (DG)' },
];

export const EditorWorkspacePanel: React.FC<EditorWorkspacePanelProps> = ({
  project,
  entities,
  activeFloor,
  onChangeActiveFloor,
  editorViewMode,
  onChangeEditorViewMode,
  selectedAssetId,
  selectedZoneId,
  selectedOpeningId,
  selectedWallId = null,
  pendingCatalogItem,
  onSelectCatalogItemToPlace,
  onSelectAsset,
  onSelectZone,
  onSelectOpening,
  onSelectWall,
  onUpdateAsset,
  onDeleteAsset,
  onDuplicateAsset,
  onImportCustomGlb,
  onAddZone,
  onUpdateZone,
  onDeleteZone,
  onAddCustomWall,
  onUpdateCustomWall,
  onDeleteCustomWall,
  onAddOpening,
  onUpdateOpening,
  onDeleteOpening,
  onSetDualSensorTestState,
  onRotateBuilding,
  onLoadDemoProject,
  onClearProject,
  onUndo,
  onRedo,
  canUndo = false,
  canRedo = false,
  onOpenWallPlanner,
}) => {
  const [editorMode, setEditorMode] = useState<'zones' | 'openings' | 'catalog'>('catalog');
  const [activeCategory, setActiveCategory] = useState<
    | AssetCategory
    | 'all'
    | 'highlights_new'
    | 'trees_only'
    | 'streets_lamps'
    | 'wall_decor'
    | 'stairs_only'
  >('all');
  const [activeWallSideTab, setActiveWallSideTab] = useState<WallSideId>('north');
  const [searchQuery, setSearchQuery] = useState('');
  const [isLeftDrawerOpen, setIsLeftDrawerOpen] = useState<boolean>(() =>
    typeof window !== 'undefined' ? window.innerWidth >= 1024 : true
  );
  const [isRightInspectorMinimized, setIsRightInspectorMinimized] = useState<boolean>(false);
  const glbInputRef = useRef<HTMLInputElement | null>(null);

  const selectedAsset = project.assets.find((a) => a.id === selectedAssetId) || null;
  const selectedZone = project.zones.find((z) => z.id === selectedZoneId) || null;
  const selectedOpening = project.openings.find((o) => o.id === selectedOpeningId) || null;
  const selectedCustomWall =
    (project.customWalls || []).find((w) => w.id === selectedWallId) || null;
  const hasSelection = Boolean(
    selectedAsset || selectedZone || selectedOpening || selectedCustomWall
  );

  const handleDeselectAll = () => {
    if (onSelectAsset) onSelectAsset(null);
    onSelectZone(null);
    onSelectOpening(null);
    onSelectWall?.(null);
  };

  const FEATURED_PRIORITY_IDS: Record<string, number> = {
    sun_shade_sail: 1,
    street_lamp_classic_3head: 2,
    wall_lantern_park_classic: 3,
    sub_distribution_board_1row: 4,
    sub_distribution_board_3row: 5,
    garage_lean_to_greenhouse: 6,
    outdoor_rattan_corner_lounge: 7,
    outdoor_dining_group_8p: 8,
    outdoor_bistro_set: 9,
    outdoor_beer_tent_set: 10,
    solar_panel_array: 11,
    garden_bollard_light: 12,
    street_lamp_classic: 13,
    street_lamp_modern_led: 14,
    electrical_meter_cabinet: 15,
    electric_roller_gate: 16,
    electric_sliding_driveway_gate: 17,
    double_swing_driveway_gate: 18,
  };

  const filteredCatalog = ASSET_CATALOG.filter((item) => {
    const matchesCat =
      activeCategory === 'all'
        ? true
        : activeCategory === 'highlights_new'
        ? Boolean(FEATURED_PRIORITY_IDS[item.id]) ||
          item.id.startsWith('outdoor_') ||
          item.id === 'glass_greenhouse'
        : activeCategory === 'stairs_only'
        ? isStairAsset(item.id) || isExteriorStairAsset(item.id)
        : activeCategory === 'trees_only'
        ? isTreeAsset(item.id)
        : activeCategory === 'streets_lamps'
        ? isStreetOrSidewalkAsset(item.id) ||
          isStreetLampAsset(item.id) ||
          isDrivewayGateAsset(item.id) ||
          item.id === 'garden_bollard_light' ||
          item.id === 'outdoor_bollard_corten_louvre' ||
          item.id === 'outdoor_path_mushroom_modern' ||
          item.id === 'outdoor_solar_stone_globe' ||
          item.id === 'outdoor_pergola_string_lights' ||
          item.id === 'outdoor_wall_lantern_classic' ||
          item.id === 'outdoor_ground_recessed_spot' ||
          item.id === 'outdoor_tree_garden_spike'
        : activeCategory === 'wall_decor'
        ? isWallDecorAsset(item.id)
        : item.category === activeCategory;
    const matchesSearch =
      !searchQuery.trim() ||
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.badgeText.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCat && matchesSearch;
  }).sort((a, b) => {
    const pA = FEATURED_PRIORITY_IDS[a.id] ?? 999;
    const pB = FEATURED_PRIORITY_IDS[b.id] ?? 999;
    if (pA !== pB) return pA - pB;
    return 0;
  });

  const entityIds = Object.keys(entities).sort();
  const coverEntityIds = entityIds.filter((id) => id.startsWith('cover.'));
  const binarySensorIds = entityIds.filter((id) => id.startsWith('binary_sensor.'));

  const filteredZones = project.zones.filter(
    (z) => activeFloor === 'all_stacked' || (z.level ?? 0) === activeFloor
  );
  const filteredOpenings = project.openings.filter(
    (o) => activeFloor === 'all_stacked' || (o.level ?? 0) === activeFloor
  );

  return (
    <>
      {/* Floating Compact Studio Bar when Left Drawer is collapsed (ideal for Smartphone, Tablet & Fullscreen Desktop) */}
      {!isLeftDrawerOpen && (
        <div className="fixed top-16 left-2.5 sm:left-4 z-20 flex flex-wrap items-center gap-1.5 max-w-[calc(100vw-1.25rem)] bg-[#0f172a]/95 border border-white/15 rounded-xl p-1.5 shadow-2xl">
          <button
            type="button"
            onClick={() => {
              setIsLeftDrawerOpen(true);
              if (typeof window !== 'undefined' && window.innerWidth < 1024) {
                setIsRightInspectorMinimized(true);
              }
            }}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-bold shadow-sm whitespace-nowrap"
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>Katalog & Räume</span>
          </button>

          {/* Compact 2D / Split / 3D Switcher */}
          <div className="flex items-center gap-0.5 bg-slate-950 p-0.5 rounded-lg border border-white/10">
            {(
              [
                ['2d', '2D'],
                ['split', 'Split'],
                ['3d', '3D'],
              ] as const
            ).map(([m, label]) => (
              <button
                key={m}
                type="button"
                onClick={() => onChangeEditorViewMode(m)}
                className={`px-2 py-1 rounded text-[11px] font-semibold transition-colors ${
                  editorViewMode === m
                    ? 'bg-sky-400 text-slate-950'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Compact Floor Switcher */}
          <div className="flex items-center gap-0.5 bg-slate-950 p-0.5 rounded-lg border border-white/10">
            {FLOOR_OPTIONS.map((fo) => (
              <button
                key={fo.level}
                type="button"
                onClick={() => onChangeActiveFloor(fo.level)}
                className={`px-2 py-1 rounded text-[11px] font-semibold transition-colors ${
                  activeFloor === fo.level
                    ? 'bg-amber-400 text-slate-950'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                {fo.short}
              </button>
            ))}
            <button
              type="button"
              onClick={() => onChangeActiveFloor('all_stacked')}
              className={`px-2 py-1 rounded text-[11px] font-semibold transition-colors ${
                activeFloor === 'all_stacked'
                  ? 'bg-amber-400 text-slate-950'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              Alle
            </button>
          </div>

          {/* Compact Undo / Redo Buttons */}
          {onUndo && (
            <div className="flex items-center gap-0.5 bg-slate-950 p-0.5 rounded-lg border border-white/10">
              <button
                type="button"
                disabled={!canUndo}
                onClick={onUndo}
                title="Rückgängig (Strg+Z)"
                className={`flex items-center gap-1 px-2 py-1 rounded text-[11px] font-semibold transition-colors ${
                  canUndo
                    ? 'text-amber-300 hover:bg-slate-800 hover:text-amber-200'
                    : 'text-slate-600 cursor-not-allowed'
                }`}
              >
                <Undo2 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Zurück</span>
              </button>
              {onRedo && (
                <button
                  type="button"
                  disabled={!canRedo}
                  onClick={onRedo}
                  title="Wiederholen (Strg+Y)"
                  className={`p-1 rounded text-[11px] font-semibold transition-colors ${
                    canRedo
                      ? 'text-sky-300 hover:bg-slate-800 hover:text-sky-200'
                      : 'text-slate-600 cursor-not-allowed'
                  }`}
                >
                  <Redo2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          )}

          {hasSelection && isRightInspectorMinimized && (
            <button
              type="button"
              onClick={() => setIsRightInspectorMinimized(false)}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-sky-500 hover:bg-sky-400 text-slate-950 text-xs font-bold whitespace-nowrap"
            >
              <span>Eigenschaften bearbeiten</span>
            </button>
          )}
        </div>
      )}

      {/* Left Studio Drawer: 2D/3D View Mode Switcher + Floor Selector + Zone Builder, Windows/Doors & Asset Catalog */}
      {isLeftDrawerOpen && (
        <aside className="fixed top-16 left-2.5 sm:left-4 bottom-16 sm:bottom-32 z-20 w-[calc(100vw-1.25rem)] sm:w-96 rounded-xl bg-[#0f172a] border border-white/15 shadow-2xl flex flex-col overflow-hidden">
          <div className="p-3 border-b border-white/10 space-y-2.5">
            {/* 2D CAD vs Split 2D/3D vs 3D View Switcher + Undo/Redo + Drawer Minimize Button */}
            <div>
              <div className="text-[11px] font-semibold text-amber-300 mb-1.5 flex items-center justify-between gap-1.5">
                <span>Planungs-Ansicht & Etagen</span>
                <div className="flex items-center gap-1">
                  {onUndo && (
                    <button
                      type="button"
                      disabled={!canUndo}
                      onClick={onUndo}
                      title="Rückgängig machen (Strg+Z)"
                      className={`flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold border transition-colors ${
                        canUndo
                          ? 'bg-slate-800 hover:bg-slate-700 text-amber-300 border-amber-400/35'
                          : 'bg-slate-900/60 text-slate-600 border-white/5 cursor-not-allowed'
                      }`}
                    >
                      <Undo2 className="w-3 h-3" />
                      <span>Strg+Z</span>
                    </button>
                  )}
                  {onRedo && (
                    <button
                      type="button"
                      disabled={!canRedo}
                      onClick={onRedo}
                      title="Wiederholen (Strg+Y)"
                      className={`px-1.5 py-0.5 rounded text-[10px] font-bold border transition-colors ${
                        canRedo
                          ? 'bg-slate-800 hover:bg-slate-700 text-sky-300 border-sky-400/35'
                          : 'bg-slate-900/60 text-slate-600 border-white/5 cursor-not-allowed'
                      }`}
                    >
                      <Redo2 className="w-3 h-3" />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setIsLeftDrawerOpen(false)}
                    className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-[10px] font-semibold text-slate-200 border border-white/10"
                    title="Katalog-Leiste minimieren für freie Sicht auf den Plan"
                  >
                    Minimieren ✕
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-1 p-1 bg-slate-950 rounded-lg border border-white/10">
                <button
                  type="button"
                  onClick={() => onChangeEditorViewMode('2d')}
                  className={`flex items-center justify-center gap-1 py-1.5 px-2 rounded-md text-xs font-semibold transition-colors whitespace-nowrap ${
                    editorViewMode === '2d'
                      ? 'bg-sky-400 text-slate-950'
                      : 'text-slate-300 hover:text-white'
                  }`}
                >
                  <Grid className="w-3.5 h-3.5" />
                  <span>2D-Planer</span>
                </button>
                <button
                  type="button"
                  onClick={() => onChangeEditorViewMode('split')}
                  className={`flex items-center justify-center gap-1 py-1.5 px-2 rounded-md text-xs font-semibold transition-colors whitespace-nowrap ${
                    editorViewMode === 'split'
                      ? 'bg-sky-400 text-slate-950'
                      : 'text-slate-300 hover:text-white'
                  }`}
                >
                  <Columns className="w-3.5 h-3.5" />
                  <span>2D + 3D Split</span>
                </button>
                <button
                  type="button"
                  onClick={() => onChangeEditorViewMode('3d')}
                  className={`flex items-center justify-center gap-1 py-1.5 px-2 rounded-md text-xs font-semibold transition-colors whitespace-nowrap ${
                    editorViewMode === '3d'
                      ? 'bg-sky-400 text-slate-950'
                      : 'text-slate-300 hover:text-white'
                  }`}
                >
                  <Box className="w-3.5 h-3.5" />
                  <span>Reines 3D</span>
                </button>
              </div>
            </div>

            {/* Quick Stockwerk Switcher inside Studio Drawer */}
            <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-white/10">
              <span className="text-[10px] font-bold text-slate-400 px-1.5 flex items-center gap-1">
                <Building2 className="w-3 h-3 text-amber-400" />
                Etage:
              </span>
              {FLOOR_OPTIONS.map((fo) => (
                <button
                  key={fo.level}
                  type="button"
                  onClick={() => onChangeActiveFloor(fo.level)}
                  className={`flex-1 py-1 rounded text-[11px] font-semibold transition-colors ${
                    activeFloor === fo.level
                      ? 'bg-amber-400 text-slate-950'
                      : 'text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  {fo.short}
                </button>
              ))}
              <button
                type="button"
                onClick={() => onChangeActiveFloor('all_stacked')}
                className={`px-2 py-1 rounded text-[11px] font-semibold transition-colors ${
                  activeFloor === 'all_stacked'
                    ? 'bg-amber-400 text-slate-950'
                    : 'text-slate-300 hover:bg-slate-800'
                }`}
                title="Alle Stockwerke gestapelt in 3D anzeigen"
              >
                Alle 3D
              </button>
            </div>

            {/* 3-Tab Mode Switcher: Räume & Außen | Fenster & Türen | Smart-Assets */}
            <div className="grid grid-cols-3 gap-1 p-1 bg-slate-900 rounded-lg">
            <button
              type="button"
              onClick={() => setEditorMode('zones')}
              className={`flex items-center justify-center gap-1 py-1.5 px-2 rounded-md text-[11px] font-medium transition-colors whitespace-nowrap ${
                editorMode === 'zones'
                  ? 'bg-amber-500 text-slate-950 font-semibold'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              <Trees className="w-3.5 h-3.5" />
              <span>Räume ({filteredZones.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setEditorMode('openings')}
              className={`flex items-center justify-center gap-1 py-1.5 px-2 rounded-md text-[11px] font-medium transition-colors whitespace-nowrap ${
                editorMode === 'openings'
                  ? 'bg-amber-500 text-slate-950 font-semibold'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              <DoorOpen className="w-3.5 h-3.5" />
              <span>Fenster & 2S</span>
            </button>
            <button
              type="button"
              onClick={() => setEditorMode('catalog')}
              className={`flex items-center justify-center gap-1 py-1.5 px-2 rounded-md text-[11px] font-medium transition-colors whitespace-nowrap ${
                editorMode === 'catalog'
                  ? 'bg-amber-500 text-slate-950 font-semibold'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              <Box className="w-3.5 h-3.5" />
              <span>Möbel ({ASSET_CATALOG.length})</span>
            </button>
          </div>

          {editorMode === 'catalog' && (
            <>
              {/* Search & Custom GLB Import */}
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Küche, Treppe, Schrank, Rauchmelder..."
                    className="w-full pl-8 pr-2.5 py-1.5 rounded-lg bg-slate-900 border border-white/10 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-amber-400"
                  />
                </div>
                <input
                  ref={glbInputRef}
                  type="file"
                  accept=".glb,.gltf"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) onImportCustomGlb(file);
                    e.target.value = '';
                  }}
                />
                <button
                  type="button"
                  onClick={() => glbInputRef.current?.click()}
                  title="Eigenes .glb / .gltf 3D-Modell importieren"
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-white/10 text-xs font-medium text-sky-300 whitespace-nowrap shrink-0"
                >
                  <FolderUp className="w-3.5 h-3.5" />
                  <span>GLB</span>
                </button>
              </div>

              {/* Category Filter Buttons */}
              <div className="flex flex-wrap gap-1">
                {CATEGORY_TABS.map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveCategory(tab.id)}
                    className={`px-2 py-1 rounded text-[11px] font-medium transition-colors whitespace-nowrap shrink-0 ${
                      activeCategory === tab.id
                        ? 'bg-sky-500 text-slate-950 font-semibold'
                        : 'bg-slate-900 text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Scrollable Content List */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {editorMode === 'catalog' ? (
            <>
              {filteredCatalog.map((item) => {
                const isArmed = pendingCatalogItem?.id === item.id;
                return (
                  <div
                    key={item.id}
                    className={`p-2.5 rounded-lg border transition-colors ${
                      isArmed
                        ? 'bg-amber-500/15 border-amber-400'
                        : 'bg-slate-900/90 border-white/8 hover:border-white/20'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="text-[11px] text-amber-300/90 font-medium">
                          {item.badgeText}
                          <span className="mx-1.5 text-slate-500">·</span>
                          <span className="text-slate-400">
                            {item.mountType === 'ceiling'
                              ? 'Deckenmontage'
                              : item.mountType === 'wall'
                              ? 'Wandmontage'
                              : 'Boden / Raum'}
                          </span>
                        </div>
                        <div className="text-xs font-semibold text-white mt-0.5">{item.name}</div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          const nextItem = isArmed ? null : item;
                          onSelectCatalogItemToPlace(nextItem);
                          if (nextItem && typeof window !== 'undefined' && window.innerWidth < 1024) {
                            setIsLeftDrawerOpen(false);
                          }
                        }}
                        className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                          isArmed
                            ? 'bg-amber-400 text-slate-950'
                            : 'bg-slate-800 text-slate-200 hover:bg-sky-500 hover:text-slate-950'
                        }`}
                      >
                        {isArmed ? 'Aktiv (Klick im Plan)' : '+ Platzieren'}
                      </button>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                      {item.description}
                    </p>
                  </div>
                );
              })}
            </>
          ) : editorMode === 'openings' ? (
            <div className="space-y-3">
              <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-400/30 text-[11px] text-amber-200 leading-relaxed">
                <strong>2-Sensor-Fensterlogik integriert:</strong> Wähle unten ein Fenster aus, um <strong>2 Tür-/Fenstersensoren</strong> zu verknüpfen (1 Sensor = <em>Gekippt 14°</em>, beide aktiv = <em>Geöffnet</em>).
              </div>

              {/* Add Window / Door / Patio Slider / Shutter Buttons */}
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    onAddOpening('window');
                    setIsRightInspectorMinimized(false);
                    if (typeof window !== 'undefined' && window.innerWidth < 1024) {
                      setIsLeftDrawerOpen(false);
                    }
                  }}
                  className="py-2 px-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-sky-500/30 text-xs font-semibold text-sky-300 text-left"
                >
                  + 2-Sensor-Fenster
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onAddOpening('floor_window');
                    setIsRightInspectorMinimized(false);
                    if (typeof window !== 'undefined' && window.innerWidth < 1024) {
                      setIsLeftDrawerOpen(false);
                    }
                  }}
                  className="py-2 px-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-sky-500/30 text-xs font-semibold text-sky-200 text-left"
                >
                  + Panoramafenster
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onAddOpening('double_patio_door');
                    setIsRightInspectorMinimized(false);
                    if (typeof window !== 'undefined' && window.innerWidth < 1024) {
                      setIsLeftDrawerOpen(false);
                    }
                  }}
                  className="py-2 px-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-amber-500/30 text-xs font-semibold text-amber-300 text-left"
                >
                  + Terrassen-Schiebetür
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onAddOpening('door');
                    setIsRightInspectorMinimized(false);
                    if (typeof window !== 'undefined' && window.innerWidth < 1024) {
                      setIsLeftDrawerOpen(false);
                    }
                  }}
                  className="py-2 px-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-amber-500/30 text-xs font-semibold text-white text-left"
                >
                  + Haustür / Innentür
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onAddOpening('glass_block_window');
                    setIsRightInspectorMinimized(false);
                    if (typeof window !== 'undefined' && window.innerWidth < 1024) {
                      setIsLeftDrawerOpen(false);
                    }
                  }}
                  className="col-span-2 py-2 px-2.5 rounded-lg bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-400/45 text-xs font-semibold text-cyan-200 text-left"
                >
                  + Glasbausteine / Glasbaustein-Wandfeld (Nebengebäude & Haus)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onAddOpening('garage_door');
                    setIsRightInspectorMinimized(false);
                    if (typeof window !== 'undefined' && window.innerWidth < 1024) {
                      setIsLeftDrawerOpen(false);
                    }
                  }}
                  className="col-span-2 py-2 px-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-emerald-500/40 text-xs font-semibold text-emerald-300 text-left"
                >
                  + Elektr. Sektional- / Rolltor (Garage & Nebengebäude)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const gateItem = ASSET_CATALOG.find(
                      (c) => c.id === 'electric_sliding_driveway_gate'
                    );
                    if (gateItem) {
                      onSelectCatalogItemToPlace(gateItem);
                      if (typeof window !== 'undefined' && window.innerWidth < 1024) {
                        setIsLeftDrawerOpen(false);
                      }
                    }
                  }}
                  className="col-span-2 py-2 px-2.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border border-amber-400/50 text-xs font-bold text-amber-200 text-left"
                >
                  + Elektr. Einfahrts-Schiebetor (Freistehend für Hofeinfahrt)
                </button>
              </div>

              {/* Existing Openings List */}
              <div className="space-y-1.5 pt-1">
                {filteredOpenings.map((op) => {
                  const isSel = op.id === selectedOpeningId;
                  const resolved = resolveOpeningSensorState(op, entities);
                  const isDual = op.sensorLogicMode === 'dual_tilt_open';
                  return (
                    <button
                      key={op.id}
                      type="button"
                      onClick={() => {
                        onSelectOpening(op.id);
                        setIsRightInspectorMinimized(false);
                        if (typeof window !== 'undefined' && window.innerWidth < 1024) {
                          setIsLeftDrawerOpen(false);
                        }
                      }}
                      className={`w-full text-left p-2.5 rounded-lg border transition-colors ${
                        isSel
                          ? 'bg-sky-500/15 border-sky-400'
                          : 'bg-slate-900/90 border-white/8 hover:border-white/20'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-semibold text-white truncate">
                          {op.name}
                        </span>
                        <span className="text-[10px] font-mono text-sky-300 tabular-nums shrink-0">
                          {op.level === 1 ? '1. OG' : op.level === -1 ? 'KG' : op.level === 2 ? 'DG' : 'EG'} · {op.width.toFixed(1)}m
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-400 mt-1 flex flex-wrap items-center gap-1.5">
                        <span className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 text-[10px] font-mono">
                          {op.width.toFixed(2)}×{op.height.toFixed(2)}m · Brüstung {op.sillHeight.toFixed(2)}m
                        </span>
                        <span className="px-1.5 py-0.5 rounded bg-slate-800 text-sky-300 text-[10px]">
                          {(op.hingeSide || 'left') === 'right' ? 'Anschlag R' : 'Anschlag L'} ·{' '}
                          {(op.openDirection || 'inward') === 'outward' ? 'Außen' : 'Innen'}
                        </span>
                        {isDual && (
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                              resolved === 'tilted'
                                ? 'bg-amber-500/25 text-amber-300 border border-amber-400/40'
                                : resolved === 'open'
                                ? 'bg-sky-500/25 text-sky-300 border border-sky-400/40'
                                : 'bg-emerald-500/20 text-emerald-300'
                            }`}
                          >
                            2S: {resolved === 'tilted' ? 'GEKIPPT' : resolved === 'open' ? 'OFFEN' : 'ZU'}
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {/* Project Quick-Start / Empty vs Demo Switcher */}
              <div className="p-2.5 rounded-lg bg-slate-900/95 border border-white/10 space-y-2">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="font-semibold text-amber-300">
                    Freies Erstellen & Live-Maße
                  </span>
                  <span className="font-mono text-[10px] text-slate-400">
                    {project.zones.length} Zonen gesamt
                  </span>
                </div>
                <p className="text-[11px] text-slate-300 leading-relaxed">
                  Nutze oben in der 2D-Leiste <strong>Rechteck-Raum</strong>, <strong>Freiform-Raum</strong> oder <strong>Freiform-Fläche</strong>, um direkt mit Live-Bemaßung (m, ° & m²) im Plan zu zeichnen.
                </p>
                <div className="grid grid-cols-2 gap-1.5 pt-0.5">
                  {onClearProject && (
                    <button
                      type="button"
                      onClick={onClearProject}
                      className="py-1.5 px-2 rounded-md bg-slate-800 hover:bg-red-500/20 border border-white/10 hover:border-red-400/40 text-[11px] font-semibold text-slate-200 hover:text-red-200 transition-colors"
                    >
                      Leere Ansicht (Neu)
                    </button>
                  )}
                  {onLoadDemoProject && (
                    <button
                      type="button"
                      onClick={onLoadDemoProject}
                      className="py-1.5 px-2 rounded-md bg-amber-500/15 hover:bg-amber-500/25 border border-amber-400/40 text-[11px] font-semibold text-amber-300 transition-colors"
                    >
                      Demo-Anwesen laden
                    </button>
                  )}
                </div>
              </div>

              {/* Add Wohnraum (Gebäude), Nebengebäude, Interior Room (Raum) or Outdoor Landscaping Zone */}
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    onAddZone('indoor', 'main_house');
                    setIsRightInspectorMinimized(false);
                    if (typeof window !== 'undefined' && window.innerWidth < 1024) {
                      setIsLeftDrawerOpen(false);
                    }
                  }}
                  className="flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-amber-400/40 text-xs font-semibold text-amber-200 whitespace-nowrap"
                  title="Erstellt einen Wohnraum als Hauptgebäude-Hülle mit Basisboden"
                >
                  <Home className="w-3.5 h-3.5 text-amber-400" />
                  <span>+ Wohnraum (Geb.)</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onAddZone('outbuilding');
                    setIsRightInspectorMinimized(false);
                    if (typeof window !== 'undefined' && window.innerWidth < 1024) {
                      setIsLeftDrawerOpen(false);
                    }
                  }}
                  className="flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-amber-500/35 text-xs font-semibold text-amber-300 whitespace-nowrap"
                  title="Erstellt ein separates Nebengebäude (Garage, Carport, Werkstatt)"
                >
                  <Building2 className="w-3.5 h-3.5 text-amber-400" />
                  <span>+ Nebengebäude</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const targetBldg =
                      selectedZone && selectedZone.zoneType === 'indoor'
                        ? selectedZone.buildingId || 'main_house'
                        : 'main_house';
                    onAddZone('room', targetBldg);
                    setIsRightInspectorMinimized(false);
                    if (typeof window !== 'undefined' && window.innerWidth < 1024) {
                      setIsLeftDrawerOpen(false);
                    }
                  }}
                  className="col-span-2 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg bg-sky-500/20 hover:bg-sky-500/30 border border-sky-400/50 text-xs font-bold text-sky-200 whitespace-nowrap"
                  title="Legt einen Innenraum innerhalb des ausgewählten Wohnraums oder Nebengebäudes an (Boden liegt grafisch über dem Gebäudeboden)"
                >
                  <DoorOpen className="w-3.5 h-3.5 text-sky-300" />
                  <span>+ Raum im Gebäude anlegen (Boden über Gebäude)</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onAddZone('outdoor');
                    setIsRightInspectorMinimized(false);
                    if (typeof window !== 'undefined' && window.innerWidth < 1024) {
                      setIsLeftDrawerOpen(false);
                    }
                  }}
                  className="col-span-2 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 border border-emerald-500/35 text-xs font-semibold text-emerald-300 whitespace-nowrap"
                >
                  <Trees className="w-3.5 h-3.5 text-emerald-400" />
                  <span>+ Große Garten-Area / Terrasse anlegen</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEditorMode('catalog');
                    setActiveCategory('trees_only');
                  }}
                  className="flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-400/50 text-xs font-bold text-emerald-200 whitespace-nowrap"
                >
                  <Trees className="w-3.5 h-3.5 text-emerald-300" />
                  <span>+ Bäume pflanzen (7)</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEditorMode('catalog');
                    setActiveCategory('fences_hedges');
                  }}
                  className="flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-400/40 text-xs font-semibold text-emerald-200 whitespace-nowrap"
                >
                  <Trees className="w-3.5 h-3.5 text-emerald-300" />
                  <span>+ Maschendraht & Zaun</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEditorMode('catalog');
                    setActiveCategory('streets_lamps');
                  }}
                  className="flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-sky-400/40 text-xs font-semibold text-sky-200 whitespace-nowrap"
                >
                  <span>+ Straße & Laternen</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const gateItem = ASSET_CATALOG.find(
                      (c) => c.id === 'electric_sliding_driveway_gate'
                    );
                    if (gateItem) {
                      onSelectCatalogItemToPlace(gateItem);
                      if (typeof window !== 'undefined' && window.innerWidth < 1024) {
                        setIsLeftDrawerOpen(false);
                      }
                    }
                  }}
                  className="col-span-2 flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-400/50 text-xs font-bold text-emerald-200 whitespace-nowrap"
                >
                  <span>🚪 + Elektrisches Einfahrts-Schiebetor platzieren</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEditorMode('catalog');
                    setActiveCategory('stairs_only');
                  }}
                  className="col-span-2 flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border border-amber-400/50 text-xs font-bold text-amber-200 whitespace-nowrap"
                >
                  <span>🪜 + Innen- & Außentreppen (14 Innen / 8 Außen-Formen)</span>
                </button>
                {onAddCustomWall && (
                  <button
                    type="button"
                    onClick={() => {
                      onAddCustomWall();
                      setIsRightInspectorMinimized(false);
                      if (typeof window !== 'undefined' && window.innerWidth < 1024) {
                        setIsLeftDrawerOpen(false);
                      }
                    }}
                    className="col-span-2 flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-lg bg-fuchsia-500/15 hover:bg-fuchsia-500/25 border border-fuchsia-400/40 text-xs font-bold text-fuchsia-200 whitespace-nowrap"
                  >
                    <span>+ Freie Trennwand</span>
                  </button>
                )}
              </div>

              {/* Custom Walls List on Active Floor */}
              {(project.customWalls || []).filter(
                (cw) => activeFloor === 'all_stacked' || (cw.level ?? 0) === activeFloor
              ).length > 0 && (
                <div className="space-y-1 pt-1">
                  <div className="text-[10px] font-bold text-fuchsia-300 uppercase tracking-wider px-1">
                    Freie Trennwände & Akzentwände
                  </div>
                  {(project.customWalls || [])
                    .filter(
                      (cw) => activeFloor === 'all_stacked' || (cw.level ?? 0) === activeFloor
                    )
                    .map((cw) => {
                      const isSelWall = cw.id === selectedWallId;
                      const lenM = Math.hypot(cw.x2 - cw.x1, cw.z2 - cw.z1);
                      return (
                        <button
                          key={cw.id}
                          type="button"
                          onClick={() => {
                            onSelectWall?.(cw.id);
                            setIsRightInspectorMinimized(false);
                            if (typeof window !== 'undefined' && window.innerWidth < 1024) {
                              setIsLeftDrawerOpen(false);
                            }
                          }}
                          className={`w-full text-left p-2 rounded-lg border transition-colors ${
                            isSelWall
                              ? 'bg-fuchsia-500/15 border-fuchsia-400'
                              : 'bg-slate-900/90 border-white/8 hover:border-white/20'
                          }`}
                        >
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-semibold text-white truncate">{cw.name}</span>
                            <span className="font-mono text-[11px] text-fuchsia-300">
                              {lenM.toFixed(2)} m · {cw.finish}
                            </span>
                          </div>
                        </button>
                      );
                    })}
                </div>
              )}

              {/* Zone List grouped hierarchically under Parent Building (Gebäude-Hierarchie) */}
              {filteredZones.length === 0 ? (
                <div className="p-4 rounded-xl bg-slate-900/60 border border-dashed border-white/15 text-center space-y-1.5">
                  <div className="text-xs font-semibold text-slate-200">
                    Noch keine Räume oder Flächen auf dieser Etage
                  </div>
                  <div className="text-[11px] text-slate-400 leading-relaxed">
                    Wähle oben im 2D-Planer ein Zeichen-Werkzeug (Rechteck oder Freiform-Polygon) oder klicke auf „+ Wohnraum“.
                  </div>
                </div>
              ) : (
                (() => {
                  const bldgGroups = getBuildingHierarchyGroups(project.zones);
                  const outdoorFiltered = filteredZones.filter((z) => z.zoneType === 'outdoor');

                  const renderZoneRow = (zone: FloorplanZone, isHullZone: boolean) => {
                    const isSelected = zone.id === selectedZoneId;
                    const matMeta = SURFACE_MATERIALS.find((m) => m.id === zone.surfaceMaterial);
                    const areaM2 = computeZoneAreaM2(zone);
                    const isPoly = Boolean(zone.points && zone.points.length >= 3);
                    const role = resolveZoneRole(zone, project.zones);
                    return (
                      <button
                        key={zone.id}
                        type="button"
                        onClick={() => {
                          onSelectZone(zone.id);
                          setIsRightInspectorMinimized(false);
                          if (typeof window !== 'undefined' && window.innerWidth < 1024) {
                            setIsLeftDrawerOpen(false);
                          }
                        }}
                        className={`w-full text-left p-2.5 rounded-lg border transition-colors ${
                          isSelected
                            ? 'bg-sky-500/15 border-sky-400'
                            : isHullZone
                            ? 'bg-amber-500/10 border-amber-400/30 hover:border-amber-400/50'
                            : 'bg-slate-900/90 border-white/8 hover:border-white/20 ml-1.5'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-semibold text-white truncate flex items-center gap-1.5">
                            {zone.locked && <Lock className="w-3 h-3 text-amber-400 shrink-0" />}
                            {isHullZone ? (
                              <span className="px-1.5 py-0.5 rounded bg-amber-400/20 border border-amber-400/40 text-[9px] font-bold text-amber-300 uppercase shrink-0">
                                {role === 'outbuilding' ? 'Nebengebäude' : 'Wohnraum-Basis'}
                              </span>
                            ) : (
                              <span className="px-1.5 py-0.5 rounded bg-sky-500/20 border border-sky-400/30 text-[9px] font-bold text-sky-300 shrink-0">
                                ↳ Raum
                              </span>
                            )}
                            <span className="truncate">{zone.name}</span>
                          </span>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <span className="text-[11px] font-mono text-amber-300 tabular-nums">
                              {areaM2.toFixed(1)} m² · {zone.width.toFixed(1)}×{zone.depth.toFixed(1)}m
                            </span>
                            <span
                              role="button"
                              tabIndex={0}
                              title={
                                zone.locked
                                  ? 'Gesperrt — Klicken zum Entsperren'
                                  : 'Fläche fixieren / sperren (gegen versehentliches Verschieben)'
                              }
                              onClick={(e) => {
                                e.stopPropagation();
                                onUpdateZone(zone.id, { locked: !zone.locked });
                              }}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                  e.stopPropagation();
                                  onUpdateZone(zone.id, { locked: !zone.locked });
                                }
                              }}
                              className={`p-1 rounded border transition-colors ${
                                zone.locked
                                  ? 'bg-amber-400/20 border-amber-400/50 text-amber-300'
                                  : 'bg-slate-800 border-white/10 text-slate-400 hover:text-white'
                              }`}
                            >
                              {zone.locked ? (
                                <Lock className="w-3 h-3" />
                              ) : (
                                <Unlock className="w-3 h-3" />
                              )}
                            </span>
                          </div>
                        </div>
                        <div className="text-[11px] text-slate-400 mt-1 flex items-center gap-1.5">
                          <span
                            className="w-2.5 h-2.5 rounded-sm inline-block border border-white/20"
                            style={{ backgroundColor: matMeta?.previewHex || '#ccc' }}
                          />
                          <span>
                            {zone.level === -1
                              ? 'KG'
                              : zone.level === 1
                              ? '1. OG'
                              : zone.level === 2
                              ? 'DG'
                              : 'EG'}
                          </span>
                          <span>·</span>
                          <span className="truncate">{matMeta?.name}</span>
                          {!isHullZone && (
                            <span className="text-[9.5px] text-sky-300/90 font-medium">
                              · Boden über Gebäude
                            </span>
                          )}
                          {isPoly && (
                            <span className="ml-auto px-1.5 py-0.2 rounded bg-sky-500/20 text-sky-300 text-[9.5px] font-mono">
                              Polygon ({zone.points!.length} Pkt)
                            </span>
                          )}
                        </div>
                      </button>
                    );
                  };

                  return (
                    <div className="space-y-3">
                      {bldgGroups.map((grp) => {
                        const visibleInGroup = grp.zones.filter((gz) =>
                          filteredZones.some((fz) => fz.id === gz.id)
                        );
                        if (visibleInGroup.length === 0) return null;
                        const visibleHull =
                          grp.hullZone && visibleInGroup.some((z) => z.id === grp.hullZone!.id)
                            ? grp.hullZone
                            : null;
                        const visibleChildren = visibleInGroup.filter(
                          (z) => !visibleHull || z.id !== visibleHull.id
                        );
                        const isOutbuilding = grp.category === 'outbuilding';

                        return (
                          <div
                            key={grp.buildingKey}
                            className={`rounded-xl border p-2 space-y-1.5 ${
                              isOutbuilding
                                ? 'border-amber-500/30 bg-slate-950/80'
                                : 'border-sky-400/30 bg-slate-950/80'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-1.5 px-1 py-0.5">
                              <div className="flex items-center gap-1.5 min-w-0">
                                {isOutbuilding ? (
                                  <Building2 className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                                ) : (
                                  <Home className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                                )}
                                <div className="min-w-0">
                                  <div className="text-[11px] font-bold text-white truncate">
                                    {grp.label}
                                  </div>
                                  <div className="text-[9.5px] text-slate-400">
                                    {isOutbuilding ? 'Nebengebäude' : 'Wohnraum (Hauptgebäude)'} ·{' '}
                                    {visibleChildren.length}{' '}
                                    {visibleChildren.length === 1 ? 'Raum' : 'Räume'}
                                  </div>
                                </div>
                              </div>
                              <button
                                type="button"
                                onClick={() => {
                                  onAddZone('room', grp.buildingId);
                                  setIsRightInspectorMinimized(false);
                                }}
                                className="px-2 py-1 rounded-lg bg-sky-500/20 hover:bg-sky-500/30 border border-sky-400/40 text-[10px] font-bold text-sky-200 shrink-0"
                                title={`Neuen Raum innerhalb von "${grp.label}" anlegen`}
                              >
                                + Raum
                              </button>
                            </div>
                            <div className="space-y-1.5 pl-1 border-l-2 border-amber-400/25">
                              {visibleHull && renderZoneRow(visibleHull, true)}
                              {visibleChildren.map((cz) => renderZoneRow(cz, false))}
                            </div>
                          </div>
                        );
                      })}

                      {outdoorFiltered.length > 0 && (
                        <div className="rounded-xl border border-emerald-400/25 bg-slate-950/75 p-2 space-y-1.5">
                          <div className="flex items-center justify-between px-1 py-0.5">
                            <div className="flex items-center gap-1.5">
                              <Trees className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                              <span className="text-[11px] font-bold text-emerald-300">
                                Außenanlagen & Grundstück
                              </span>
                            </div>
                            <span className="text-[10px] font-mono text-slate-400">
                              {outdoorFiltered.length} Flächen
                            </span>
                          </div>
                          <div className="space-y-1.5 pl-1.5 border-l-2 border-emerald-400/25">
                            {outdoorFiltered.map(renderZoneRow)}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })()
              )}
            </div>
          )}
        </div>
        </aside>
      )}

      {/* Right Studio Inspector: Edit Selected 3D Asset, Window/Door Opening (with 2-Sensor Rule Editor), Custom Wall, or Zone */}
      {(selectedAsset || selectedOpening || selectedZone || selectedCustomWall) &&
        !isRightInspectorMinimized && (
        <aside className="fixed inset-x-2.5 bottom-16 top-auto max-h-[62dvh] sm:inset-x-auto sm:top-16 sm:bottom-auto sm:right-4 z-20 sm:w-92 sm:max-h-[calc(100dvh-180px)] overflow-y-auto rounded-xl bg-[#0f172a] border border-white/15 shadow-2xl p-3.5 sm:p-4 space-y-4">
          {/* Mobile / Tablet / Desktop Sticky Inspector Bar for minimizing or deselecting */}
          <div className="flex items-center justify-between gap-2 pb-2 border-b border-white/10">
            <span className="text-[11px] font-bold text-sky-300 truncate">
              {selectedAsset
                ? `Objekt: ${selectedAsset.name}`
                : selectedOpening
                ? `Öffnung: ${selectedOpening.name}`
                : selectedCustomWall
                ? `Freie Wand: ${selectedCustomWall.name}`
                : `Zone: ${selectedZone?.name}`}
            </span>
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={() => setIsRightInspectorMinimized(true)}
                className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-[10px] font-semibold text-slate-200 border border-white/10"
                title="Inspektor einklappen für freie Sicht auf den Plan"
              >
                Minimieren
              </button>
              <button
                type="button"
                onClick={handleDeselectAll}
                className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-[10px] font-semibold text-slate-300 hover:text-white border border-white/10"
                title="Auswahl aufheben"
              >
                ✕
              </button>
            </div>
          </div>

          {selectedAsset ? (
            <>
              <div className="flex items-start justify-between gap-2 pb-2.5 border-b border-white/10">
                <div className="flex-1">
                  <div className="text-[11px] text-amber-400 font-medium">
                    Objekt & Home Assistant Entität
                  </div>
                  <input
                    type="text"
                    value={selectedAsset.name}
                    onChange={(e) =>
                      onUpdateAsset(selectedAsset.id, { name: e.target.value })
                    }
                    className="mt-1 w-full bg-slate-900 border border-white/10 rounded px-2 py-1 text-xs font-semibold text-white"
                  />
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    title={
                      selectedAsset.locked
                        ? 'Objekt entsperren'
                        : 'Objekt sperren (gegen versehentliches Verschieben)'
                    }
                    onClick={() =>
                      onUpdateAsset(selectedAsset.id, { locked: !selectedAsset.locked })
                    }
                    className={`p-1.5 rounded-lg border transition-colors ${
                      selectedAsset.locked
                        ? 'bg-amber-400 text-slate-950 border-amber-300 font-bold'
                        : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-white/10'
                    }`}
                  >
                    {selectedAsset.locked ? (
                      <Lock className="w-3.5 h-3.5" />
                    ) : (
                      <Unlock className="w-3.5 h-3.5" />
                    )}
                  </button>
                  <button
                    type="button"
                    title="Duplizieren"
                    onClick={() => onDuplicateAsset(selectedAsset.id)}
                    className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    title="Löschen"
                    disabled={Boolean(selectedAsset.locked)}
                    onClick={() => onDeleteAsset(selectedAsset.id)}
                    className={`p-1.5 rounded-lg ${
                      selectedAsset.locked
                        ? 'bg-slate-900 text-slate-600 cursor-not-allowed'
                        : 'bg-red-500/20 hover:bg-red-500/30 text-red-300'
                    }`}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Floor Level Selection */}
              <div>
                <label className="block text-xs text-slate-300 mb-1">
                  Stockwerk / Etage
                </label>
                <div className="grid grid-cols-4 gap-1">
                  {FLOOR_OPTIONS.map((fo) => (
                    <button
                      key={fo.level}
                      type="button"
                      onClick={() =>
                        onUpdateAsset(selectedAsset.id, { level: fo.level })
                      }
                      className={`py-1 rounded text-xs font-semibold ${
                        (selectedAsset.level ?? 0) === fo.level
                          ? 'bg-amber-400 text-slate-950'
                          : 'bg-slate-900 text-slate-300 hover:bg-slate-800'
                      }`}
                    >
                      {fo.short}
                    </button>
                  ))}
                </div>
              </div>

              {/* Home Assistant Entity Binding */}
              <div>
                <label className="block text-xs text-slate-300 mb-1">
                  Verknüpfte Home Assistant Entität (entity_id)
                </label>
                <select
                  value={selectedAsset.entityId || ''}
                  onChange={(e) =>
                    onUpdateAsset(selectedAsset.id, {
                      entityId: e.target.value || undefined,
                    })
                  }
                  className="w-full bg-slate-900 border border-white/15 rounded-lg px-2.5 py-1.5 text-xs font-mono text-sky-300"
                >
                  <option value="">
                    — Keine Entität (Statisch / Pollerleuchten: Nacht-Automatik) —
                  </option>
                  {entityIds.map((id) => (
                    <option key={id} value={id}>
                      {id} ({entities[id]?.attributes.friendly_name})
                    </option>
                  ))}
                </select>
                {(selectedAsset.catalogId === 'garden_bollard_light' ||
                  selectedAsset.catalogId === 'outdoor_bollard_corten_louvre' ||
                  selectedAsset.catalogId === 'outdoor_path_mushroom_modern' ||
                  selectedAsset.catalogId === 'outdoor_solar_stone_globe') && (
                  <div className="mt-1.5 flex items-center justify-between gap-2 px-2 py-1 rounded bg-slate-900/90 border border-amber-400/25 text-[10px]">
                    <span className="text-amber-200">
                      {selectedAsset.entityId
                        ? 'Steuerung strikt über verknüpfte HA-Entität'
                        : 'Ohne Entität: Schaltet bei Nacht automatisch ein'}
                    </span>
                    {selectedAsset.entityId && (
                      <button
                        type="button"
                        onClick={() =>
                          onUpdateAsset(selectedAsset.id, { entityId: undefined })
                        }
                        className="px-1.5 py-0.5 rounded bg-amber-400 text-slate-950 font-bold shrink-0"
                      >
                        Auf Nacht-Automatik (Ohne Entität)
                      </button>
                    )}
                  </div>
                )}

                {/* Live 3D Verhalten: Sensor / Aktor / Beides & 3D-Status-Icon */}
                <div className="mt-2 pt-2 border-t border-white/10 space-y-2">
                  <div className="grid grid-cols-2 gap-1.5">
                    <div>
                      <label className="block text-[10px] text-slate-300 font-semibold mb-0.5">
                        Rolle in Live 3D (Sensor / Aktor)
                      </label>
                      <select
                        value={selectedAsset.controlMode || 'auto'}
                        onChange={(e) =>
                          onUpdateAsset(selectedAsset.id, {
                            controlMode: e.target.value as
                              | 'auto'
                              | 'sensor_only'
                              | 'actuator'
                              | 'sensor_and_actuator',
                          })
                        }
                        className="w-full bg-slate-900 border border-white/15 rounded-lg px-2 py-1 text-[10.5px] text-white"
                      >
                        <option value="auto">Automatisch (nach Domäne)</option>
                        <option value="sensor_only">Nur Sensor (Nur Status-Anzeige)</option>
                        <option value="actuator">Aktor (Per Klick steuerbar)</option>
                        <option value="sensor_and_actuator">
                          Sensor + Aktor (Anzeige & Schalten)
                        </option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[10px] text-amber-300 font-semibold mb-0.5">
                        3D-Status-Icon in Live 3D
                      </label>
                      <select
                        value={selectedAsset.statusBadgeMode || 'auto'}
                        onChange={(e) =>
                          onUpdateAsset(selectedAsset.id, {
                            statusBadgeMode: e.target.value as
                              | 'auto'
                              | 'always'
                              | 'when_active'
                              | 'hidden',
                          })
                        }
                        className="w-full bg-slate-900 border border-amber-400/35 rounded-lg px-2 py-1 text-[10.5px] text-amber-200 font-semibold"
                      >
                        <option value="auto">Automatisch</option>
                        <option value="when_active">Nur wenn Offen / Aktiv</option>
                        <option value="always">Immer über Objekt anzeigen</option>
                        <option value="hidden">Kein 3D-Icon anzeigen</option>
                      </select>
                    </div>
                  </div>

                  {(selectedAsset.controlMode === 'actuator' ||
                    selectedAsset.controlMode === 'sensor_and_actuator') && (
                    <div>
                      <label className="block text-[10px] text-slate-400 mb-0.5">
                        Optionaler separater Schalt-Aktor (falls Haupt-Entität ein Sensor ist)
                      </label>
                      <select
                        value={selectedAsset.actuatorEntityId || ''}
                        onChange={(e) =>
                          onUpdateAsset(selectedAsset.id, {
                            actuatorEntityId: e.target.value || undefined,
                          })
                        }
                        className="w-full bg-slate-900 border border-white/15 rounded-lg px-2 py-1 text-[10.5px] font-mono text-amber-300"
                      >
                        <option value="">— Haupt-Entität direkt schalten —</option>
                        {entityIds
                          .filter(
                            (id) =>
                              id.startsWith('cover.') ||
                              id.startsWith('switch.') ||
                              id.startsWith('light.') ||
                              id.startsWith('button.') ||
                              id.startsWith('lock.') ||
                              id.startsWith('input_boolean.')
                          )
                          .map((id) => (
                            <option key={id} value={id}>
                              {id} ({entities[id]?.attributes.friendly_name || entities[id]?.state})
                            </option>
                          ))}
                      </select>
                    </div>
                  )}
                </div>
              </div>

              {/* Coordinates X / Y / Z & Mount Height Presets */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span>Position im Grundriss (Meter)</span>
                  <span className="font-mono text-slate-200 tabular-nums">
                    X:{selectedAsset.position[0].toFixed(2)} · Y:{selectedAsset.position[1].toFixed(2)} · Z:{selectedAsset.position[2].toFixed(2)}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  {(['X (Ost/West)', 'Y (Höhe)', 'Z (Nord/Süd)'] as const).map((label, idx) => (
                    <div key={label}>
                      <div className="text-[10px] text-slate-400 mb-0.5">{label}</div>
                      <input
                        type="number"
                        step={0.1}
                        value={selectedAsset.position[idx]}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value) || 0;
                          const nextPos: [number, number, number] = [
                            ...selectedAsset.position,
                          ] as [number, number, number];
                          nextPos[idx] = val;
                          onUpdateAsset(selectedAsset.id, { position: nextPos });
                        }}
                        className="w-full bg-slate-900 border border-white/10 rounded px-2 py-1 text-xs font-mono text-white tabular-nums"
                      />
                    </div>
                  ))}
                </div>

                {/* Smart Mounting Height Presets */}
                <div>
                  <div className="text-[11px] text-slate-400 mb-1">
                    Schnellwahl Montagehöhe (Y-Achse)
                  </div>
                  <div className="grid grid-cols-4 gap-1">
                    {[
                      { label: 'Boden 0m', y: 0.0 },
                      { label: 'Steckd. 0.35m', y: 0.35 },
                      { label: 'Taster 1.15m', y: 1.15 },
                      { label: 'Decke 2.54m', y: 2.54 },
                    ].map((preset) => (
                      <button
                        key={preset.label}
                        type="button"
                        onClick={() =>
                          onUpdateAsset(selectedAsset.id, {
                            position: [
                              selectedAsset.position[0],
                              preset.y,
                              selectedAsset.position[2],
                            ],
                          })
                        }
                        className="px-1.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-[10px] font-mono text-slate-200 whitespace-nowrap"
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Custom Length & Height/Width Controls for Hedges, Fences, Walls, Gates & Walkways */}
              {isFenceOrHedgeAsset(selectedAsset.catalogId) && (
                <div className="p-3 rounded-xl bg-slate-950 border border-emerald-400/35 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-emerald-300">
                      {isWalkwayAsset(selectedAsset.catalogId)
                        ? 'Weg-Länge & Breite frei einstellen'
                        : 'Hecken- / Zaun-Länge & Höhe einstellen'}
                    </span>
                    <span className="text-[10px] font-mono text-slate-400">
                      2D-Endpunkte ziehbar
                    </span>
                  </div>

                  {/* Length (m) */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-slate-300">Länge (m)</span>
                      <input
                        type="number"
                        step={0.1}
                        min={0.4}
                        max={30.0}
                        value={
                          selectedAsset.customLength ??
                          ASSET_CATALOG.find((c) => c.id === selectedAsset.catalogId)?.width ??
                          3.0
                        }
                        onChange={(e) =>
                          onUpdateAsset(selectedAsset.id, {
                            customLength: Math.max(0.4, parseFloat(e.target.value) || 2.0),
                          })
                        }
                        className="w-20 bg-slate-900 border border-white/15 rounded px-2 py-0.5 text-xs font-mono text-right text-emerald-300 tabular-nums"
                      />
                    </div>
                    <input
                      type="range"
                      min={0.5}
                      max={18.0}
                      step={0.1}
                      value={Math.min(
                        18.0,
                        selectedAsset.customLength ??
                          ASSET_CATALOG.find((c) => c.id === selectedAsset.catalogId)?.width ??
                          3.0
                      )}
                      onChange={(e) =>
                        onUpdateAsset(selectedAsset.id, {
                          customLength: parseFloat(e.target.value),
                        })
                      }
                      className="w-full accent-emerald-400"
                    />
                    <div className="flex flex-wrap gap-1">
                      {[1.5, 3.0, 5.0, 8.0, 12.0].map((lenPreset) => (
                        <button
                          key={lenPreset}
                          type="button"
                          onClick={() =>
                            onUpdateAsset(selectedAsset.id, { customLength: lenPreset })
                          }
                          className="px-1.5 py-0.5 rounded bg-slate-900 hover:bg-slate-800 border border-white/10 text-[10px] font-mono text-slate-300"
                        >
                          {lenPreset.toFixed(1)}m
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Height (for Hedges/Fences) or Width (for Walkways) */}
                  <div className="space-y-1 pt-1 border-t border-white/10">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-slate-300">
                        {isWalkwayAsset(selectedAsset.catalogId)
                          ? 'Wegbreite (m)'
                          : 'Höhe (m)'}
                      </span>
                      <input
                        type="number"
                        step={0.05}
                        min={0.3}
                        max={4.0}
                        value={
                          selectedAsset.customHeight ??
                          (isWalkwayAsset(selectedAsset.catalogId)
                            ? ASSET_CATALOG.find((c) => c.id === selectedAsset.catalogId)?.depth ??
                              1.2
                            : ASSET_CATALOG.find((c) => c.id === selectedAsset.catalogId)?.height ??
                              1.8)
                        }
                        onChange={(e) =>
                          onUpdateAsset(selectedAsset.id, {
                            customHeight: Math.max(0.3, parseFloat(e.target.value) || 1.2),
                          })
                        }
                        className="w-20 bg-slate-900 border border-white/15 rounded px-2 py-0.5 text-xs font-mono text-right text-amber-300 tabular-nums"
                      />
                    </div>
                    <input
                      type="range"
                      min={0.4}
                      max={3.0}
                      step={0.05}
                      value={Math.min(
                        3.0,
                        selectedAsset.customHeight ??
                          (isWalkwayAsset(selectedAsset.catalogId)
                            ? ASSET_CATALOG.find((c) => c.id === selectedAsset.catalogId)?.depth ??
                              1.2
                            : ASSET_CATALOG.find((c) => c.id === selectedAsset.catalogId)?.height ??
                              1.8)
                      )}
                      onChange={(e) =>
                        onUpdateAsset(selectedAsset.id, {
                          customHeight: parseFloat(e.target.value),
                        })
                      }
                      className="w-full accent-amber-400"
                    />
                  </div>
                </div>
              )}

              {/* Custom Height & Width Controls for Stainless Steel Chimneys, Brick Roof Chimneys & Standalone Roof Dormers */}
              {isChimneyOrDormerAsset(selectedAsset.catalogId) && (
                <div className="p-3 rounded-xl bg-slate-950 border border-amber-400/35 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-amber-300">
                      {selectedAsset.catalogId === 'stainless_steel_chimney'
                        ? 'Edelstahl-Außenkamin Höhe einstellen'
                        : selectedAsset.catalogId === 'chimney_brick_roof'
                        ? 'Gebäude-Schornstein / Dachkamin Maße'
                        : selectedAsset.catalogId === 'wood_stove_scandinavian'
                        ? 'Kaminofen / Schwedenofen Maße'
                        : 'Dachgaube / Dachfenster Maße & Fenster'}
                    </span>
                    <span className="text-[10px] font-mono text-slate-400">3D-Architektur</span>
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-slate-300">
                        {selectedAsset.catalogId === 'stainless_steel_chimney' ||
                        selectedAsset.catalogId === 'chimney_brick_roof'
                          ? 'Schornsteinhöhe (m)'
                          : 'Höhe / Tiefe (m)'}
                      </span>
                      <input
                        type="number"
                        step={0.1}
                        min={0.6}
                        max={9.5}
                        value={
                          selectedAsset.customHeight ??
                          ASSET_CATALOG.find((c) => c.id === selectedAsset.catalogId)?.height ??
                          2.2
                        }
                        onChange={(e) =>
                          onUpdateAsset(selectedAsset.id, {
                            customHeight: Math.max(0.6, parseFloat(e.target.value) || 2.0),
                          })
                        }
                        className="w-20 bg-slate-900 border border-white/15 rounded px-2 py-0.5 text-xs font-mono text-right text-amber-300 tabular-nums"
                      />
                    </div>
                    <input
                      type="range"
                      min={selectedAsset.catalogId === 'stainless_steel_chimney' ? 2.5 : 0.8}
                      max={selectedAsset.catalogId === 'stainless_steel_chimney' ? 8.5 : 3.2}
                      step={0.1}
                      value={
                        selectedAsset.customHeight ??
                        ASSET_CATALOG.find((c) => c.id === selectedAsset.catalogId)?.height ??
                        2.2
                      }
                      onChange={(e) =>
                        onUpdateAsset(selectedAsset.id, {
                          customHeight: parseFloat(e.target.value),
                        })
                      }
                      className="w-full accent-amber-400"
                    />
                  </div>

                  {(selectedAsset.catalogId.startsWith('roof_') ||
                    selectedAsset.catalogId === 'chimney_brick_roof') && (
                    <div className="space-y-1 pt-1 border-t border-white/10">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-slate-300">
                          {selectedAsset.catalogId === 'chimney_brick_roof'
                            ? 'Schornstein-Breite (m)'
                            : 'Breite (m)'}
                        </span>
                        <input
                          type="number"
                          step={0.05}
                          min={0.45}
                          max={4.5}
                          value={
                            selectedAsset.customLength ??
                            ASSET_CATALOG.find((c) => c.id === selectedAsset.catalogId)?.width ??
                            1.6
                          }
                          onChange={(e) =>
                            onUpdateAsset(selectedAsset.id, {
                              customLength: Math.max(0.45, parseFloat(e.target.value) || 1.4),
                            })
                          }
                          className="w-20 bg-slate-900 border border-white/15 rounded px-2 py-0.5 text-xs font-mono text-right text-sky-300 tabular-nums"
                        />
                      </div>
                      <input
                        type="range"
                        min={selectedAsset.catalogId === 'chimney_brick_roof' ? 0.45 : 0.8}
                        max={selectedAsset.catalogId === 'chimney_brick_roof' ? 1.4 : 3.8}
                        step={0.05}
                        value={
                          selectedAsset.customLength ??
                          ASSET_CATALOG.find((c) => c.id === selectedAsset.catalogId)?.width ??
                          1.6
                        }
                        onChange={(e) =>
                          onUpdateAsset(selectedAsset.id, {
                            customLength: parseFloat(e.target.value),
                          })
                        }
                        className="w-full accent-sky-400"
                      />
                    </div>
                  )}

                  {/* Individual Window Configuration inside Standalone Dormers & Skylights */}
                  {isDormerOrSkylightAsset(selectedAsset.catalogId) && (
                    <div className="pt-2 border-t border-white/10 space-y-2">
                      <div className="text-[11px] font-bold text-sky-300">
                        Fenster in der Gaube / im Dachfenster einzeln bearbeiten
                      </div>

                      <div className="grid grid-cols-2 gap-1.5">
                        <div>
                          <label className="block text-[10px] text-slate-400 mb-0.5">
                            Flügelanzahl
                          </label>
                          <select
                            value={String(selectedAsset.dormerWindowConfig?.windowCount ?? 2)}
                            onChange={(e) =>
                              onUpdateAsset(selectedAsset.id, {
                                dormerWindowConfig: {
                                  ...selectedAsset.dormerWindowConfig,
                                  windowCount: parseInt(e.target.value, 10) as 1 | 2 | 3,
                                },
                              })
                            }
                            className="w-full bg-slate-900 border border-white/15 rounded px-1.5 py-1 text-[10px] text-white"
                          >
                            <option value="1">1-flügelig</option>
                            <option value="2">2-flügelig (Doppelfenster)</option>
                            <option value="3">3-flügelig (Panorama)</option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-[10px] text-slate-400 mb-0.5">
                            Rahmenfarbe
                          </label>
                          <select
                            value={selectedAsset.dormerWindowConfig?.windowFrameColor || 'anthracite'}
                            onChange={(e) =>
                              onUpdateAsset(selectedAsset.id, {
                                dormerWindowConfig: {
                                  ...selectedAsset.dormerWindowConfig,
                                  windowFrameColor: e.target.value as OpeningFrameColor,
                                },
                              })
                            }
                            className="w-full bg-slate-900 border border-white/15 rounded px-1.5 py-1 text-[10px] text-white"
                          >
                            <option value="anthracite">Anthrazit (RAL 7016)</option>
                            <option value="white">Reinweiß (RAL 9016)</option>
                            <option value="oak">Eiche Natur</option>
                            <option value="walnut">Nussbaum Dunkel</option>
                            <option value="alu_silver">Alu / Edelstahl</option>
                            <option value="matte_black">Tiefschwarz Matt</option>
                            <option value="sage_green">Salbeigrün</option>
                            <option value="bronze_corten">Bronze / Corten</option>
                            <option value="burgundy_red">Weinrot</option>
                          </select>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-1.5">
                        <div>
                          <label className="block text-[10px] text-slate-400 mb-0.5">
                            Fenster-Design & Sprossen
                          </label>
                          <select
                            value={selectedAsset.dormerWindowConfig?.windowStyle || 'mullion_cross'}
                            onChange={(e) =>
                              onUpdateAsset(selectedAsset.id, {
                                dormerWindowConfig: {
                                  ...selectedAsset.dormerWindowConfig,
                                  windowStyle: e.target.value as DormerWindowStyle,
                                },
                              })
                            }
                            className="w-full bg-slate-900 border border-white/15 rounded px-1.5 py-1 text-[10px] text-white"
                          >
                            <option value="modern_single">Modern Klarglas (ohne Sprossen)</option>
                            <option value="mullion_cross">Klassische Kreuzsprossen</option>
                            <option value="industrial_loft">Industrial Loft-Gitter</option>
                            <option value="arched_classic">Oberlicht-Kämpferprofil</option>
                            <option value="frosted_privacy">Milchglas / Satiniert</option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-[10px] text-slate-400 mb-0.5">
                            3D-Öffnungszustand
                          </label>
                          <select
                            value={selectedAsset.dormerWindowConfig?.windowOpenState || 'closed'}
                            onChange={(e) =>
                              onUpdateAsset(selectedAsset.id, {
                                dormerWindowConfig: {
                                  ...selectedAsset.dormerWindowConfig,
                                  windowOpenState: e.target.value as 'closed' | 'tilted' | 'open',
                                },
                              })
                            }
                            className="w-full bg-slate-900 border border-sky-400/35 rounded px-1.5 py-1 text-[10px] text-sky-200 font-semibold"
                          >
                            <option value="closed">Geschlossen</option>
                            <option value="tilted">Gekippt (Lüftung)</option>
                            <option value="open">Geöffnet (Drehstellung)</option>
                          </select>
                        </div>
                      </div>

                      {selectedAsset.catalogId.startsWith('roof_dormer_') && (() => {
                        const assetWins = getEffectiveDormerWindows(selectedAsset.dormerWindowConfig);
                        const commitAssetWins = (nextWins: DormerWindowUnit[]) => {
                          onUpdateAsset(selectedAsset.id, {
                            dormerWindowConfig: {
                              ...selectedAsset.dormerWindowConfig,
                              windows: nextWins,
                            },
                          });
                        };
                        return (
                          <div className="pt-1.5 border-t border-white/10 space-y-1.5">
                            <div className="flex items-center justify-between gap-2 bg-slate-950/70 px-2 py-1 rounded border border-white/10">
                              <span className="text-[9px] text-slate-300">
                                Wangen-Dachneigung ({selectedAsset.dormerWindowConfig?.roofSlopeAngleDeg ?? 0}°)
                              </span>
                              <input
                                type="range"
                                min={0}
                                max={38}
                                step={2}
                                value={selectedAsset.dormerWindowConfig?.roofSlopeAngleDeg ?? 0}
                                onChange={(e) =>
                                  onUpdateAsset(selectedAsset.id, {
                                    dormerWindowConfig: {
                                      ...selectedAsset.dormerWindowConfig,
                                      roofSlopeAngleDeg: parseInt(e.target.value, 10),
                                    },
                                  })
                                }
                                className="w-24 accent-amber-400"
                              />
                            </div>

                            <div className="flex items-center justify-between">
                              <span className="text-[10px] font-bold text-amber-300">
                                Einzelne Fenster & Rollos in Gaube ({assetWins.length})
                              </span>
                              {assetWins.length < 4 && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    const nextWin: DormerWindowUnit = {
                                      id: `awin_${Date.now()}_${assetWins.length}`,
                                      widthRatio: 1,
                                      sashCount: 1,
                                      hingeSide: assetWins.length % 2 === 0 ? 'left' : 'right',
                                      windowStyle:
                                        selectedAsset.dormerWindowConfig?.windowStyle ||
                                        'mullion_cross',
                                      windowFrameColor:
                                        selectedAsset.dormerWindowConfig?.windowFrameColor ||
                                        'anthracite',
                                      windowOpenState: 'closed',
                                      hasShutter: false,
                                      shutterClosedPct: 35,
                                    };
                                    commitAssetWins([...assetWins, nextWin]);
                                  }}
                                  className="px-1.5 py-0.5 rounded bg-sky-400 text-slate-950 text-[9px] font-bold"
                                >
                                  + Fenster in Gaube
                                </button>
                              )}
                            </div>

                            <div className="space-y-1.5 max-h-64 overflow-y-auto pr-0.5">
                              {assetWins.map((wUnit, wIdx) => {
                                const patchWin = (p: Partial<DormerWindowUnit>) => {
                                  commitAssetWins(
                                    assetWins.map((u, i) => (i === wIdx ? { ...u, ...p } : u))
                                  );
                                };
                                return (
                                  <div
                                    key={wUnit.id || wIdx}
                                    className="p-1.5 rounded bg-slate-950/90 border border-sky-400/25 space-y-1"
                                  >
                                    <div className="flex items-center justify-between">
                                      <span className="text-[9px] font-bold text-sky-200">
                                        Gaubenfenster #{wIdx + 1}
                                      </span>
                                      {assetWins.length > 1 && (
                                        <button
                                          type="button"
                                          onClick={() =>
                                            commitAssetWins(
                                              assetWins.filter((_, i) => i !== wIdx)
                                            )
                                          }
                                          className="text-[9px] text-red-300 hover:text-red-200 px-1"
                                        >
                                          × Entfernen
                                        </button>
                                      )}
                                    </div>
                                    <div className="grid grid-cols-3 gap-1">
                                      <select
                                        value={`${wUnit.sashCount ?? 1}_${wUnit.hingeSide || 'left'}`}
                                        onChange={(e) => {
                                          const [sc, hs] = e.target.value.split('_');
                                          patchWin({
                                            sashCount: (parseInt(sc, 10) === 2 ? 2 : 1) as 1 | 2,
                                            hingeSide: (hs === 'right' ? 'right' : 'left') as
                                              | 'left'
                                              | 'right',
                                          });
                                        }}
                                        className="bg-slate-900 border border-white/15 rounded px-1 py-0.5 text-[9px] text-white"
                                      >
                                        <option value="1_left">1-fl. Links</option>
                                        <option value="1_right">1-fl. Rechts</option>
                                        <option value="2_left">2-fl. Doppel</option>
                                      </select>
                                      <select
                                        value={wUnit.windowFrameColor || 'anthracite'}
                                        onChange={(e) =>
                                          patchWin({
                                            windowFrameColor: e.target.value as OpeningFrameColor,
                                          })
                                        }
                                        className="bg-slate-900 border border-white/15 rounded px-1 py-0.5 text-[9px] text-white"
                                      >
                                        <option value="anthracite">Anthrazit</option>
                                        <option value="white">Reinweiß</option>
                                        <option value="oak">Eiche</option>
                                        <option value="walnut">Nussbaum</option>
                                        <option value="alu_silver">Alu Silber</option>
                                        <option value="matte_black">Schwarz</option>
                                      </select>
                                      <select
                                        value={wUnit.windowOpenState || 'closed'}
                                        onChange={(e) =>
                                          patchWin({
                                            windowOpenState: e.target.value as
                                              | 'closed'
                                              | 'tilted'
                                              | 'open',
                                          })
                                        }
                                        className="bg-slate-900 border border-sky-400/35 rounded px-1 py-0.5 text-[9px] text-sky-200 font-semibold"
                                      >
                                        <option value="closed">Zu</option>
                                        <option value="tilted">Kipp</option>
                                        <option value="open">Offen</option>
                                      </select>
                                    </div>
                                    <div className="flex items-center justify-between gap-1.5">
                                      <select
                                        value={wUnit.windowStyle || 'mullion_cross'}
                                        onChange={(e) =>
                                          patchWin({
                                            windowStyle: e.target.value as DormerWindowStyle,
                                          })
                                        }
                                        className="bg-slate-900 border border-white/15 rounded px-1 py-0.5 text-[9px] text-white"
                                      >
                                        <option value="modern_single">Klarglas</option>
                                        <option value="mullion_cross">Kreuzsprossen</option>
                                        <option value="industrial_loft">Loft-Gitter</option>
                                        <option value="arched_classic">Kämpfer</option>
                                        <option value="frosted_privacy">Milchglas</option>
                                      </select>
                                      <button
                                        type="button"
                                        onClick={() =>
                                          patchWin({
                                            hasShutter: !wUnit.hasShutter,
                                            shutterClosedPct: wUnit.shutterClosedPct ?? 40,
                                          })
                                        }
                                        className={`px-1.5 py-0.5 rounded text-[9px] font-semibold ${
                                          wUnit.hasShutter
                                            ? 'bg-amber-400 text-slate-950 font-bold'
                                            : 'bg-slate-900 text-slate-300 border border-white/10'
                                        }`}
                                      >
                                        {wUnit.hasShutter ? '✓ Rollo' : '+ Rollo'}
                                      </button>
                                      {wUnit.hasShutter && (
                                        <input
                                          type="range"
                                          min={0}
                                          max={100}
                                          step={5}
                                          value={wUnit.shutterClosedPct ?? 40}
                                          onChange={(e) =>
                                            patchWin({
                                              shutterClosedPct: parseInt(e.target.value, 10),
                                            })
                                          }
                                          className="flex-1 accent-amber-400"
                                        />
                                      )}
                                    </div>

                                    {/* HA Entity Bindings per Dormer Window (Sensor + Rollo) */}
                                    <div className="grid grid-cols-2 gap-1 pt-1 border-t border-white/10">
                                      <div>
                                        <label className="block text-[8px] text-slate-400 mb-0.5">
                                          Fenster-Sensor (HA)
                                        </label>
                                        <select
                                          value={wUnit.entityId || ''}
                                          onChange={(e) =>
                                            patchWin({
                                              entityId: e.target.value || undefined,
                                            })
                                          }
                                          className="w-full bg-slate-900 border border-white/15 rounded px-1 py-0.5 text-[8px] font-mono text-sky-300"
                                        >
                                          <option value="">— Kein Sensor —</option>
                                          {binarySensorIds.map((id) => (
                                            <option key={id} value={id}>
                                              {id} ({entities[id]?.state})
                                            </option>
                                          ))}
                                        </select>
                                      </div>
                                      <div>
                                        <label className="block text-[8px] text-slate-400 mb-0.5">
                                          Rollo-Entität (cover.*)
                                        </label>
                                        <select
                                          value={wUnit.shutterEntityId || ''}
                                          onChange={(e) => {
                                            const nextId = e.target.value || undefined;
                                            patchWin({
                                              shutterEntityId: nextId,
                                              hasShutter: nextId ? true : wUnit.hasShutter,
                                            });
                                          }}
                                          className="w-full bg-slate-900 border border-white/15 rounded px-1 py-0.5 text-[8px] font-mono text-amber-300"
                                        >
                                          <option value="">— Manuell / Kein HA —</option>
                                          {coverEntityIds.map((id) => (
                                            <option key={id} value={id}>
                                              {id} ({entities[id]?.state})
                                            </option>
                                          ))}
                                        </select>
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  )}
                </div>
              )}

              {/* CUSTOMIZABLE 3D STAIRCASE ARCHITECTURE (14 Shapes, Curves bottom/top, L/U/T Landings, Cantilever, Under-Stair Wall Closure, Railing & Treads) */}
              {isStairAsset(selectedAsset.catalogId) && (() => {
                const sc = selectedAsset.stairConfig || {};
                const defaultShape: StairShapeType =
                  selectedAsset.catalogId === 'staircase_spiral_steel'
                    ? 'spiral'
                    : selectedAsset.catalogId === 'staircase_double_winder'
                    ? 'double_winder_s_left'
                    : selectedAsset.catalogId === 'staircase_curved_landing'
                    ? 'half_s_curve'
                    : selectedAsset.catalogId === 'staircase_u_podest'
                    ? 'u_podest'
                    : selectedAsset.catalogId === 'staircase_floating_cantilever'
                    ? 'floating_cantilever'
                    : 'straight';
                const currentShape = sc.shape || defaultShape;
                const currentClosure =
                  sc.underStairClosure ||
                  (selectedAsset.catalogId === 'staircase_curved_landing'
                    ? 'walled_closed'
                    : 'open');
                const patchStair = (patch: Partial<NonNullable<PlacedAsset['stairConfig']>>) => {
                  onUpdateAsset(selectedAsset.id, {
                    stairConfig: {
                      ...sc,
                      ...patch,
                    },
                  });
                };

                const INDOOR_STAIR_SHAPES: {
                  id: StairShapeType;
                  short: string;
                  label: string;
                }[] = [
                  { id: 'straight', short: 'I · Gerade', label: 'Gerade Geschosstreppe (I-Form)' },
                  {
                    id: 'double_winder_s_left',
                    short: '2×¼ S-Form L',
                    label: 'Zweifach ¼-gewendelt S-Verlauf Links (Unten & Oben gleiche Blickrichtung)',
                  },
                  {
                    id: 'double_winder_s_right',
                    short: '2×¼ S-Form R',
                    label: 'Zweifach ¼-gewendelt S-Verlauf Rechts (Unten & Oben gleiche Blickrichtung)',
                  },
                  {
                    id: 'double_winder_c_left',
                    short: '2×¼ C-Form L',
                    label: 'Zweifach ¼-gewendelt C-Verlauf Links (Unten & Oben zur gleichen Raumseite)',
                  },
                  {
                    id: 'double_winder_c_right',
                    short: '2×¼ C-Form R',
                    label: 'Zweifach ¼-gewendelt C-Verlauf Rechts (Unten & Oben zur gleichen Raumseite)',
                  },
                  {
                    id: 'quarter_bottom_left',
                    short: '¼ Unten L',
                    label: '¼-gewendelt: Unten mit Kurve nach Links',
                  },
                  {
                    id: 'quarter_bottom_right',
                    short: '¼ Unten R',
                    label: '¼-gewendelt: Unten mit Kurve nach Rechts',
                  },
                  {
                    id: 'quarter_top_left',
                    short: '¼ Oben L',
                    label: '¼-gewendelt: Oben mit Kurve nach Links',
                  },
                  {
                    id: 'quarter_top_right',
                    short: '¼ Oben R',
                    label: '¼-gewendelt: Oben mit Kurve nach Rechts',
                  },
                  {
                    id: 'l_landing_left',
                    short: 'L-Podest L',
                    label: '90°-Eckpodesttreppe nach Links (L-Form)',
                  },
                  {
                    id: 'l_landing_right',
                    short: 'L-Podest R',
                    label: '90°-Eckpodesttreppe nach Rechts (L-Form)',
                  },
                  {
                    id: 'half_s_curve',
                    short: 'S-Kurve Sanft',
                    label: 'Doppelt gewendelt: Sanfte S-Kurve über gesamte Lauflänge',
                  },
                  {
                    id: 'u_podest',
                    short: '180° U-Podest',
                    label: '180°-Podesttreppe (Gegenläufige U-Treppe mit Zwischenpodest)',
                  },
                  {
                    id: 'u_winder',
                    short: '180° U-Wendel',
                    label: '180°-Halbgewendelte U-Treppe (Kompakt ohne Podest)',
                  },
                  {
                    id: 't_imperial',
                    short: 'T-Freitreppe',
                    label: 'Repräsentative T-Treppe (Zweiarmige Freitreppe)',
                  },
                  {
                    id: 'curved_arc',
                    short: 'Bogentreppe',
                    label: 'Frei geschwungene Panorama-Bogentreppe',
                  },
                  {
                    id: 'floating_cantilever',
                    short: 'Kragarm + LED',
                    label: 'Freitragende Kragarmtreppe (Schwebende Wandstufen + LED)',
                  },
                  {
                    id: 'spiral',
                    short: '360° Spindel',
                    label: '360°-Spindeltreppe / Wendeltreppe',
                  },
                ];

                return (
                  <div className="p-3 rounded-xl bg-slate-950 border border-amber-400/35 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-amber-300">
                        Innentreppe: 18 Bauformen (inkl. C- & S-Wendel)
                      </span>
                      <span className="text-[10px] font-mono text-slate-400">
                        {sc.stepCount ?? 14} Stufen
                      </span>
                    </div>

                    {/* 1. Visual Quick-Select Grid + Dropdown for all 18 Stair Shapes */}
                    <div className="space-y-1.5">
                      <label className="block text-[10px] text-slate-300 font-medium">
                        Treppenform direkt wählen (Unten + Oben gewendelt C-Form / S-Form):
                      </label>
                      <div className="grid grid-cols-3 gap-1">
                        {INDOOR_STAIR_SHAPES.map((sh) => (
                          <button
                            key={sh.id}
                            type="button"
                            onClick={() => patchStair({ shape: sh.id })}
                            className={`py-1 px-1.5 rounded text-[9.5px] font-semibold truncate transition-colors ${
                              currentShape === sh.id
                                ? 'bg-amber-400 text-slate-950 font-bold'
                                : 'bg-slate-900 hover:bg-slate-800 text-slate-300 border border-white/10'
                            }`}
                            title={sh.label}
                          >
                            {sh.short}
                          </button>
                        ))}
                      </div>
                      <select
                        value={currentShape}
                        onChange={(e) =>
                          patchStair({ shape: e.target.value as StairShapeType })
                        }
                        className="w-full bg-slate-900 border border-amber-400/35 rounded-lg px-2 py-1.5 text-[11px] text-white font-medium"
                      >
                        {INDOOR_STAIR_SHAPES.map((sh) => (
                          <option key={sh.id} value={sh.id}>
                            {sh.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* 2. Under-Stair Wall Closure (Wandabschluss unter der Treppe!) */}
                    {currentShape !== 'spiral' && currentShape !== 'floating_cantilever' && (
                      <div>
                        <label className="block text-[10px] text-sky-300 mb-0.5 font-semibold">
                          Wandabschluss / Unterbau unter der Treppe
                        </label>
                        <select
                          value={currentClosure}
                          onChange={(e) =>
                            patchStair({
                              underStairClosure: e.target.value as UnderStairClosureType,
                            })
                          }
                          className="w-full bg-slate-900 border border-sky-400/35 rounded-lg px-2 py-1.5 text-[11px] text-sky-100 font-medium"
                        >
                          <option value="open">
                            Freitragend / Offen (mit Stahlwange)
                          </option>
                          <option value="walled_closed">
                            Wandabschluss geschlossen (Abgemauerter Treppenunterbau)
                          </option>
                          <option value="storage_door">
                            Wandabschluss mit Abstellraum-Tür unter der Treppe
                          </option>
                          <option value="built_in_drawers">
                            Maßgefertigter Einbauschrank & Schubladen unter der Treppe
                          </option>
                        </select>
                      </div>
                    )}

                    {/* 3. Railing Side, Railing Style, Riser & Tread Material */}
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[10px] text-slate-400 mb-0.5">
                          Geländer-Seite
                        </label>
                        <select
                          value={sc.railingSide || 'both'}
                          onChange={(e) =>
                            patchStair({
                              railingSide: e.target.value as StairRailingSide,
                            })
                          }
                          className="w-full bg-slate-900 border border-white/15 rounded px-2 py-1 text-[11px] text-white"
                        >
                          <option value="both">Beidseitig (Links & Rechts)</option>
                          <option value="left">Nur Links (Wand rechts)</option>
                          <option value="right">Nur Rechts (Wand links)</option>
                          <option value="none">Ohne Geländer</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-[10px] text-slate-400 mb-0.5">
                          Geländer-Ausführung
                        </label>
                        <select
                          value={sc.railingStyle || 'glass'}
                          onChange={(e) =>
                            patchStair({
                              railingStyle: e.target.value as StairRailingStyle,
                            })
                          }
                          className="w-full bg-slate-900 border border-white/15 rounded px-2 py-1 text-[11px] text-white"
                        >
                          <option value="glass">ESG-Ganzglas + Holzhandlauf</option>
                          <option value="steel_rods">Schwarze Stahlstreben</option>
                          <option value="oak_handrail">Eichen-Handlauf + Streben</option>
                          <option value="solid_parapet">Gemauerte Brüstungswand</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-[10px] text-slate-400 mb-0.5">
                          Setzstufen (Zwischenraum)
                        </label>
                        <select
                          value={
                            sc.riserStyle ||
                            (currentClosure !== 'open' ? 'closed_white' : 'open')
                          }
                          onChange={(e) =>
                            patchStair({
                              riserStyle: e.target.value as StairRiserStyle,
                            })
                          }
                          className="w-full bg-slate-900 border border-white/15 rounded px-2 py-1 text-[11px] text-white"
                        >
                          <option value="open">Offene Stufen (Durchblick)</option>
                          <option value="closed_white">Geschlossen (Weiß matt)</option>
                          <option value="closed_oak">Geschlossen (Holz / Stein)</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-[10px] text-slate-400 mb-0.5">
                          Stufen-Material
                        </label>
                        <select
                          value={sc.treadMaterial || 'oak'}
                          onChange={(e) =>
                            patchStair({
                              treadMaterial: e.target.value as StairTreadMaterial,
                            })
                          }
                          className="w-full bg-slate-900 border border-white/15 rounded px-2 py-1 text-[11px] text-white"
                        >
                          <option value="oak">Wildeiche Natur</option>
                          <option value="walnut">Nussbaum Dunkel</option>
                          <option value="anthracite_stone">Schiefer Anthrazit</option>
                          <option value="travertine">Travertin / Naturstein</option>
                        </select>
                      </div>
                    </div>

                    {/* 4. Dimensions: Width, Total Run, Total Rise & Step Count */}
                    <div className="grid grid-cols-2 gap-2 pt-1 border-t border-white/10">
                      <div>
                        <div className="flex justify-between text-[10px] text-slate-300 mb-0.5">
                          <span>Laufbreite</span>
                          <span className="font-mono text-amber-300">
                            {(sc.width ?? 1.06).toFixed(2)} m
                          </span>
                        </div>
                        <input
                          type="range"
                          min={0.75}
                          max={1.65}
                          step={0.05}
                          value={sc.width ?? 1.06}
                          onChange={(e) =>
                            patchStair({ width: parseFloat(e.target.value) })
                          }
                          className="w-full accent-amber-400"
                        />
                      </div>
                      <div>
                        <div className="flex justify-between text-[10px] text-slate-300 mb-0.5">
                          <span>Lauflänge</span>
                          <span className="font-mono text-amber-300">
                            {(sc.totalRun ?? 3.1).toFixed(2)} m
                          </span>
                        </div>
                        <input
                          type="range"
                          min={1.8}
                          max={4.5}
                          step={0.1}
                          value={sc.totalRun ?? 3.1}
                          onChange={(e) =>
                            patchStair({ totalRun: parseFloat(e.target.value) })
                          }
                          className="w-full accent-amber-400"
                        />
                      </div>
                      <div>
                        <div className="flex justify-between text-[10px] text-slate-300 mb-0.5">
                          <span>Geschosshöhe</span>
                          <span className="font-mono text-sky-300">
                            {(sc.totalRise ?? 2.75).toFixed(2)} m
                          </span>
                        </div>
                        <input
                          type="range"
                          min={1.8}
                          max={3.5}
                          step={0.05}
                          value={sc.totalRise ?? 2.75}
                          onChange={(e) =>
                            patchStair({ totalRise: parseFloat(e.target.value) })
                          }
                          className="w-full accent-sky-400"
                        />
                      </div>
                      <div>
                        <div className="flex justify-between text-[10px] text-slate-300 mb-0.5">
                          <span>Stufenanzahl</span>
                          <span className="font-mono text-sky-300">
                            {sc.stepCount ?? 14} St.
                          </span>
                        </div>
                        <input
                          type="range"
                          min={9}
                          max={18}
                          step={1}
                          value={sc.stepCount ?? 14}
                          onChange={(e) =>
                            patchStair({ stepCount: parseInt(e.target.value, 10) })
                          }
                          className="w-full accent-sky-400"
                        />
                      </div>
                    </div>

                    {/* Bündig von Wand zu Wand & Raumecken-Einpassung für Treppen */}
                    <div className="pt-2 border-t border-white/10 space-y-1.5">
                      <div className="text-[10px] font-semibold text-amber-300">
                        1-Klick Raum-Einpassung & 3D-Wand-Schutz:
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          const floorZones = project.zones.filter(
                            (z) => (z.level ?? 0) === (selectedAsset.level ?? 0)
                          );
                          const patch = fitStairAssetToRoomWalls(
                            selectedAsset,
                            floorZones,
                            'fill_room'
                          );
                          if (patch) onUpdateAsset(selectedAsset.id, patch);
                        }}
                        className="w-full py-2 px-2.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-400/50 text-[10.5px] font-bold text-emerald-200 transition-colors"
                      >
                        📐 Treppe exakt an Raumform anpassen (Kein Wand-Überstand in 3D)
                      </button>
                      <div className="grid grid-cols-2 gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            const floorZones = project.zones.filter(
                              (z) => (z.level ?? 0) === (selectedAsset.level ?? 0)
                            );
                            const patch = fitStairAssetToRoomWalls(
                              selectedAsset,
                              floorZones,
                              'wall_to_wall'
                            );
                            if (patch) onUpdateAsset(selectedAsset.id, patch);
                          }}
                          className="py-1.5 px-2 rounded-lg bg-sky-500/20 hover:bg-sky-500/30 border border-sky-400/40 text-[10px] font-bold text-sky-200 transition-colors"
                        >
                          📐 Wand-zu-Wand spannen
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const floorZones = project.zones.filter(
                              (z) => (z.level ?? 0) === (selectedAsset.level ?? 0)
                            );
                            const patch = fitStairAssetToRoomWalls(
                              selectedAsset,
                              floorZones,
                              'flush_corner'
                            );
                            if (patch) onUpdateAsset(selectedAsset.id, patch);
                          }}
                          className="py-1.5 px-2 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border border-amber-400/40 text-[10px] font-bold text-amber-200 transition-colors"
                        >
                          📐 Bündig in Raumecke
                        </button>
                      </div>
                      <p className="text-[9.5px] text-slate-400 leading-tight">
                        Passt Breite, Lauflänge und Position exakt an die lichten Innenwände des Raums an (oder ziehe die Treppe im 2D-Plan frei über die 8 Griffe auf).
                      </p>
                    </div>
                  </div>
                );
              })()}

              {/* ELECTRIC SLIDING DRIVEWAY GATE CONTROLS */}
              {selectedAsset.catalogId === 'electric_sliding_driveway_gate' && (
                <div className="p-3 rounded-xl bg-slate-950 border border-sky-400/35 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-sky-300">
                      Elektrisches Einfahrts-Schiebetor (Seitlich)
                    </span>
                    <span className="text-[10px] font-mono text-amber-300">
                      {(selectedAsset.customLength ?? 4.2).toFixed(1)} m Breite
                    </span>
                  </div>

                  <div>
                    <div className="text-[10px] text-slate-400 mb-1">
                      Seitliche Laufrichtung beim Öffnen:
                    </div>
                    <div className="grid grid-cols-2 gap-1.5">
                      <button
                        type="button"
                        onClick={() =>
                          onUpdateAsset(selectedAsset.id, { gateSlideDirection: 'left' })
                        }
                        className={`py-1.5 px-2 rounded-lg text-[11px] font-semibold transition-colors ${
                          (selectedAsset.gateSlideDirection || 'left') === 'left'
                            ? 'bg-sky-400 text-slate-950 font-bold'
                            : 'bg-slate-900 text-slate-300 hover:bg-slate-800 border border-white/10'
                        }`}
                      >
                        ← Öffnet nach Links
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          onUpdateAsset(selectedAsset.id, { gateSlideDirection: 'right' })
                        }
                        className={`py-1.5 px-2 rounded-lg text-[11px] font-semibold transition-colors ${
                          selectedAsset.gateSlideDirection === 'right'
                            ? 'bg-sky-400 text-slate-950 font-bold'
                            : 'bg-slate-900 text-slate-300 hover:bg-slate-800 border border-white/10'
                        }`}
                      >
                        Öffnet nach Rechts →
                      </button>
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-[10px] text-slate-300 mb-0.5">
                      <span>Schiebetor-Öffnung direkt testen</span>
                      <span className="font-mono text-amber-300">
                        {selectedAsset.customOpenPct ?? 0}% geöffnet
                      </span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      step={5}
                      value={selectedAsset.customOpenPct ?? 0}
                      onChange={(e) =>
                        onUpdateAsset(selectedAsset.id, {
                          customOpenPct: parseInt(e.target.value, 10),
                        })
                      }
                      className="w-full accent-amber-400"
                    />
                  </div>
                </div>
              )}

              {/* ZWEIFLÜGELIGES EINFAHRTSTOR & ROLLTOR: BREITE, HÖHE & DIREKT-TEST */}
              {(selectedAsset.catalogId === 'double_swing_driveway_gate' ||
                selectedAsset.catalogId === 'electric_roller_gate') && (
                <div className="p-3 rounded-xl bg-slate-950 border border-sky-400/35 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-sky-300">
                      {selectedAsset.catalogId === 'double_swing_driveway_gate'
                        ? 'Zweiflügeliges Hof- & Einfahrtstor'
                        : 'Elektrisches Lamellen-Rolltor'}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <div className="flex justify-between text-[10px] text-slate-300 mb-0.5">
                        <span>Torbreite</span>
                        <span className="font-mono text-sky-300">
                          {(selectedAsset.customLength ?? 3.6).toFixed(2)} m
                        </span>
                      </div>
                      <input
                        type="range"
                        min={2.0}
                        max={6.0}
                        step={0.1}
                        value={selectedAsset.customLength ?? 3.6}
                        onChange={(e) =>
                          onUpdateAsset(selectedAsset.id, {
                            customLength: parseFloat(e.target.value),
                          })
                        }
                        className="w-full accent-sky-400"
                      />
                    </div>
                    <div>
                      <div className="flex justify-between text-[10px] text-slate-300 mb-0.5">
                        <span>Torhöhe</span>
                        <span className="font-mono text-sky-300">
                          {(selectedAsset.customHeight ?? 1.65).toFixed(2)} m
                        </span>
                      </div>
                      <input
                        type="range"
                        min={1.0}
                        max={2.6}
                        step={0.05}
                        value={selectedAsset.customHeight ?? 1.65}
                        onChange={(e) =>
                          onUpdateAsset(selectedAsset.id, {
                            customHeight: parseFloat(e.target.value),
                          })
                        }
                        className="w-full accent-sky-400"
                      />
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between text-[10px] text-slate-300 mb-0.5">
                      <span>Tor-Öffnung direkt testen</span>
                      <span className="font-mono text-amber-300">
                        {selectedAsset.customOpenPct ?? 0}% geöffnet
                      </span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      step={5}
                      value={selectedAsset.customOpenPct ?? 0}
                      onChange={(e) =>
                        onUpdateAsset(selectedAsset.id, {
                          customOpenPct: parseInt(e.target.value, 10),
                        })
                      }
                      className="w-full accent-amber-400"
                    />
                  </div>
                </div>
              )}

              {/* FREI PLANBARES SONNENSEGEL (SUN SHADE SAIL): FORM, MASSE, MASTHÖHE & FARBE */}
              {selectedAsset.catalogId === 'sun_shade_sail' && (
                <div className="p-3 rounded-xl bg-slate-950 border border-amber-400/35 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-amber-300">
                      Frei planbares Sonnensegel (2D & 3D)
                    </span>
                    {selectedAsset.sailCorners && selectedAsset.sailCorners.length >= 3 && (
                      <button
                        type="button"
                        onClick={() =>
                          onUpdateAsset(selectedAsset.id, { sailCorners: undefined })
                        }
                        className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-[9px] text-amber-300 border border-amber-400/30"
                      >
                        Eckpunkte zurücksetzen
                      </button>
                    )}
                  </div>
                  <p className="text-[10px] text-slate-400 leading-snug">
                    Tipp: Im <strong className="text-amber-300">2D-Grundriss</strong> kannst du jeden einzelnen Eckpunkt (Mast) des Sonnensegels frei an die gewünschte Position ziehen!
                  </p>

                  <div>
                    <span className="text-[10px] text-slate-300 block mb-1">
                      Segel-Grundform / Befestigung
                    </span>
                    <div className="grid grid-cols-3 gap-1.5">
                      {(
                        [
                          { id: 'quad_4mast', label: '4-Mast Viereck' },
                          { id: 'triangle_3mast', label: '3-Mast Dreieck' },
                          { id: 'trapezoid_wall', label: 'Wand-Trapez' },
                        ] as const
                      ).map((opt) => {
                        const active = (selectedAsset.sailShape || 'quad_4mast') === opt.id;
                        return (
                          <button
                            key={opt.id}
                            type="button"
                            onClick={() =>
                              onUpdateAsset(selectedAsset.id, {
                                sailShape: opt.id,
                                sailCorners: undefined,
                              })
                            }
                            className={`py-1.5 px-1.5 rounded-lg text-[10px] font-semibold transition-colors ${
                              active
                                ? 'bg-amber-400 text-slate-950 font-bold'
                                : 'bg-slate-900 text-slate-300 hover:bg-slate-800 border border-white/10'
                            }`}
                          >
                            {opt.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <div className="flex justify-between text-[10px] text-slate-300 mb-0.5">
                        <span>Breite</span>
                        <span className="font-mono text-amber-300">
                          {(selectedAsset.customLength ?? 3.6).toFixed(1)} m
                        </span>
                      </div>
                      <input
                        type="range"
                        min={2.0}
                        max={8.0}
                        step={0.2}
                        value={selectedAsset.customLength ?? 3.6}
                        onChange={(e) =>
                          onUpdateAsset(selectedAsset.id, {
                            customLength: parseFloat(e.target.value),
                            sailCorners: undefined,
                          })
                        }
                        className="w-full accent-amber-400"
                      />
                    </div>
                    <div>
                      <div className="flex justify-between text-[10px] text-slate-300 mb-0.5">
                        <span>Tiefe</span>
                        <span className="font-mono text-amber-300">
                          {(selectedAsset.customWidth ?? 3.6).toFixed(1)} m
                        </span>
                      </div>
                      <input
                        type="range"
                        min={2.0}
                        max={8.0}
                        step={0.2}
                        value={selectedAsset.customWidth ?? 3.6}
                        onChange={(e) =>
                          onUpdateAsset(selectedAsset.id, {
                            customWidth: parseFloat(e.target.value),
                            sailCorners: undefined,
                          })
                        }
                        className="w-full accent-amber-400"
                      />
                    </div>
                    <div>
                      <div className="flex justify-between text-[10px] text-slate-300 mb-0.5">
                        <span>Masthöhe</span>
                        <span className="font-mono text-amber-300">
                          {(selectedAsset.customHeight ?? 2.65).toFixed(2)} m
                        </span>
                      </div>
                      <input
                        type="range"
                        min={1.9}
                        max={4.0}
                        step={0.05}
                        value={selectedAsset.customHeight ?? 2.65}
                        onChange={(e) =>
                          onUpdateAsset(selectedAsset.id, {
                            customHeight: parseFloat(e.target.value),
                          })
                        }
                        className="w-full accent-amber-400"
                      />
                    </div>
                  </div>

                  <div>
                    <span className="text-[10px] text-slate-300 block mb-1">
                      Segeltuch-Farbe
                    </span>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {[
                        { hex: '#f5f0e6', label: 'Natur-Creme' },
                        { hex: '#e2e8f0', label: 'Lichtgrau' },
                        { hex: '#d6c7b2', label: 'Sand-Beige' },
                        { hex: '#c2410c', label: 'Terrakotta' },
                        { hex: '#334155', label: 'Anthrazit' },
                        { hex: '#0284c7', label: 'Ozeanblau' },
                      ].map((col) => (
                        <button
                          key={col.hex}
                          type="button"
                          onClick={() =>
                            onUpdateAsset(selectedAsset.id, { sailColor: col.hex })
                          }
                          className={`px-2 py-1 rounded text-[9px] font-semibold flex items-center gap-1 border ${
                            (selectedAsset.sailColor || '#f5f0e6') === col.hex
                              ? 'border-amber-400 bg-amber-500/20 text-amber-200'
                              : 'border-white/10 bg-slate-900 text-slate-300'
                          }`}
                        >
                          <span
                            className="w-2.5 h-2.5 rounded-full border border-white/20"
                            style={{ backgroundColor: col.hex }}
                          />
                          {col.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* FREI PLATZIERBARES PV-SOLARMODUL-FELD: MODUL-ANZAHL & NEIGUNG */}
              {selectedAsset.catalogId === 'solar_panel_array' && (
                <div className="p-3 rounded-xl bg-slate-950 border border-emerald-400/35 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-emerald-300">
                      Frei platzierbares PV-Modulfeld
                    </span>
                    <span className="text-[10px] font-mono text-emerald-300 font-bold">
                      {((selectedAsset.pvModuleCount ?? 8) * 0.425).toFixed(2)} kWp
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-400 leading-snug">
                    Wird auf einem Gebäudedach automatisch an die Dachhöhe & Dachschräge angepasst oder frei auf Flachdach/Garten aufgeständert.
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <div className="flex justify-between text-[10px] text-slate-300 mb-0.5">
                        <span>Anzahl PV-Module</span>
                        <span className="font-mono text-emerald-300 font-bold">
                          {selectedAsset.pvModuleCount ?? 8} Stk.
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <input
                          type="number"
                          min={1}
                          max={36}
                          step={1}
                          value={selectedAsset.pvModuleCount ?? 8}
                          onChange={(e) =>
                            onUpdateAsset(selectedAsset.id, {
                              pvModuleCount: Math.max(
                                1,
                                Math.min(36, parseInt(e.target.value, 10) || 1)
                              ),
                            })
                          }
                          className="w-16 bg-slate-900 border border-white/15 rounded px-2 py-1 text-xs font-mono text-emerald-300"
                        />
                        <input
                          type="range"
                          min={1}
                          max={24}
                          step={1}
                          value={selectedAsset.pvModuleCount ?? 8}
                          onChange={(e) =>
                            onUpdateAsset(selectedAsset.id, {
                              pvModuleCount: parseInt(e.target.value, 10),
                            })
                          }
                          className="flex-1 accent-emerald-400"
                        />
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between text-[10px] text-slate-300 mb-0.5">
                        <span>Neigungswinkel</span>
                        <span className="font-mono text-emerald-300">
                          {selectedAsset.pvTiltDeg ?? 14}°
                        </span>
                      </div>
                      <input
                        type="range"
                        min={0}
                        max={45}
                        step={2}
                        value={selectedAsset.pvTiltDeg ?? 14}
                        onChange={(e) =>
                          onUpdateAsset(selectedAsset.id, {
                            pvTiltDeg: parseInt(e.target.value, 10),
                          })
                        }
                        className="w-full accent-emerald-400 mt-1.5"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* 3D TREE ASSETS: HEIGHT & CROWN DIAMETER */}
              {isTreeAsset(selectedAsset.catalogId) && (
                <div className="p-3 rounded-xl bg-slate-950 border border-emerald-400/35 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-emerald-300">
                      Baum-Wuchshöhe & Kronenbreite
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <div className="flex justify-between text-[10px] text-slate-300 mb-0.5">
                        <span>Baumhöhe</span>
                        <span className="font-mono text-emerald-300">
                          {(selectedAsset.customHeight ?? 3.5).toFixed(1)} m
                        </span>
                      </div>
                      <input
                        type="range"
                        min={1.6}
                        max={7.5}
                        step={0.1}
                        value={selectedAsset.customHeight ?? 3.5}
                        onChange={(e) =>
                          onUpdateAsset(selectedAsset.id, {
                            customHeight: parseFloat(e.target.value),
                          })
                        }
                        className="w-full accent-emerald-400"
                      />
                    </div>
                    <div>
                      <div className="flex justify-between text-[10px] text-slate-300 mb-0.5">
                        <span>Kronen-Ø</span>
                        <span className="font-mono text-emerald-300">
                          {(selectedAsset.customLength ?? 2.4).toFixed(1)} m
                        </span>
                      </div>
                      <input
                        type="range"
                        min={0.8}
                        max={5.0}
                        step={0.1}
                        value={selectedAsset.customLength ?? 2.4}
                        onChange={(e) =>
                          onUpdateAsset(selectedAsset.id, {
                            customLength: parseFloat(e.target.value),
                          })
                        }
                        className="w-full accent-emerald-400"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* ANLEHN-GEWÄCHSHAUS AN GARAGE & GLAS-GEWÄCHSHAUS: BREITE & FIRSTHÖHE */}
              {(selectedAsset.catalogId === 'garage_lean_to_greenhouse' ||
                selectedAsset.catalogId === 'glass_greenhouse') && (
                <div className="p-3 rounded-xl bg-slate-950 border border-emerald-400/35 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-emerald-300">
                      {selectedAsset.catalogId === 'garage_lean_to_greenhouse'
                        ? 'Anlehn-Gewächshaus an Garage (7 Segmente & Klinkersockel)'
                        : 'Garten-Gewächshaus Maße'}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <div className="flex justify-between text-[10px] text-slate-300 mb-0.5">
                        <span>Breite / Länge</span>
                        <span className="font-mono text-emerald-300">
                          {(
                            selectedAsset.customLength ??
                            (selectedAsset.catalogId === 'garage_lean_to_greenhouse'
                              ? 3.85
                              : 3.15)
                          ).toFixed(2)}{' '}
                          m
                        </span>
                      </div>
                      <input
                        type="range"
                        min={2.0}
                        max={6.5}
                        step={0.05}
                        value={
                          selectedAsset.customLength ??
                          (selectedAsset.catalogId === 'garage_lean_to_greenhouse'
                            ? 3.85
                            : 3.15)
                        }
                        onChange={(e) =>
                          onUpdateAsset(selectedAsset.id, {
                            customLength: parseFloat(e.target.value),
                          })
                        }
                        className="w-full accent-emerald-400"
                      />
                    </div>
                    <div>
                      <div className="flex justify-between text-[10px] text-slate-300 mb-0.5">
                        <span>Firsthöhe</span>
                        <span className="font-mono text-emerald-300">
                          {(selectedAsset.customHeight ?? 2.28).toFixed(2)} m
                        </span>
                      </div>
                      <input
                        type="range"
                        min={1.85}
                        max={2.9}
                        step={0.05}
                        value={selectedAsset.customHeight ?? 2.28}
                        onChange={(e) =>
                          onUpdateAsset(selectedAsset.id, {
                            customHeight: parseFloat(e.target.value),
                          })
                        }
                        className="w-full accent-emerald-400"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* STANDALONE EXTERIOR STEPS / OUTDOOR STAIRCASE ASSET (8 SHAPES) */}
              {isExteriorStairAsset(selectedAsset.catalogId) && (() => {
                const ec = selectedAsset.exteriorStairConfig || {};
                const defaultExtShape: ExteriorStepsShapeType =
                  selectedAsset.catalogId === 'outdoor_stairs_curved_fan'
                    ? 'curved_fan'
                    : selectedAsset.catalogId === 'outdoor_stairs_pyramid'
                    ? 'pyramid_3side'
                    : selectedAsset.catalogId === 'outdoor_stairs_kellertreppe'
                    ? 'kellertreppe_wall'
                    : 'straight';
                const currentExtShape = ec.shape || defaultExtShape;
                const currentW = ec.width ?? selectedAsset.customLength ?? 1.75;
                const currentH =
                  ec.plinthHeight ??
                  selectedAsset.customHeight ??
                  (selectedAsset.catalogId === 'outdoor_stairs_kellertreppe' ? 1.2 : 0.35);
                const currentSteps =
                  ec.stepCount ?? Math.max(2, Math.min(8, Math.round(currentH / 0.16)));
                const currentD = ec.depth ?? +(0.55 + currentSteps * 0.28).toFixed(2);

                const patchExtStair = (
                  patch: Partial<NonNullable<PlacedAsset['exteriorStairConfig']>>
                ) => {
                  onUpdateAsset(selectedAsset.id, {
                    exteriorStairConfig: {
                      ...ec,
                      ...patch,
                    },
                    ...(patch.width !== undefined ? { customLength: patch.width } : {}),
                    ...(patch.plinthHeight !== undefined
                      ? { customHeight: patch.plinthHeight }
                      : {}),
                  });
                };

                const EXTERIOR_STAIR_SHAPES: {
                  id: ExteriorStepsShapeType;
                  short: string;
                  label: string;
                }[] = [
                  {
                    id: 'straight',
                    short: 'Gerade',
                    label: 'Gerade Blockstufen mit Eingangspodest',
                  },
                  {
                    id: 'pyramid_3side',
                    short: '3-Seitig Pyramide',
                    label: '3-seitig umlaufende Pyramiden-Blockstufen (Vorn + Links + Rechts)',
                  },
                  {
                    id: 'curved_fan',
                    short: 'Halbrund / Fächer',
                    label: 'Halbrunde / Geschwungene Fächerstufen (Bogenpodest)',
                  },
                  {
                    id: 'side_left',
                    short: 'Seitlich Links',
                    label: 'Seitlicher Abgang nach Links entlang der Hauswand',
                  },
                  {
                    id: 'side_right',
                    short: 'Seitlich Rechts',
                    label: 'Seitlicher Abgang nach Rechts entlang der Hauswand',
                  },
                  {
                    id: 'double_side_T',
                    short: 'Beidseitig (T)',
                    label: 'Beidseitiger T-Abgang (Links & Rechts mit Mittelpodest)',
                  },
                  {
                    id: 'corner_L',
                    short: 'Übereck (L-Form)',
                    label: 'Übereck-Außentreppe / L-Winkelpodest (Vorn + Seite)',
                  },
                  {
                    id: 'kellertreppe_wall',
                    short: 'Wangenmauer',
                    label: 'Kellerausgangs- / Außentreppe mit seitlichen Wangenmauern',
                  },
                ];

                return (
                  <div className="p-3 rounded-xl bg-slate-950 border border-amber-400/35 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-amber-300">
                        Außentreppe & Podest (8 Bauformen)
                      </span>
                      <span className="text-[10px] font-mono text-sky-300">
                        {currentSteps} Stufen · {Math.round(currentH * 100)} cm
                      </span>
                    </div>

                    <div className="space-y-1.5">
                      <label className="block text-[10px] text-slate-300 font-medium">
                        Außentreppen-Form direkt wählen:
                      </label>
                      <div className="grid grid-cols-2 gap-1">
                        {EXTERIOR_STAIR_SHAPES.map((sh) => (
                          <button
                            key={sh.id}
                            type="button"
                            onClick={() => patchExtStair({ shape: sh.id })}
                            className={`py-1 px-2 rounded text-[10px] font-semibold truncate text-left transition-colors ${
                              currentExtShape === sh.id
                                ? 'bg-amber-400 text-slate-950 font-bold'
                                : 'bg-slate-900 hover:bg-slate-800 text-slate-300 border border-white/10'
                            }`}
                            title={sh.label}
                          >
                            {sh.short}
                          </button>
                        ))}
                      </div>
                      <select
                        value={currentExtShape}
                        onChange={(e) =>
                          patchExtStair({ shape: e.target.value as ExteriorStepsShapeType })
                        }
                        className="w-full bg-slate-900 border border-amber-400/35 rounded-lg px-2 py-1.5 text-[11px] text-white font-medium"
                      >
                        {EXTERIOR_STAIR_SHAPES.map((sh) => (
                          <option key={sh.id} value={sh.id}>
                            {sh.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <div className="flex justify-between text-[10px] text-slate-300 mb-0.5">
                          <span>Podestbreite</span>
                          <span className="font-mono text-amber-300">
                            {currentW.toFixed(2)} m
                          </span>
                        </div>
                        <input
                          type="range"
                          min={0.9}
                          max={3.6}
                          step={0.05}
                          value={currentW}
                          onChange={(e) =>
                            patchExtStair({ width: parseFloat(e.target.value) })
                          }
                          className="w-full accent-amber-400"
                        />
                      </div>
                      <div>
                        <div className="flex justify-between text-[10px] text-slate-300 mb-0.5">
                          <span>Ausladung / Tiefe</span>
                          <span className="font-mono text-amber-300">
                            {currentD.toFixed(2)} m
                          </span>
                        </div>
                        <input
                          type="range"
                          min={0.75}
                          max={3.0}
                          step={0.05}
                          value={currentD}
                          onChange={(e) =>
                            patchExtStair({ depth: parseFloat(e.target.value) })
                          }
                          className="w-full accent-amber-400"
                        />
                      </div>
                      <div>
                        <div className="flex justify-between text-[10px] text-slate-300 mb-0.5">
                          <span>Höhe / Sockel</span>
                          <span className="font-mono text-sky-300">
                            {Math.round(currentH * 100)} cm
                          </span>
                        </div>
                        <input
                          type="range"
                          min={0.15}
                          max={1.8}
                          step={0.05}
                          value={currentH}
                          onChange={(e) =>
                            patchExtStair({ plinthHeight: parseFloat(e.target.value) })
                          }
                          className="w-full accent-sky-400"
                        />
                      </div>
                      <div>
                        <div className="flex justify-between text-[10px] text-slate-300 mb-0.5">
                          <span>Stufenanzahl</span>
                          <span className="font-mono text-sky-300">
                            {currentSteps} Stufen
                          </span>
                        </div>
                        <input
                          type="range"
                          min={1}
                          max={8}
                          step={1}
                          value={currentSteps}
                          onChange={(e) =>
                            patchExtStair({ stepCount: parseInt(e.target.value, 10) })
                          }
                          className="w-full accent-sky-400"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[10px] text-slate-400 mb-0.5">
                          Stufen-Material
                        </label>
                        <select
                          value={ec.material || 'travertine'}
                          onChange={(e) =>
                            patchExtStair({
                              material: e.target.value as NonNullable<
                                PlacedAsset['exteriorStairConfig']
                              >['material'],
                            })
                          }
                          className="w-full bg-slate-900 border border-white/15 rounded px-2 py-1 text-[11px] text-white"
                        >
                          <option value="travertine">Travertin / Naturstein</option>
                          <option value="granite">Granit Hellgrau</option>
                          <option value="anthracite">Basalt Anthrazit</option>
                          <option value="wood">Hartholz / Teak</option>
                          <option value="brick_clinker">Rotklinker / Backstein</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-[10px] text-slate-400 mb-0.5">
                          Außengeländer
                        </label>
                        <select
                          value={ec.railing || 'none'}
                          onChange={(e) =>
                            patchExtStair({
                              railing: e.target.value as NonNullable<
                                PlacedAsset['exteriorStairConfig']
                              >['railing'],
                            })
                          }
                          className="w-full bg-slate-900 border border-white/15 rounded px-2 py-1 text-[11px] text-white"
                        >
                          <option value="none">Ohne Geländer</option>
                          <option value="both">Edelstahl Beidseitig</option>
                          <option value="left">Nur Links</option>
                          <option value="right">Nur Rechts</option>
                          <option value="glass">ESG-Glasgeländer</option>
                        </select>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* HAUSTECHNIK & ENERGIE-ZENTRALE: Detaillierte Entitäts-Zuordnung (Wärmepumpe, PV, Speicher, Zählerschrank, Smart-Home-Hub) */}
              {isBuildingTechAsset(selectedAsset.catalogId) &&
                (() => {
                  const tc: BuildingTechEntityConfig = selectedAsset.techConfig || {};
                  const patchTech = (patch: Partial<BuildingTechEntityConfig>) => {
                    onUpdateAsset(selectedAsset.id, {
                      techConfig: {
                        ...tc,
                        ...patch,
                      },
                    });
                  };
                  const isHeatPump =
                    selectedAsset.catalogId === 'heat_pump_outdoor_monoblock' ||
                    selectedAsset.catalogId === 'heat_pump_indoor_unit';
                  const isBufferTank = selectedAsset.catalogId === 'hot_water_buffer_tank';
                  const isPvOrBattery =
                    selectedAsset.catalogId === 'pv_inverter_system' ||
                    selectedAsset.catalogId === 'home_battery_inverter' ||
                    selectedAsset.catalogId === 'solar_panel_array';
                  const isMeterCabinet =
                    selectedAsset.catalogId === 'electrical_meter_cabinet' ||
                    selectedAsset.catalogId === 'sub_distribution_board_1row' ||
                    selectedAsset.catalogId === 'sub_distribution_board_3row';
                  const isSmartHub = selectedAsset.catalogId === 'smart_home_server_hub';

                  return (
                    <div className="p-3 rounded-xl bg-slate-950 border border-emerald-400/40 space-y-2.5">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-xs font-bold text-emerald-300">
                            Haustechnik & Live-Cockpit Entitäten
                          </div>
                          <div className="text-[10px] text-slate-400">
                            Automatisch mit dem Tab „Haustechnik“ im Live-Cockpit verknüpft
                          </div>
                        </div>
                        <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 text-[9.5px] font-mono font-semibold">
                          Auto-Card aktiv
                        </span>
                      </div>

                      {isHeatPump && (
                        <div className="grid grid-cols-1 gap-2">
                          <div>
                            <label className="block text-[10px] text-slate-300 mb-0.5">
                              Vorlauftemperatur (°C)
                            </label>
                            <input
                              type="text"
                              list="ha-entity-datalist-tech"
                              value={tc.supplyTempEntityId ?? 'sensor.wp_vorlauf_temp'}
                              onChange={(e) =>
                                patchTech({ supplyTempEntityId: e.target.value || undefined })
                              }
                              placeholder="z.B. sensor.wp_vorlauf_temp"
                              className="w-full bg-slate-900 border border-white/15 rounded px-2 py-1 text-[11px] font-mono text-amber-200"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] text-slate-300 mb-0.5">
                              Rücklauftemperatur (°C)
                            </label>
                            <input
                              type="text"
                              list="ha-entity-datalist-tech"
                              value={tc.returnTempEntityId ?? 'sensor.wp_ruecklauf_temp'}
                              onChange={(e) =>
                                patchTech({ returnTempEntityId: e.target.value || undefined })
                              }
                              placeholder="z.B. sensor.wp_ruecklauf_temp"
                              className="w-full bg-slate-900 border border-white/15 rounded px-2 py-1 text-[11px] font-mono text-sky-200"
                            />
                          </div>
                          <div className="grid grid-cols-2 gap-1.5">
                            <div>
                              <label className="block text-[10px] text-slate-300 mb-0.5">
                                Arbeitszahl (COP)
                              </label>
                              <input
                                type="text"
                                list="ha-entity-datalist-tech"
                                value={tc.copEntityId ?? 'sensor.wp_cop'}
                                onChange={(e) =>
                                  patchTech({ copEntityId: e.target.value || undefined })
                                }
                                placeholder="sensor.wp_cop"
                                className="w-full bg-slate-900 border border-white/15 rounded px-2 py-1 text-[11px] font-mono text-emerald-200"
                              />
                            </div>
                            <div>
                              <label className="block text-[10px] text-slate-300 mb-0.5">
                                Leistung (W)
                              </label>
                              <input
                                type="text"
                                list="ha-entity-datalist-tech"
                                value={tc.powerEntityId ?? 'sensor.wp_aufnahmeleistung'}
                                onChange={(e) =>
                                  patchTech({ powerEntityId: e.target.value || undefined })
                                }
                                placeholder="sensor.wp_aufnahmeleistung"
                                className="w-full bg-slate-900 border border-white/15 rounded px-2 py-1 text-[11px] font-mono text-white"
                              />
                            </div>
                          </div>
                        </div>
                      )}

                      {isBufferTank && (
                        <div className="grid grid-cols-1 gap-2">
                          <div>
                            <label className="block text-[10px] text-slate-300 mb-0.5">
                              Warmwasser-Speichertemperatur (°C)
                            </label>
                            <input
                              type="text"
                              list="ha-entity-datalist-tech"
                              value={
                                tc.storageTempEntityId ||
                                selectedAsset.entityId ||
                                'sensor.warmwasser_speicher_temp'
                              }
                              onChange={(e) =>
                                patchTech({ storageTempEntityId: e.target.value || undefined })
                              }
                              placeholder="z.B. sensor.warmwasser_speicher_temp"
                              className="w-full bg-slate-900 border border-white/15 rounded px-2 py-1 text-[11px] font-mono text-amber-200"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] text-slate-300 mb-0.5">
                              Zirkulation / Heizstab-Leistung (Optional)
                            </label>
                            <input
                              type="text"
                              list="ha-entity-datalist-tech"
                              value={tc.powerEntityId ?? ''}
                              onChange={(e) =>
                                patchTech({ powerEntityId: e.target.value || undefined })
                              }
                              placeholder="z.B. sensor.heizstab_power"
                              className="w-full bg-slate-900 border border-white/15 rounded px-2 py-1 text-[11px] font-mono text-slate-200"
                            />
                          </div>
                        </div>
                      )}

                      {isPvOrBattery && (
                        <div className="grid grid-cols-1 gap-2">
                          <div className="grid grid-cols-2 gap-1.5">
                            <div>
                              <label className="block text-[10px] text-slate-300 mb-0.5">
                                PV-Leistung (W)
                              </label>
                              <input
                                type="text"
                                list="ha-entity-datalist-tech"
                                value={
                                  tc.powerEntityId ||
                                  selectedAsset.entityId ||
                                  'sensor.pv_dach_leistung'
                                }
                                onChange={(e) =>
                                  patchTech({ powerEntityId: e.target.value || undefined })
                                }
                                className="w-full bg-slate-900 border border-white/15 rounded px-2 py-1 text-[11px] font-mono text-amber-200"
                              />
                            </div>
                            <div>
                              <label className="block text-[10px] text-slate-300 mb-0.5">
                                Tagesertrag (kWh)
                              </label>
                              <input
                                type="text"
                                list="ha-entity-datalist-tech"
                                value={tc.dailyYieldEntityId ?? 'sensor.pv_tagesertrag'}
                                onChange={(e) =>
                                  patchTech({ dailyYieldEntityId: e.target.value || undefined })
                                }
                                className="w-full bg-slate-900 border border-white/15 rounded px-2 py-1 text-[11px] font-mono text-emerald-200"
                              />
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-1.5">
                            <div>
                              <label className="block text-[10px] text-slate-300 mb-0.5">
                                Hausakku SoC (%)
                              </label>
                              <input
                                type="text"
                                list="ha-entity-datalist-tech"
                                value={tc.batterySocEntityId ?? 'sensor.hausakku_soc'}
                                onChange={(e) =>
                                  patchTech({ batterySocEntityId: e.target.value || undefined })
                                }
                                className="w-full bg-slate-900 border border-white/15 rounded px-2 py-1 text-[11px] font-mono text-sky-200"
                              />
                            </div>
                            <div>
                              <label className="block text-[10px] text-slate-300 mb-0.5">
                                Netzleistung (W)
                              </label>
                              <input
                                type="text"
                                list="ha-entity-datalist-tech"
                                value={tc.gridPowerEntityId ?? 'sensor.zaehlerschrank_leistung'}
                                onChange={(e) =>
                                  patchTech({ gridPowerEntityId: e.target.value || undefined })
                                }
                                className="w-full bg-slate-900 border border-white/15 rounded px-2 py-1 text-[11px] font-mono text-slate-200"
                              />
                            </div>
                          </div>
                        </div>
                      )}

                      {isMeterCabinet && (
                        <div className="grid grid-cols-1 gap-2">
                          <div>
                            <label className="block text-[10px] text-slate-300 mb-0.5">
                              Smart-Meter Netzleistung / Hausverbrauch (W)
                            </label>
                            <input
                              type="text"
                              list="ha-entity-datalist-tech"
                              value={
                                tc.gridPowerEntityId ||
                                selectedAsset.entityId ||
                                'sensor.zaehlerschrank_leistung'
                              }
                              onChange={(e) =>
                                patchTech({ gridPowerEntityId: e.target.value || undefined })
                              }
                              className="w-full bg-slate-900 border border-white/15 rounded px-2 py-1 text-[11px] font-mono text-emerald-200"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] text-slate-300 mb-0.5">
                              Tagesverbrauch / Bezug (kWh)
                            </label>
                            <input
                              type="text"
                              list="ha-entity-datalist-tech"
                              value={tc.dailyYieldEntityId ?? ''}
                              onChange={(e) =>
                                patchTech({ dailyYieldEntityId: e.target.value || undefined })
                              }
                              placeholder="z.B. sensor.hausverbrauch_heute_kwh"
                              className="w-full bg-slate-900 border border-white/15 rounded px-2 py-1 text-[11px] font-mono text-slate-200"
                            />
                          </div>
                        </div>
                      )}

                      {isSmartHub && (
                        <div className="grid grid-cols-1 gap-2">
                          <div>
                            <label className="block text-[10px] text-slate-300 mb-0.5">
                              CPU-Last / System-Auslastung (%)
                            </label>
                            <input
                              type="text"
                              list="ha-entity-datalist-tech"
                              value={
                                tc.cpuLoadEntityId ||
                                selectedAsset.entityId ||
                                'sensor.smarthome_hub_cpu'
                              }
                              onChange={(e) =>
                                patchTech({ cpuLoadEntityId: e.target.value || undefined })
                              }
                              className="w-full bg-slate-900 border border-white/15 rounded px-2 py-1 text-[11px] font-mono text-sky-200"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] text-slate-300 mb-0.5">
                              Server- / Gehäuse-Temperatur (°C)
                            </label>
                            <input
                              type="text"
                              list="ha-entity-datalist-tech"
                              value={tc.storageTempEntityId ?? ''}
                              onChange={(e) =>
                                patchTech({ storageTempEntityId: e.target.value || undefined })
                              }
                              placeholder="z.B. sensor.processor_temperature"
                              className="w-full bg-slate-900 border border-white/15 rounded px-2 py-1 text-[11px] font-mono text-amber-200"
                            />
                          </div>
                        </div>
                      )}

                      <datalist id="ha-entity-datalist-tech">
                        {entityIds.map((id) => (
                          <option key={id} value={id}>
                            {entities[id]?.attributes.friendly_name || id}
                          </option>
                        ))}
                      </datalist>
                    </div>
                  );
                })()}

              {/* HEIZKÖRPER-KONFIGURATOR (Wand-Snap, Typ, Breite, Höhe & Farbe) */}
              {isRadiatorAsset(selectedAsset.catalogId) &&
                (() => {
                  const catMeta = ASSET_CATALOG.find((c) => c.id === selectedAsset.catalogId);
                  const rc = selectedAsset.radiatorConfig || {};
                  const curType: RadiatorType =
                    rc.radiatorType ||
                    (selectedAsset.catalogId === 'bathroom_towel_radiator'
                      ? 'towel_bathroom'
                      : selectedAsset.catalogId === 'wall_radiator_modern'
                      ? 'vertical_designer'
                      : 'flat_panel');
                  const curW =
                    selectedAsset.customLength ??
                    selectedAsset.customWidth ??
                    catMeta?.width ??
                    1.1;
                  const curH =
                    selectedAsset.customHeight ??
                    (curType === 'vertical_designer'
                      ? 1.8
                      : curType === 'towel_bathroom'
                      ? 1.5
                      : 0.6);
                  const curColor = rc.color || selectedAsset.customColor || '#f8fafc';
                  const snapEnabled = rc.snapToWall !== false;

                  return (
                    <div className="p-3 rounded-xl bg-slate-950 border border-rose-400/35 space-y-2.5">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-rose-300">
                          🔥 Heizkörper: Typ, Maß & Wand-Snap
                        </span>
                        <span className="text-[10px] font-mono text-amber-300">
                          {curW.toFixed(2)} × {curH.toFixed(2)} m
                        </span>
                      </div>

                      {/* Radiator Type Selector */}
                      <div>
                        <div className="text-[10px] text-slate-400 mb-1">Bauform / Typ:</div>
                        <div className="grid grid-cols-2 gap-1">
                          {(
                            [
                              { id: 'flat_panel', label: 'Flachheizkörper' },
                              { id: 'ribbed_classic', label: 'Rippenheizkörper' },
                              { id: 'towel_bathroom', label: 'Bad-Handtuch' },
                              { id: 'vertical_designer', label: 'Vertikal-Design' },
                            ] as { id: RadiatorType; label: string }[]
                          ).map((rt) => (
                            <button
                              key={rt.id}
                              type="button"
                              onClick={() => {
                                const defaultH =
                                  rt.id === 'vertical_designer'
                                    ? 1.8
                                    : rt.id === 'towel_bathroom'
                                    ? 1.5
                                    : 0.6;
                                const defaultW =
                                  rt.id === 'vertical_designer' || rt.id === 'towel_bathroom'
                                    ? 0.6
                                    : 1.1;
                                onUpdateAsset(selectedAsset.id, {
                                  customLength: defaultW,
                                  customWidth: defaultW,
                                  customHeight: defaultH,
                                  radiatorConfig: { ...rc, radiatorType: rt.id },
                                });
                              }}
                              className={`py-1.5 px-2 rounded-lg text-[10px] font-semibold transition-colors ${
                                curType === rt.id
                                  ? 'bg-rose-400 text-slate-950 font-bold'
                                  : 'bg-slate-900 text-slate-300 hover:bg-slate-800 border border-white/10'
                              }`}
                            >
                              {rt.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Width & Height Sliders */}
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <div className="flex justify-between text-[10px] text-slate-300 mb-0.5">
                            <span>Breite</span>
                            <span className="font-mono text-amber-300">{curW.toFixed(2)} m</span>
                          </div>
                          <input
                            type="range"
                            min={0.35}
                            max={2.4}
                            step={0.05}
                            value={curW}
                            onChange={(e) => {
                              const w = parseFloat(e.target.value);
                              onUpdateAsset(selectedAsset.id, {
                                customLength: w,
                                customWidth: w,
                              });
                            }}
                            className="w-full accent-rose-400"
                          />
                        </div>
                        <div>
                          <div className="flex justify-between text-[10px] text-slate-300 mb-0.5">
                            <span>Höhe</span>
                            <span className="font-mono text-amber-300">{curH.toFixed(2)} m</span>
                          </div>
                          <input
                            type="range"
                            min={0.3}
                            max={2.2}
                            step={0.05}
                            value={curH}
                            onChange={(e) =>
                              onUpdateAsset(selectedAsset.id, {
                                customHeight: parseFloat(e.target.value),
                              })
                            }
                            className="w-full accent-rose-400"
                          />
                        </div>
                      </div>

                      {/* Radiator Color Swatches */}
                      <div className="flex items-center justify-between gap-2 pt-1 border-t border-white/10">
                        <span className="text-[10px] text-slate-400">Lackierung:</span>
                        <div className="flex items-center gap-1">
                          {[
                            { hex: '#f8fafc', label: 'Reinweiß' },
                            { hex: '#334155', label: 'Anthrazit' },
                            { hex: '#18181b', label: 'Mattschwarz' },
                            { hex: '#cbd5e1', label: 'Chrom / Alu' },
                            { hex: '#d6c7b2', label: 'Sandbeige' },
                          ].map((sw) => (
                            <button
                              key={sw.hex}
                              type="button"
                              onClick={() =>
                                onUpdateAsset(selectedAsset.id, {
                                  customColor: sw.hex,
                                  radiatorConfig: { ...rc, color: sw.hex },
                                })
                              }
                              title={sw.label}
                              style={{ backgroundColor: sw.hex }}
                              className={`w-5 h-5 rounded-full border ${
                                curColor === sw.hex
                                  ? 'border-amber-400 ring-2 ring-amber-400/50 scale-110'
                                  : 'border-white/30'
                              }`}
                            />
                          ))}
                          <input
                            type="color"
                            value={curColor}
                            onChange={(e) =>
                              onUpdateAsset(selectedAsset.id, {
                                customColor: e.target.value,
                                radiatorConfig: { ...rc, color: e.target.value },
                              })
                            }
                            className="w-5 h-5 rounded bg-transparent border border-white/20 cursor-pointer"
                          />
                        </div>
                      </div>

                      {/* Magnetic Wall Snap Toggle & Instant Snap Action */}
                      <div className="flex items-center gap-1.5 pt-1 border-t border-white/10">
                        <button
                          type="button"
                          onClick={() =>
                            onUpdateAsset(selectedAsset.id, {
                              radiatorConfig: { ...rc, snapToWall: !snapEnabled },
                            })
                          }
                          className={`flex-1 py-1.5 px-2 rounded-lg text-[10px] font-semibold border transition-colors ${
                            snapEnabled
                              ? 'bg-emerald-500/20 text-emerald-300 border-emerald-400/40'
                              : 'bg-slate-900 text-slate-400 border-white/10'
                          }`}
                        >
                          🧲 Wand-Snap {snapEnabled ? 'AN' : 'AUS'}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const floorZones = project.zones.filter(
                              (z) => (z.level ?? 0) === (selectedAsset.level ?? 0)
                            );
                            const foot = getAssetEffectiveFootprint(selectedAsset, catMeta);
                            const snapped = snapAssetToNearestRoomWall(
                              selectedAsset.position[0],
                              selectedAsset.position[2],
                              foot.widthM,
                              foot.depthM,
                              floorZones,
                              0.05,
                              3.5
                            );
                            if (snapped) {
                              onUpdateAsset(selectedAsset.id, {
                                position: [snapped.x, selectedAsset.position[1], snapped.z],
                                rotationY: snapped.rotationY,
                              });
                            }
                          }}
                          className="py-1.5 px-2.5 rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 text-[10px] font-bold transition-colors"
                        >
                          Jetzt an Wand snappen
                        </button>
                      </div>
                    </div>
                  );
                })()}

              {/* AKUSTIKPANEEL-KONFIGURATOR (Holzton, Breite, Höhe & Wand-Snap) */}
              {isAcousticPanelAsset(selectedAsset.catalogId) &&
                (() => {
                  const catMeta = ASSET_CATALOG.find((c) => c.id === selectedAsset.catalogId);
                  const ac = selectedAsset.acousticPanelConfig || {};
                  const curTone: AcousticWoodTone = ac.woodTone || 'oak_natural';
                  const curW =
                    selectedAsset.customLength ??
                    selectedAsset.customWidth ??
                    catMeta?.width ??
                    1.2;
                  const curH = selectedAsset.customHeight ?? 2.4;

                  return (
                    <div className="p-3 rounded-xl bg-slate-950 border border-amber-400/35 space-y-2.5">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-amber-300">
                          🪵 Akustikpaneel: Holzton, Breite & Höhe
                        </span>
                        <span className="text-[10px] font-mono text-sky-300">
                          {curW.toFixed(2)} × {curH.toFixed(2)} m
                        </span>
                      </div>

                      <div>
                        <div className="text-[10px] text-slate-400 mb-1">Holzton der Lamellen:</div>
                        <div className="grid grid-cols-2 gap-1">
                          {(
                            [
                              { id: 'oak_natural', label: 'Natur-Eiche', swatch: '#b68652' },
                              { id: 'walnut_dark', label: 'Dunkel-Nussbaum', swatch: '#5c3a21' },
                              { id: 'ash_light', label: 'Hell-Esche', swatch: '#d6c1a3' },
                              { id: 'teak_warm', label: 'Teak Warm', swatch: '#9a5b25' },
                              { id: 'charcoal_black', label: 'Räuchereiche Schwarz', swatch: '#27272a' },
                            ] as { id: AcousticWoodTone; label: string; swatch: string }[]
                          ).map((wt) => (
                            <button
                              key={wt.id}
                              type="button"
                              onClick={() =>
                                onUpdateAsset(selectedAsset.id, {
                                  acousticPanelConfig: { ...ac, woodTone: wt.id },
                                })
                              }
                              className={`flex items-center gap-1.5 py-1.5 px-2 rounded-lg text-[10px] font-semibold transition-colors ${
                                curTone === wt.id
                                  ? 'bg-amber-400 text-slate-950 font-bold'
                                  : 'bg-slate-900 text-slate-300 hover:bg-slate-800 border border-white/10'
                              }`}
                            >
                              <span
                                className="w-3 h-3 rounded-full border border-black/30 shrink-0"
                                style={{ backgroundColor: wt.swatch }}
                              />
                              <span className="truncate">{wt.label}</span>
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <div className="flex justify-between text-[10px] text-slate-300 mb-0.5">
                            <span>Breite</span>
                            <span className="font-mono text-amber-300">{curW.toFixed(2)} m</span>
                          </div>
                          <input
                            type="range"
                            min={0.4}
                            max={4.0}
                            step={0.1}
                            value={curW}
                            onChange={(e) => {
                              const w = parseFloat(e.target.value);
                              onUpdateAsset(selectedAsset.id, {
                                customLength: w,
                                customWidth: w,
                              });
                            }}
                            className="w-full accent-amber-400"
                          />
                        </div>
                        <div>
                          <div className="flex justify-between text-[10px] text-slate-300 mb-0.5">
                            <span>Höhe</span>
                            <span className="font-mono text-amber-300">{curH.toFixed(2)} m</span>
                          </div>
                          <input
                            type="range"
                            min={0.6}
                            max={3.0}
                            step={0.05}
                            value={curH}
                            onChange={(e) =>
                              onUpdateAsset(selectedAsset.id, {
                                customHeight: parseFloat(e.target.value),
                              })
                            }
                            className="w-full accent-amber-400"
                          />
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          const floorZones = project.zones.filter(
                            (z) => (z.level ?? 0) === (selectedAsset.level ?? 0)
                          );
                          const foot = getAssetEffectiveFootprint(selectedAsset, catMeta);
                          const snapped = snapAssetToNearestRoomWall(
                            selectedAsset.position[0],
                            selectedAsset.position[2],
                            foot.widthM,
                            foot.depthM,
                            floorZones,
                            0.05,
                            3.5
                          );
                          if (snapped) {
                            onUpdateAsset(selectedAsset.id, {
                              position: [snapped.x, selectedAsset.position[1], snapped.z],
                              rotationY: snapped.rotationY,
                            });
                          }
                        }}
                        className="w-full py-1.5 px-2.5 rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 text-[10px] font-bold transition-colors"
                      >
                        🧲 Jetzt bündig an nächste Raumwand snappen
                      </button>
                    </div>
                  );
                })()}

              {/* SOFA- & WOHNLANDSCHAFT-KONFIGURATOR (Formen, Ottomane/Hocker, Stoff-Farbe & Maße) */}
              {isSofaAsset(selectedAsset.catalogId) &&
                (() => {
                  const catMeta = ASSET_CATALOG.find((c) => c.id === selectedAsset.catalogId);
                  const sc = selectedAsset.sofaConfig || {};
                  const curShape: SofaShapeType = sc.shape || 'l_right';
                  const curW =
                    selectedAsset.customLength ??
                    selectedAsset.customWidth ??
                    catMeta?.width ??
                    2.65;
                  const curD =
                    selectedAsset.customDepth ??
                    (curShape === 'single' ? 1.0 : catMeta?.depth ?? 2.35);
                  const curFabric = sc.fabricColor || selectedAsset.customColor || '#4b5563';
                  const curCushion = sc.cushionColor || '#94a3b8';

                  return (
                    <div className="p-3 rounded-xl bg-slate-950 border border-sky-400/35 space-y-2.5">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-sky-300">
                          🛋️ Sofa-Form, Hocker & Stoff-Farbe
                        </span>
                        <span className="text-[10px] font-mono text-amber-300">
                          {curW.toFixed(2)} × {curD.toFixed(2)} m
                        </span>
                      </div>

                      {/* Sofa Shape Selector */}
                      <div>
                        <div className="text-[10px] text-slate-400 mb-1">Sofa-Form wählen:</div>
                        <div className="grid grid-cols-2 gap-1">
                          {(
                            [
                              { id: 'single', label: 'Einzelsofa (Gerade)' },
                              { id: 'l_left', label: 'L-Form (Recamiere links)' },
                              { id: 'l_right', label: 'L-Form (Recamiere rechts)' },
                              { id: 'u_shape', label: 'U-Wohnlandschaft (XXL)' },
                            ] as { id: SofaShapeType; label: string }[]
                          ).map((sh) => (
                            <button
                              key={sh.id}
                              type="button"
                              onClick={() => {
                                const nextD =
                                  sh.id === 'single'
                                    ? 1.05
                                    : Math.max(2.1, selectedAsset.customDepth ?? 2.35);
                                const nextW =
                                  sh.id === 'u_shape'
                                    ? Math.max(3.1, curW)
                                    : curW;
                                onUpdateAsset(selectedAsset.id, {
                                  customLength: nextW,
                                  customWidth: nextW,
                                  customDepth: nextD,
                                  sofaConfig: { ...sc, shape: sh.id },
                                });
                              }}
                              className={`py-1.5 px-2 rounded-lg text-[10px] font-semibold transition-colors ${
                                curShape === sh.id
                                  ? 'bg-sky-400 text-slate-950 font-bold'
                                  : 'bg-slate-900 text-slate-300 hover:bg-slate-800 border border-white/10'
                              }`}
                            >
                              {sh.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Ottoman & Coffee Table Toggles */}
                      <div className="grid grid-cols-2 gap-1.5">
                        <button
                          type="button"
                          onClick={() =>
                            onUpdateAsset(selectedAsset.id, {
                              sofaConfig: { ...sc, hasOttoman: !sc.hasOttoman },
                            })
                          }
                          className={`py-1.5 px-2 rounded-lg text-[10px] font-semibold border transition-colors ${
                            sc.hasOttoman
                              ? 'bg-amber-400 text-slate-950 font-bold border-amber-300'
                              : 'bg-slate-900 text-slate-300 border-white/10 hover:bg-slate-800'
                          }`}
                        >
                          {sc.hasOttoman ? '✓ Hocker / Ottomane AN' : '+ Hocker / Ottomane'}
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            onUpdateAsset(selectedAsset.id, {
                              sofaConfig: {
                                ...sc,
                                showCoffeeTableAndRug: sc.showCoffeeTableAndRug === false,
                              },
                            })
                          }
                          className={`py-1.5 px-2 rounded-lg text-[10px] font-semibold border transition-colors ${
                            sc.showCoffeeTableAndRug !== false
                              ? 'bg-emerald-500/20 text-emerald-300 border-emerald-400/40'
                              : 'bg-slate-900 text-slate-400 border-white/10 hover:bg-slate-800'
                          }`}
                        >
                          Tisch & Teppich {sc.showCoffeeTableAndRug !== false ? 'AN' : 'AUS'}
                        </button>
                      </div>

                      {/* Width & Depth Sliders */}
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <div className="flex justify-between text-[10px] text-slate-300 mb-0.5">
                            <span>Gesamtbreite</span>
                            <span className="font-mono text-amber-300">{curW.toFixed(2)} m</span>
                          </div>
                          <input
                            type="range"
                            min={1.6}
                            max={4.2}
                            step={0.05}
                            value={curW}
                            onChange={(e) => {
                              const w = parseFloat(e.target.value);
                              onUpdateAsset(selectedAsset.id, {
                                customLength: w,
                                customWidth: w,
                              });
                            }}
                            className="w-full accent-sky-400"
                          />
                        </div>
                        <div>
                          <div className="flex justify-between text-[10px] text-slate-300 mb-0.5">
                            <span>Gesamttiefe</span>
                            <span className="font-mono text-amber-300">{curD.toFixed(2)} m</span>
                          </div>
                          <input
                            type="range"
                            min={0.85}
                            max={3.2}
                            step={0.05}
                            value={curD}
                            onChange={(e) =>
                              onUpdateAsset(selectedAsset.id, {
                                customDepth: parseFloat(e.target.value),
                              })
                            }
                            className="w-full accent-sky-400"
                          />
                        </div>
                      </div>

                      {/* Free Fabric & Cushion Color Picker */}
                      <div className="pt-1.5 border-t border-white/10 space-y-1.5">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[10px] text-slate-300 font-semibold">
                            Stoff-Farbe:
                          </span>
                          <div className="flex items-center gap-1 flex-wrap justify-end">
                            {[
                              { hex: '#4b5563', label: 'Schiefergrau' },
                              { hex: '#d6cfc2', label: 'Creme-Bouclé' },
                              { hex: '#9a5b32', label: 'Cognac-Leder' },
                              { hex: '#1e3a2f', label: 'Waldgrün-Samt' },
                              { hex: '#1e3a5f', label: 'Ozeanblau' },
                              { hex: '#7f1d1d', label: 'Terrakotta-Bordeaux' },
                              { hex: '#18181b', label: 'Anthrazit-Schwarz' },
                            ].map((sw) => (
                              <button
                                key={sw.hex}
                                type="button"
                                onClick={() =>
                                  onUpdateAsset(selectedAsset.id, {
                                    customColor: sw.hex,
                                    sofaConfig: { ...sc, fabricColor: sw.hex },
                                  })
                                }
                                title={sw.label}
                                style={{ backgroundColor: sw.hex }}
                                className={`w-4 h-4 rounded-full border ${
                                  curFabric === sw.hex
                                    ? 'border-amber-400 ring-2 ring-amber-400/50 scale-110'
                                    : 'border-white/30'
                                }`}
                              />
                            ))}
                            <input
                              type="color"
                              value={curFabric}
                              onChange={(e) =>
                                onUpdateAsset(selectedAsset.id, {
                                  customColor: e.target.value,
                                  sofaConfig: { ...sc, fabricColor: e.target.value },
                                })
                              }
                              className="w-5 h-5 rounded bg-transparent border border-white/20 cursor-pointer"
                            />
                          </div>
                        </div>

                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[10px] text-slate-400">Zierkissen-Farbe:</span>
                          <input
                            type="color"
                            value={curCushion}
                            onChange={(e) =>
                              onUpdateAsset(selectedAsset.id, {
                                sofaConfig: { ...sc, cushionColor: e.target.value },
                              })
                            }
                            className="w-6 h-5 rounded bg-transparent border border-white/20 cursor-pointer"
                          />
                        </div>
                      </div>
                    </div>
                  );
                })()}

              {/* WAND-PLANER EINBAUMODUL-INSPEKTOR (Küche, Wohnwand, Garderobe & Schränke) */}
              {isWallModuleAsset(selectedAsset.catalogId) &&
                (() => {
                  const wm = selectedAsset.wallModuleConfig;
                  if (!wm) return null;
                  const curW = selectedAsset.customLength ?? selectedAsset.customWidth ?? 0.6;
                  const curD = selectedAsset.customDepth ?? 0.6;
                  const curH = selectedAsset.customHeight ?? 2.15;

                  return (
                    <div className="p-3 rounded-xl bg-slate-950 border border-amber-400/40 space-y-2.5">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-amber-300">
                          🧱 Wand-Einbaumodul ({wm.category === 'kitchen' ? 'Küche' : wm.category === 'living_wall' ? 'Wohnwand' : wm.category === 'wardrobe' ? 'Garderobe' : 'Schrank'})
                        </span>
                        <span className="text-[10px] font-mono text-sky-300">
                          {Math.round(curW * 100)} cm
                        </span>
                      </div>

                      <div className="grid grid-cols-3 gap-1.5">
                        <div>
                          <div className="text-[10px] text-slate-400 mb-0.5">Breite (m)</div>
                          <input
                            type="number"
                            step={0.05}
                            min={0.3}
                            max={3.0}
                            value={curW}
                            onChange={(e) => {
                              const w = parseFloat(e.target.value) || 0.6;
                              onUpdateAsset(selectedAsset.id, {
                                customLength: w,
                                customWidth: w,
                              });
                            }}
                            className="w-full bg-slate-900 border border-white/15 rounded px-1.5 py-1 text-xs font-mono text-white"
                          />
                        </div>
                        <div>
                          <div className="text-[10px] text-slate-400 mb-0.5">Tiefe (m)</div>
                          <input
                            type="number"
                            step={0.05}
                            min={0.25}
                            max={1.2}
                            value={curD}
                            onChange={(e) =>
                              onUpdateAsset(selectedAsset.id, {
                                customDepth: parseFloat(e.target.value) || 0.6,
                              })
                            }
                            className="w-full bg-slate-900 border border-white/15 rounded px-1.5 py-1 text-xs font-mono text-white"
                          />
                        </div>
                        <div>
                          <div className="text-[10px] text-slate-400 mb-0.5">Höhe (m)</div>
                          <input
                            type="number"
                            step={0.05}
                            min={0.4}
                            max={2.8}
                            value={curH}
                            onChange={(e) =>
                              onUpdateAsset(selectedAsset.id, {
                                customHeight: parseFloat(e.target.value) || 2.15,
                              })
                            }
                            className="w-full bg-slate-900 border border-white/15 rounded px-1.5 py-1 text-xs font-mono text-white"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2 pt-1 border-t border-white/10">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] text-slate-300">Frontfarbe:</span>
                          <input
                            type="color"
                            value={wm.frontColor || '#f8fafc'}
                            onChange={(e) =>
                              onUpdateAsset(selectedAsset.id, {
                                customColor: e.target.value,
                                wallModuleConfig: { ...wm, frontColor: e.target.value },
                              })
                            }
                            className="w-6 h-5 rounded bg-transparent border border-white/20 cursor-pointer"
                          />
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] text-slate-300">Platte / Korpus:</span>
                          <input
                            type="color"
                            value={wm.countertopColor || '#b48352'}
                            onChange={(e) =>
                              onUpdateAsset(selectedAsset.id, {
                                wallModuleConfig: { ...wm, countertopColor: e.target.value },
                              })
                            }
                            className="w-6 h-5 rounded bg-transparent border border-white/20 cursor-pointer"
                          />
                        </div>
                      </div>

                      {onOpenWallPlanner && wm.hostZoneId && (
                        <button
                          type="button"
                          onClick={() =>
                            onOpenWallPlanner(wm.hostZoneId!, wm.wallSide, wm.category)
                          }
                          className="w-full py-2 px-3 rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-bold transition-colors shadow"
                        >
                          🧱 Komplette Wand im Wand-Planer bearbeiten
                        </button>
                      )}
                    </div>
                  );
                })()}

              {/* Rotation & Scale */}
              <div className="grid grid-cols-2 gap-3 pt-2 border-t border-white/10">
                <div>
                  <div className="text-xs text-slate-400 mb-1">Drehung (Y)</div>
                  <button
                    type="button"
                    onClick={() =>
                      onUpdateAsset(selectedAsset.id, {
                        rotationY: (selectedAsset.rotationY + Math.PI / 2) % (Math.PI * 2),
                      })
                    }
                    className="w-full flex items-center justify-center gap-1.5 py-1.5 px-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium text-white whitespace-nowrap"
                  >
                    <RotateCw className="w-3.5 h-3.5 text-amber-400" />
                    <span>+90° drehen</span>
                  </button>
                </div>
                <div>
                  <div className="text-xs text-slate-400 mb-1">
                    Skalierung ({selectedAsset.scale.toFixed(2)}×)
                  </div>
                  <input
                    type="range"
                    min={0.5}
                    max={2.0}
                    step={0.05}
                    value={selectedAsset.scale}
                    onChange={(e) =>
                      onUpdateAsset(selectedAsset.id, {
                        scale: parseFloat(e.target.value),
                      })
                    }
                    className="w-full accent-amber-400 mt-2"
                  />
                </div>
              </div>
            </>
          ) : selectedOpening ? (
            <>
              <div className="flex items-start justify-between gap-2 pb-2.5 border-b border-white/10">
                <div className="flex-1">
                  <div className="text-[11px] text-sky-400 font-medium">
                    Fenster & Türen: Maß, Design, Farbe, Anschlag & Sensorik
                  </div>
                  <input
                    type="text"
                    value={selectedOpening.name}
                    onChange={(e) =>
                      onUpdateOpening(selectedOpening.id, { name: e.target.value })
                    }
                    className="mt-1 w-full bg-slate-900 border border-white/10 rounded px-2 py-1 text-xs font-semibold text-white"
                  />
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    title={
                      selectedOpening.locked
                        ? 'Öffnung entsperren'
                        : 'Öffnung sperren (gegen versehentliches Verschieben)'
                    }
                    onClick={() =>
                      onUpdateOpening(selectedOpening.id, { locked: !selectedOpening.locked })
                    }
                    className={`p-1.5 rounded-lg border transition-colors ${
                      selectedOpening.locked
                        ? 'bg-amber-400 text-slate-950 border-amber-300 font-bold'
                        : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-white/10'
                    }`}
                  >
                    {selectedOpening.locked ? (
                      <Lock className="w-3.5 h-3.5" />
                    ) : (
                      <Unlock className="w-3.5 h-3.5" />
                    )}
                  </button>
                  <button
                    type="button"
                    disabled={Boolean(selectedOpening.locked)}
                    onClick={() => onDeleteOpening(selectedOpening.id)}
                    className={`p-1.5 rounded-lg ${
                      selectedOpening.locked
                        ? 'bg-slate-900 text-slate-600 cursor-not-allowed'
                        : 'bg-red-500/20 hover:bg-red-500/30 text-red-300'
                    }`}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <div className="space-y-3.5">
                {/* Floor Level & Opening Type */}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] text-slate-300 mb-1">
                      Stockwerk / Etage
                    </label>
                    <div className="grid grid-cols-4 gap-1">
                      {FLOOR_OPTIONS.map((fo) => (
                        <button
                          key={fo.level}
                          type="button"
                          onClick={() =>
                            onUpdateOpening(selectedOpening.id, { level: fo.level })
                          }
                          className={`py-1 rounded text-[11px] font-semibold ${
                            (selectedOpening.level ?? 0) === fo.level
                              ? 'bg-amber-400 text-slate-950'
                              : 'bg-slate-900 text-slate-300 hover:bg-slate-800'
                          }`}
                        >
                          {fo.short}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] text-slate-300 mb-1">
                      Bauart / Typ
                    </label>
                    <select
                      value={selectedOpening.type}
                      onChange={(e) => {
                        const nextType = e.target.value as WallOpeningType;
                        onUpdateOpening(selectedOpening.id, {
                          type: nextType,
                          sillHeight:
                            nextType === 'window' || nextType === 'glass_block_window'
                              ? 0.85
                              : nextType === 'floor_window'
                              ? 0.15
                              : 0.0,
                        });
                      }}
                      className="w-full bg-slate-900 border border-white/15 rounded-lg px-2 py-1.5 text-[11px] text-white"
                    >
                      <option value="window">Fenster (mit Brüstung)</option>
                      <option value="floor_window">Bodentiefes Fenster</option>
                      <option value="glass_block_window">Glasbausteine / Glasbaustein-Wandfeld</option>
                      <option value="double_patio_door">Hebeschiebetür</option>
                      <option value="door">Haustür / Innentür</option>
                      <option value="garage_door">Garagen-/Rolltor</option>
                    </select>
                  </div>
                </div>

                {/* 1. ANSCHLAG (LINKS/RECHTS), ÖFFNUNGSRICHTUNG (INNEN/AUSSEN), FLÜGEL, FARBE & ARCHITEKTUR-DESIGN */}
                <div className="p-3 rounded-xl bg-slate-950 border border-sky-400/30 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-sky-300">
                      Anschlag, Farbe & Architektur-Design
                    </span>
                    <span className="text-[10px] font-mono text-slate-400">
                      Nur im Editor
                    </span>
                  </div>

                  {/* Hinge Side: DIN Links vs DIN Rechts */}
                  <div>
                    <div className="text-[10px] text-slate-400 mb-1">
                      {selectedOpening.type === 'double_patio_door'
                        ? 'Schieberichtung des beweglichen Flügels'
                        : 'Anschlag / Scharnierseite (DIN Links / DIN Rechts)'}
                    </div>
                    <div className="grid grid-cols-2 gap-1.5">
                      <button
                        type="button"
                        onClick={() =>
                          onUpdateOpening(selectedOpening.id, { hingeSide: 'left' })
                        }
                        className={`py-1.5 px-2 rounded-lg text-xs font-semibold transition-colors ${
                          (selectedOpening.hingeSide || 'left') === 'left'
                            ? 'bg-sky-400 text-slate-950 font-bold'
                            : 'bg-slate-900 text-slate-300 hover:bg-slate-800 border border-white/10'
                        }`}
                      >
                        ⇤ Anschlag Links (DIN-L)
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          onUpdateOpening(selectedOpening.id, { hingeSide: 'right' })
                        }
                        className={`py-1.5 px-2 rounded-lg text-xs font-semibold transition-colors ${
                          selectedOpening.hingeSide === 'right'
                            ? 'bg-sky-400 text-slate-950 font-bold'
                            : 'bg-slate-900 text-slate-300 hover:bg-slate-800 border border-white/10'
                        }`}
                      >
                        Anschlag Rechts (DIN-R) ⇥
                      </button>
                    </div>
                  </div>

                  {/* Open Direction: Nach Innen vs Nach Außen */}
                  <div>
                    <div className="text-[10px] text-slate-400 mb-1">
                      Öffnungsrichtung (Aufschlagseite in den Raum / nach Außen)
                    </div>
                    <div className="grid grid-cols-2 gap-1.5">
                      <button
                        type="button"
                        onClick={() =>
                          onUpdateOpening(selectedOpening.id, {
                            openDirection: 'inward',
                          })
                        }
                        className={`py-1.5 px-2 rounded-lg text-xs font-semibold transition-colors ${
                          (selectedOpening.openDirection || 'inward') === 'inward'
                            ? 'bg-emerald-400 text-slate-950 font-bold'
                            : 'bg-slate-900 text-slate-300 hover:bg-slate-800 border border-white/10'
                        }`}
                      >
                        ↑ Nach Innen (Raumseite)
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          onUpdateOpening(selectedOpening.id, {
                            openDirection: 'outward',
                          })
                        }
                        className={`py-1.5 px-2 rounded-lg text-xs font-semibold transition-colors ${
                          selectedOpening.openDirection === 'outward'
                            ? 'bg-emerald-400 text-slate-950 font-bold'
                            : 'bg-slate-900 text-slate-300 hover:bg-slate-800 border border-white/10'
                        }`}
                      >
                        ↓ Nach Außen (Hofseite)
                      </button>
                    </div>
                  </div>

                  {/* Sash Count & Frame Color */}
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <div>
                      <label className="block text-[10px] text-slate-400 mb-0.5">
                        Flügelaufteilung
                      </label>
                      <select
                        value={String(selectedOpening.sashCount || 'auto')}
                        onChange={(e) => {
                          const v = e.target.value;
                          onUpdateOpening(selectedOpening.id, {
                            sashCount: v === '1' ? 1 : v === '2' ? 2 : 'auto',
                          });
                        }}
                        className="w-full bg-slate-900 border border-white/15 rounded px-2 py-1 text-[11px] text-white"
                      >
                        <option value="auto">Automatisch (ab 1,35m 2-flg.)</option>
                        <option value="1">1-flügelig (Ohne Pfosten)</option>
                        <option value="2">2-flügelig (Mit Mittelpfosten)</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] text-slate-400 mb-0.5">
                        Rahmen- / Türfarbe (9 Oberflächen)
                      </label>
                      <select
                        value={selectedOpening.frameColor || 'anthracite'}
                        onChange={(e) =>
                          onUpdateOpening(selectedOpening.id, {
                            frameColor: e.target.value as WallOpening['frameColor'],
                          })
                        }
                        className="w-full bg-slate-900 border border-white/15 rounded px-2 py-1 text-[11px] text-white"
                      >
                        <option value="anthracite">Anthrazitgrau (RAL 7016)</option>
                        <option value="white">Reinweiß (RAL 9016)</option>
                        <option value="oak">Eiche Natur (Echtholz)</option>
                        <option value="walnut">Nussbaum Dunkel (Edelholz)</option>
                        <option value="alu_silver">Gebürstetes Alu / Edelstahl</option>
                        <option value="matte_black">Tiefschwarz Matt (RAL 9005)</option>
                        <option value="sage_green">Salbeigrün (Landhaus)</option>
                        <option value="bronze_corten">Bronze / Corten-Eloxal</option>
                        <option value="burgundy_red">Weinrot / Klassik-Rot</option>
                      </select>
                    </div>
                  </div>

                  {/* Architectural Design Style (Sprossen, Loft, Haustür mit Lichtband/Stangengriff, Lamellen, Sektionaltor) */}
                  <div className="pt-1">
                    <label className="block text-[10px] text-amber-300 font-semibold mb-0.5">
                      Architektur-Design / Verglasung & Türblatt
                    </label>
                    <select
                      value={
                        selectedOpening.openingDesign ||
                        (selectedOpening.type === 'door'
                          ? 'modern_flush'
                          : selectedOpening.type === 'garage_door'
                          ? 'sectional_modern'
                          : 'modern_single')
                      }
                      onChange={(e) =>
                        onUpdateOpening(selectedOpening.id, {
                          openingDesign: e.target.value as WallOpening['openingDesign'],
                        })
                      }
                      className="w-full bg-slate-900 border border-amber-400/35 rounded px-2 py-1.5 text-[11px] text-amber-200 font-medium"
                    >
                      {selectedOpening.type === 'door' ? (
                        <>
                          <option value="modern_flush">
                            Design-Haustür Glatt (mit Edelstahl-Stangengriff)
                          </option>
                          <option value="entrance_glass_sidelight">
                            Haustür mit vertikalem Milchglas-Lichtband & Stangengriff
                          </option>
                          <option value="entrance_wood_slats">
                            Architekten-Haustür mit Akustik-Lamellen & Stangengriff
                          </option>
                          <option value="classic_panel_cottage">
                            Klassische Kassettentür (Landhaus-Profilrahmen)
                          </option>
                          <option value="full_glass_office">
                            Moderne Vollglas-Tür (Klarglas mit Beschlag)
                          </option>
                        </>
                      ) : selectedOpening.type === 'garage_door' ? (
                        <>
                          <option value="sectional_modern">
                            Großlamellen-Sektionaltor (Modern glatt, 100% bündig)
                          </option>
                          <option value="sectional_wood_ribbed">
                            Holz-/Struktur-Sektionaltor mit feiner Sicke
                          </option>
                          <option value="sectional_flush_glass">
                            Design-Sektionaltor mit Panorama-Lichtband
                          </option>
                          <option value="up_and_over_classic">
                            Klassisches Schwingtor / Kipptor (Vertikalsicke)
                          </option>
                          <option value="roller_shutter_gate">
                            Motorisiertes Lamellen-Rolltor
                          </option>
                          <option value="double_wing_gate">
                            Zweiflügel-Garagentor / Scheunentor (mit Sprossenfenster)
                          </option>
                        </>
                      ) : (
                        <>
                          <option value="modern_single">
                            Modern Klarglas (3-fach Isolierglas ohne Sprossen)
                          </option>
                          <option value="mullion_cross">
                            Klassisches Sprossenfenster (Wiener Kreuzsprossen)
                          </option>
                          <option value="industrial_loft">
                            Industrial Steel-Loft (Schwarze Metallsprossen-Raster)
                          </option>
                          <option value="frosted_privacy">
                            Milchglas / Satiniert (Sichtschutz für Bad & WC)
                          </option>
                          <option value="arched_classic">
                            Klassik-Fenster mit Oberlicht-Kämpferprofil
                          </option>
                        </>
                      )}
                    </select>
                  </div>

                  {/* Direct 3D Opening / Tilt Preview Test for ALL Windows & Doors */}
                  <div className="pt-1 border-t border-white/10">
                    <div className="text-[10px] text-slate-400 mb-1">
                      3D-Anschlag & Öffnung direkt im Modell testen:
                    </div>
                    <div className="grid grid-cols-3 gap-1">
                      {(
                        [
                          { id: 'closed', label: 'Geschlossen' },
                          { id: 'tilted', label: 'Gekippt (14°)' },
                          { id: 'open', label: 'Geöffnet (90°)' },
                        ] as const
                      ).map((stBtn) => {
                        const currentResolved = resolveOpeningSensorState(
                          selectedOpening,
                          entities
                        );
                        const active = currentResolved === stBtn.id;
                        return (
                          <button
                            key={stBtn.id}
                            type="button"
                            onClick={() => {
                              onUpdateOpening(selectedOpening.id, {
                                previewStateOverride: stBtn.id,
                                openPositionPct:
                                  stBtn.id === 'open'
                                    ? selectedOpening.openPositionPct || 100
                                    : 0,
                              });
                              onSetDualSensorTestState?.(selectedOpening.id, stBtn.id);
                            }}
                            className={`py-1.5 px-1.5 rounded text-[11px] font-bold transition-colors ${
                              active
                                ? stBtn.id === 'tilted'
                                  ? 'bg-amber-400 text-slate-950'
                                  : stBtn.id === 'open'
                                  ? 'bg-sky-400 text-slate-950'
                                  : 'bg-emerald-400 text-slate-950'
                                : 'bg-slate-900 text-slate-300 hover:bg-slate-800'
                            }`}
                          >
                            {stBtn.label}
                          </button>
                        );
                      })}
                    </div>

                    {/* Stufenloser 3D-Öffnungsgrad-Slider (0% .. 100%) */}
                    <div className="pt-2">
                      <div className="flex items-center justify-between text-[10px] text-slate-300 mb-1">
                        <span>Stufenlose 3D-Öffnung / Aufstellwinkel</span>
                        <span className="font-mono text-sky-300 tabular-nums">
                          {selectedOpening.openPositionPct ??
                            (resolveOpeningSensorState(selectedOpening, entities) === 'open'
                              ? 100
                              : 0)}
                          %
                        </span>
                      </div>
                      <input
                        type="range"
                        min={0}
                        max={100}
                        step={5}
                        value={
                          selectedOpening.openPositionPct ??
                          (resolveOpeningSensorState(selectedOpening, entities) === 'open'
                            ? 100
                            : 0)
                        }
                        onChange={(e) => {
                          const pct = parseInt(e.target.value, 10);
                          onUpdateOpening(selectedOpening.id, {
                            openPositionPct: pct,
                            previewStateOverride: pct > 0 ? 'open' : 'closed',
                          });
                        }}
                        className="w-full accent-sky-400"
                      />
                    </div>
                  </div>
                </div>

                {/* 2. GRÖSSE (BREITE / HÖHE) & HÖHE VOM BODEN (BRÜSTUNGSHÖHE) */}
                <div className="p-3 rounded-xl bg-slate-950 border border-white/12 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-white">
                      Größe & Höhe vom Boden (Brüstung)
                    </span>
                    <span className="text-[10px] font-mono text-amber-300 tabular-nums">
                      Sturz/Oberkante: {(selectedOpening.sillHeight + selectedOpening.height).toFixed(2)} m
                    </span>
                  </div>

                  {/* Breite (Width) */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-slate-300">Breite (m)</span>
                      <input
                        type="number"
                        step={0.05}
                        min={0.4}
                        max={6.0}
                        value={selectedOpening.width}
                        onChange={(e) =>
                          onUpdateOpening(selectedOpening.id, {
                            width: Math.max(0.4, parseFloat(e.target.value) || 1.0),
                          })
                        }
                        className="w-20 bg-slate-900 border border-white/15 rounded px-2 py-0.5 text-xs font-mono text-right text-amber-300 tabular-nums"
                      />
                    </div>
                    <input
                      type="range"
                      min={0.5}
                      max={5.0}
                      step={0.05}
                      value={Math.min(5.0, selectedOpening.width)}
                      onChange={(e) =>
                        onUpdateOpening(selectedOpening.id, {
                          width: parseFloat(e.target.value),
                        })
                      }
                      className="w-full accent-amber-400"
                    />
                    <div className="flex flex-wrap gap-1">
                      {[
                        { label: '0,88m (Tür)', w: 0.88 },
                        { label: '1,01m', w: 1.01 },
                        { label: '1,26m', w: 1.26 },
                        { label: '1,76m (2-flg)', w: 1.76 },
                        { label: '2,26m', w: 2.26 },
                        { label: '3,00m', w: 3.0 },
                      ].map((p) => (
                        <button
                          key={p.label}
                          type="button"
                          onClick={() =>
                            onUpdateOpening(selectedOpening.id, { width: p.w })
                          }
                          className="px-1.5 py-0.5 rounded bg-slate-900 hover:bg-slate-800 border border-white/10 text-[10px] font-mono text-slate-300"
                        >
                          {p.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Element-Höhe (Height) */}
                  <div className="space-y-1 pt-1 border-t border-white/8">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-slate-300">Element-Höhe (m)</span>
                      <input
                        type="number"
                        step={0.05}
                        min={0.4}
                        max={2.6}
                        value={selectedOpening.height}
                        onChange={(e) =>
                          onUpdateOpening(selectedOpening.id, {
                            height: Math.max(0.4, parseFloat(e.target.value) || 1.2),
                          })
                        }
                        className="w-20 bg-slate-900 border border-white/15 rounded px-2 py-0.5 text-xs font-mono text-right text-amber-300 tabular-nums"
                      />
                    </div>
                    <input
                      type="range"
                      min={0.45}
                      max={2.45}
                      step={0.05}
                      value={Math.min(2.45, selectedOpening.height)}
                      onChange={(e) =>
                        onUpdateOpening(selectedOpening.id, {
                          height: parseFloat(e.target.value),
                        })
                      }
                      className="w-full accent-amber-400"
                    />
                    <div className="flex flex-wrap gap-1">
                      {[
                        { label: '0,65m Keller/WC', h: 0.65 },
                        { label: '1,26m Standard', h: 1.26 },
                        { label: '1,45m Hoch', h: 1.45 },
                        { label: '2,05m Panorama', h: 2.05 },
                        { label: '2,13m Türmaß', h: 2.13 },
                      ].map((p) => (
                        <button
                          key={p.label}
                          type="button"
                          onClick={() =>
                            onUpdateOpening(selectedOpening.id, { height: p.h })
                          }
                          className="px-1.5 py-0.5 rounded bg-slate-900 hover:bg-slate-800 border border-white/10 text-[10px] font-mono text-slate-300"
                        >
                          {p.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Brüstungshöhe / Höhe vom Boden (Sill Height) */}
                  <div className="space-y-1 pt-1 border-t border-white/8">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-sky-300 font-semibold">
                        Höhe vom Boden / Brüstung (m)
                      </span>
                      <input
                        type="number"
                        step={0.05}
                        min={0}
                        max={2.1}
                        value={selectedOpening.sillHeight}
                        onChange={(e) =>
                          onUpdateOpening(selectedOpening.id, {
                            sillHeight: Math.max(0, parseFloat(e.target.value) || 0),
                          })
                        }
                        className="w-20 bg-slate-900 border border-sky-400/40 rounded px-2 py-0.5 text-xs font-mono text-right text-sky-300 tabular-nums"
                      />
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={1.8}
                      step={0.05}
                      value={Math.min(1.8, selectedOpening.sillHeight)}
                      onChange={(e) =>
                        onUpdateOpening(selectedOpening.id, {
                          sillHeight: parseFloat(e.target.value),
                        })
                      }
                      className="w-full accent-sky-400"
                    />
                    <div className="flex flex-wrap gap-1">
                      {[
                        { label: '0,00m Boden/Tür', s: 0.0 },
                        { label: '0,15m Bodentief', s: 0.15 },
                        { label: '0,85m Standard', s: 0.85 },
                        { label: '1,10m Küche/Bad', s: 1.1 },
                        { label: '1,45m Oberlicht', s: 1.45 },
                      ].map((p) => (
                        <button
                          key={p.label}
                          type="button"
                          onClick={() =>
                            onUpdateOpening(selectedOpening.id, { sillHeight: p.s })
                          }
                          className="px-1.5 py-0.5 rounded bg-slate-900 hover:bg-slate-800 border border-white/10 text-[10px] font-mono text-sky-200"
                        >
                          {p.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* 3. Visueller Zwei-Sensor-Regel-Editor (Gekippt vs. Geöffnet) */}
                <div className="p-3 rounded-xl bg-slate-950 border border-amber-400/30 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                      <Sliders className="w-3.5 h-3.5" />
                      <span>Home Assistant Sensor-Logik</span>
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-1 p-1 bg-slate-900 rounded-lg">
                    <button
                      type="button"
                      onClick={() =>
                        onUpdateOpening(selectedOpening.id, {
                          sensorLogicMode: 'single',
                        })
                      }
                      className={`py-1 px-2 rounded text-[11px] font-semibold transition-colors ${
                        selectedOpening.sensorLogicMode !== 'dual_tilt_open'
                          ? 'bg-sky-400 text-slate-950'
                          : 'text-slate-300 hover:text-white'
                      }`}
                    >
                      1-Sensor Standard
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        onUpdateOpening(selectedOpening.id, {
                          sensorLogicMode: 'dual_tilt_open',
                          entityId:
                            selectedOpening.entityId ||
                            'binary_sensor.fenster_wohnzimmer_offen',
                          tiltEntityId:
                            selectedOpening.tiltEntityId ||
                            'binary_sensor.fenster_wohnzimmer_kipp',
                        })
                      }
                      className={`py-1 px-2 rounded text-[11px] font-semibold transition-colors ${
                        selectedOpening.sensorLogicMode === 'dual_tilt_open'
                          ? 'bg-amber-400 text-slate-950'
                          : 'text-slate-300 hover:text-white'
                      }`}
                    >
                      2-Sensor (Kipp + Offen)
                    </button>
                  </div>

                  {selectedOpening.sensorLogicMode === 'dual_tilt_open' ? (
                    <div className="space-y-2 pt-1">
                      <div>
                        <label className="block text-[11px] text-amber-200 mb-0.5 font-medium">
                          Sensor A (Oben / Aktiv = Gekippt 14°):
                        </label>
                        <select
                          value={selectedOpening.entityId || ''}
                          onChange={(e) =>
                            onUpdateOpening(selectedOpening.id, {
                              entityId: e.target.value || undefined,
                            })
                          }
                          className="w-full bg-slate-900 border border-white/15 rounded px-2 py-1 text-[11px] font-mono text-amber-300"
                        >
                          <option value="">— Sensor A wählen —</option>
                          {binarySensorIds.map((id) => (
                            <option key={id} value={id}>
                              {id} ({entities[id]?.state})
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-[11px] text-sky-200 mb-0.5 font-medium">
                          Sensor B (Unten / Sensor A + B aktiv = Geöffnet):
                        </label>
                        <select
                          value={selectedOpening.tiltEntityId || ''}
                          onChange={(e) =>
                            onUpdateOpening(selectedOpening.id, {
                              tiltEntityId: e.target.value || undefined,
                            })
                          }
                          className="w-full bg-slate-900 border border-white/15 rounded px-2 py-1 text-[11px] font-mono text-sky-300"
                        >
                          <option value="">— Sensor B wählen —</option>
                          {binarySensorIds.map((id) => (
                            <option key={id} value={id}>
                              {id} ({entities[id]?.state})
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <label className="block text-[11px] text-slate-300 mb-1">
                        Einzel-Fenster-/Tür-/Garagentor-Sensor (entity_id)
                      </label>
                      <select
                        value={selectedOpening.entityId || ''}
                        onChange={(e) =>
                          onUpdateOpening(selectedOpening.id, {
                            entityId: e.target.value || undefined,
                          })
                        }
                        className="w-full bg-slate-900 border border-white/15 rounded-lg px-2 py-1 text-[11px] font-mono text-sky-300"
                      >
                        <option value="">— Kein Öffnungssensor —</option>
                        {entityIds.map((id) => (
                          <option key={id} value={id}>
                            {id} ({entities[id]?.attributes.friendly_name})
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {/* Read-Only Sensor vs. Actuator Control Behavior & 3D Status Badge in Live View */}
                  <div className="pt-2 border-t border-white/10 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <label className="text-[11px] text-slate-300 font-semibold">
                        Live 3D Rolle (Sensor / Aktor) & 3D-Status-Icon
                      </label>
                      {selectedOpening.entityId?.startsWith('binary_sensor.') &&
                        !selectedOpening.actuatorEntityId &&
                        selectedOpening.controlMode !== 'actuator' &&
                        selectedOpening.controlMode !== 'sensor_and_actuator' && (
                          <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 border border-emerald-400/30 text-[9px] font-bold text-emerald-300">
                            Nur Live-Sensor
                          </span>
                        )}
                    </div>
                    <div className="grid grid-cols-2 gap-1.5">
                      <div>
                        <label className="block text-[9.5px] text-slate-400 mb-0.5">
                          Rolle (Sensor / Aktor / Beides)
                        </label>
                        <select
                          value={selectedOpening.controlMode || 'auto'}
                          onChange={(e) =>
                            onUpdateOpening(selectedOpening.id, {
                              controlMode: e.target.value as
                                | 'auto'
                                | 'sensor_only'
                                | 'actuator'
                                | 'sensor_and_actuator',
                            })
                          }
                          className="w-full bg-slate-900 border border-white/15 rounded-lg px-2 py-1 text-[10.5px] text-white"
                        >
                          <option value="auto">
                            Automatisch (Sensor=Anzeige, Cover=Aktor)
                          </option>
                          <option value="sensor_only">
                            Nur Sensor (Reine Status-Anzeige)
                          </option>
                          <option value="actuator">
                            Nur Aktor (Per Klick schalten)
                          </option>
                          <option value="sensor_and_actuator">
                            Sensor + Aktor (Status & Schalten)
                          </option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-[9.5px] text-amber-300 font-semibold mb-0.5">
                          3D-Status-Icon in Live 3D
                        </label>
                        <select
                          value={selectedOpening.statusBadgeMode || 'auto'}
                          onChange={(e) =>
                            onUpdateOpening(selectedOpening.id, {
                              statusBadgeMode: e.target.value as
                                | 'auto'
                                | 'always'
                                | 'when_active'
                                | 'hidden',
                            })
                          }
                          className="w-full bg-slate-900 border border-amber-400/35 rounded-lg px-2 py-1 text-[10.5px] text-amber-200 font-semibold"
                        >
                          <option value="auto">
                            Automatisch (Tore immer, Fenster bei Offen)
                          </option>
                          <option value="when_active">
                            Nur wenn Offen / Gekippt
                          </option>
                          <option value="always">
                            Immer als 3D-Icon einblenden
                          </option>
                          <option value="hidden">
                            Kein 3D-Icon einblenden
                          </option>
                        </select>
                      </div>
                    </div>

                    {selectedOpening.controlMode !== 'sensor_only' && (
                      <div>
                        <label className="block text-[10px] text-slate-400 mb-0.5">
                          Optionaler Tor-/Tür-Aktor zum Steuern per Klick (cover.* / switch.* / button.*)
                        </label>
                        <select
                          value={selectedOpening.actuatorEntityId || ''}
                          onChange={(e) =>
                            onUpdateOpening(selectedOpening.id, {
                              actuatorEntityId: e.target.value || undefined,
                            })
                          }
                          className="w-full bg-slate-900 border border-white/15 rounded-lg px-2 py-1 text-[11px] font-mono text-amber-300"
                        >
                          <option value="">— Kein separater Aktor (Standard-Entität nutzen) —</option>
                          {entityIds
                            .filter(
                              (id) =>
                                id.startsWith('cover.') ||
                                id.startsWith('switch.') ||
                                id.startsWith('button.') ||
                                id.startsWith('lock.') ||
                                id.startsWith('input_boolean.')
                            )
                            .map((id) => (
                              <option key={id} value={id}>
                                {id} ({entities[id]?.attributes.friendly_name || entities[id]?.state})
                              </option>
                            ))}
                        </select>
                      </div>
                    )}
                  </div>
                </div>

                {/* Position X / Z & Wall Orientation */}
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <div className="text-[10px] text-slate-400 mb-0.5">Position X (m)</div>
                    <input
                      type="number"
                      step={0.05}
                      value={selectedOpening.x}
                      onChange={(e) =>
                        onUpdateOpening(selectedOpening.id, {
                          x: parseFloat(e.target.value) || 0,
                        })
                      }
                      className="w-full bg-slate-900 border border-white/10 rounded px-2 py-1 text-xs font-mono text-white tabular-nums"
                    />
                  </div>
                  <div>
                    <div className="text-[10px] text-slate-400 mb-0.5">Position Z (m)</div>
                    <input
                      type="number"
                      step={0.05}
                      value={selectedOpening.z}
                      onChange={(e) =>
                        onUpdateOpening(selectedOpening.id, {
                          z: parseFloat(e.target.value) || 0,
                        })
                      }
                      className="w-full bg-slate-900 border border-white/10 rounded px-2 py-1 text-xs font-mono text-white tabular-nums"
                    />
                  </div>
                  <div>
                    <div className="text-[10px] text-slate-400 mb-0.5">Wand-Achse</div>
                    <button
                      type="button"
                      onClick={() =>
                        onUpdateOpening(selectedOpening.id, {
                          rotationY:
                            Math.abs(Math.sin(selectedOpening.rotationY)) >= 0.6
                              ? 0
                              : Math.PI / 2,
                        })
                      }
                      className="w-full flex items-center justify-center gap-1 py-1 px-2 rounded bg-slate-800 hover:bg-slate-700 text-xs font-medium text-amber-300"
                    >
                      <RotateCw className="w-3 h-3" />
                      <span>
                        {Math.abs(Math.sin(selectedOpening.rotationY)) >= 0.6
                          ? 'Nord/Süd'
                          : 'Ost/West'}
                      </span>
                    </button>
                  </div>
                </div>

                {/* Electric Roller Shutter Binding */}
                <div className="pt-2 border-t border-white/10">
                  <label className="block text-xs text-slate-300 mb-1">
                    Elektrischer 3D-Rollladen (cover.*)
                  </label>
                  <select
                    value={selectedOpening.shutterEntityId || ''}
                    onChange={(e) =>
                      onUpdateOpening(selectedOpening.id, {
                        shutterEntityId: e.target.value || undefined,
                      })
                    }
                    className="w-full bg-slate-900 border border-white/15 rounded-lg px-2.5 py-1.5 text-xs font-mono text-amber-300"
                  >
                    <option value="">— Kein Rollladen verbaut —</option>
                    {coverEntityIds.map((id) => (
                      <option key={id} value={id}>
                        {id} ({entities[id]?.attributes.friendly_name})
                      </option>
                    ))}
                  </select>
                </div>

                {/* FRONT DOOR EXTERIOR STEPS & 30cm BASEMENT PLINTH (8 ARCHITECTURAL SHAPES) */}
                {(selectedOpening.type === 'door' ||
                  selectedOpening.type === 'double_patio_door') && (
                  <div className="p-3 rounded-xl bg-slate-950 border border-amber-400/35 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-xs font-bold text-amber-300">
                          Außentreppe vor der Tür (8 Bauformen & Keller-Sockel)
                        </div>
                        <div className="text-[10px] text-slate-400">
                          Gerade, 3-Seiten-Pyramide, Halbrund, Seitlich Links/Rechts, T-Form, Übereck
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          onUpdateOpening(selectedOpening.id, {
                            hasExteriorSteps: !selectedOpening.hasExteriorSteps,
                            exteriorStepsShape: selectedOpening.exteriorStepsShape ?? 'straight',
                            exteriorPlinthHeight: selectedOpening.exteriorPlinthHeight ?? 0.3,
                            exteriorStepsCount: selectedOpening.exteriorStepsCount ?? 2,
                          })
                        }
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-colors ${
                          selectedOpening.hasExteriorSteps
                            ? 'bg-amber-400 text-slate-950'
                            : 'bg-slate-800 text-slate-300 hover:bg-slate-700 border border-white/10'
                        }`}
                      >
                        {selectedOpening.hasExteriorSteps ? '✓ Aktiv' : '+ Aktivieren'}
                      </button>
                    </div>

                    {selectedOpening.hasExteriorSteps && (
                      <div className="space-y-2.5 pt-1.5 border-t border-white/10">
                        {/* Exterior Steps Shape Selector (Buttons + Dropdown) */}
                        <div>
                          <label className="block text-[10px] text-slate-300 mb-1 font-medium">
                            Außentreppen-Form (8 Varianten):
                          </label>
                          <div className="grid grid-cols-2 gap-1 mb-1.5">
                            {(
                              [
                                { id: 'straight', label: 'Gerade nach vorn' },
                                { id: 'pyramid_3side', label: '3-seitig Pyramide' },
                                { id: 'curved_fan', label: 'Halbrund / Bogen' },
                                { id: 'side_left', label: 'Seitlich Links' },
                                { id: 'side_right', label: 'Seitlich Rechts' },
                                { id: 'double_side_T', label: 'Beidseitig (T-Form)' },
                                { id: 'corner_L', label: 'Übereck (L-Form)' },
                                { id: 'kellertreppe_wall', label: 'Mit Wangenmauer' },
                              ] as const
                            ).map((sh) => (
                              <button
                                key={sh.id}
                                type="button"
                                onClick={() =>
                                  onUpdateOpening(selectedOpening.id, {
                                    exteriorStepsShape: sh.id,
                                  })
                                }
                                className={`py-1 px-2 rounded text-[10px] font-semibold text-left truncate transition-colors ${
                                  (selectedOpening.exteriorStepsShape || 'straight') === sh.id
                                    ? 'bg-amber-400 text-slate-950 font-bold'
                                    : 'bg-slate-900 hover:bg-slate-800 text-slate-300 border border-white/10'
                                }`}
                              >
                                {sh.label}
                              </button>
                            ))}
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <div className="flex justify-between text-[10px] text-slate-300 mb-0.5">
                              <span>Keller-Sockelhöhe</span>
                              <span className="font-mono text-amber-300">
                                {Math.round((selectedOpening.exteriorPlinthHeight ?? 0.3) * 100)} cm
                              </span>
                            </div>
                            <input
                              type="range"
                              min={0.15}
                              max={1.2}
                              step={0.05}
                              value={selectedOpening.exteriorPlinthHeight ?? 0.3}
                              onChange={(e) =>
                                onUpdateOpening(selectedOpening.id, {
                                  exteriorPlinthHeight: parseFloat(e.target.value),
                                })
                              }
                              className="w-full accent-amber-400"
                            />
                          </div>
                          <div>
                            <div className="flex justify-between text-[10px] text-slate-300 mb-0.5">
                              <span>Stufenanzahl</span>
                              <span className="font-mono text-sky-300">
                                {selectedOpening.exteriorStepsCount ?? 2} Stufen
                              </span>
                            </div>
                            <input
                              type="range"
                              min={1}
                              max={8}
                              step={1}
                              value={selectedOpening.exteriorStepsCount ?? 2}
                              onChange={(e) =>
                                onUpdateOpening(selectedOpening.id, {
                                  exteriorStepsCount: parseInt(e.target.value, 10),
                                })
                              }
                              className="w-full accent-sky-400"
                            />
                          </div>
                          <div>
                            <div className="flex justify-between text-[10px] text-slate-300 mb-0.5">
                              <span>Podestbreite</span>
                              <span className="font-mono text-amber-300">
                                {(
                                  selectedOpening.exteriorStepsWidth ??
                                  +(selectedOpening.width + 0.45).toFixed(2)
                                ).toFixed(2)}{' '}
                                m
                              </span>
                            </div>
                            <input
                              type="range"
                              min={1.1}
                              max={3.5}
                              step={0.05}
                              value={
                                selectedOpening.exteriorStepsWidth ??
                                +(selectedOpening.width + 0.45).toFixed(2)
                              }
                              onChange={(e) =>
                                onUpdateOpening(selectedOpening.id, {
                                  exteriorStepsWidth: parseFloat(e.target.value),
                                })
                              }
                              className="w-full accent-amber-400"
                            />
                          </div>
                          <div>
                            <div className="flex justify-between text-[10px] text-slate-300 mb-0.5">
                              <span>Ausladung / Tiefe</span>
                              <span className="font-mono text-amber-300">
                                {(selectedOpening.exteriorStepsDepth ?? 1.15).toFixed(2)} m
                              </span>
                            </div>
                            <input
                              type="range"
                              min={0.7}
                              max={2.6}
                              step={0.05}
                              value={selectedOpening.exteriorStepsDepth ?? 1.15}
                              onChange={(e) =>
                                onUpdateOpening(selectedOpening.id, {
                                  exteriorStepsDepth: parseFloat(e.target.value),
                                })
                              }
                              className="w-full accent-amber-400"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="block text-[10px] text-slate-400 mb-0.5">
                              Stufen-Material
                            </label>
                            <select
                              value={selectedOpening.exteriorStepsMaterial || 'travertine'}
                              onChange={(e) =>
                                onUpdateOpening(selectedOpening.id, {
                                  exteriorStepsMaterial: e.target.value as NonNullable<
                                    WallOpening['exteriorStepsMaterial']
                                  >,
                                })
                              }
                              className="w-full bg-slate-900 border border-white/15 rounded px-2 py-1 text-[11px] text-white"
                            >
                              <option value="travertine">Travertin / Naturstein</option>
                              <option value="granite">Granit Hellgrau</option>
                              <option value="anthracite">Basalt Anthrazit</option>
                              <option value="wood">Hartholz / Teak</option>
                              <option value="brick_clinker">Rotklinker / Backstein</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-[10px] text-slate-400 mb-0.5">
                              Außengeländer
                            </label>
                            <select
                              value={selectedOpening.exteriorStepsRailing || 'none'}
                              onChange={(e) =>
                                onUpdateOpening(selectedOpening.id, {
                                  exteriorStepsRailing: e.target.value as NonNullable<
                                    WallOpening['exteriorStepsRailing']
                                  >,
                                })
                              }
                              className="w-full bg-slate-900 border border-white/15 rounded px-2 py-1 text-[11px] text-white"
                            >
                              <option value="none">Ohne Geländer</option>
                              <option value="both">Edelstahl Beidseitig</option>
                              <option value="left">Nur Links</option>
                              <option value="right">Nur Rechts</option>
                              <option value="glass">ESG-Glasgeländer</option>
                            </select>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </>
          ) : selectedZone ? (
            <>
              <div className="flex items-start justify-between gap-2 pb-2.5 border-b border-white/10">
                <div className="flex-1">
                  <div className="text-[11px] text-sky-400 font-medium">
                    {selectedZone.surfaceMaterial === 'pool_water'
                      ? '3D-Swimmingpool frei konfigurieren'
                      : selectedZone.zoneType === 'indoor'
                      ? 'Innenraum bearbeiten'
                      : 'Außenanlage / Grundstück bearbeiten'}
                  </div>
                  <input
                    type="text"
                    value={selectedZone.name}
                    onChange={(e) =>
                      onUpdateZone(selectedZone.id, { name: e.target.value })
                    }
                    className="mt-1 w-full bg-slate-900 border border-white/10 rounded px-2 py-1 text-xs font-semibold text-white"
                  />
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    title={
                      selectedZone.locked
                        ? 'Raum/Fläche entsperren'
                        : 'Raum/Fläche sperren (gegen versehentliches Verschieben)'
                    }
                    onClick={() =>
                      onUpdateZone(selectedZone.id, { locked: !selectedZone.locked })
                    }
                    className={`flex items-center gap-1 px-2 py-1.5 rounded-lg border text-[11px] font-bold transition-colors ${
                      selectedZone.locked
                        ? 'bg-amber-400 text-slate-950 border-amber-300'
                        : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-white/10'
                    }`}
                  >
                    {selectedZone.locked ? (
                      <>
                        <Lock className="w-3.5 h-3.5" />
                        <span>Gesperrt</span>
                      </>
                    ) : (
                      <>
                        <Unlock className="w-3.5 h-3.5" />
                        <span>Fixieren</span>
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    disabled={Boolean(selectedZone.locked)}
                    onClick={() => onDeleteZone(selectedZone.id)}
                    className={`p-1.5 rounded-lg ${
                      selectedZone.locked
                        ? 'bg-slate-900 text-slate-600 cursor-not-allowed'
                        : 'bg-red-500/20 hover:bg-red-500/30 text-red-300'
                    }`}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <div className="space-y-3">
                {/* Floor Level */}
                <div>
                  <label className="block text-xs text-slate-300 mb-1">
                    Stockwerk / Etage
                  </label>
                  <div className="grid grid-cols-4 gap-1">
                    {FLOOR_OPTIONS.map((fo) => (
                      <button
                        key={fo.level}
                        type="button"
                        onClick={() =>
                          onUpdateZone(selectedZone.id, { level: fo.level })
                        }
                        className={`py-1 rounded text-xs font-semibold ${
                          (selectedZone.level ?? 0) === fo.level
                            ? 'bg-amber-400 text-slate-950'
                            : 'bg-slate-900 text-slate-300 hover:bg-slate-800'
                        }`}
                      >
                        {fo.short}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Duplicate Baukörper building assignment card removed as requested */}

                <div>
                  <label className="block text-xs text-slate-300 mb-1">
                    PBR Boden- / Oberflächenmaterial (UE5 Bump/Roughness)
                  </label>
                  <select
                    value={selectedZone.surfaceMaterial}
                    onChange={(e) =>
                      onUpdateZone(selectedZone.id, {
                        surfaceMaterial: e.target.value as SurfaceMaterialId,
                      })
                    }
                    className="w-full bg-slate-900 border border-white/15 rounded-lg px-2.5 py-1.5 text-xs text-white"
                  >
                    {SURFACE_MATERIALS.map((mat) => (
                      <option key={mat.id} value={mat.id}>
                        {mat.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Room Presence / Motion Sensor Binding for Live View */}
                <div className="p-2.5 rounded-xl bg-slate-950/90 border border-sky-400/25 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-bold text-sky-300">
                      Raum-Präsenz / Anwesenheits-Sensor (HA)
                    </label>
                    {selectedZone.presenceEntityId && (
                      <span className="text-[9px] font-mono text-emerald-300">
                        {entities[selectedZone.presenceEntityId]?.state || 'verbunden'}
                      </span>
                    )}
                  </div>
                  <select
                    value={selectedZone.presenceEntityId || ''}
                    onChange={(e) =>
                      onUpdateZone(selectedZone.id, {
                        presenceEntityId: e.target.value || undefined,
                      })
                    }
                    className="w-full bg-slate-900 border border-white/15 rounded-lg px-2 py-1.5 text-[11px] font-mono text-sky-200"
                  >
                    <option value="">— Kein direkter Raum-Präsenzsensor —</option>
                    {entityIds
                      .filter(
                        (id) =>
                          id.startsWith('binary_sensor.') ||
                          id.startsWith('person.') ||
                          id.startsWith('device_tracker.') ||
                          id.startsWith('sensor.') ||
                          id.startsWith('input_boolean.')
                      )
                      .map((id) => (
                        <option key={id} value={id}>
                          {id} ({entities[id]?.attributes.friendly_name || entities[id]?.state})
                        </option>
                      ))}
                  </select>
                  <p className="text-[9px] text-slate-400">
                    Steuert die Live-Raumpräsenz (z.B. mmWave, PIR Bewegungsmelder oder Personen-Tracker).
                  </p>
                </div>

                {/* Outdoor Layer Order & Outdoor Perimeter Fence / Hedge (inkl. Maschendrahtzaun) */}
                {selectedZone.zoneType === 'outdoor' && (
                  <div className="p-2.5 rounded-xl bg-slate-950 border border-emerald-400/30 space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-[11px] font-bold text-emerald-300">
                        Grundstücks-Einfassung & Layer-Ebene
                      </label>
                      <span className="text-[10px] font-mono text-slate-400">
                        Ebene {selectedZone.layerOrder ?? 0}
                      </span>
                    </div>
                    <div>
                      <label className="block text-[10px] text-slate-400 mb-0.5">
                        Umlaufende 3D-Einfassung (Zaun / Hecke / Randstein)
                      </label>
                      <select
                        value={selectedZone.outdoorPerimeter || 'none'}
                        onChange={(e) =>
                          onUpdateZone(selectedZone.id, {
                            outdoorPerimeter: e.target.value as FloorplanZone['outdoorPerimeter'],
                          })
                        }
                        className="w-full bg-slate-900 border border-emerald-400/40 rounded-lg px-2 py-1.5 text-[11px] text-emerald-200 font-semibold"
                      >
                        <option value="none">Ohne Einfassung (Freie Fläche)</option>
                        <option value="chainlink_fence">
                          Maschendrahtzaun (Tannengrün mit Spanndraht)
                        </option>
                        <option value="wood_fence">Moderne Lamellen-Zaunanlage</option>
                        <option value="hedge">Dichte Zypressen-/Ligusterhecke</option>
                        <option value="stone_curb">Naturstein-Randstein / Bordstein</option>
                      </select>
                    </div>
                    <select
                      value={String(selectedZone.layerOrder ?? 0)}
                      onChange={(e) =>
                        onUpdateZone(selectedZone.id, {
                          layerOrder: parseInt(e.target.value, 10),
                        })
                      }
                      className="w-full bg-slate-900 border border-white/15 rounded-lg px-2 py-1.5 text-[11px] text-white"
                    >
                      <option value="-2">Ebene -2: Tiefster Hintergrund (Basis-Grundstück)</option>
                      <option value="-1">Ebene -1: Hintergrund (Großer Gartenrasen)</option>
                      <option value="0">Ebene 0: Automatisch (Kleinere Flächen über größeren)</option>
                      <option value="1">Ebene +1: Mittelgrund (Terrasse / Freizeitfläche)</option>
                      <option value="2">Ebene +2: Vordergrund (Pooldeck / Lounge-Insel)</option>
                      <option value="3">Ebene +3: Oberste Schicht (Gartenwege & Trittplatten)</option>
                    </select>
                  </div>
                )}

                {/* 2D/3D WAND-DESIGNER PRO WANDSEITE (Offene Küche, Akzentwand, Lamellen, Klinker, Wand-Objekte) */}
                {selectedZone.zoneType === 'indoor' && (
                  <div className="p-3 rounded-xl bg-slate-950 border border-fuchsia-400/35 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-xs font-bold text-fuchsia-300">
                          2D/3D Wand-Designer (Pro Wandseite)
                        </div>
                        <div className="text-[10px] text-slate-400">
                          Einzelne Raumwände ausblenden (Offene Küche), Akzentwand & Wand-Deko
                        </div>
                      </div>
                    </div>

                    {/* 4 Cardinal Wall Side Tabs */}
                    <div className="grid grid-cols-4 gap-1 bg-slate-900 p-1 rounded-lg">
                      {(
                        [
                          { id: 'north', label: 'Nord (Oben)' },
                          { id: 'east', label: 'Ost (Rechts)' },
                          { id: 'south', label: 'Süd (Unten)' },
                          { id: 'west', label: 'West (Links)' },
                        ] as const
                      ).map((ws) => {
                        const cfg = selectedZone.wallSides?.[ws.id];
                        const isHidden = cfg?.mode === 'hidden';
                        return (
                          <button
                            key={ws.id}
                            type="button"
                            onClick={() => setActiveWallSideTab(ws.id)}
                            className={`py-1 px-1.5 rounded text-[10px] font-bold transition-colors ${
                              activeWallSideTab === ws.id
                                ? 'bg-fuchsia-400 text-slate-950'
                                : isHidden
                                ? 'bg-sky-500/20 text-sky-300 border border-sky-400/30'
                                : 'text-slate-300 hover:text-white'
                            }`}
                          >
                            {ws.label}
                          </button>
                        );
                      })}
                    </div>

                    {(() => {
                      const currentSideCfg: WallSideConfig = selectedZone.wallSides?.[
                        activeWallSideTab
                      ] || {
                        mode: 'full',
                        finish: 'plaster',
                      };
                      const updateSideCfg = (patch: Partial<WallSideConfig>) => {
                        const nextSides = {
                          ...(selectedZone.wallSides || {}),
                          [activeWallSideTab]: {
                            ...currentSideCfg,
                            ...patch,
                          },
                        };
                        onUpdateZone(selectedZone.id, { wallSides: nextSides });
                      };

                      return (
                        <div className="space-y-2 pt-1">
                          <div className="grid grid-cols-2 gap-1.5">
                            <div>
                              <label className="block text-[10px] text-slate-400 mb-0.5">
                                Wand-Modus ({activeWallSideTab.toUpperCase()})
                              </label>
                              <select
                                value={currentSideCfg.mode}
                                onChange={(e) =>
                                  updateSideCfg({
                                    mode: e.target.value as WallSegmentMode,
                                  })
                                }
                                className="w-full bg-slate-900 border border-white/15 rounded px-2 py-1 text-[11px] text-white font-semibold"
                              >
                                <option value="full">Geschlossene Wand (Voll)</option>
                                <option value="hidden">
                                  Wand ausblenden (Offene Küche / Durchgang)
                                </option>
                                <option value="half_height">
                                  Halbhohe Wand / Theke (1,10 m)
                                </option>
                                <option value="archway">
                                  Wanddurchbruch / Rundbogen
                                </option>
                              </select>
                            </div>

                            <div>
                              <label className="block text-[10px] text-slate-400 mb-0.5">
                                Wand-Styling / Material
                              </label>
                              <select
                                value={currentSideCfg.finish}
                                onChange={(e) =>
                                  updateSideCfg({
                                    finish: e.target.value as WallSurfaceFinish,
                                  })
                                }
                                className="w-full bg-slate-900 border border-white/15 rounded px-2 py-1 text-[11px] text-fuchsia-200 font-semibold"
                              >
                                <option value="plaster">Glattputz Standard</option>
                                <option value="wood_slats">Akustik-Holzlamellen (Eiche)</option>
                                <option value="brick_exposed">Sichtklinker / Loft-Backstein</option>
                                <option value="stone_tile">Naturstein-Fliesen (Schiefer)</option>
                                <option value="concrete_loft">Sichtbeton Architektur</option>
                                <option value="wallpaper_accent">Design-Akzenttapete</option>
                                <option value="glass_block">Glasbausteine (Lichtdurchlässiges Raster)</option>
                              </select>
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-2 items-center">
                            <div className="flex items-center gap-2">
                              <label className="text-[10px] text-slate-400">Wandfarbe:</label>
                              <input
                                type="color"
                                value={currentSideCfg.color || selectedZone.wallColor || '#e4e0d8'}
                                onChange={(e) => updateSideCfg({ color: e.target.value })}
                                className="w-7 h-6 rounded bg-slate-900 border border-white/15 cursor-pointer"
                              />
                              <button
                                type="button"
                                onClick={() =>
                                  onUpdateZone(selectedZone.id, {
                                    wallColor:
                                      currentSideCfg.color || selectedZone.wallColor || '#e4e0d8',
                                  })
                                }
                                className="text-[9.5px] text-slate-400 hover:text-white underline"
                              >
                                Für alle 4 Wände
                              </button>
                            </div>
                            <div className="flex items-center justify-end gap-1.5">
                              <span className="text-[10px] text-slate-400">Stärke:</span>
                              <input
                                type="number"
                                step={0.02}
                                min={0.08}
                                max={0.45}
                                value={currentSideCfg.thickness ?? 0.16}
                                onChange={(e) =>
                                  updateSideCfg({
                                    thickness: parseFloat(e.target.value) || 0.16,
                                  })
                                }
                                className="w-14 bg-slate-900 border border-white/15 rounded px-1.5 py-0.5 text-[11px] font-mono text-white"
                              />
                              <span className="text-[10px] text-slate-400">m</span>
                            </div>
                          </div>

                          {/* Universeller Wand- & Einbau-Planer (Küche, Wohnwand, Garderobe, Schränke) */}
                          {onOpenWallPlanner && (
                            <div className="pt-2 border-t border-white/10 space-y-1.5">
                              <button
                                type="button"
                                onClick={() =>
                                  onOpenWallPlanner(selectedZone.id, activeWallSideTab)
                                }
                                className="w-full py-2 px-3 rounded-lg bg-gradient-to-r from-amber-400 to-amber-300 hover:from-amber-300 hover:to-amber-200 text-slate-950 text-xs font-bold shadow-md flex items-center justify-center gap-1.5 transition-all"
                              >
                                <span>🧱 Diese Wand planen (Modul-Baukasten öffnen)</span>
                              </button>
                              <div className="grid grid-cols-2 gap-1">
                                {(
                                  [
                                    { id: 'kitchen', label: '🍳 Küchenplaner' },
                                    { id: 'living_wall', label: '📺 Wohnwand' },
                                    { id: 'wardrobe', label: '🧥 Garderobe' },
                                    { id: 'closet', label: '🚪 Einbauschrank' },
                                  ] as { id: WallPlannerCategory; label: string }[]
                                ).map((catBtn) => (
                                  <button
                                    key={catBtn.id}
                                    type="button"
                                    onClick={() =>
                                      onOpenWallPlanner(
                                        selectedZone.id,
                                        activeWallSideTab,
                                        catBtn.id
                                      )
                                    }
                                    className="py-1 px-2 rounded bg-slate-900 hover:bg-slate-800 border border-amber-400/30 text-[10px] font-semibold text-amber-200 text-left transition-colors"
                                  >
                                    {catBtn.label}
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Quick Place Wall Objects directly from the Wall Designer */}
                          <div className="pt-1.5 border-t border-white/10">
                            <div className="text-[10px] font-semibold text-slate-300 mb-1">
                              Einzelne Wand-Objekte direkt platzieren:
                            </div>
                            <div className="grid grid-cols-2 gap-1">
                              {[
                                { id: 'wall_tv_oled_77', label: '+ 77" Wand-TV (OLED)' },
                                { id: 'wall_art_framed_triptych', label: '+ Bilder-Triptychon' },
                                { id: 'wall_acoustic_wood_panel', label: '+ Akustik-Paneel' },
                                { id: 'wall_radiator_modern', label: '+ Design-Heizkörper' },
                              ].map((wObj) => {
                                const catItem = ASSET_CATALOG.find((c) => c.id === wObj.id);
                                if (!catItem) return null;
                                const isArmed = pendingCatalogItem?.id === catItem.id;
                                return (
                                  <button
                                    key={wObj.id}
                                    type="button"
                                    onClick={() =>
                                      onSelectCatalogItemToPlace(isArmed ? null : catItem)
                                    }
                                    className={`py-1 px-2 rounded text-[10px] font-semibold text-left transition-colors ${
                                      isArmed
                                        ? 'bg-amber-400 text-slate-950 font-bold'
                                        : 'bg-slate-900 hover:bg-slate-800 text-fuchsia-200 border border-white/10'
                                    }`}
                                  >
                                    {isArmed ? 'Im Plan antippen…' : wObj.label}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                )}

                {/* Indoor Raised Basement Plinth (30cm Keller-Sockel über Gelände) */}
                {selectedZone.zoneType === 'indoor' && (
                  <div className="p-2.5 rounded-xl bg-slate-950 border border-amber-400/30 space-y-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-[11px] font-bold text-amber-300">
                          Keller-Sockelhöhe über Gelände (EG erhöht)
                        </div>
                        <div className="text-[9.5px] text-slate-400">
                          Hebt das Gebäude an, wenn das KG z.B. 30 cm aus dem Boden schaut
                        </div>
                      </div>
                      <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 font-mono text-[11px] font-bold tabular-nums">
                        {Math.round((selectedZone.plinthHeight ?? 0) * 100)} cm
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-1">
                      {[
                        { val: 0, label: '0 cm (Ebenerdig)' },
                        { val: 0.3, label: '30 cm Keller-Sockel' },
                        { val: 0.45, label: '45 cm Hochparterre' },
                      ].map((preset) => (
                        <button
                          key={preset.val}
                          type="button"
                          onClick={() => {
                            const cluster = getConnectedBuildingCluster(
                              selectedZone,
                              project.zones
                            );
                            for (const z of cluster) {
                              onUpdateZone(z.id, { plinthHeight: preset.val });
                            }
                          }}
                          className={`py-1 px-1.5 rounded text-[10px] font-semibold transition-colors ${
                            Math.abs((selectedZone.plinthHeight ?? 0) - preset.val) < 0.02
                              ? 'bg-amber-400 text-slate-950 font-bold'
                              : 'bg-slate-900 text-slate-300 hover:bg-slate-800 border border-white/10'
                          }`}
                        >
                          {preset.label}
                        </button>
                      ))}
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={0.8}
                      step={0.05}
                      value={selectedZone.plinthHeight ?? 0}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value);
                        const cluster = getConnectedBuildingCluster(
                          selectedZone,
                          project.zones
                        );
                        for (const z of cluster) {
                          onUpdateZone(z.id, { plinthHeight: val });
                        }
                      }}
                      className="w-full accent-amber-400"
                    />
                  </div>
                )}

                {/* Live Area & Geometry Mode Card */}
                <div className="p-2.5 rounded-xl bg-slate-950 border border-sky-400/30 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-sky-300">
                      Exakte Maße & Grundfläche
                    </span>
                    <span className="px-2 py-0.5 rounded bg-amber-500/20 border border-amber-400/40 font-mono text-xs font-bold text-amber-300 tabular-nums">
                      {computeZoneAreaM2(selectedZone).toFixed(2)} m²
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-slate-300">
                    <span>Geometrie-Typ:</span>
                    <span className="font-mono text-slate-200">
                      {selectedZone.points && selectedZone.points.length >= 3
                        ? `Freiform-Polygon (${selectedZone.points.length} Eckpunkte)`
                        : 'Rechteck-Grundriss'}
                    </span>
                  </div>
                  <div className="pt-1">
                    {selectedZone.points && selectedZone.points.length >= 3 ? (
                      <button
                        type="button"
                        onClick={() =>
                          onUpdateZone(selectedZone.id, { points: undefined })
                        }
                        className="w-full py-1.5 px-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-white/10 text-[11px] font-semibold text-slate-200 transition-colors"
                      >
                        In Standard-Rechteck umwandeln
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          const hw = selectedZone.width / 2;
                          const hd = selectedZone.depth / 2;
                          const pts: [number, number][] = [
                            [
                              Math.round((selectedZone.x - hw) * 10) / 10,
                              Math.round((selectedZone.z - hd) * 10) / 10,
                            ],
                            [
                              Math.round((selectedZone.x + hw) * 10) / 10,
                              Math.round((selectedZone.z - hd) * 10) / 10,
                            ],
                            [
                              Math.round((selectedZone.x + hw) * 10) / 10,
                              Math.round((selectedZone.z + hd) * 10) / 10,
                            ],
                            [
                              Math.round((selectedZone.x - hw) * 10) / 10,
                              Math.round((selectedZone.z + hd) * 10) / 10,
                            ],
                          ];
                          onUpdateZone(selectedZone.id, { points: pts });
                        }}
                        className="w-full py-1.5 px-2.5 rounded-lg bg-sky-500/20 hover:bg-sky-500/30 border border-sky-400/40 text-[11px] font-semibold text-sky-200 transition-colors"
                      >
                        In Freiform-Polygon umwandeln (Ecken frei ziehen)
                      </button>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <div className="text-[11px] text-slate-400 mb-0.5">Breite X (m)</div>
                    <input
                      type="number"
                      step={0.1}
                      min={0.6}
                      value={selectedZone.width}
                      onChange={(e) => {
                        const nextW = Math.max(0.6, parseFloat(e.target.value) || 2);
                        if (selectedZone.points && selectedZone.points.length >= 3) {
                          const scaleX = nextW / Math.max(0.2, selectedZone.width);
                          const scaledPts: [number, number][] = selectedZone.points.map(
                            ([px, pz]) => [
                              Math.round((selectedZone.x + (px - selectedZone.x) * scaleX) * 100) / 100,
                              pz,
                            ]
                          );
                          const b = computePolygonBounds(scaledPts);
                          onUpdateZone(selectedZone.id, {
                            points: scaledPts,
                            width: b.width,
                            x: b.x,
                          });
                        } else {
                          onUpdateZone(selectedZone.id, { width: nextW });
                        }
                      }}
                      className="w-full bg-slate-900 border border-white/10 rounded px-2 py-1 text-xs font-mono text-white tabular-nums"
                    />
                  </div>
                  <div>
                    <div className="text-[11px] text-slate-400 mb-0.5">Tiefe Z (m)</div>
                    <input
                      type="number"
                      step={0.1}
                      min={0.6}
                      value={selectedZone.depth}
                      onChange={(e) => {
                        const nextD = Math.max(0.6, parseFloat(e.target.value) || 2);
                        if (selectedZone.points && selectedZone.points.length >= 3) {
                          const scaleZ = nextD / Math.max(0.2, selectedZone.depth);
                          const scaledPts: [number, number][] = selectedZone.points.map(
                            ([px, pz]) => [
                              px,
                              Math.round((selectedZone.z + (pz - selectedZone.z) * scaleZ) * 100) / 100,
                            ]
                          );
                          const b = computePolygonBounds(scaledPts);
                          onUpdateZone(selectedZone.id, {
                            points: scaledPts,
                            depth: b.depth,
                            z: b.z,
                          });
                        } else {
                          onUpdateZone(selectedZone.id, { depth: nextD });
                        }
                      }}
                      className="w-full bg-slate-900 border border-white/10 rounded px-2 py-1 text-xs font-mono text-white tabular-nums"
                    />
                  </div>
                  <div>
                    <div className="text-[11px] text-slate-400 mb-0.5">Position X (m)</div>
                    <input
                      type="number"
                      step={0.2}
                      value={selectedZone.x}
                      onChange={(e) => {
                        const nextX = parseFloat(e.target.value) || 0;
                        const dx = nextX - selectedZone.x;
                        if (selectedZone.points && selectedZone.points.length >= 3) {
                          onUpdateZone(selectedZone.id, {
                            x: nextX,
                            points: selectedZone.points.map(([px, pz]) => [
                              Math.round((px + dx) * 100) / 100,
                              pz,
                            ]),
                          });
                        } else {
                          onUpdateZone(selectedZone.id, { x: nextX });
                        }
                      }}
                      className="w-full bg-slate-900 border border-white/10 rounded px-2 py-1 text-xs font-mono text-white tabular-nums"
                    />
                  </div>
                  <div>
                    <div className="text-[11px] text-slate-400 mb-0.5">Position Z (m)</div>
                    <input
                      type="number"
                      step={0.2}
                      value={selectedZone.z}
                      onChange={(e) => {
                        const nextZ = parseFloat(e.target.value) || 0;
                        const dz = nextZ - selectedZone.z;
                        if (selectedZone.points && selectedZone.points.length >= 3) {
                          onUpdateZone(selectedZone.id, {
                            z: nextZ,
                            points: selectedZone.points.map(([px, pz]) => [
                              px,
                              Math.round((pz + dz) * 100) / 100,
                            ]),
                          });
                        } else {
                          onUpdateZone(selectedZone.id, { z: nextZ });
                        }
                      }}
                      className="w-full bg-slate-900 border border-white/10 rounded px-2 py-1 text-xs font-mono text-white tabular-nums"
                    />
                  </div>
                </div>

                {/* GEBÄUDE-ZUORDNUNG, DREHUNG & 3D-DACH / DACHGAUBEN KONFIGURATOR (für Innenräume & Nebengebäude) */}
                {selectedZone.zoneType === 'indoor' && (
                  <>
                    {/* 1. Gebäude-Gruppe & Gebäudeteile / ganzes Gebäude drehen */}
                    <div className="p-3 rounded-xl bg-slate-950 border border-amber-400/35 space-y-2.5">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                          <Building2 className="w-3.5 h-3.5" />
                          <span>Gebäude-Zuordnung & Drehen</span>
                        </span>
                        <span className="text-[10px] font-mono text-sky-300 tabular-nums">
                          {Math.round((-(selectedZone.rotationY || 0) * 180) / Math.PI)}°
                        </span>
                      </div>

                      <div>
                        <label className="block text-[10px] text-slate-400 mb-1">
                          Zugeordnetes Gebäude (für Sortierung, Raster-Snap & gemeinsame Drehung)
                        </label>
                        {(() => {
                          const bldgOptions = getAvailableBuildingOptions(project.zones);
                          return (
                            <select
                              value={selectedZone.buildingId || 'main_house'}
                              onChange={(e) =>
                                onUpdateZone(selectedZone.id, {
                                  buildingId: e.target.value || undefined,
                                })
                              }
                              className="w-full bg-slate-900 border border-white/15 rounded-lg px-2 py-1.5 text-[11px] text-white"
                            >
                              {bldgOptions.map((b) => (
                                <option key={b.id} value={b.id}>
                                  {b.label} ({b.hint})
                                </option>
                              ))}
                              <option value="">Freistehender Raum (ohne Gruppe)</option>
                            </select>
                          );
                        })()}
                      </div>

                      {/* Room / Building Part Rotation Slider */}
                      <div className="space-y-1 pt-1 border-t border-white/10">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-slate-300">Drehwinkel Gebäudeteil (°)</span>
                          <span className="font-mono text-amber-300 tabular-nums">
                            {Math.round((-(selectedZone.rotationY || 0) * 180) / Math.PI)}°
                          </span>
                        </div>
                        <input
                          type="range"
                          min={-180}
                          max={180}
                          step={5}
                          value={Math.round((-(selectedZone.rotationY || 0) * 180) / Math.PI)}
                          onChange={(e) => {
                            const deg = parseFloat(e.target.value) || 0;
                            onUpdateZone(selectedZone.id, {
                              rotationY: -((deg * Math.PI) / 180),
                            });
                          }}
                          className="w-full accent-amber-400"
                        />
                        <div className="grid grid-cols-2 gap-1.5 pt-1">
                          <button
                            type="button"
                            onClick={() =>
                              onRotateBuilding
                                ? onRotateBuilding(selectedZone.id, -Math.PI / 12, false)
                                : onUpdateZone(selectedZone.id, {
                                    rotationY: (selectedZone.rotationY || 0) - Math.PI / 12,
                                  })
                            }
                            className="flex items-center justify-center gap-1 py-1.5 px-2 rounded-lg bg-slate-900 hover:bg-slate-800 border border-sky-400/40 text-[11px] font-semibold text-sky-300"
                          >
                            <RotateCw className="w-3 h-3" />
                            <span>Nur Raum +15°</span>
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              onRotateBuilding?.(selectedZone.id, -Math.PI / 12, true)
                            }
                            className="flex items-center justify-center gap-1 py-1.5 px-2 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border border-amber-400/50 text-[11px] font-bold text-amber-300"
                            title="Dreht alle Räume, Fenster, Türen und Möbel dieses Gebäudes gemeinsam"
                          >
                            <RotateCw className="w-3 h-3" />
                            <span>Ganzes Gebäude +15°</span>
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* 2. 3D-Dachform, Eindeckung & Dachgauben Konfigurator */}
                    <div className="p-3 rounded-xl bg-slate-950 border border-sky-400/35 space-y-2.5">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-sky-300 flex items-center gap-1.5">
                          <Home className="w-3.5 h-3.5 text-sky-400" />
                          <span>3D-Dach & Dachgauben</span>
                        </span>
                        <span className="text-[10px] font-mono text-slate-400">
                          {selectedZone.roofConfig?.type && selectedZone.roofConfig.type !== 'none'
                            ? `${selectedZone.roofConfig.pitchDeg ?? 32}° Neigung`
                            : 'Kein Dach'}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[10px] text-slate-400 mb-0.5">
                            Dachform / Bauart
                          </label>
                          <select
                            value={selectedZone.roofConfig?.type || 'none'}
                            onChange={(e) => {
                              const nextType = e.target.value as RoofType;
                              const isPitchedOnOG =
                                (selectedZone.level ?? 0) === 1 &&
                                nextType !== 'none' &&
                                nextType !== 'flat';
                              onUpdateZone(selectedZone.id, {
                                roofConfig: {
                                  ...(selectedZone.roofConfig || {}),
                                  type: nextType,
                                  pitchDeg: selectedZone.roofConfig?.pitchDeg ?? 35,
                                  overhang: selectedZone.roofConfig?.overhang ?? 0.35,
                                  gableOverhang:
                                    selectedZone.roofConfig?.gableOverhang ??
                                    selectedZone.roofConfig?.overhang ??
                                    0.35,
                                  material:
                                    selectedZone.roofConfig?.material || 'anthracite_tile',
                                  ridgeDirection:
                                    selectedZone.roofConfig?.ridgeDirection || 'x',
                                  roofSpanMode:
                                    selectedZone.roofConfig?.roofSpanMode ||
                                    (isPitchedOnOG ? 'og_in_roof' : 'single_floor'),
                                  footprintScope:
                                    selectedZone.roofConfig?.footprintScope || 'building',
                                  kniestockHeight:
                                    selectedZone.roofConfig?.kniestockHeight ??
                                    (isPitchedOnOG ? 0.85 : 0),
                                  dormerType: selectedZone.roofConfig?.dormerType || 'none',
                                  dormerSides:
                                    selectedZone.roofConfig?.dormerSides || 'front',
                                  dormerCountPerSide:
                                    selectedZone.roofConfig?.dormerCountPerSide ?? 1,
                                  dormerWidth: selectedZone.roofConfig?.dormerWidth ?? 1.45,
                                  dormerHeight: selectedZone.roofConfig?.dormerHeight ?? 1.25,
                                },
                              });
                            }}
                            className="w-full bg-slate-900 border border-white/15 rounded px-2 py-1 text-[11px] text-white"
                          >
                            <option value="none">Kein Dach (Offene Decke)</option>
                            <option value="gable">Satteldach (Klassisch)</option>
                            <option value="hipped">Walmdach (4 Dachflächen)</option>
                            <option value="tent">Zeltdach / Pyramidendach</option>
                            <option value="flat">Flachdach mit Attika</option>
                            <option value="mono_pitch">Pultdach (Modern)</option>
                            <option value="mansard">Mansarddach</option>
                            <option value="barrel">Tonnendach (Gewölbt)</option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-[10px] text-slate-400 mb-0.5">
                            Dacheindeckung / Farbe
                          </label>
                          <select
                            value={selectedZone.roofConfig?.material || 'anthracite_tile'}
                            onChange={(e) =>
                              onUpdateZone(selectedZone.id, {
                                roofConfig: {
                                  ...(selectedZone.roofConfig || { type: 'gable' }),
                                  material: e.target.value as RoofMaterialStyle,
                                },
                              })
                            }
                            className="w-full bg-slate-900 border border-white/15 rounded px-2 py-1 text-[11px] text-white"
                          >
                            <option value="anthracite_tile">Tondachziegel Anthrazit</option>
                            <option value="terracotta_tile">Klassik-Ziegel Naturrot</option>
                            <option value="standing_seam_zinc">Stehfalz-Titanzink</option>
                            <option value="slate_dark">Naturschiefer Dunkel</option>
                            <option value="flat_gravel">Kiesdach / Attika Grau</option>
                            <option value="green_sedum">Extensives Gründach (Sedum)</option>
                          </select>
                        </div>
                      </div>

                      {selectedZone.roofConfig?.type &&
                        selectedZone.roofConfig.type !== 'none' && (
                          <>
                            {/* Dachneigung & Separate Dachüberstände (Traufseiten vs. Giebelseiten/Ortgang) */}
                            <div className="grid grid-cols-3 gap-1.5 pt-1">
                              <div>
                                <div className="text-[10px] text-slate-400 mb-0.5">
                                  Neigung ({selectedZone.roofConfig.pitchDeg ?? 32}°)
                                </div>
                                <input
                                  type="range"
                                  min={8}
                                  max={55}
                                  step={1}
                                  value={selectedZone.roofConfig.pitchDeg ?? 32}
                                  onChange={(e) =>
                                    onUpdateZone(selectedZone.id, {
                                      roofConfig: {
                                        ...selectedZone.roofConfig!,
                                        pitchDeg: parseInt(e.target.value, 10),
                                      },
                                    })
                                  }
                                  className="w-full accent-sky-400"
                                />
                              </div>
                              <div>
                                <div className="text-[10px] text-slate-400 mb-0.5">
                                  Traufüberstand ({(selectedZone.roofConfig.overhang ?? 0.35).toFixed(2)}m)
                                </div>
                                <input
                                  type="range"
                                  min={0}
                                  max={1.2}
                                  step={0.05}
                                  value={selectedZone.roofConfig.overhang ?? 0.35}
                                  onChange={(e) =>
                                    onUpdateZone(selectedZone.id, {
                                      roofConfig: {
                                        ...selectedZone.roofConfig!,
                                        overhang: parseFloat(e.target.value),
                                      },
                                    })
                                  }
                                  className="w-full accent-sky-400"
                                />
                              </div>
                              <div>
                                <div className="text-[10px] text-amber-300 font-semibold mb-0.5">
                                  Giebelüberstand (
                                  {(
                                    selectedZone.roofConfig.gableOverhang ??
                                    selectedZone.roofConfig.overhang ??
                                    0.35
                                  ).toFixed(2)}
                                  m)
                                </div>
                                <input
                                  type="range"
                                  min={0}
                                  max={1.2}
                                  step={0.05}
                                  value={
                                    selectedZone.roofConfig.gableOverhang ??
                                    selectedZone.roofConfig.overhang ??
                                    0.35
                                  }
                                  onChange={(e) =>
                                    onUpdateZone(selectedZone.id, {
                                      roofConfig: {
                                        ...selectedZone.roofConfig!,
                                        gableOverhang: parseFloat(e.target.value),
                                      },
                                    })
                                  }
                                  className="w-full accent-amber-400"
                                />
                              </div>
                            </div>

                            <div className="grid grid-cols-2 gap-1.5">
                              <button
                                type="button"
                                onClick={() =>
                                  onUpdateZone(selectedZone.id, {
                                    roofConfig: {
                                      ...selectedZone.roofConfig!,
                                      ridgeDirection: 'x',
                                    },
                                  })
                                }
                                className={`py-1 px-2 rounded text-[10px] font-semibold ${
                                  (selectedZone.roofConfig.ridgeDirection || 'x') === 'x'
                                    ? 'bg-sky-400 text-slate-950 font-bold'
                                    : 'bg-slate-900 text-slate-300 border border-white/10'
                                }`}
                              >
                                Firstverlauf Ost–West (X)
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  onUpdateZone(selectedZone.id, {
                                    roofConfig: {
                                      ...selectedZone.roofConfig!,
                                      ridgeDirection: 'z',
                                    },
                                  })
                                }
                                className={`py-1 px-2 rounded text-[10px] font-semibold ${
                                  selectedZone.roofConfig.ridgeDirection === 'z'
                                    ? 'bg-sky-400 text-slate-950 font-bold'
                                    : 'bg-slate-900 text-slate-300 border border-white/10'
                                }`}
                              >
                                Firstverlauf Nord–Süd (Z)
                              </button>
                            </div>

                            {/* GESCHOSS-BAUWEISE: EG + 1. OG IM DACH + DG / SPITZBODEN */}
                            <div className="p-2.5 rounded-lg bg-slate-900/90 border border-sky-400/30 space-y-2">
                              <div className="flex items-center justify-between gap-2">
                                <div>
                                  <div className="text-[11px] font-bold text-sky-300">
                                    Geschoss-Bauweise & Dach-Auflage
                                  </div>
                                  <div className="text-[9px] text-slate-400">
                                    Dach sitzt auf EG — 1. OG im Dach (mit Kniestock) + DG / Spitzboden
                                  </div>
                                </div>
                                <button
                                  type="button"
                                  onClick={() =>
                                    onUpdateZone(selectedZone.id, {
                                      roofConfig: {
                                        ...selectedZone.roofConfig!,
                                        type:
                                          selectedZone.roofConfig!.type === 'flat'
                                            ? 'gable'
                                            : selectedZone.roofConfig!.type,
                                        roofSpanMode: 'og_and_dg_in_roof',
                                        footprintScope: 'building',
                                        pitchDeg: Math.max(
                                          35,
                                          selectedZone.roofConfig!.pitchDeg ?? 38
                                        ),
                                        kniestockHeight:
                                          selectedZone.roofConfig!.kniestockHeight ?? 0.85,
                                        spitzbodenHeight:
                                          selectedZone.roofConfig!.spitzbodenHeight ?? 2.65,
                                        hasSpitzbodenFloor: true,
                                        overhang: selectedZone.roofConfig!.overhang ?? 0.45,
                                        gableOverhang:
                                          selectedZone.roofConfig!.gableOverhang ?? 0.35,
                                      },
                                    })
                                  }
                                  className="px-2 py-1 rounded bg-emerald-400 hover:bg-emerald-300 text-slate-950 text-[9px] font-bold shrink-0"
                                >
                                  Hausdach (EG + OG im Dach + DG)
                                </button>
                              </div>

                              <div className="grid grid-cols-2 gap-1.5">
                                <div>
                                  <label className="block text-[9px] text-slate-400 mb-0.5">
                                    Dach-Geschoss-Modus
                                  </label>
                                  <select
                                    value={selectedZone.roofConfig.roofSpanMode || 'single_floor'}
                                    onChange={(e) => {
                                      const nextMode = e.target.value as RoofSpanMode;
                                      onUpdateZone(selectedZone.id, {
                                        roofConfig: {
                                          ...selectedZone.roofConfig!,
                                          roofSpanMode: nextMode,
                                          footprintScope:
                                            nextMode !== 'single_floor'
                                              ? 'building'
                                              : selectedZone.roofConfig!.footprintScope || 'zone',
                                          kniestockHeight:
                                            selectedZone.roofConfig!.kniestockHeight ?? 0.85,
                                          spitzbodenHeight:
                                            selectedZone.roofConfig!.spitzbodenHeight ?? 2.65,
                                          hasSpitzbodenFloor:
                                            selectedZone.roofConfig!.hasSpitzbodenFloor ?? true,
                                        },
                                      });
                                    }}
                                    className="w-full bg-slate-950 border border-sky-400/35 rounded px-1.5 py-1 text-[10px] text-sky-200 font-semibold"
                                  >
                                    <option value="single_floor">
                                      Standard (nur auf dieser Etage)
                                    </option>
                                    <option value="og_in_roof">
                                      Dach auf EG (1. OG liegt im Dach)
                                    </option>
                                    <option value="og_and_dg_in_roof">
                                      Dach auf EG (1. OG im Dach + DG / Spitzboden)
                                    </option>
                                  </select>
                                </div>

                                <div>
                                  <label className="block text-[9px] text-slate-400 mb-0.5">
                                    Dach-Grundfläche
                                  </label>
                                  <select
                                    value={
                                      (selectedZone.roofConfig.roofSpanMode || 'single_floor') !==
                                      'single_floor'
                                        ? 'building'
                                        : selectedZone.roofConfig.footprintScope || 'zone'
                                    }
                                    onChange={(e) =>
                                      onUpdateZone(selectedZone.id, {
                                        roofConfig: {
                                          ...selectedZone.roofConfig!,
                                          footprintScope: e.target.value as RoofFootprintScope,
                                        },
                                      })
                                    }
                                    className="w-full bg-slate-950 border border-white/15 rounded px-1.5 py-1 text-[10px] text-white"
                                  >
                                    <option value="zone">Nur dieser Raum / Gebäudeteil</option>
                                    <option value="building">
                                      Ganzes Gebäude ({selectedZone.buildingId || 'Haus'})
                                    </option>
                                  </select>
                                </div>
                              </div>

                              <div className="grid grid-cols-2 gap-2 pt-0.5">
                                <div>
                                  <div className="text-[9px] text-slate-300 mb-0.5">
                                    Kniestock / Drempelhöhe (
                                    {(
                                      selectedZone.roofConfig.kniestockHeight ??
                                      ((selectedZone.roofConfig.roofSpanMode || 'single_floor') !==
                                      'single_floor'
                                        ? 0.85
                                        : 0)
                                    ).toFixed(2)}
                                    m)
                                  </div>
                                  <input
                                    type="range"
                                    min={0}
                                    max={1.8}
                                    step={0.05}
                                    value={
                                      selectedZone.roofConfig.kniestockHeight ??
                                      ((selectedZone.roofConfig.roofSpanMode || 'single_floor') !==
                                      'single_floor'
                                        ? 0.85
                                        : 0)
                                    }
                                    onChange={(e) =>
                                      onUpdateZone(selectedZone.id, {
                                        roofConfig: {
                                          ...selectedZone.roofConfig!,
                                          kniestockHeight: parseFloat(e.target.value),
                                        },
                                      })
                                    }
                                    className="w-full accent-sky-400"
                                  />
                                </div>

                                {(selectedZone.roofConfig.roofSpanMode || 'single_floor') ===
                                  'og_and_dg_in_roof' && (
                                  <div>
                                    <div className="text-[9px] text-amber-200 mb-0.5">
                                      DG-Spitzbodenhöhe (
                                      {(selectedZone.roofConfig.spitzbodenHeight ?? 2.65).toFixed(
                                        2
                                      )}
                                      m)
                                    </div>
                                    <input
                                      type="range"
                                      min={2.2}
                                      max={3.4}
                                      step={0.05}
                                      value={selectedZone.roofConfig.spitzbodenHeight ?? 2.65}
                                      onChange={(e) =>
                                        onUpdateZone(selectedZone.id, {
                                          roofConfig: {
                                            ...selectedZone.roofConfig!,
                                            spitzbodenHeight: parseFloat(e.target.value),
                                          },
                                        })
                                      }
                                      className="w-full accent-amber-400"
                                    />
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* SEPARATE DACH-SICHTBARKEIT PRO GEBÄUDE (z.B. Garage immer sichtbar, Wohnhaus ausgeblendet) */}
                            <div className="p-2.5 rounded-lg bg-slate-900/90 border border-amber-400/35 space-y-1.5">
                              <div className="flex items-center justify-between">
                                <span className="text-[11px] font-bold text-amber-300">
                                  Feste Dach-Sichtbarkeit für dieses Gebäude
                                </span>
                                <span className="text-[9.5px] font-mono text-slate-400">
                                  {selectedZone.buildingId || 'Gebäude'}
                                </span>
                              </div>
                              <p className="text-[9.5px] text-slate-400 leading-snug">
                                Lege fest, ob das Dach dieses Gebäudes (z.B. Garage) dauerhaft eingeblendet bleibt, während das Wohnhaus freien Einblick bietet:
                              </p>
                              <div className="grid grid-cols-3 gap-1">
                                {(
                                  [
                                    {
                                      id: 'auto',
                                      label: 'Globaler Schalter',
                                    },
                                    {
                                      id: 'always_visible',
                                      label: 'Immer sichtbar',
                                    },
                                    {
                                      id: 'always_hidden',
                                      label: 'Immer ausgeblendet',
                                    },
                                  ] as const
                                ).map((visOpt) => {
                                  const curVis =
                                    selectedZone.roofConfig?.visibilityMode || 'auto';
                                  return (
                                    <button
                                      key={visOpt.id}
                                      type="button"
                                      onClick={() =>
                                        onUpdateZone(selectedZone.id, {
                                          roofConfig: {
                                            ...selectedZone.roofConfig!,
                                            visibilityMode: visOpt.id,
                                          },
                                        })
                                      }
                                      className={`py-1.5 px-1.5 rounded text-[10px] font-semibold transition-colors ${
                                        curVis === visOpt.id
                                          ? 'bg-amber-400 text-slate-950 font-bold shadow-sm'
                                          : 'bg-slate-950 text-slate-300 hover:bg-slate-800 border border-white/10'
                                      }`}
                                    >
                                      {visOpt.label}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>

                            {/* PV-MODULE / SOLARANLAGE DIREKT AUF DEM DACH (Pro Dachseite separat einstellbar!) */}
                            <div className="p-2.5 rounded-lg bg-slate-900/90 border border-emerald-400/35 space-y-2">
                              <div className="flex items-center justify-between">
                                <div>
                                  <div className="text-[11px] font-bold text-emerald-300">
                                    PV-Module / Solaranlage auf dem Dach
                                  </div>
                                  <div className="text-[9px] text-slate-400">
                                    Pro Dachseite separat aktivierbar & Modulanzahl pro Seite einstellbar
                                  </div>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => {
                                    const curPv = selectedZone.roofConfig?.pvConfig;
                                    const nextEnabled = !curPv?.enabled;
                                    onUpdateZone(selectedZone.id, {
                                      roofConfig: {
                                        ...selectedZone.roofConfig!,
                                        pvConfig: {
                                          enabled: nextEnabled,
                                          sides: curPv?.sides || 'per_side',
                                          perSide: curPv?.perSide || {
                                            front: {
                                              enabled: true,
                                              moduleCount: curPv?.moduleCount,
                                              coveragePct: curPv?.coveragePct ?? 75,
                                            },
                                            back: {
                                              enabled: curPv?.sides === 'both' || curPv?.sides === 'back',
                                              moduleCount: undefined,
                                              coveragePct: curPv?.coveragePct ?? 75,
                                            },
                                          },
                                          coveragePct: curPv?.coveragePct ?? 75,
                                          kwPeak: curPv?.kwPeak ?? 9.6,
                                          entityId:
                                            curPv?.entityId || 'sensor.solar_production_power',
                                        },
                                      },
                                    });
                                  }}
                                  className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-colors ${
                                    selectedZone.roofConfig?.pvConfig?.enabled
                                      ? 'bg-emerald-400 text-slate-950 shadow-sm'
                                      : 'bg-slate-950 text-slate-300 hover:bg-slate-800 border border-white/15'
                                  }`}
                                >
                                  {selectedZone.roofConfig?.pvConfig?.enabled
                                    ? '✓ PV-Dach Aktiv'
                                    : '+ PV-Module aktivieren'}
                                </button>
                              </div>

                              {selectedZone.roofConfig?.pvConfig?.enabled && (() => {
                                const pvCfg = selectedZone.roofConfig.pvConfig!;
                                const roofType = selectedZone.roofConfig.type;
                                const sideDefs: {
                                  id: 'front' | 'back' | 'left' | 'right';
                                  title: string;
                                  hint: string;
                                }[] =
                                  roofType === 'flat'
                                    ? [
                                        {
                                          id: 'front',
                                          title: 'Flachdach-Aufständerung (Süd 16°)',
                                          hint: 'Aufgeständerte Modulreihen auf dem Flachdach',
                                        },
                                      ]
                                    : roofType === 'mono_pitch'
                                    ? [
                                        {
                                          id: 'front',
                                          title: 'Pultdach-Hauptfläche',
                                          hint: 'Geneigte Dachfläche des Pultdachs',
                                        },
                                      ]
                                    : roofType === 'hipped' || roofType === 'tent'
                                    ? [
                                        {
                                          id: 'front',
                                          title: 'Vorderseite / Süd-Dachfläche',
                                          hint: 'Traufseite Vorne (+Z)',
                                        },
                                        {
                                          id: 'back',
                                          title: 'Rückseite / Nord-Dachfläche',
                                          hint: 'Traufseite Hinten (-Z)',
                                        },
                                        {
                                          id: 'left',
                                          title: 'Linke Walmseite / West',
                                          hint: 'Dreieckige Walmfläche Links (-X)',
                                        },
                                        {
                                          id: 'right',
                                          title: 'Rechte Walmseite / Ost',
                                          hint: 'Dreieckige Walmfläche Rechts (+X)',
                                        },
                                      ]
                                    : [
                                        {
                                          id: 'front',
                                          title: 'Dachseite 1: Vorderseite / Süd',
                                          hint: 'Vordere Dachhälfte (+Z)',
                                        },
                                        {
                                          id: 'back',
                                          title: 'Dachseite 2: Rückseite / Nord',
                                          hint: 'Hintere Dachhälfte (-Z)',
                                        },
                                      ];

                                const getEffectiveSideCfg = (
                                  sId: 'front' | 'back' | 'left' | 'right'
                                ) => {
                                  if (pvCfg.perSide && pvCfg.perSide[sId] !== undefined) {
                                    return pvCfg.perSide[sId]!;
                                  }
                                  const defaultEnabled =
                                    sId === 'front'
                                      ? pvCfg.sides !== 'back'
                                      : sId === 'back'
                                      ? pvCfg.sides === 'back' || pvCfg.sides === 'both'
                                      : false;
                                  return {
                                    enabled: defaultEnabled,
                                    moduleCount: pvCfg.moduleCount,
                                    coveragePct: pvCfg.coveragePct ?? 75,
                                  };
                                };

                                const updateSideCfg = (
                                  sId: 'front' | 'back' | 'left' | 'right',
                                  patch: {
                                    enabled?: boolean;
                                    moduleCount?: number;
                                    coveragePct?: number;
                                  }
                                ) => {
                                  const nextPerSide: NonNullable<typeof pvCfg.perSide> = {};
                                  for (const sd of sideDefs) {
                                    const cur = getEffectiveSideCfg(sd.id);
                                    nextPerSide[sd.id] =
                                      sd.id === sId ? { ...cur, ...patch } : cur;
                                  }
                                  // Recompute total kWp if explicit module counts are set
                                  let totalExplicitMods = 0;
                                  for (const sd of sideDefs) {
                                    const sc = nextPerSide[sd.id];
                                    if (sc?.enabled && sc.moduleCount && sc.moduleCount > 0) {
                                      totalExplicitMods += sc.moduleCount;
                                    }
                                  }
                                  onUpdateZone(selectedZone.id, {
                                    roofConfig: {
                                      ...selectedZone.roofConfig!,
                                      pvConfig: {
                                        ...pvCfg,
                                        sides: 'per_side',
                                        perSide: nextPerSide,
                                        kwPeak:
                                          totalExplicitMods > 0
                                            ? +(totalExplicitMods * 0.425).toFixed(2)
                                            : pvCfg.kwPeak ?? 9.6,
                                      },
                                    },
                                  });
                                };

                                return (
                                  <div className="space-y-2 pt-1 border-t border-white/10">
                                    <div className="text-[9.5px] font-semibold text-emerald-200">
                                      Dachseiten einzeln konfigurieren (pro Seite AN/AUS & Modulanzahl):
                                    </div>

                                    <div className="space-y-2">
                                      {sideDefs.map((sd) => {
                                        const sCfg = getEffectiveSideCfg(sd.id);
                                        const modCnt = sCfg.moduleCount ?? 0;
                                        const covPct = sCfg.coveragePct ?? 75;
                                        return (
                                          <div
                                            key={sd.id}
                                            className={`p-2 rounded-lg border transition-colors space-y-1.5 ${
                                              sCfg.enabled
                                                ? 'bg-slate-950/95 border-emerald-400/40'
                                                : 'bg-slate-950/50 border-white/10 opacity-75'
                                            }`}
                                          >
                                            <div className="flex items-center justify-between gap-2">
                                              <div>
                                                <div className="text-[10px] font-bold text-white">
                                                  {sd.title}
                                                </div>
                                                <div className="text-[8.5px] text-slate-400">
                                                  {sd.hint}
                                                </div>
                                              </div>
                                              <button
                                                type="button"
                                                onClick={() =>
                                                  updateSideCfg(sd.id, {
                                                    enabled: !sCfg.enabled,
                                                  })
                                                }
                                                className={`px-2 py-0.5 rounded text-[9.5px] font-bold transition-colors ${
                                                  sCfg.enabled
                                                    ? 'bg-emerald-400 text-slate-950'
                                                    : 'bg-slate-800 text-slate-400 hover:text-white'
                                                }`}
                                              >
                                                {sCfg.enabled ? 'Seite AN' : 'Seite AUS'}
                                              </button>
                                            </div>

                                            {sCfg.enabled && (
                                              <div className="space-y-1.5 pt-1 border-t border-white/10">
                                                <div className="flex items-center justify-between text-[9px] text-slate-300">
                                                  <span>Anzahl Module ({sd.title.split(':')[0]}):</span>
                                                  <span className="font-mono text-emerald-300 font-bold">
                                                    {modCnt > 0
                                                      ? `${modCnt} Module (${(
                                                          modCnt * 0.425
                                                        ).toFixed(1)} kWp)`
                                                      : `Automatisch (${covPct}% Fläche)`}
                                                  </span>
                                                </div>
                                                <div className="flex items-center gap-1.5">
                                                  <input
                                                    type="number"
                                                    min={0}
                                                    max={50}
                                                    step={1}
                                                    placeholder="Auto"
                                                    value={modCnt}
                                                    onChange={(e) => {
                                                      const cnt = Math.max(
                                                        0,
                                                        Math.min(
                                                          50,
                                                          parseInt(e.target.value, 10) || 0
                                                        )
                                                      );
                                                      updateSideCfg(sd.id, {
                                                        moduleCount: cnt > 0 ? cnt : undefined,
                                                      });
                                                    }}
                                                    className="w-14 bg-slate-900 border border-white/15 rounded px-1.5 py-0.5 text-[10px] font-mono text-emerald-300"
                                                  />
                                                  <input
                                                    type="range"
                                                    min={0}
                                                    max={36}
                                                    step={1}
                                                    value={modCnt}
                                                    onChange={(e) => {
                                                      const cnt = parseInt(e.target.value, 10);
                                                      updateSideCfg(sd.id, {
                                                        moduleCount: cnt > 0 ? cnt : undefined,
                                                      });
                                                    }}
                                                    className="flex-1 accent-emerald-400"
                                                  />
                                                  {modCnt > 0 && (
                                                    <button
                                                      type="button"
                                                      onClick={() =>
                                                        updateSideCfg(sd.id, {
                                                          moduleCount: undefined,
                                                        })
                                                      }
                                                      className="px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-[8.5px] text-slate-300"
                                                    >
                                                      Auto %
                                                    </button>
                                                  )}
                                                </div>

                                                {modCnt === 0 && (
                                                  <div className="flex items-center gap-2 pt-0.5">
                                                    <span className="text-[8.5px] text-slate-400 shrink-0">
                                                      Fläche %:
                                                    </span>
                                                    <input
                                                      type="range"
                                                      min={25}
                                                      max={95}
                                                      step={5}
                                                      value={covPct}
                                                      onChange={(e) =>
                                                        updateSideCfg(sd.id, {
                                                          coveragePct: parseInt(
                                                            e.target.value,
                                                            10
                                                          ),
                                                        })
                                                      }
                                                      className="flex-1 accent-emerald-400"
                                                    />
                                                    <span className="text-[9px] font-mono text-emerald-300 w-8 text-right">
                                                      {covPct}%
                                                    </span>
                                                  </div>
                                                )}
                                              </div>
                                            )}
                                          </div>
                                        );
                                      })}
                                    </div>

                                    <div className="grid grid-cols-2 gap-1.5 pt-1">
                                      <div>
                                        <label className="block text-[9px] text-slate-400 mb-0.5">
                                          Gesamtleistung (kWp)
                                        </label>
                                        <input
                                          type="number"
                                          step={0.4}
                                          min={0.8}
                                          max={60}
                                          value={pvCfg.kwPeak ?? 9.6}
                                          onChange={(e) =>
                                            onUpdateZone(selectedZone.id, {
                                              roofConfig: {
                                                ...selectedZone.roofConfig!,
                                                pvConfig: {
                                                  ...pvCfg,
                                                  kwPeak: parseFloat(e.target.value) || 9.6,
                                                },
                                              },
                                            })
                                          }
                                          className="w-full bg-slate-950 border border-white/15 rounded px-2 py-1 text-[10px] font-mono text-emerald-300"
                                        />
                                      </div>

                                      <div>
                                        <label className="block text-[9px] text-slate-400 mb-0.5">
                                          HA PV-Entität (Live-Card)
                                        </label>
                                        <select
                                          value={
                                            pvCfg.entityId || 'sensor.solar_production_power'
                                          }
                                          onChange={(e) =>
                                            onUpdateZone(selectedZone.id, {
                                              roofConfig: {
                                                ...selectedZone.roofConfig!,
                                                pvConfig: {
                                                  ...pvCfg,
                                                  entityId: e.target.value || undefined,
                                                },
                                              },
                                            })
                                          }
                                          className="w-full bg-slate-950 border border-white/15 rounded px-1.5 py-1 text-[10px] font-mono text-emerald-300"
                                        >
                                          <option value="">— Keine Entität —</option>
                                          {entityIds
                                            .filter((id) => id.startsWith('sensor.'))
                                            .map((id) => (
                                              <option key={id} value={id}>
                                                {id} (
                                                {entities[id]?.attributes.friendly_name ||
                                                  entities[id]?.state}
                                                )
                                              </option>
                                            ))}
                                        </select>
                                      </div>
                                    </div>
                                  </div>
                                );
                              })()}
                            </div>

                            {/* 1. EINZELNE DACHGAUBEN (inkl. mehrere Gaubenfenster einzeln bearbeiten & Kniestock auf Dach) */}
                            {selectedZone.roofConfig.type !== 'flat' && (() => {
                              const hostFootprint = computeRoofHostFootprintZone(
                                selectedZone,
                                project.zones
                              );
                              const ridgeLen =
                                (selectedZone.roofConfig.ridgeDirection || 'x') === 'x'
                                  ? hostFootprint.width
                                  : hostFootprint.depth;
                              const maxOffset = Math.max(
                                0.5,
                                Number((ridgeLen / 2 - 0.7).toFixed(2))
                              );
                              const effectiveDormers = getEffectiveRoofDormers(
                                selectedZone.roofConfig,
                                ridgeLen
                              );

                              const commitDormers = (nextList: RoofDormerItem[]) => {
                                onUpdateZone(selectedZone.id, {
                                  roofConfig: {
                                    ...selectedZone.roofConfig!,
                                    dormerType: nextList.length > 0 ? nextList[0].type : 'none',
                                    dormers: nextList,
                                  },
                                });
                              };

                              return (
                                <div className="pt-2.5 border-t border-white/10 space-y-2">
                                  <div className="flex items-center justify-between">
                                    <div>
                                      <div className="text-[11px] font-bold text-amber-300">
                                        Dachgauben einzeln ({effectiveDormers.length})
                                      </div>
                                      <div className="text-[9px] text-slate-400">
                                        Gauben-Kniestock auf Dach & mehrere Fenster einzeln einstellbar
                                      </div>
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const count = effectiveDormers.length;
                                        const defaultOffset =
                                          count === 0
                                            ? 0
                                            : count % 2 === 1
                                            ? Math.min(maxOffset, 1.4)
                                            : -Math.min(maxOffset, 1.4);
                                        const newDormer: RoofDormerItem = {
                                          id: `dormer_${Date.now()}_${count}`,
                                          type: 'gable',
                                          side: 'front',
                                          offsetAlongRidge: Number(defaultOffset.toFixed(2)),
                                          width: 1.8,
                                          height: 1.35,
                                          sillHeight: 0.24,
                                          eavesSetback: 0.35,
                                          windowCount: 2,
                                          windowStyle: 'mullion_cross',
                                          windowFrameColor: 'anthracite',
                                          windowOpenState: 'closed',
                                          hasShutter: false,
                                          shutterClosedPct: 0,
                                          windows: [
                                            {
                                              id: `dwin_${Date.now()}_0`,
                                              widthRatio: 1,
                                              sashCount: 1,
                                              hingeSide: 'left',
                                              windowStyle: 'mullion_cross',
                                              windowFrameColor: 'anthracite',
                                              windowOpenState: 'closed',
                                              hasShutter: false,
                                              shutterClosedPct: 0,
                                            },
                                            {
                                              id: `dwin_${Date.now()}_1`,
                                              widthRatio: 1,
                                              sashCount: 1,
                                              hingeSide: 'right',
                                              windowStyle: 'mullion_cross',
                                              windowFrameColor: 'anthracite',
                                              windowOpenState: 'closed',
                                              hasShutter: false,
                                              shutterClosedPct: 0,
                                            },
                                          ],
                                        };
                                        commitDormers([...effectiveDormers, newDormer]);
                                      }}
                                      className="px-2 py-1 rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 text-[10px] font-bold transition-colors"
                                    >
                                      + Dachgaube hinzufügen
                                    </button>
                                  </div>

                                  {effectiveDormers.length === 0 ? (
                                    <div className="text-[10px] text-slate-400 bg-slate-900/70 rounded-lg px-2.5 py-2 border border-white/5">
                                      Noch keine Dachgaube auf diesem Dach. Klicke auf „+ Dachgaube hinzufügen“, um Gauben einzeln zu platzieren.
                                    </div>
                                  ) : (
                                    <div className="space-y-2 max-h-96 overflow-y-auto pr-0.5">
                                      {effectiveDormers.map((dItem, idx) => {
                                        const updateThisDormer = (
                                          patch: Partial<RoofDormerItem>
                                        ) => {
                                          const next = effectiveDormers.map((item, i) =>
                                            i === idx ? { ...item, ...patch } : item
                                          );
                                          commitDormers(next);
                                        };
                                        const dormerWins = getEffectiveDormerWindows(dItem);
                                        const commitDormerWins = (nextWins: DormerWindowUnit[]) => {
                                          updateThisDormer({
                                            windows: nextWins,
                                            windowCount: Math.min(
                                              3,
                                              Math.max(1, nextWins.length)
                                            ) as 1 | 2 | 3,
                                          });
                                        };

                                        return (
                                          <div
                                            key={dItem.id || idx}
                                            className="p-2.5 rounded-lg bg-slate-900/90 border border-amber-400/30 space-y-2"
                                          >
                                            <div className="flex items-center justify-between">
                                              <span className="text-[11px] font-bold text-amber-200">
                                                Gaube #{idx + 1} (
                                                {dItem.side === 'back'
                                                  ? 'Rückseite'
                                                  : 'Vorderseite'}{' '}
                                                · {dormerWins.length} Fenster)
                                              </span>
                                              <button
                                                type="button"
                                                onClick={() =>
                                                  commitDormers(
                                                    effectiveDormers.filter((_, i) => i !== idx)
                                                  )
                                                }
                                                className="px-1.5 py-0.5 rounded bg-red-500/20 hover:bg-red-500/35 text-red-300 text-[10px] font-semibold"
                                              >
                                                Entfernen
                                              </button>
                                            </div>

                                            {/* Gauben-Dachform & Dachseite */}
                                            <div className="grid grid-cols-2 gap-1.5">
                                              <div>
                                                <label className="block text-[9px] text-slate-400 mb-0.5">
                                                  Gauben-Dachform
                                                </label>
                                                <select
                                                  value={dItem.type}
                                                  onChange={(e) =>
                                                    updateThisDormer({
                                                      type: e.target.value as Exclude<
                                                        RoofDormerType,
                                                        'none'
                                                      >,
                                                    })
                                                  }
                                                  className="w-full bg-slate-950 border border-white/15 rounded px-1.5 py-1 text-[10px] text-amber-200"
                                                >
                                                  <option value="gable">Spitzgaube / Giebelgaube</option>
                                                  <option value="shed">Schleppgaube (fallend)</option>
                                                  <option value="flat_box">Flachdach-Kastengaube</option>
                                                  <option value="trapezoid">Trapezgaube</option>
                                                  <option value="arched">Rundbogengaube</option>
                                                </select>
                                              </div>
                                              <div>
                                                <label className="block text-[9px] text-slate-400 mb-0.5">
                                                  Dachseite
                                                </label>
                                                <select
                                                  value={dItem.side}
                                                  onChange={(e) =>
                                                    updateThisDormer({
                                                      side: e.target.value as 'front' | 'back',
                                                    })
                                                  }
                                                  className="w-full bg-slate-950 border border-white/15 rounded px-1.5 py-1 text-[10px] text-white"
                                                >
                                                  <option value="front">Vorderseite / Süd-Ost</option>
                                                  <option value="back">Rückseite / Nord-West</option>
                                                </select>
                                              </div>
                                            </div>

                                            {/* Position along ridge & Dimensions */}
                                            <div className="grid grid-cols-3 gap-1.5">
                                              <div>
                                                <div className="text-[9px] text-slate-400 mb-0.5">
                                                  Pos. First ({dItem.offsetAlongRidge.toFixed(2)}m)
                                                </div>
                                                <input
                                                  type="range"
                                                  min={-maxOffset}
                                                  max={maxOffset}
                                                  step={0.1}
                                                  value={dItem.offsetAlongRidge}
                                                  onChange={(e) =>
                                                    updateThisDormer({
                                                      offsetAlongRidge: parseFloat(e.target.value),
                                                    })
                                                  }
                                                  className="w-full accent-amber-400"
                                                />
                                              </div>
                                              <div>
                                                <div className="text-[9px] text-slate-400 mb-0.5">
                                                  Breite ({dItem.width.toFixed(2)}m)
                                                </div>
                                                <input
                                                  type="range"
                                                  min={0.8}
                                                  max={3.6}
                                                  step={0.05}
                                                  value={dItem.width}
                                                  onChange={(e) =>
                                                    updateThisDormer({
                                                      width: parseFloat(e.target.value),
                                                    })
                                                  }
                                                  className="w-full accent-amber-400"
                                                />
                                              </div>
                                              <div>
                                                <div className="text-[9px] text-slate-400 mb-0.5">
                                                  Höhe ({dItem.height.toFixed(2)}m)
                                                </div>
                                                <input
                                                  type="range"
                                                  min={0.75}
                                                  max={2.2}
                                                  step={0.05}
                                                  value={dItem.height}
                                                  onChange={(e) =>
                                                    updateThisDormer({
                                                      height: parseFloat(e.target.value),
                                                    })
                                                  }
                                                  className="w-full accent-amber-400"
                                                />
                                              </div>
                                            </div>

                                            {/* Gauben-Kniestock / Brüstung (sitzt sauber auf dem Dach) & Trauf-Rücksprung */}
                                            <div className="grid grid-cols-2 gap-1.5">
                                              <div>
                                                <div className="text-[9px] text-amber-200 mb-0.5">
                                                  Gauben-Kniestock / Brüstung (
                                                  {(dItem.sillHeight ?? 0.24).toFixed(2)}m)
                                                </div>
                                                <input
                                                  type="range"
                                                  min={0.05}
                                                  max={0.9}
                                                  step={0.03}
                                                  value={dItem.sillHeight ?? 0.24}
                                                  onChange={(e) =>
                                                    updateThisDormer({
                                                      sillHeight: parseFloat(e.target.value),
                                                    })
                                                  }
                                                  className="w-full accent-amber-400"
                                                />
                                              </div>
                                              <div>
                                                <div className="text-[9px] text-slate-400 mb-0.5">
                                                  Trauf-Rücksprung (
                                                  {(dItem.eavesSetback ?? 0.35).toFixed(2)}m)
                                                </div>
                                                <input
                                                  type="range"
                                                  min={0.05}
                                                  max={1.6}
                                                  step={0.05}
                                                  value={dItem.eavesSetback ?? 0.35}
                                                  onChange={(e) =>
                                                    updateThisDormer({
                                                      eavesSetback: parseFloat(e.target.value),
                                                    })
                                                  }
                                                  className="w-full accent-amber-400"
                                                />
                                              </div>
                                            </div>

                                            {/* MEHRERE FENSTER IN DER GAUBE EINZELN HINZUFÜGEN & BEARBEITEN */}
                                            <div className="pt-1.5 border-t border-white/10 space-y-1.5">
                                              <div className="flex items-center justify-between">
                                                <div className="text-[10px] font-semibold text-sky-300">
                                                  Einzelne Fenster in Gaube #{idx + 1} (
                                                  {dormerWins.length})
                                                </div>
                                                {dormerWins.length < 4 && (
                                                  <button
                                                    type="button"
                                                    onClick={() => {
                                                      const nextWin: DormerWindowUnit = {
                                                        id: `dwin_${Date.now()}_${dormerWins.length}`,
                                                        widthRatio: 1,
                                                        sashCount: 1,
                                                        hingeSide:
                                                          dormerWins.length % 2 === 0
                                                            ? 'left'
                                                            : 'right',
                                                        windowStyle:
                                                          dItem.windowStyle || 'mullion_cross',
                                                        windowFrameColor:
                                                          dItem.windowFrameColor || 'anthracite',
                                                        windowOpenState: 'closed',
                                                        hasShutter: false,
                                                        shutterClosedPct: 40,
                                                      };
                                                      commitDormerWins([
                                                        ...dormerWins,
                                                        nextWin,
                                                      ]);
                                                    }}
                                                    className="px-1.5 py-0.5 rounded bg-sky-400 hover:bg-sky-300 text-slate-950 text-[9px] font-bold"
                                                  >
                                                    + Fenster in Gaube
                                                  </button>
                                                )}
                                              </div>

                                              <div className="space-y-1.5">
                                                {dormerWins.map((wUnit, wIdx) => {
                                                  const patchWin = (
                                                    p: Partial<DormerWindowUnit>
                                                  ) => {
                                                    commitDormerWins(
                                                      dormerWins.map((u, i) =>
                                                        i === wIdx ? { ...u, ...p } : u
                                                      )
                                                    );
                                                  };

                                                  return (
                                                    <div
                                                      key={wUnit.id || wIdx}
                                                      className="p-2 rounded bg-slate-950/90 border border-sky-400/25 space-y-1.5"
                                                    >
                                                      <div className="flex items-center justify-between">
                                                        <span className="text-[10px] font-bold text-sky-200">
                                                          Fenster #{wIdx + 1} in Gaube #{idx + 1}
                                                        </span>
                                                        {dormerWins.length > 1 && (
                                                          <button
                                                            type="button"
                                                            onClick={() =>
                                                              commitDormerWins(
                                                                dormerWins.filter(
                                                                  (_, i) => i !== wIdx
                                                                )
                                                              )
                                                            }
                                                            className="px-1.5 py-0.5 rounded bg-red-500/20 text-red-300 text-[9px] font-semibold"
                                                          >
                                                            × Fenster entfernen
                                                          </button>
                                                        )}
                                                      </div>

                                                      <div className="grid grid-cols-3 gap-1">
                                                        <div>
                                                          <label className="block text-[8px] text-slate-400 mb-0.5">
                                                            Flügel & Anschlag
                                                          </label>
                                                          <select
                                                            value={`${wUnit.sashCount ?? 1}_${wUnit.hingeSide || 'left'}`}
                                                            onChange={(e) => {
                                                              const [sc, hs] =
                                                                e.target.value.split('_');
                                                              patchWin({
                                                                sashCount: (parseInt(sc, 10) === 2
                                                                  ? 2
                                                                  : 1) as 1 | 2,
                                                                hingeSide: (hs === 'right'
                                                                  ? 'right'
                                                                  : 'left') as 'left' | 'right',
                                                              });
                                                            }}
                                                            className="w-full bg-slate-900 border border-white/15 rounded px-1 py-0.5 text-[9px] text-white"
                                                          >
                                                            <option value="1_left">
                                                              1-fl. (Links)
                                                            </option>
                                                            <option value="1_right">
                                                              1-fl. (Rechts)
                                                            </option>
                                                            <option value="2_left">
                                                              2-fl. (Doppel)
                                                            </option>
                                                          </select>
                                                        </div>

                                                        <div>
                                                          <label className="block text-[8px] text-slate-400 mb-0.5">
                                                            Design / Sprossen
                                                          </label>
                                                          <select
                                                            value={
                                                              wUnit.windowStyle ||
                                                              dItem.windowStyle ||
                                                              'mullion_cross'
                                                            }
                                                            onChange={(e) =>
                                                              patchWin({
                                                                windowStyle:
                                                                  e.target
                                                                    .value as DormerWindowStyle,
                                                              })
                                                            }
                                                            className="w-full bg-slate-900 border border-white/15 rounded px-1 py-0.5 text-[9px] text-white"
                                                          >
                                                            <option value="modern_single">
                                                              Klarglas
                                                            </option>
                                                            <option value="mullion_cross">
                                                              Kreuzsprossen
                                                            </option>
                                                            <option value="industrial_loft">
                                                              Loft-Gitter
                                                            </option>
                                                            <option value="arched_classic">
                                                              Kämpferprofil
                                                            </option>
                                                            <option value="frosted_privacy">
                                                              Milchglas
                                                            </option>
                                                          </select>
                                                        </div>

                                                        <div>
                                                          <label className="block text-[8px] text-slate-400 mb-0.5">
                                                            Rahmenfarbe
                                                          </label>
                                                          <select
                                                            value={
                                                              wUnit.windowFrameColor ||
                                                              dItem.windowFrameColor ||
                                                              'anthracite'
                                                            }
                                                            onChange={(e) =>
                                                              patchWin({
                                                                windowFrameColor:
                                                                  e.target
                                                                    .value as OpeningFrameColor,
                                                              })
                                                            }
                                                            className="w-full bg-slate-900 border border-white/15 rounded px-1 py-0.5 text-[9px] text-white"
                                                          >
                                                            <option value="anthracite">
                                                              Anthrazit
                                                            </option>
                                                            <option value="white">Reinweiß</option>
                                                            <option value="oak">Eiche Natur</option>
                                                            <option value="walnut">Nussbaum</option>
                                                            <option value="alu_silver">
                                                              Alu Silber
                                                            </option>
                                                            <option value="matte_black">
                                                              Tiefschwarz
                                                            </option>
                                                            <option value="sage_green">
                                                              Salbeigrün
                                                            </option>
                                                            <option value="bronze_corten">
                                                              Bronze / Corten
                                                            </option>
                                                            <option value="burgundy_red">
                                                              Weinrot
                                                            </option>
                                                          </select>
                                                        </div>
                                                      </div>

                                                      <div className="grid grid-cols-3 gap-1 items-center">
                                                        <div>
                                                          <label className="block text-[8px] text-slate-400 mb-0.5">
                                                            3D-Öffnung
                                                          </label>
                                                          <select
                                                            value={
                                                              wUnit.windowOpenState ||
                                                              dItem.windowOpenState ||
                                                              'closed'
                                                            }
                                                            onChange={(e) =>
                                                              patchWin({
                                                                windowOpenState: e.target.value as
                                                                  | 'closed'
                                                                  | 'tilted'
                                                                  | 'open',
                                                              })
                                                            }
                                                            className="w-full bg-slate-900 border border-sky-400/35 rounded px-1 py-0.5 text-[9px] text-sky-200 font-semibold"
                                                          >
                                                            <option value="closed">
                                                              Geschlossen
                                                            </option>
                                                            <option value="tilted">
                                                              Gekippt (14°)
                                                            </option>
                                                            <option value="open">
                                                              Geöffnet (Dreh)
                                                            </option>
                                                          </select>
                                                        </div>

                                                        <div>
                                                          <div className="text-[8px] text-slate-400 mb-0.5">
                                                            Breite (
                                                            {(wUnit.widthRatio ?? 1).toFixed(1)}×)
                                                          </div>
                                                          <input
                                                            type="range"
                                                            min={0.5}
                                                            max={2.0}
                                                            step={0.1}
                                                            value={wUnit.widthRatio ?? 1}
                                                            onChange={(e) =>
                                                              patchWin({
                                                                widthRatio: parseFloat(
                                                                  e.target.value
                                                                ),
                                                              })
                                                            }
                                                            className="w-full accent-sky-400"
                                                          />
                                                        </div>

                                                        <div className="flex items-center gap-1 pt-2">
                                                          <button
                                                            type="button"
                                                            onClick={() =>
                                                              patchWin({
                                                                hasShutter: !wUnit.hasShutter,
                                                                shutterClosedPct:
                                                                  wUnit.shutterClosedPct ?? 40,
                                                              })
                                                            }
                                                            className={`px-1.5 py-0.5 rounded text-[8px] font-semibold ${
                                                              wUnit.hasShutter
                                                                ? 'bg-amber-400 text-slate-950 font-bold'
                                                                : 'bg-slate-900 text-slate-300 border border-white/10'
                                                            }`}
                                                          >
                                                            {wUnit.hasShutter
                                                              ? '✓ Rollo'
                                                              : '+ Rollo'}
                                                          </button>
                                                          {wUnit.hasShutter && (
                                                            <input
                                                              type="range"
                                                              min={0}
                                                              max={100}
                                                              step={10}
                                                              value={wUnit.shutterClosedPct ?? 40}
                                                              onChange={(e) =>
                                                                patchWin({
                                                                  shutterClosedPct: parseInt(
                                                                    e.target.value,
                                                                    10
                                                                  ),
                                                                })
                                                              }
                                                              className="w-full accent-amber-400"
                                                            />
                                                          )}
                                                        </div>
                                                      </div>

                                                      {/* HA Entity Bindings per Roof Dormer Window (Sensor + Rollo) */}
                                                      <div className="grid grid-cols-2 gap-1 pt-1 border-t border-white/10">
                                                        <div>
                                                          <label className="block text-[8px] text-slate-400 mb-0.5">
                                                            Fensterkontakt (binary_sensor.*)
                                                          </label>
                                                          <select
                                                            value={wUnit.entityId || ''}
                                                            onChange={(e) =>
                                                              patchWin({
                                                                entityId:
                                                                  e.target.value || undefined,
                                                              })
                                                            }
                                                            className="w-full bg-slate-900 border border-white/15 rounded px-1 py-0.5 text-[8px] font-mono text-sky-300"
                                                          >
                                                            <option value="">
                                                              — Kein Fenster-Sensor —
                                                            </option>
                                                            {binarySensorIds.map((id) => (
                                                              <option key={id} value={id}>
                                                                {id} ({entities[id]?.state})
                                                              </option>
                                                            ))}
                                                          </select>
                                                        </div>
                                                        <div>
                                                          <label className="block text-[8px] text-slate-400 mb-0.5">
                                                            Gauben-Rollo (cover.*)
                                                          </label>
                                                          <select
                                                            value={wUnit.shutterEntityId || ''}
                                                            onChange={(e) => {
                                                              const nextId =
                                                                e.target.value || undefined;
                                                              patchWin({
                                                                shutterEntityId: nextId,
                                                                hasShutter: nextId
                                                                  ? true
                                                                  : wUnit.hasShutter,
                                                              });
                                                            }}
                                                            className="w-full bg-slate-900 border border-white/15 rounded px-1 py-0.5 text-[8px] font-mono text-amber-300"
                                                          >
                                                            <option value="">
                                                              — Manuell / Kein HA-Rollo —
                                                            </option>
                                                            {coverEntityIds.map((id) => (
                                                              <option key={id} value={id}>
                                                                {id} ({entities[id]?.state})
                                                              </option>
                                                            ))}
                                                          </select>
                                                        </div>
                                                      </div>
                                                    </div>
                                                  );
                                                })}
                                              </div>
                                            </div>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  )}
                                </div>
                              );
                            })()}

                            {/* 2. DACHFENSTER / DACHFLÄCHENFENSTER EINZELN HINZUFÜGEN */}
                            {(() => {
                              const hostFootprint = computeRoofHostFootprintZone(
                                selectedZone,
                                project.zones
                              );
                              const ridgeLen =
                                (selectedZone.roofConfig.ridgeDirection || 'x') === 'x'
                                  ? hostFootprint.width
                                  : hostFootprint.depth;
                              const maxOffset = Math.max(0.5, Number((ridgeLen / 2 - 0.6).toFixed(2)));
                              const skylightsList = selectedZone.roofConfig.skylights || [];

                              const commitSkylights = (nextList: RoofSkylightItem[]) => {
                                onUpdateZone(selectedZone.id, {
                                  roofConfig: {
                                    ...selectedZone.roofConfig!,
                                    skylights: nextList,
                                  },
                                });
                              };

                              return (
                                <div className="pt-2.5 border-t border-white/10 space-y-2">
                                  <div className="flex items-center justify-between gap-1.5 flex-wrap">
                                    <div>
                                      <div className="text-[11px] font-bold text-sky-300">
                                        Dachfenster & Schornsteinfeger-Ausstieg ({skylightsList.length})
                                      </div>
                                      <div className="text-[9px] text-slate-400">
                                        Schwingfenster, Schornsteinfeger-Fenster (klein mit Trittrost) & Kuppeln
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-1">
                                      <button
                                        type="button"
                                        onClick={() => {
                                          const count = skylightsList.length;
                                          const newSky: RoofSkylightItem = {
                                            id: `skylight_${Date.now()}_${count}`,
                                            style:
                                              selectedZone.roofConfig?.type === 'flat'
                                                ? 'flat_roof_dome'
                                                : 'velux_pivot',
                                            side: 'front',
                                            offsetAlongRidge:
                                              count === 0 ? 0 : count % 2 === 1 ? 1.2 : -1.2,
                                            slopePosition: 0.5,
                                            width: 1.14,
                                            length: 1.4,
                                            frameColor: 'anthracite',
                                            openState: 'closed',
                                          };
                                          commitSkylights([...skylightsList, newSky]);
                                        }}
                                        className="px-2 py-1 rounded-lg bg-sky-400 hover:bg-sky-300 text-slate-950 text-[10px] font-bold transition-colors"
                                      >
                                        + Dachfenster
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          const count = skylightsList.length;
                                          const newHatch: RoofSkylightItem = {
                                            id: `skylight_sweep_${Date.now()}_${count}`,
                                            style: 'chimney_sweep_hatch',
                                            side: 'back',
                                            offsetAlongRidge: 0.65,
                                            slopePosition: 0.35,
                                            width: 0.48,
                                            length: 0.55,
                                            frameColor: 'anthracite',
                                            openState: 'closed',
                                          };
                                          commitSkylights([...skylightsList, newHatch]);
                                        }}
                                        className="px-2 py-1 rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 text-[10px] font-bold transition-colors"
                                        title="Kleines Dachausstiegsfenster (48×55 cm) mit Trittrost für den Schornsteinfeger hinzufügen"
                                      >
                                        + Schornsteinfeger-Fenster
                                      </button>
                                    </div>
                                  </div>

                                  {skylightsList.length > 0 && (
                                    <div className="space-y-2 max-h-64 overflow-y-auto pr-0.5">
                                      {skylightsList.map((sky, sIdx) => {
                                        const updateSky = (patch: Partial<RoofSkylightItem>) => {
                                          commitSkylights(
                                            skylightsList.map((item, i) =>
                                              i === sIdx ? { ...item, ...patch } : item
                                            )
                                          );
                                        };
                                        return (
                                          <div
                                            key={sky.id || sIdx}
                                            className="p-2 rounded-lg bg-slate-900/90 border border-sky-400/30 space-y-1.5"
                                          >
                                            <div className="flex items-center justify-between">
                                              <span className="text-[10px] font-bold text-sky-200">
                                                {sky.style === 'chimney_sweep_hatch'
                                                  ? `Schornsteinfeger-Ausstieg #${sIdx + 1}`
                                                  : `Dachfenster #${sIdx + 1}`}
                                              </span>
                                              <button
                                                type="button"
                                                onClick={() =>
                                                  commitSkylights(
                                                    skylightsList.filter((_, i) => i !== sIdx)
                                                  )
                                                }
                                                className="px-1.5 py-0.5 rounded bg-red-500/20 hover:bg-red-500/35 text-red-300 text-[9px] font-semibold"
                                              >
                                                Entfernen
                                              </button>
                                            </div>

                                            <div className="grid grid-cols-2 gap-1.5">
                                              <div>
                                                <label className="block text-[9px] text-slate-400 mb-0.5">
                                                  Bauart / Typ
                                                </label>
                                                <select
                                                  value={sky.style}
                                                  onChange={(e) => {
                                                    const nextStyle = e.target
                                                      .value as RoofSkylightStyle;
                                                    if (nextStyle === 'chimney_sweep_hatch') {
                                                      updateSky({
                                                        style: nextStyle,
                                                        width: 0.48,
                                                        length: 0.55,
                                                      });
                                                    } else {
                                                      updateSky({ style: nextStyle });
                                                    }
                                                  }}
                                                  className="w-full bg-slate-950 border border-white/15 rounded px-1.5 py-0.5 text-[10px] text-white"
                                                >
                                                  <option value="velux_pivot">Schwing-Dachfenster</option>
                                                  <option value="chimney_sweep_hatch">
                                                    Schornsteinfeger-Fenster (Klein mit Trittrost)
                                                  </option>
                                                  <option value="velux_twin">Zwillings-Dachfenster</option>
                                                  <option value="panoramic_studio">3-fach Studio-Lichtband</option>
                                                  <option value="cabrio_balcony">Klapp-Schwing / Panorama</option>
                                                  <option value="flat_roof_dome">Flachdach-Lichtkuppel</option>
                                                </select>
                                              </div>
                                              <div>
                                                <label className="block text-[9px] text-slate-400 mb-0.5">
                                                  Dachseite & Öffnung
                                                </label>
                                                <div className="flex gap-1">
                                                  <select
                                                    value={sky.side}
                                                    onChange={(e) =>
                                                      updateSky({
                                                        side: e.target.value as 'front' | 'back',
                                                      })
                                                    }
                                                    className="flex-1 bg-slate-950 border border-white/15 rounded px-1 py-0.5 text-[10px] text-white"
                                                  >
                                                    <option value="front">Vorn</option>
                                                    <option value="back">Hinten</option>
                                                  </select>
                                                  <select
                                                    value={sky.openState || 'closed'}
                                                    onChange={(e) =>
                                                      updateSky({
                                                        openState: e.target.value as
                                                          | 'closed'
                                                          | 'tilted'
                                                          | 'open',
                                                      })
                                                    }
                                                    className="flex-1 bg-slate-950 border border-sky-400/35 rounded px-1 py-0.5 text-[10px] text-sky-200"
                                                  >
                                                    <option value="closed">Zu</option>
                                                    <option value="tilted">Kipp</option>
                                                    <option value="open">Offen</option>
                                                  </select>
                                                </div>
                                              </div>
                                            </div>

                                            <div className="grid grid-cols-3 gap-1.5">
                                              <div>
                                                <div className="text-[9px] text-slate-400 mb-0.5">
                                                  Pos. ({sky.offsetAlongRidge.toFixed(1)}m)
                                                </div>
                                                <input
                                                  type="range"
                                                  min={-maxOffset}
                                                  max={maxOffset}
                                                  step={0.1}
                                                  value={sky.offsetAlongRidge}
                                                  onChange={(e) =>
                                                    updateSky({
                                                      offsetAlongRidge: parseFloat(e.target.value),
                                                    })
                                                  }
                                                  className="w-full accent-sky-400"
                                                />
                                              </div>
                                              <div>
                                                <div className="text-[9px] text-slate-400 mb-0.5">
                                                  Dachhöhe ({Math.round((1 - (sky.slopePosition ?? 0.5)) * 100)}%)
                                                </div>
                                                <input
                                                  type="range"
                                                  min={0.25}
                                                  max={0.78}
                                                  step={0.05}
                                                  value={sky.slopePosition ?? 0.5}
                                                  onChange={(e) =>
                                                    updateSky({
                                                      slopePosition: parseFloat(e.target.value),
                                                    })
                                                  }
                                                  className="w-full accent-sky-400"
                                                />
                                              </div>
                                              <div>
                                                <div className="text-[9px] text-slate-400 mb-0.5">
                                                  Breite ({sky.width.toFixed(2)}m)
                                                </div>
                                                <input
                                                  type="range"
                                                  min={0.65}
                                                  max={2.4}
                                                  step={0.05}
                                                  value={sky.width}
                                                  onChange={(e) =>
                                                    updateSky({
                                                      width: parseFloat(e.target.value),
                                                    })
                                                  }
                                                  className="w-full accent-sky-400"
                                                />
                                              </div>
                                            </div>

                                            {/* HA Sensor / Cover Entity for Skylight */}
                                            <div className="pt-1 border-t border-white/10">
                                              <label className="block text-[8px] text-slate-400 mb-0.5">
                                                Home Assistant Fensterkontakt / Antrieb (binary_sensor.* / cover.*)
                                              </label>
                                              <select
                                                value={sky.entityId || ''}
                                                onChange={(e) =>
                                                  updateSky({
                                                    entityId: e.target.value || undefined,
                                                  })
                                                }
                                                className="w-full bg-slate-950 border border-white/15 rounded px-1.5 py-0.5 text-[9px] font-mono text-sky-300"
                                              >
                                                <option value="">
                                                  — Kein HA-Sensor (manuelle 3D-Stellung) —
                                                </option>
                                                {entityIds
                                                  .filter(
                                                    (id) =>
                                                      id.startsWith('binary_sensor.') ||
                                                      id.startsWith('cover.')
                                                  )
                                                  .map((id) => (
                                                    <option key={id} value={id}>
                                                      {id} ({entities[id]?.state})
                                                    </option>
                                                  ))}
                                              </select>
                                            </div>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  )}
                                </div>
                              );
                            })()}

                            {/* 3. GEBÄUDE-SCHORNSTEINE & DACHKAMINE EINZELN HINZUFÜGEN */}
                            {(() => {
                              const halfW = Math.max(0.5, Number((selectedZone.width / 2 - 0.4).toFixed(2)));
                              const halfD = Math.max(0.5, Number((selectedZone.depth / 2 - 0.4).toFixed(2)));
                              const chimneysList = selectedZone.roofConfig.chimneys || [];

                              const commitChimneys = (nextList: RoofChimneyItem[]) => {
                                onUpdateZone(selectedZone.id, {
                                  roofConfig: {
                                    ...selectedZone.roofConfig!,
                                    chimneys: nextList,
                                  },
                                });
                              };

                              return (
                                <div className="pt-2.5 border-t border-white/10 space-y-2">
                                  <div className="flex items-center justify-between">
                                    <div>
                                      <div className="text-[11px] font-bold text-orange-300">
                                        Schornsteine & Kamine ({chimneysList.length})
                                      </div>
                                      <div className="text-[9px] text-slate-400">
                                        Gemauerte Dachkamine, Schieferkamine & Edelstahlzüge
                                      </div>
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const count = chimneysList.length;
                                        const newChim: RoofChimneyItem = {
                                          id: `chimney_${Date.now()}_${count}`,
                                          style: 'brick_classic',
                                          offsetX: count === 0 ? Number((halfW * 0.45).toFixed(2)) : -Number((halfW * 0.45).toFixed(2)),
                                          offsetZ: 0,
                                          height: 1.55,
                                          width: 0.62,
                                        };
                                        commitChimneys([...chimneysList, newChim]);
                                      }}
                                      className="px-2 py-1 rounded-lg bg-orange-400 hover:bg-orange-300 text-slate-950 text-[10px] font-bold transition-colors"
                                    >
                                      + Schornstein hinzufügen
                                    </button>
                                  </div>

                                  {chimneysList.length > 0 && (
                                    <div className="space-y-2 max-h-64 overflow-y-auto pr-0.5">
                                      {chimneysList.map((chim, cIdx) => {
                                        const updateChim = (patch: Partial<RoofChimneyItem>) => {
                                          commitChimneys(
                                            chimneysList.map((item, i) =>
                                              i === cIdx ? { ...item, ...patch } : item
                                            )
                                          );
                                        };
                                        return (
                                          <div
                                            key={chim.id || cIdx}
                                            className="p-2 rounded-lg bg-slate-900/90 border border-orange-400/30 space-y-1.5"
                                          >
                                            <div className="flex items-center justify-between">
                                              <span className="text-[10px] font-bold text-orange-200">
                                                Schornstein #{cIdx + 1}
                                              </span>
                                              <div className="flex items-center gap-1">
                                                <button
                                                  type="button"
                                                  onClick={() => updateChim({ offsetZ: 0 })}
                                                  className="px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-[9px]"
                                                  title="Auf Dachfirst zentrieren"
                                                >
                                                  Auf First
                                                </button>
                                                <button
                                                  type="button"
                                                  onClick={() =>
                                                    commitChimneys(
                                                      chimneysList.filter((_, i) => i !== cIdx)
                                                    )
                                                  }
                                                  className="px-1.5 py-0.5 rounded bg-red-500/20 hover:bg-red-500/35 text-red-300 text-[9px] font-semibold"
                                                >
                                                  Entfernen
                                                </button>
                                              </div>
                                            </div>

                                            <div className="grid grid-cols-2 gap-1.5">
                                              <div>
                                                <label className="block text-[9px] text-slate-400 mb-0.5">
                                                  Kamin-Bauart / Material
                                                </label>
                                                <select
                                                  value={chim.style}
                                                  onChange={(e) =>
                                                    updateChim({
                                                      style: e.target.value as RoofChimneyStyle,
                                                    })
                                                  }
                                                  className="w-full bg-slate-950 border border-white/15 rounded px-1.5 py-0.5 text-[10px] text-orange-200"
                                                >
                                                  <option value="brick_classic">Klinker-Schornstein (Rot)</option>
                                                  <option value="plaster_modern">Putz-Schornstein (Weiß)</option>
                                                  <option value="slate_clad">Schiefer-Verkleidung (Anthrazit)</option>
                                                  <option value="double_brick_flue">Doppelzug-Kamin (Breit)</option>
                                                  <option value="stainless_flue">Edelstahl-Dachdurchführung</option>
                                                </select>
                                              </div>
                                              <div className="grid grid-cols-2 gap-1">
                                                <div>
                                                  <div className="text-[9px] text-slate-400 mb-0.5">
                                                    Höhe ({chim.height.toFixed(2)}m)
                                                  </div>
                                                  <input
                                                    type="range"
                                                    min={0.7}
                                                    max={2.8}
                                                    step={0.05}
                                                    value={chim.height}
                                                    onChange={(e) =>
                                                      updateChim({
                                                        height: parseFloat(e.target.value),
                                                      })
                                                    }
                                                    className="w-full accent-orange-400"
                                                  />
                                                </div>
                                                <div>
                                                  <div className="text-[9px] text-slate-400 mb-0.5">
                                                    Breite ({chim.width.toFixed(2)}m)
                                                  </div>
                                                  <input
                                                    type="range"
                                                    min={0.4}
                                                    max={1.2}
                                                    step={0.04}
                                                    value={chim.width}
                                                    onChange={(e) =>
                                                      updateChim({
                                                        width: parseFloat(e.target.value),
                                                      })
                                                    }
                                                    className="w-full accent-orange-400"
                                                  />
                                                </div>
                                              </div>
                                            </div>

                                            <div className="grid grid-cols-2 gap-1.5">
                                              <div>
                                                <div className="text-[9px] text-slate-400 mb-0.5">
                                                  Position Längsachse ({chim.offsetX.toFixed(2)}m)
                                                </div>
                                                <input
                                                  type="range"
                                                  min={-halfW}
                                                  max={halfW}
                                                  step={0.1}
                                                  value={chim.offsetX}
                                                  onChange={(e) =>
                                                    updateChim({
                                                      offsetX: parseFloat(e.target.value),
                                                    })
                                                  }
                                                  className="w-full accent-orange-400"
                                                />
                                              </div>
                                              <div>
                                                <div className="text-[9px] text-slate-400 mb-0.5">
                                                  Abstand zum First ({chim.offsetZ.toFixed(2)}m)
                                                </div>
                                                <input
                                                  type="range"
                                                  min={-halfD}
                                                  max={halfD}
                                                  step={0.1}
                                                  value={chim.offsetZ}
                                                  onChange={(e) =>
                                                    updateChim({
                                                      offsetZ: parseFloat(e.target.value),
                                                    })
                                                  }
                                                  className="w-full accent-orange-400"
                                                />
                                              </div>
                                            </div>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  )}
                                </div>
                              );
                            })()}
                          </>
                        )}
                    </div>
                  </>
                )}

                {/* FREIE 3D-POOL-KONFIGURATION (when surfaceMaterial === 'pool_water') */}
                {selectedZone.surfaceMaterial === 'pool_water' && (
                  <div className="p-3 rounded-xl bg-slate-950 border border-sky-400/35 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-sky-300">
                        Pool-Architektur frei konfigurieren
                      </span>
                      <span className="text-[10px] font-mono text-slate-400">
                        {computeZoneAreaM2(selectedZone).toFixed(1)} m²
                      </span>
                    </div>

                    {/* 1. Pool-Form & Fliesenfarbe */}
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[10px] text-slate-400 mb-0.5">
                          Beckenform / Bauart
                        </label>
                        <select
                          value={
                            selectedZone.points && selectedZone.points.length >= 3
                              ? 'freeform'
                              : selectedZone.poolConfig?.shape || 'rect'
                          }
                          onChange={(e) => {
                            const val = e.target.value;
                            if (val === 'freeform') {
                              const hw = selectedZone.width / 2;
                              const hd = selectedZone.depth / 2;
                              const pts: [number, number][] =
                                selectedZone.points && selectedZone.points.length >= 3
                                  ? selectedZone.points
                                  : [
                                      [+(selectedZone.x - hw).toFixed(2), +(selectedZone.z - hd).toFixed(2)],
                                      [+(selectedZone.x + hw * 0.4).toFixed(2), +(selectedZone.z - hd).toFixed(2)],
                                      [+(selectedZone.x + hw).toFixed(2), +(selectedZone.z - hd * 0.2).toFixed(2)],
                                      [+(selectedZone.x + hw).toFixed(2), +(selectedZone.z + hd).toFixed(2)],
                                      [+(selectedZone.x - hw * 0.5).toFixed(2), +(selectedZone.z + hd).toFixed(2)],
                                      [+(selectedZone.x - hw).toFixed(2), +(selectedZone.z + hd * 0.3).toFixed(2)],
                                    ];
                              onUpdateZone(selectedZone.id, { points: pts });
                            } else {
                              onUpdateZone(selectedZone.id, {
                                points: undefined,
                                poolConfig: {
                                  ...selectedZone.poolConfig,
                                  shape: val as NonNullable<FloorplanZone['poolConfig']>['shape'],
                                },
                              });
                            }
                          }}
                          className="w-full bg-slate-900 border border-white/15 rounded px-2 py-1 text-[11px] text-white"
                        >
                          <option value="freeform">Freiform-Polygon (3D-Ecken frei ziehen)</option>
                          <option value="rect">Rechteck (Frei nach Maß)</option>
                          <option value="l_shape">L-Form (mit Sonnendeck)</option>
                          <option value="oval">Oval / Stadion-Radius</option>
                          <option value="roman">Römischer Pool</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-[10px] text-slate-400 mb-0.5">
                          Fliesen- & Wasserfarbe
                        </label>
                        <select
                          value={selectedZone.poolConfig?.tilePreset || 'azure'}
                          onChange={(e) =>
                            onUpdateZone(selectedZone.id, {
                              poolConfig: {
                                ...selectedZone.poolConfig,
                                tilePreset: e.target.value as NonNullable<
                                  FloorplanZone['poolConfig']
                                >['tilePreset'],
                              },
                            })
                          }
                          className="w-full bg-slate-900 border border-white/15 rounded px-2 py-1 text-[11px] text-white"
                        >
                          <option value="azure">Azurblau (Klassisch)</option>
                          <option value="turquoise">Karibik-Türkis</option>
                          <option value="sand">Lagunen-Sand (Hell)</option>
                          <option value="anthracite">Naturpool-Anthrazit</option>
                          <option value="emerald">Smaragdgrün</option>
                        </select>
                      </div>
                    </div>

                    {/* 2. Beckentiefe & Wasserstand */}
                    <div className="space-y-1.5 pt-1 border-t border-white/10">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-slate-300">Beckentiefe (m)</span>
                        <span className="font-mono text-sky-300 tabular-nums">
                          {(selectedZone.poolConfig?.basinDepth ?? 0.65).toFixed(2)} m
                        </span>
                      </div>
                      <input
                        type="range"
                        min={0.4}
                        max={2.2}
                        step={0.05}
                        value={selectedZone.poolConfig?.basinDepth ?? 0.65}
                        onChange={(e) =>
                          onUpdateZone(selectedZone.id, {
                            poolConfig: {
                              ...selectedZone.poolConfig,
                              basinDepth: parseFloat(e.target.value),
                            },
                          })
                        }
                        className="w-full accent-sky-400"
                      />

                      <div className="flex items-center justify-between text-[11px] pt-1">
                        <span className="text-slate-300">Randbreite / Umrandung (m)</span>
                        <span className="font-mono text-amber-300 tabular-nums">
                          {(selectedZone.poolConfig?.copingWidth ?? 0.28).toFixed(2)} m
                        </span>
                      </div>
                      <input
                        type="range"
                        min={0.0}
                        max={0.5}
                        step={0.02}
                        value={selectedZone.poolConfig?.copingWidth ?? 0.28}
                        onChange={(e) =>
                          onUpdateZone(selectedZone.id, {
                            poolConfig: {
                              ...selectedZone.poolConfig,
                              copingWidth: parseFloat(e.target.value),
                            },
                          })
                        }
                        className="w-full accent-amber-400"
                      />
                    </div>

                    {/* 3. Einstiegstreppe & Edelstahlleiter frei positionieren */}
                    <div className="grid grid-cols-2 gap-2 pt-1 border-t border-white/10">
                      <div>
                        <label className="block text-[10px] text-slate-400 mb-0.5">
                          Einstiegstreppe Seite
                        </label>
                        <select
                          value={selectedZone.poolConfig?.stepsPosition || 'west'}
                          onChange={(e) =>
                            onUpdateZone(selectedZone.id, {
                              poolConfig: {
                                ...selectedZone.poolConfig,
                                stepsPosition: e.target.value as NonNullable<
                                  FloorplanZone['poolConfig']
                                >['stepsPosition'],
                              },
                            })
                          }
                          className="w-full bg-slate-900 border border-white/15 rounded px-2 py-1 text-[11px] text-white"
                        >
                          <option value="west">West (Links)</option>
                          <option value="east">Ost (Rechts)</option>
                          <option value="north">Nord (Oben)</option>
                          <option value="south">Süd (Unten)</option>
                          <option value="none">Keine Treppe</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-[10px] text-slate-400 mb-0.5">
                          Edelstahlleiter Seite
                        </label>
                        <select
                          value={selectedZone.poolConfig?.ladderPosition || 'east'}
                          onChange={(e) =>
                            onUpdateZone(selectedZone.id, {
                              poolConfig: {
                                ...selectedZone.poolConfig,
                                ladderPosition: e.target.value as NonNullable<
                                  FloorplanZone['poolConfig']
                                >['ladderPosition'],
                              },
                            })
                          }
                          className="w-full bg-slate-900 border border-white/15 rounded px-2 py-1 text-[11px] text-white"
                        >
                          <option value="east">Ost (Rechts)</option>
                          <option value="west">West (Links)</option>
                          <option value="north">Nord (Oben)</option>
                          <option value="south">Süd (Unten)</option>
                          <option value="none">Keine Leiter</option>
                        </select>
                      </div>
                    </div>

                    {selectedZone.poolConfig?.stepsPosition !== 'none' && (
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <div className="text-[10px] text-slate-400 mb-0.5">
                            Stufenanzahl ({selectedZone.poolConfig?.stepsCount ?? 3})
                          </div>
                          <input
                            type="range"
                            min={2}
                            max={5}
                            step={1}
                            value={selectedZone.poolConfig?.stepsCount ?? 3}
                            onChange={(e) =>
                              onUpdateZone(selectedZone.id, {
                                poolConfig: {
                                  ...selectedZone.poolConfig,
                                  stepsCount: parseInt(e.target.value, 10),
                                },
                              })
                            }
                            className="w-full accent-sky-400"
                          />
                        </div>
                        <div>
                          <div className="text-[10px] text-slate-400 mb-0.5">
                            Treppenbreite ({(selectedZone.poolConfig?.stepsWidth ?? 1.6).toFixed(1)}m)
                          </div>
                          <input
                            type="range"
                            min={0.7}
                            max={3.4}
                            step={0.1}
                            value={selectedZone.poolConfig?.stepsWidth ?? 1.6}
                            onChange={(e) =>
                              onUpdateZone(selectedZone.id, {
                                poolConfig: {
                                  ...selectedZone.poolConfig,
                                  stepsWidth: parseFloat(e.target.value),
                                },
                              })
                            }
                            className="w-full accent-sky-400"
                          />
                        </div>
                      </div>
                    )}

                    {/* 4. Schwalldusche & Elektrische Pool-Rollladenabdeckung */}
                    <div className="space-y-2 pt-1 border-t border-white/10">
                      <div className="grid grid-cols-2 gap-1.5">
                        <button
                          type="button"
                          onClick={() =>
                            onUpdateZone(selectedZone.id, {
                              poolConfig: {
                                ...selectedZone.poolConfig,
                                hasWaterfallJet: !selectedZone.poolConfig?.hasWaterfallJet,
                              },
                            })
                          }
                          className={`py-1.5 px-2 rounded-lg text-[11px] font-semibold transition-colors ${
                            selectedZone.poolConfig?.hasWaterfallJet
                              ? 'bg-sky-400 text-slate-950 font-bold'
                              : 'bg-slate-900 text-slate-300 hover:bg-slate-800 border border-white/10'
                          }`}
                        >
                          {selectedZone.poolConfig?.hasWaterfallJet
                            ? '✓ Schwalldusche aktiv'
                            : '+ Schwalldusche'}
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            onUpdateZone(selectedZone.id, {
                              poolConfig: {
                                ...selectedZone.poolConfig,
                                hasPoolCover: !selectedZone.poolConfig?.hasPoolCover,
                              },
                            })
                          }
                          className={`py-1.5 px-2 rounded-lg text-[11px] font-semibold transition-colors ${
                            selectedZone.poolConfig?.hasPoolCover
                              ? 'bg-amber-400 text-slate-950 font-bold'
                              : 'bg-slate-900 text-slate-300 hover:bg-slate-800 border border-white/10'
                          }`}
                        >
                          {selectedZone.poolConfig?.hasPoolCover
                            ? '✓ Pool-Abdeckung'
                            : '+ Pool-Abdeckung'}
                        </button>
                      </div>

                      {selectedZone.poolConfig?.hasPoolCover && (
                        <div>
                          <div className="flex justify-between text-[10px] text-slate-300 mb-0.5">
                            <span>Solar-Rollladenabdeckung Position</span>
                            <span className="font-mono text-amber-300">
                              {selectedZone.poolConfig?.coverPositionPct ?? 35}%
                            </span>
                          </div>
                          <input
                            type="range"
                            min={0}
                            max={100}
                            step={5}
                            value={selectedZone.poolConfig?.coverPositionPct ?? 35}
                            onChange={(e) =>
                              onUpdateZone(selectedZone.id, {
                                poolConfig: {
                                  ...selectedZone.poolConfig,
                                  coverPositionPct: parseInt(e.target.value, 10),
                                },
                              })
                            }
                            className="w-full accent-amber-400"
                          />
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </>
          ) : selectedCustomWall ? (
            <div className="space-y-3">
              <div className="flex items-start justify-between gap-2 pb-2.5 border-b border-white/10">
                <div className="flex-1">
                  <div className="text-[11px] text-fuchsia-300 font-medium">
                    Freistehende Wand / Trennwand (Wand-Designer)
                  </div>
                  <input
                    type="text"
                    value={selectedCustomWall.name}
                    onChange={(e) =>
                      onUpdateCustomWall?.(selectedCustomWall.id, { name: e.target.value })
                    }
                    className="mt-1 w-full bg-slate-900 border border-white/10 rounded px-2 py-1 text-xs font-semibold text-white"
                  />
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    title={
                      selectedCustomWall.locked
                        ? 'Trennwand entsperren'
                        : 'Trennwand sperren (gegen versehentliches Verschieben)'
                    }
                    onClick={() =>
                      onUpdateCustomWall?.(selectedCustomWall.id, {
                        locked: !selectedCustomWall.locked,
                      })
                    }
                    className={`p-1.5 rounded-lg border transition-colors ${
                      selectedCustomWall.locked
                        ? 'bg-amber-400 text-slate-950 border-amber-300 font-bold'
                        : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-white/10'
                    }`}
                  >
                    {selectedCustomWall.locked ? (
                      <Lock className="w-3.5 h-3.5" />
                    ) : (
                      <Unlock className="w-3.5 h-3.5" />
                    )}
                  </button>
                  {onDeleteCustomWall && (
                    <button
                      type="button"
                      disabled={Boolean(selectedCustomWall.locked)}
                      onClick={() => onDeleteCustomWall(selectedCustomWall.id)}
                      className={`p-1.5 rounded-lg ${
                        selectedCustomWall.locked
                          ? 'bg-slate-900 text-slate-600 cursor-not-allowed'
                          : 'bg-red-500/20 hover:bg-red-500/30 text-red-300'
                      }`}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] text-slate-400 mb-0.5">
                    Wand-Bauart
                  </label>
                  <select
                    value={selectedCustomWall.mode}
                    onChange={(e) =>
                      onUpdateCustomWall?.(selectedCustomWall.id, {
                        mode: e.target.value as WallSegmentMode,
                      })
                    }
                    className="w-full bg-slate-900 border border-white/15 rounded px-2 py-1.5 text-xs text-white"
                  >
                    <option value="full">Volle Raumhöhe</option>
                    <option value="half_height">Halbhohe Theke / Brüstung (1,10 m)</option>
                    <option value="archway">Wand mit Rundbogen-Durchbruch</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] text-slate-400 mb-0.5">
                    Oberfläche / Material
                  </label>
                  <select
                    value={selectedCustomWall.finish}
                    onChange={(e) =>
                      onUpdateCustomWall?.(selectedCustomWall.id, {
                        finish: e.target.value as WallSurfaceFinish,
                      })
                    }
                    className="w-full bg-slate-900 border border-white/15 rounded px-2 py-1.5 text-xs text-fuchsia-200"
                  >
                    <option value="plaster">Glattputz Standard</option>
                    <option value="wood_slats">Akustik-Holzlamellen</option>
                    <option value="brick_exposed">Sichtklinker / Backstein</option>
                    <option value="stone_tile">Naturstein-Fliesen</option>
                    <option value="concrete_loft">Sichtbeton Loft</option>
                    <option value="wallpaper_accent">Design-Akzenttapete</option>
                    <option value="glass_block">Glasbausteine (Lichtdurchlässiges Raster)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-[10px] text-slate-400 mb-0.5">Höhe (m)</label>
                  <input
                    type="number"
                    step={0.1}
                    min={0.5}
                    max={4.5}
                    value={selectedCustomWall.height}
                    onChange={(e) =>
                      onUpdateCustomWall?.(selectedCustomWall.id, {
                        height: parseFloat(e.target.value) || 2.6,
                      })
                    }
                    className="w-full bg-slate-900 border border-white/15 rounded px-2 py-1 text-xs font-mono text-white"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-slate-400 mb-0.5">Stärke (m)</label>
                  <input
                    type="number"
                    step={0.02}
                    min={0.06}
                    max={0.5}
                    value={selectedCustomWall.thickness}
                    onChange={(e) =>
                      onUpdateCustomWall?.(selectedCustomWall.id, {
                        thickness: parseFloat(e.target.value) || 0.16,
                      })
                    }
                    className="w-full bg-slate-900 border border-white/15 rounded px-2 py-1 text-xs font-mono text-white"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-slate-400 mb-0.5">Wandfarbe</label>
                  <input
                    type="color"
                    value={selectedCustomWall.color || '#e4e0d8'}
                    onChange={(e) =>
                      onUpdateCustomWall?.(selectedCustomWall.id, { color: e.target.value })
                    }
                    className="w-full h-7 rounded bg-slate-900 border border-white/15 cursor-pointer"
                  />
                </div>
              </div>
            </div>
          ) : null}
        </aside>
      )}
    </>
  );
};
