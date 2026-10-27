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
  RotateCw,
  Search,
  Sliders,
  Trash2,
  Trees,
} from 'lucide-react';
import { ASSET_CATALOG, SURFACE_MATERIALS } from '../data/catalogAndInitialState';
import { getEffectiveRoofDormers } from '../three/assetBuilder';
import {
  ActiveFloorView,
  AssetCategory,
  BUILDING_PRESETS,
  CatalogItem,
  computePolygonBounds,
  computeRoofHostFootprintZone,
  computeZoneAreaM2,
  CustomWallSegment,
  DormerWindowStyle,
  DormerWindowUnit,
  EditorViewMode,
  ExteriorStepsShapeType,
  FloorLevelId,
  FloorplanProject,
  FloorplanZone,
  getEffectiveDormerWindows,
  HAEntityState,
  isChimneyOrDormerAsset,
  isDormerOrSkylightAsset,
  isExteriorStairAsset,
  isFenceOrHedgeAsset,
  isStairAsset,
  isStreetLampAsset,
  isStreetOrSidewalkAsset,
  isTreeAsset,
  isWalkwayAsset,
  isWallDecorAsset,
  OpeningFrameColor,
  PlacedAsset,
  resolveOpeningSensorState,
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
  StairRailingSide,
  StairRailingStyle,
  StairRiserStyle,
  StairShapeType,
  StairTreadMaterial,
  SurfaceMaterialId,
  UnderStairClosureType,
  WallOpening,
  WallOpeningType,
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
  onAddZone: (zoneType: 'indoor' | 'outdoor' | 'outbuilding') => void;
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
}

const CATEGORY_TABS: {
  id:
    | AssetCategory
    | 'all'
    | 'trees_only'
    | 'streets_lamps'
    | 'wall_decor'
    | 'stairs_only';
  label: string;
}[] = [
  { id: 'stairs_only', label: '🪜 Innen- & Außentreppen (Alle Formen)' },
  { id: 'trees_only', label: '🌳 Bäume & Pflanzen (7)' },
  { id: 'fences_hedges', label: 'Maschendrahtzaun, Zäune & Hecken' },
  { id: 'streets_lamps', label: '🛣️ Straße, Gehweg & Laternen' },
  { id: 'wall_decor', label: '🖼️ Wand-TV, Bilder & Paneele' },
  { id: 'outdoor_energy', label: 'Garten, Garage & Tore' },
  { id: 'furniture', label: 'Küchen, Möbel & Treppen' },
  { id: 'sensors_plugs', label: 'Steckdosen & Sensoren' },
  { id: 'lighting', label: 'Lichter (Raum/Außen)' },
  { id: 'climate_appliance', label: 'Klima & Haushalt' },
  { id: 'media_camera', label: 'Kameras & TV' },
  { id: 'all', label: `Alle (${ASSET_CATALOG.length})` },
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
}) => {
  const [editorMode, setEditorMode] = useState<'zones' | 'openings' | 'catalog'>('zones');
  const [activeCategory, setActiveCategory] = useState<
    | AssetCategory
    | 'all'
    | 'trees_only'
    | 'streets_lamps'
    | 'wall_decor'
    | 'stairs_only'
  >('stairs_only');
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

  const filteredCatalog = ASSET_CATALOG.filter((item) => {
    const matchesCat =
      activeCategory === 'all'
        ? true
        : activeCategory === 'stairs_only'
        ? isStairAsset(item.id) || isExteriorStairAsset(item.id)
        : activeCategory === 'trees_only'
        ? isTreeAsset(item.id)
        : activeCategory === 'streets_lamps'
        ? isStreetOrSidewalkAsset(item.id) || isStreetLampAsset(item.id)
        : activeCategory === 'wall_decor'
        ? isWallDecorAsset(item.id)
        : item.category === activeCategory;
    const matchesSearch =
      !searchQuery.trim() ||
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.badgeText.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCat && matchesSearch;
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
            {/* 2D CAD vs Split 2D/3D vs 3D View Switcher + Drawer Minimize Button */}
            <div>
              <div className="text-[11px] font-semibold text-amber-300 mb-1.5 flex items-center justify-between gap-2">
                <span>Planungs-Ansicht & Etagen-Wahl</span>
                <button
                  type="button"
                  onClick={() => setIsLeftDrawerOpen(false)}
                  className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-[10px] font-semibold text-slate-200 border border-white/10"
                  title="Katalog-Leiste minimieren für freie Sicht auf den Plan"
                >
                  Minimieren ✕
                </button>
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

              {/* Add Indoor Room, Garage/Outbuilding or Outdoor Landscaping Zone */}
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    onAddZone('indoor');
                    setIsRightInspectorMinimized(false);
                    if (typeof window !== 'undefined' && window.innerWidth < 1024) {
                      setIsLeftDrawerOpen(false);
                    }
                  }}
                  className="flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-white/10 text-xs font-semibold text-white whitespace-nowrap"
                >
                  <Home className="w-3.5 h-3.5 text-amber-400" />
                  <span>+ Wohnraum</span>
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
                >
                  <Building2 className="w-3.5 h-3.5 text-amber-400" />
                  <span>+ Garage / Nebengeb.</span>
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

              {/* Zone List */}
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
                filteredZones.map((zone) => {
                  const isSelected = zone.id === selectedZoneId;
                  const matMeta = SURFACE_MATERIALS.find((m) => m.id === zone.surfaceMaterial);
                  const areaM2 = computeZoneAreaM2(zone);
                  const isPoly = Boolean(zone.points && zone.points.length >= 3);
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
                          : 'bg-slate-900/90 border-white/8 hover:border-white/20'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-semibold text-white truncate">
                          {zone.name}
                        </span>
                        <span className="text-[11px] font-mono text-amber-300 tabular-nums shrink-0">
                          {areaM2.toFixed(1)} m² · {zone.width.toFixed(1)}×{zone.depth.toFixed(1)}m
                        </span>
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
                        {isPoly && (
                          <span className="ml-auto px-1.5 py-0.2 rounded bg-sky-500/20 text-sky-300 text-[9.5px] font-mono">
                            Polygon ({zone.points!.length} Pkt)
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })
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
                    title="Duplizieren"
                    onClick={() => onDuplicateAsset(selectedAsset.id)}
                    className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    title="Löschen"
                    onClick={() => onDeleteAsset(selectedAsset.id)}
                    className="p-1.5 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-300"
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
                  <option value="">— Keine Entität (Statisches 3D-Möbel) —</option>
                  {entityIds.map((id) => (
                    <option key={id} value={id}>
                      {id} ({entities[id]?.attributes.friendly_name})
                    </option>
                  ))}
                </select>
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
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] font-bold text-amber-300">
                                Einzelne Fenster in dieser Gaube ({assetWins.length})
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

                            <div className="space-y-1.5 max-h-52 overflow-y-auto pr-0.5">
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
                    short: 'S-Kurve',
                    label: 'Doppelt gewendelt: Unten & Oben mit Kurve (S-Verlauf)',
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
                        Innentreppe: 14 Bauformen & Wandabschluss
                      </span>
                      <span className="text-[10px] font-mono text-slate-400">
                        {sc.stepCount ?? 14} Stufen
                      </span>
                    </div>

                    {/* 1. Visual Quick-Select Grid + Dropdown for all 14 Stair Shapes */}
                    <div className="space-y-1.5">
                      <label className="block text-[10px] text-slate-300 font-medium">
                        Treppenform direkt wählen (14 Architektur-Formen):
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
                <button
                  type="button"
                  onClick={() => onDeleteOpening(selectedOpening.id)}
                  className="p-1.5 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-300"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
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
                            nextType === 'window'
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
                            Großlamellen-Sektionaltor (Modern glatt)
                          </option>
                          <option value="sectional_wood_ribbed">
                            Holz-/Struktur-Sektionaltor mit feiner Sicke
                          </option>
                          <option value="sectional_flush_glass">
                            Design-Sektionaltor mit Panorama-Lichtband
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
                        Einzel-Fenster-/Türsensor (entity_id)
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
                <button
                  type="button"
                  onClick={() => onDeleteZone(selectedZone.id)}
                  className="p-1.5 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-300"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
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

                          {/* Quick Place Wall Objects directly from the Wall Designer */}
                          <div className="pt-1.5 border-t border-white/10">
                            <div className="text-[10px] font-semibold text-slate-300 mb-1">
                              Wand-Objekte direkt auswählen & platzieren:
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
                            const bId = selectedZone.buildingId;
                            if (bId) {
                              for (const z of project.zones) {
                                if (z.zoneType === 'indoor' && z.buildingId === bId) {
                                  onUpdateZone(z.id, { plinthHeight: preset.val });
                                }
                              }
                            } else {
                              onUpdateZone(selectedZone.id, { plinthHeight: preset.val });
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
                        onUpdateZone(selectedZone.id, { plinthHeight: val });
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
                          Zugeordnetes Gebäude (für Raster-Snap & gemeinsame Drehung)
                        </label>
                        <select
                          value={selectedZone.buildingId || 'main_house'}
                          onChange={(e) =>
                            onUpdateZone(selectedZone.id, {
                              buildingId: e.target.value || undefined,
                            })
                          }
                          className="w-full bg-slate-900 border border-white/15 rounded-lg px-2 py-1.5 text-[11px] text-white"
                        >
                          {BUILDING_PRESETS.map((b) => (
                            <option key={b.id} value={b.id}>
                              {b.name}
                            </option>
                          ))}
                          <option value="">Freistehender Raum (ohne Gruppe)</option>
                        </select>
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
                              onUpdateZone(selectedZone.id, {
                                roofConfig: {
                                  type: nextType,
                                  pitchDeg: selectedZone.roofConfig?.pitchDeg ?? 32,
                                  overhang: selectedZone.roofConfig?.overhang ?? 0.35,
                                  material:
                                    selectedZone.roofConfig?.material || 'anthracite_tile',
                                  ridgeDirection:
                                    selectedZone.roofConfig?.ridgeDirection || 'x',
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
                                  <div className="flex items-center justify-between">
                                    <div>
                                      <div className="text-[11px] font-bold text-sky-300">
                                        Dachfenster / Dachflächenfenster ({skylightsList.length})
                                      </div>
                                      <div className="text-[9px] text-slate-400">
                                        Schwingfenster, Zwillingsfenster & Flachdach-Lichtkuppeln
                                      </div>
                                    </div>
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
                                      + Dachfenster hinzufügen
                                    </button>
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
                                                Dachfenster #{sIdx + 1}
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
                                                  onChange={(e) =>
                                                    updateSky({
                                                      style: e.target.value as RoofSkylightStyle,
                                                    })
                                                  }
                                                  className="w-full bg-slate-950 border border-white/15 rounded px-1.5 py-0.5 text-[10px] text-white"
                                                >
                                                  <option value="velux_pivot">Schwing-Dachfenster</option>
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
                {onDeleteCustomWall && (
                  <button
                    type="button"
                    onClick={() => onDeleteCustomWall(selectedCustomWall.id)}
                    className="p-1.5 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-300"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
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
