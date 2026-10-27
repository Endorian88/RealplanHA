export type ZoneType = 'indoor' | 'outdoor';

/**
 * Multi-Floor / Stockwerke IDs:
 * -1 = KG (Keller / Untergeschoss)
 *  0 = EG (Erdgeschoss & Außenanlage)
 *  1 = 1. OG (Obergeschoss)
 *  2 = DG (Dachgeschoss / Studio)
 */
export type FloorLevelId = -1 | 0 | 1 | 2;

export type ActiveFloorView = FloorLevelId | 'all_stacked';

export type PerformanceMode = 'eco' | 'balanced' | 'ultra';

export type SurfaceMaterialId =
  | 'oak_parquet'
  | 'herringbone_wood'
  | 'travertine_stone'
  | 'polished_concrete'
  | 'anthracite_tile'
  | 'warm_carpet'
  | 'wpc_decking'
  | 'lush_lawn'
  | 'driveway_pavers'
  | 'pool_water'
  | 'gravel_bed'
  | 'pathway_stone'
  | 'pathway_wood'
  | 'pathway_stepping'
  | 'pathway_cobble';

export interface SurfaceMaterialMeta {
  id: SurfaceMaterialId;
  name: string;
  zoneType: ZoneType | 'both';
  roughness: number;
  metalness: number;
  bumpScale: number;
  previewHex: string;
  description: string;
}

export type PoolShapeType = 'rect' | 'oval' | 'l_shape' | 'roman';
export type PoolEdgeSide = 'west' | 'east' | 'north' | 'south' | 'none';
export type PoolTilePreset = 'azure' | 'turquoise' | 'sand' | 'anthracite' | 'emerald';

export interface PoolConfiguration {
  /** Pool footprint form ('rect' = Rechteck, 'oval' = Oval/Abgerundet, 'l_shape' = L-Form, 'roman' = Römische Treppe) */
  shape?: PoolShapeType;
  /** Physical water & basin depth in meters (0.40m .. 2.20m) */
  basinDepth?: number;
  /** Water surface offset below rim in meters (e.g. -0.01m Infinity .. -0.14m Skimmer) */
  waterLevelOffset?: number;
  /** Mosaic tile & water color preset */
  tilePreset?: PoolTilePreset;
  /** Rim / coping stone width in meters (0.0m = flush .. 0.50m) */
  copingWidth?: number;
  /** Rim / coping stone hex color */
  copingColor?: string;
  /** Which side has the submerged entry steps */
  stepsPosition?: PoolEdgeSide;
  /** Width of the submerged entry steps in meters */
  stepsWidth?: number;
  /** Number of submerged steps (2..5) */
  stepsCount?: number;
  /** Which side has the stainless steel ladder */
  ladderPosition?: PoolEdgeSide;
  /** Optional stainless steel waterfall massage shower jet at pool edge */
  hasWaterfallJet?: boolean;
  /** Optional motorized slatted pool cover (Rollladenabdeckung) */
  hasPoolCover?: boolean;
  /** Pool cover closed percentage (0 = completely open, 100 = completely covered) */
  coverPositionPct?: number;
}

export type RoofType =
  | 'none'
  | 'flat'
  | 'gable'
  | 'hipped'
  | 'tent'
  | 'mono_pitch'
  | 'mansard'
  | 'barrel';

export type RoofMaterialStyle =
  | 'anthracite_tile'
  | 'terracotta_tile'
  | 'standing_seam_zinc'
  | 'slate_dark'
  | 'flat_gravel'
  | 'green_sedum';

export type RoofDormerType =
  | 'none'
  | 'gable'
  | 'shed'
  | 'flat_box'
  | 'trapezoid'
  | 'arched';

export type DormerWindowStyle =
  | 'modern_single'
  | 'mullion_cross'
  | 'industrial_loft'
  | 'frosted_privacy'
  | 'arched_classic';

export interface DormerWindowUnit {
  id: string;
  name?: string;
  /** Relative width weight of this window inside the dormer (0.5 .. 2.0, default 1.0) */
  widthRatio?: number;
  /** Number of sashes inside this individual window (1 = Einzelflügel, 2 = Doppelflügel) */
  sashCount?: 1 | 2;
  /** Hinge side when 1-flügelig ('left' = Anschlag Links, 'right' = Anschlag Rechts) */
  hingeSide?: 'left' | 'right';
  /** Architectural glazing/mullion style for this window */
  windowStyle?: DormerWindowStyle;
  /** Window frame color for this window */
  windowFrameColor?: OpeningFrameColor;
  /** 3D opening state for this window ('closed' | 'tilted' | 'open') */
  windowOpenState?: 'closed' | 'tilted' | 'open';
  /** Optional roller shutter for this individual dormer window */
  hasShutter?: boolean;
  /** Roller shutter closed percentage (0..100) */
  shutterClosedPct?: number;
}

export interface DormerWindowConfig {
  /** Individual windows placed side-by-side in this dormer (each individually editable) */
  windows?: DormerWindowUnit[];
  /** Legacy / Quick count of windows/sashes in the dormer (1..4) */
  windowCount?: 1 | 2 | 3 | 4;
  /** Default architectural glazing/mullion style */
  windowStyle?: DormerWindowStyle;
  /** Default window frame color */
  windowFrameColor?: OpeningFrameColor;
  /** Default window opening state ('closed' | 'tilted' | 'open') */
  windowOpenState?: 'closed' | 'tilted' | 'open';
  /** Optional roller shutter on the dormer window */
  hasShutter?: boolean;
  /** Roller shutter closed percentage (0..100) */
  shutterClosedPct?: number;
}

export interface RoofDormerItem extends DormerWindowConfig {
  id: string;
  name?: string;
  /** Dormer roof shape ('gable' | 'shed' | 'flat_box' | 'trapezoid' | 'arched') */
  type: Exclude<RoofDormerType, 'none'>;
  /** Roof slope side ('front' = Vorderseite / +Z / +X, 'back' = Rückseite / -Z / -X) */
  side: 'front' | 'back';
  /** Offset along the roof ridge in meters relative to roof center */
  offsetAlongRidge: number;
  /** Width of this dormer in meters (0.8m .. 4.2m) */
  width: number;
  /** Height of this dormer front in meters (0.75m .. 2.2m) */
  height: number;
  /** Gauben-Kniestock / Brüstungshöhe unter den Gaubenfenstern über der Dachfläche in Metern (0.08m .. 0.90m, default 0.30m) */
  sillHeight?: number;
  /** Rücksprung der Gaubenfront von der Hauswand / Traufe in Metern (0.0m = bündig .. 1.6m, default 0.35m) */
  eavesSetback?: number;
}

export type RoofSpanMode =
  | 'single_floor'
  | 'og_in_roof'
  | 'og_and_dg_in_roof';

export type RoofFootprintScope = 'zone' | 'building';

export type RoofSkylightStyle =
  | 'velux_pivot'
  | 'velux_twin'
  | 'panoramic_studio'
  | 'cabrio_balcony'
  | 'flat_roof_dome';

export interface RoofSkylightItem {
  id: string;
  name?: string;
  style: RoofSkylightStyle;
  /** Roof slope side ('front' = Vorderseite, 'back' = Rückseite) */
  side: 'front' | 'back';
  /** Offset along the roof ridge in meters relative to zone center */
  offsetAlongRidge: number;
  /** Relative position on the slope from ridge (0.18 = oben am First / DG) to eave (0.82 = unten / 1. OG) */
  slopePosition?: number;
  /** Skylight width in meters (0.55m .. 2.6m) */
  width: number;
  /** Skylight length along slope in meters (0.70m .. 2.2m) */
  length: number;
  /** Frame color */
  frameColor?: OpeningFrameColor;
  /** Open state ('closed' | 'tilted' | 'open') */
  openState?: 'closed' | 'tilted' | 'open';
}

export type RoofChimneyStyle =
  | 'brick_classic'
  | 'plaster_modern'
  | 'slate_clad'
  | 'stainless_flue'
  | 'double_brick_flue';

export interface RoofChimneyItem {
  id: string;
  name?: string;
  style: RoofChimneyStyle;
  /** Position along the roof ridge axis in meters relative to zone center */
  offsetX: number;
  /** Position across the roof span in meters (0 = directly on ridge) */
  offsetZ: number;
  /** Height of chimney shaft in meters (0.8m .. 2.8m) */
  height: number;
  /** Cross-section width in meters (0.38m .. 1.2m) */
  width: number;
}

export interface ZoneRoofConfig {
  /** Roof form ('none' | 'flat' | 'gable' | 'hipped' | 'tent' | 'mono_pitch' | 'mansard' | 'barrel') */
  type: RoofType;
  /** Roof slope angle in degrees (12° .. 55°, default 35°) */
  pitchDeg?: number;
  /** Eaves overhang (Traufüberstand an den Längsseiten) in meters (0.0m .. 1.20m, default 0.35m) */
  overhang?: number;
  /** Separate Gable overhang (Dachüberstand an den Giebelseiten / Ortgang) in meters (0.0m .. 1.20m, default 0.25m) */
  gableOverhang?: number;
  /** Multi-story roof construction mode:
   * - 'single_floor': Standard roof on top of current floor
   * - 'og_in_roof': Roof sits on EG (1. OG is inside the roof / 1,5-Geschosser)
   * - 'og_and_dg_in_roof': Roof sits on EG, encloses 1. OG in the lower roof AND DG (Spitzboden) in the upper roof
   */
  roofSpanMode?: RoofSpanMode;
  /** Whether this roof covers only this single room ('zone') or spans the entire building ('building') */
  footprintScope?: RoofFootprintScope;
  /** Height of the Kniestock / Drempel (knee wall) in meters before the roof slope begins (0.00m .. 1.80m, default 0.75m) */
  kniestockHeight?: number;
  /** Height of the DG / Spitzboden floor above the 1. OG floor in meters (2.20m .. 3.00m, default 2.75m) */
  spitzbodenHeight?: number;
  /** Whether to render the intermediate Spitzboden / DG ceiling slab inside the roof */
  hasSpitzbodenFloor?: boolean;
  /** Roof covering material */
  material?: RoofMaterialStyle;
  /** Ridge orientation ('x' = Ost-West, 'z' = Nord-Süd) */
  ridgeDirection?: 'x' | 'z';
  /** Individual roof dormers (Dachgauben einzeln hinzugefügt & konfigurierbar) */
  dormers?: RoofDormerItem[];
  /** Individual roof skylights / roof windows (Dachflächenfenster & Lichtkuppeln) */
  skylights?: RoofSkylightItem[];
  /** Individual roof chimneys / flues (Schornsteine & Kamine auf dem Gebäude) */
  chimneys?: RoofChimneyItem[];
  /** Legacy / Quick-preset Dormer architectural type */
  dormerType?: RoofDormerType;
  /** Legacy / Quick-preset Which roof side(s) have dormers */
  dormerSides?: 'front' | 'back' | 'both' | 'south' | 'north' | 'east' | 'west';
  /** Legacy / Quick-preset Number of dormers per active roof slope (1..3) */
  dormerCountPerSide?: number;
  /** Legacy / Quick-preset Width of each dormer in meters (1.0m .. 3.8m) */
  dormerWidth?: number;
  /** Legacy / Quick-preset Height of each dormer in meters (0.9m .. 2.0m) */
  dormerHeight?: number;
}

export interface FloorplanZone {
  id: string;
  name: string;
  zoneType: ZoneType;
  /** Floor level (-1 = KG, 0 = EG, 1 = 1. OG, 2 = DG). Defaults to 0 (EG) */
  level?: FloorLevelId;
  /** Associated Building / Gebäudeteil ID (e.g. 'main_house', 'outbuilding_garage', 'garden_pavilion') for local grid snapping & co-rotation */
  buildingId?: string;
  /** Rotation of this building part / zone around Y in radians (0 = axis-aligned) */
  rotationY?: number;
  /** Center X in meters */
  x: number;
  /** Center Z in meters */
  z: number;
  /** Width along X in meters */
  width: number;
  /** Depth along Z in meters */
  depth: number;
  /** Wall height for indoor zones (default 2.6m), or curb/fence height for outdoor */
  wallHeight: number;
  /** Surface PBR material */
  surfaceMaterial: SurfaceMaterialId;
  /** Indoor wall paint color hex */
  wallColor: string;
  /** Associated temperature/climate entity */
  climateEntityId?: string;
  /** Outdoor perimeter style */
  outdoorPerimeter?: 'none' | 'hedge' | 'wood_fence' | 'stone_curb' | 'carport_roof';
  /** Configurable 3D Roof & Roof Dormers (Dach & Dachgauben) */
  roofConfig?: ZoneRoofConfig;
  /** Free configuration for swimming pool zones (surfaceMaterial === 'pool_water') */
  poolConfig?: PoolConfiguration;
  /** Optional freeform polygon vertices [worldX, worldZ][] in meters for freely drawn surfaces & rooms */
  points?: [number, number][];
  /** Explicit vertical layer order (-1 = Hintergrund/Basisfläche, 0 = Automatisch, 1 = Mittelgrund, 2 = Vordergrund, 3 = Weg/Top-Layer) */
  layerOrder?: number;
  /** Optional raised basement plinth height in meters (e.g. 0.30m when Kellergeschoss protrudes 30cm above ground) */
  plinthHeight?: number;
}

export type OpeningType = 'door' | 'double_patio_door' | 'window' | 'floor_window' | 'garage_door';
export type WallOpeningType = OpeningType;

export type SensorLogicMode = 'single' | 'dual_tilt_open';

export type OpeningHingeSide = 'left' | 'right';
export type OpeningDirection = 'inward' | 'outward';
export type OpeningFrameColor =
  | 'anthracite'
  | 'white'
  | 'oak'
  | 'walnut'
  | 'alu_silver'
  | 'matte_black'
  | 'sage_green'
  | 'bronze_corten'
  | 'burgundy_red';

export type OpeningDesignStyle =
  | 'modern_single'
  | 'mullion_cross'
  | 'industrial_loft'
  | 'frosted_privacy'
  | 'arched_classic'
  | 'modern_flush'
  | 'entrance_glass_sidelight'
  | 'entrance_wood_slats'
  | 'classic_panel_cottage'
  | 'full_glass_office'
  | 'sectional_modern'
  | 'sectional_wood_ribbed'
  | 'sectional_flush_glass';

export interface WallOpening {
  id: string;
  name: string;
  type: OpeningType;
  /** Floor level (-1 = KG, 0 = EG, 1 = 1. OG, 2 = DG). Defaults to 0 (EG) */
  level?: FloorLevelId;
  /** World X in meters */
  x: number;
  /** World Z in meters */
  z: number;
  /** Rotation around Y in radians (0 = along X wall, Math.PI/2 = along Z wall) */
  rotationY: number;
  width: number;
  height: number;
  /** Height from floor level in meters (Brüstungshöhe vom Boden, e.g. 0.85m for windows, 0.0m for doors) */
  sillHeight: number;
  /** DIN-Anschlag / Scharnierseite ('left' = Anschlag Links, 'right' = Anschlag Rechts) */
  hingeSide?: OpeningHingeSide;
  /** Öffnungsrichtung ('inward' = nach Innen / Raumseite, 'outward' = nach Außen / Hofseite) */
  openDirection?: OpeningDirection;
  /** Flügelanzahl ('auto' | 1 | 2) */
  sashCount?: 'auto' | 1 | 2;
  /** Rahmen- & Türfarbe */
  frameColor?: OpeningFrameColor;
  /** Architektur-Design für Fenster, Haustüren, Innentüren & Tore */
  openingDesign?: OpeningDesignStyle;
  /** Optional manual state override ('closed' | 'tilted' | 'open') usable in both Live & Editor */
  previewStateOverride?: 'closed' | 'tilted' | 'open';
  /** Continuous opening percentage (0..100) for smooth 3D door/window/gate angle & slide control */
  openPositionPct?: number;
  /** Primary door/window contact sensor or cover entity (Sensor A) */
  entityId?: string;
  /** Secondary contact sensor for Two-Sensor Tilt/Open logic (Sensor B: e.g. 1 active = Gekippt, both active = Geöffnet) */
  tiltEntityId?: string;
  /** Sensor evaluation mode: 'single' or 'dual_tilt_open' (2 sensors for Closed / Tilted / Open) */
  sensorLogicMode?: SensorLogicMode;
  /** Optional shutter/blind cover entity */
  shutterEntityId?: string;
  /** Whether this door has exterior entrance steps (e.g. when basement protrudes 30 cm out of the ground) */
  hasExteriorSteps?: boolean;
  /** Height of the raised basement plinth / entrance threshold above ground in meters (default 0.30 m) */
  exteriorPlinthHeight?: number;
  /** Number of exterior steps leading up to the door (1..5, default 2) */
  exteriorStepsCount?: number;
  /** Width of the exterior entrance landing & steps in meters */
  exteriorStepsWidth?: number;
  /** Total depth of the exterior landing + steps in meters */
  exteriorStepsDepth?: number;
  /** Material of the exterior steps ('granite' | 'travertine' | 'anthracite' | 'wood') */
  exteriorStepsMaterial?: 'granite' | 'travertine' | 'anthracite' | 'wood';
  /** Exterior step handrail side ('none' | 'both' | 'left' | 'right') */
  exteriorStepsRailing?: 'none' | 'both' | 'left' | 'right';
}

export type StairShapeType =
  | 'straight'
  | 'quarter_bottom_left'
  | 'quarter_bottom_right'
  | 'quarter_top_left'
  | 'quarter_top_right'
  | 'half_s_curve'
  | 'u_podest'
  | 'spiral';

export type UnderStairClosureType =
  | 'open'
  | 'walled_closed'
  | 'storage_door'
  | 'built_in_drawers';

export type StairRailingSide = 'both' | 'left' | 'right' | 'none';
export type StairRailingStyle = 'glass' | 'steel_rods' | 'solid_parapet' | 'oak_handrail';
export type StairRiserStyle = 'open' | 'closed_white' | 'closed_oak';
export type StairTreadMaterial = 'oak' | 'walnut' | 'anthracite_stone' | 'travertine';

export interface StairConfiguration {
  shape?: StairShapeType;
  underStairClosure?: UnderStairClosureType;
  railingSide?: StairRailingSide;
  railingStyle?: StairRailingStyle;
  riserStyle?: StairRiserStyle;
  treadMaterial?: StairTreadMaterial;
  stepCount?: number;
  width?: number;
  totalRun?: number;
  totalRise?: number;
}

export type AssetCategory =
  | 'fences_hedges'
  | 'sensors_plugs'
  | 'lighting'
  | 'climate_appliance'
  | 'media_camera'
  | 'outdoor_energy'
  | 'furniture'
  | 'custom_glb';

export type MountType = 'floor' | 'wall' | 'ceiling';

export interface CatalogItem {
  id: string;
  name: string;
  category: AssetCategory;
  mountType: MountType;
  defaultY: number;
  width: number;
  height: number;
  depth: number;
  defaultDomain?: HADomain;
  description: string;
  badgeText: string;
}

export interface PlacedAsset {
  id: string;
  catalogId: string;
  name: string;
  category: AssetCategory;
  mountType: MountType;
  /** Floor level (-1 = KG, 0 = EG, 1 = 1. OG, 2 = DG). Defaults to 0 (EG) */
  level?: FloorLevelId;
  position: [number, number, number];
  rotationY: number;
  scale: number;
  /** Optional custom length in meters (especially for hedges, fences, walkways, privacy walls) */
  customLength?: number;
  /** Optional custom height or width in meters */
  customHeight?: number;
  /** Optional individual window configuration for standalone placed roof dormers & skylights */
  dormerWindowConfig?: DormerWindowConfig;
  /** Optional customizable staircase configuration (curves bottom/top, under-stair wall closure, railing, material) */
  stairConfig?: StairConfiguration;
  /** Lateral sliding direction for electric driveway gate ('left' | 'right') */
  gateSlideDirection?: 'left' | 'right';
  /** Manual opening percentage override (0..100) for gates/doors */
  customOpenPct?: number;
  entityId?: string;
  /** Optional secondary entity for composite rules */
  secondaryEntityId?: string;
  /** Optional custom GLB/GLTF blob or data URL */
  customGlbUrl?: string;
  /** Optional light cone parameters */
  lightConfig?: {
    type: 'point' | 'spot';
    maxIntensity: number;
    distance: number;
  };
}

export function isStairAsset(catalogId: string): boolean {
  return (
    catalogId === 'staircase_oak_glass' ||
    catalogId === 'staircase_spiral_steel' ||
    catalogId === 'staircase_curved_landing'
  );
}

export function isTreeAsset(catalogId: string): boolean {
  return (
    catalogId === 'garden_tree_oak' ||
    catalogId === 'tree_birch_multi' ||
    catalogId === 'tree_japanese_maple' ||
    catalogId === 'tree_pine_conifer' ||
    catalogId === 'tree_mediterranean_olive' ||
    catalogId === 'tree_cypress_column' ||
    catalogId === 'tree_fruit_apple'
  );
}

export function isDrivewayGateAsset(catalogId: string): boolean {
  return (
    catalogId === 'electric_sliding_driveway_gate' ||
    catalogId === 'garden_pedestrian_gate' ||
    catalogId === 'electric_roller_gate'
  );
}

export function isWalkwayAsset(catalogId: string): boolean {
  return (
    catalogId === 'walkway_wood_deck' ||
    catalogId === 'walkway_natural_stone' ||
    catalogId === 'walkway_stepping_stones' ||
    catalogId === 'walkway_slate_anthracite'
  );
}

export function isDormerOrSkylightAsset(catalogId: string): boolean {
  return (
    catalogId === 'roof_dormer_gable' ||
    catalogId === 'roof_dormer_shed' ||
    catalogId === 'roof_dormer_flat_modern' ||
    catalogId === 'roof_skylight_window' ||
    catalogId === 'roof_skylight_twin'
  );
}

export function isChimneyOrDormerAsset(catalogId: string): boolean {
  return (
    catalogId === 'stainless_steel_chimney' ||
    catalogId === 'outdoor_patio_fireplace_steel' ||
    catalogId === 'chimney_brick_roof' ||
    catalogId === 'wood_stove_scandinavian' ||
    isDormerOrSkylightAsset(catalogId)
  );
}

export function isFenceOrHedgeAsset(catalogId: string): boolean {
  return (
    catalogId === 'cypress_hedge' ||
    catalogId === 'hedge_thuja' ||
    catalogId === 'hedge_boxwood_low' ||
    catalogId === 'fence_double_rod' ||
    catalogId === 'fence_wpc_privacy' ||
    catalogId === 'fence_wood_larch' ||
    catalogId === 'fence_picket_classic' ||
    catalogId === 'fence_gabion_wall' ||
    catalogId === 'fence_glass_alu' ||
    catalogId === 'garden_pedestrian_gate' ||
    catalogId === 'electric_sliding_driveway_gate' ||
    catalogId === 'outdoor_pergola_string_lights' ||
    isWalkwayAsset(catalogId)
  );
}

export type HADomain =
  | 'light'
  | 'switch'
  | 'binary_sensor'
  | 'sensor'
  | 'cover'
  | 'climate'
  | 'camera'
  | 'media_player'
  | 'vacuum'
  | 'valve'
  | 'lock'
  | 'alarm_control_panel';

export interface HAEntityAttributes {
  friendly_name: string;
  device_class?:
    | 'smoke'
    | 'moisture'
    | 'motion'
    | 'occupancy'
    | 'door'
    | 'window'
    | 'garage_door'
    | 'shutter'
    | 'outlet'
    | 'power'
    | 'energy'
    | 'temperature'
    | 'co2';
  /** Light attributes */
  brightness?: number; // 0..255
  rgb_color?: [number, number, number];
  color_temp_kelvin?: number; // 2200..6500
  /** Smart plug & energy attributes */
  current_power_w?: number;
  today_energy_kwh?: number;
  voltage_v?: number;
  /** Sensor / Detector attributes */
  battery_level?: number;
  linkquality_lqi?: number;
  alarm_test_active?: boolean;
  detection_radius_m?: number;
  co2_ppm?: number;
  humidity_pct?: number;
  /** Cover / Door attributes */
  current_position?: number; // 0 (closed) .. 100 (open)
  /** Climate attributes */
  current_temperature?: number;
  target_temperature?: number;
  hvac_mode?: 'heat' | 'cool' | 'auto' | 'off';
  hvac_action?: 'heating' | 'cooling' | 'idle' | 'off';
  /** Media & Camera attributes */
  media_title?: string;
  volume_level?: number;
  camera_location?: string;
  night_vision?: boolean;
  /** Robot / Irrigation attributes */
  cleaned_area_m2?: number;
  soil_moisture_pct?: number;
  water_flow_lmin?: number;
  unit_of_measurement?: string;
}

export interface HAEntityState {
  entity_id: string;
  domain: HADomain;
  state: string;
  attributes: HAEntityAttributes;
  last_changed: string;
}

export interface FloorplanProject {
  title: string;
  version: string;
  zones: FloorplanZone[];
  openings: WallOpening[];
  assets: PlacedAsset[];
}

export type CameraPresetId =
  | 'overview'
  | 'living_kitchen'
  | 'garden_pool'
  | 'driveway_solar'
  | 'top_blueprint';

export type WorkspaceTab = 'live' | 'editor' | 'devices' | 'hacs';

export type EditorViewMode = '2d' | 'split' | '3d';

export function isBinaryEntityActive(entity?: HAEntityState): boolean {
  if (!entity) return false;
  return (
    entity.state === 'on' ||
    entity.state === 'open' ||
    entity.state === 'detected' ||
    (entity.attributes?.current_position ?? 0) > 25
  );
}

/**
 * Evaluates a window or door opening's physical state ('closed' | 'tilted' | 'open')
 * supporting both single-sensor and two-sensor composite rules:
 * - In 'dual_tilt_open' mode (or whenever tiltEntityId is bound):
 *   - Sensor 1 active + Sensor 2 active => 'open' (Komplett geöffnet)
 *   - Only Sensor 1 (or Only Sensor 2) active => 'tilted' (Gekippt)
 *   - Both inactive => 'closed' (Geschlossen)
 */
export function resolveOpeningSensorState(
  opening: WallOpening,
  entities: Record<string, HAEntityState>
): 'closed' | 'tilted' | 'open' {
  if (opening.previewStateOverride) {
    return opening.previewStateOverride;
  }

  const ent1 = opening.entityId ? entities[opening.entityId] : undefined;
  const ent2 = opening.tiltEntityId ? entities[opening.tiltEntityId] : undefined;

  if (opening.sensorLogicMode === 'dual_tilt_open' || opening.tiltEntityId) {
    const s1Active = isBinaryEntityActive(ent1);
    const s2Active = isBinaryEntityActive(ent2);
    if (s1Active && s2Active) return 'open';
    if (s1Active || s2Active) return 'tilted';
    return 'closed';
  }

  if (ent1?.state === 'tilted') return 'tilted';
  return isBinaryEntityActive(ent1) ? 'open' : 'closed';
}

/**
 * Computes exact area in m² for a polygon defined by [worldX, worldZ][] vertices (Shoelace formula)
 */
export function computePolygonAreaM2(points: [number, number][]): number {
  if (!points || points.length < 3) return 0;
  let sum = 0;
  for (let i = 0; i < points.length; i++) {
    const [x1, z1] = points[i];
    const [x2, z2] = points[(i + 1) % points.length];
    sum += x1 * z2 - x2 * z1;
  }
  return Math.abs(sum) * 0.5;
}

export function computeZoneAreaM2(zone: FloorplanZone): number {
  if (zone.points && zone.points.length >= 3) {
    return computePolygonAreaM2(zone.points);
  }
  return zone.width * zone.depth;
}

export function computePolygonBounds(points: [number, number][]): {
  x: number;
  z: number;
  width: number;
  depth: number;
} {
  if (!points || points.length === 0) {
    return { x: 0, z: 0, width: 1, depth: 1 };
  }
  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  for (const [px, pz] of points) {
    if (px < minX) minX = px;
    if (px > maxX) maxX = px;
    if (pz < minZ) minZ = pz;
    if (pz > maxZ) maxZ = pz;
  }
  const width = Math.max(0.4, +(maxX - minX).toFixed(2));
  const depth = Math.max(0.4, +(maxZ - minZ).toFixed(2));
  const x = +((minX + maxX) / 2).toFixed(2);
  const z = +((minZ + maxZ) / 2).toFixed(2);
  return { x, z, width, depth };
}

export const BUILDING_PRESETS: { id: string; name: string; badge: string; colorHex: string }[] = [
  { id: 'main_house', name: 'Hauptgebäude (Wohnhaus / Villa)', badge: 'Hauptgebäude', colorHex: '#38bdf8' },
  { id: 'outbuilding_garage', name: 'Nebengebäude 1 (Garage & Werkstatt)', badge: 'Nebengebäude 1', colorHex: '#fbbf24' },
  { id: 'garden_pavilion', name: 'Nebengebäude 2 (Poolhaus / Gartenhaus)', badge: 'Nebengebäude 2', colorHex: '#34d399' },
  { id: 'guest_wing', name: 'Anbau / Seitenflügel (Wintergarten / Büro)', badge: 'Anbau / Flügel', colorHex: '#c084fc' },
];

export function isZoneRotated(zone: FloorplanZone): boolean {
  return Math.abs(zone.rotationY ?? 0) > 0.004;
}

/**
 * Returns the world [x, z][] vertices of a zone:
 * - If `zone.points` is defined, returns `zone.points`
 * - Otherwise returns the 4 corners of the rectangle rotated by `zone.rotationY` around `(zone.x, zone.z)`
 */
export function getZoneCorners(zone: FloorplanZone): [number, number][] {
  if (zone.points && zone.points.length >= 3) {
    return zone.points;
  }
  const hw = zone.width / 2;
  const hd = zone.depth / 2;
  const rot = zone.rotationY ?? 0;
  const cosR = Math.cos(-rot);
  const sinR = Math.sin(-rot);
  const localCorners: [number, number][] = [
    [-hw, -hd],
    [hw, -hd],
    [hw, hd],
    [-hw, hd],
  ];
  return localCorners.map(([lx, lz]) => [
    +(zone.x + lx * cosR - lz * sinR).toFixed(3),
    +(zone.z + lx * sinR + lz * cosR).toFixed(3),
  ]);
}

/**
 * Returns the list of individually editable windows inside a dormer (`DormerWindowUnit[]`).
 * Automatically upgrades legacy `windowCount` / `windowStyle` configs into individual window items.
 */
export function getEffectiveDormerWindows(cfg?: DormerWindowConfig): DormerWindowUnit[] {
  if (cfg?.windows && cfg.windows.length > 0) {
    return cfg.windows;
  }
  const count = Math.max(1, Math.min(4, cfg?.windowCount ?? 2));
  const baseStyle = cfg?.windowStyle || 'mullion_cross';
  const baseColor = cfg?.windowFrameColor || 'anthracite';
  const baseState = cfg?.windowOpenState || 'closed';
  const hasShutter = cfg?.hasShutter ?? false;
  const shutterPct = cfg?.shutterClosedPct ?? 0;

  const units: DormerWindowUnit[] = [];
  for (let i = 0; i < count; i++) {
    units.push({
      id: `dwin_${i + 1}`,
      name: `Fenster ${i + 1}`,
      widthRatio: 1,
      sashCount: 1,
      hingeSide: i % 2 === 0 ? 'left' : 'right',
      windowStyle: baseStyle,
      windowFrameColor: baseColor,
      windowOpenState: baseState,
      hasShutter,
      shutterClosedPct: shutterPct,
    });
  }
  return units;
}

/**
 * Determines whether a zone's roof sits on the ground floor (EG) and encloses upper floors (1. OG / DG).
 * Returns true if:
 * - `roofSpanMode` is explicitly `'og_in_roof'` or `'og_and_dg_in_roof'`, OR
 * - A pitched roof is placed on EG (`level === 0`) of a building that also has `1. OG` (`level >= 1`) rooms, OR
 * - A pitched roof on `1. OG` (`level === 1`) has a Kniestock configured or `DG` (`level >= 2`) rooms above it.
 */
export function isBuildingMultiStoryRoof(
  zone: FloorplanZone,
  allZones: FloorplanZone[]
): boolean {
  const cfg = zone.roofConfig;
  if (!cfg || cfg.type === 'none') return false;
  if (cfg.roofSpanMode === 'og_in_roof' || cfg.roofSpanMode === 'og_and_dg_in_roof') {
    return true;
  }
  if (cfg.type === 'flat') return false;
  const bldgKey = zone.buildingId || zone.id;
  const zLevel = zone.level ?? 0;
  if (zLevel === 0) {
    return allZones.some(
      (uz) =>
        uz.zoneType === 'indoor' &&
        (uz.buildingId || uz.id) === bldgKey &&
        (uz.level ?? 0) >= 1
    );
  }
  if (zLevel === 1) {
    if (cfg.kniestockHeight !== undefined) return true;
    return allZones.some(
      (uz) =>
        uz.zoneType === 'indoor' &&
        (uz.buildingId || uz.id) === bldgKey &&
        (uz.level ?? 0) >= 2
    );
  }
  return false;
}

/**
 * Computes the effective footprint zone for a roof:
 * - If `footprintScope === 'building'` (or multi-story roof spanning from EG without explicit `'zone'` scope),
 *   merges all indoor rooms of the same `buildingId` on the base floor into one unified building envelope.
 * - Otherwise returns `zone` unchanged.
 */
export function computeRoofHostFootprintZone(
  zone: FloorplanZone,
  allZones: FloorplanZone[]
): FloorplanZone {
  const cfg = zone.roofConfig;
  if (!cfg || cfg.type === 'none') return zone;

  const isMultiStory = isBuildingMultiStoryRoof(zone, allZones);
  const bldgKey = zone.buildingId || zone.id;
  const hasDG = allZones.some(
    (uz) =>
      uz.zoneType === 'indoor' &&
      (uz.buildingId || uz.id) === bldgKey &&
      (uz.level ?? 0) >= 2
  );
  const effectiveSpanMode =
    cfg.roofSpanMode && cfg.roofSpanMode !== 'single_floor'
      ? cfg.roofSpanMode
      : isMultiStory
      ? hasDG
        ? 'og_and_dg_in_roof'
        : 'og_in_roof'
      : 'single_floor';

  const useWholeBuilding =
    cfg.footprintScope === 'building' || (isMultiStory && cfg.footprintScope !== 'zone');

  if (!useWholeBuilding || !zone.buildingId) {
    return {
      ...zone,
      roofConfig: {
        ...cfg,
        roofSpanMode: effectiveSpanMode,
      },
    };
  }

  const targetLevel = isMultiStory ? 0 : (zone.level ?? 0);
  let siblingZones = allZones.filter(
    (z) =>
      z.zoneType === 'indoor' &&
      z.buildingId === zone.buildingId &&
      (z.level ?? 0) === targetLevel
  );
  if (siblingZones.length === 0) {
    siblingZones = allZones.filter(
      (z) =>
        z.zoneType === 'indoor' &&
        z.buildingId === zone.buildingId &&
        (z.level ?? 0) === (zone.level ?? 0)
    );
  }
  if (siblingZones.length <= 1 && siblingZones[0]?.id === zone.id) {
    return {
      ...zone,
      roofConfig: {
        ...cfg,
        roofSpanMode: effectiveSpanMode,
      },
    };
  }

  const refZone = siblingZones[0] || zone;
  const rot = refZone.rotationY ?? zone.rotationY ?? 0;
  const cos = Math.cos(-rot);
  const sin = Math.sin(-rot);
  const invCos = Math.cos(rot);
  const invSin = Math.sin(rot);

  let minU = Infinity;
  let maxU = -Infinity;
  let minV = Infinity;
  let maxV = -Infinity;
  let maxWallH = zone.wallHeight || 2.6;

  for (const sz of siblingZones) {
    if ((sz.wallHeight || 2.6) > maxWallH) maxWallH = sz.wallHeight || 2.6;
    const corners = getZoneCorners(sz);
    for (const [wx, wz] of corners) {
      const dx = wx - refZone.x;
      const dz = wz - refZone.z;
      const u = dx * invCos - dz * invSin;
      const v = dx * invSin + dz * invCos;
      if (u < minU) minU = u;
      if (u > maxU) maxU = u;
      if (v < minV) minV = v;
      if (v > maxV) maxV = v;
    }
  }

  const midU = (minU + maxU) / 2;
  const midV = (minV + maxV) / 2;
  const centerX = +(refZone.x + midU * cos - midV * sin).toFixed(3);
  const centerZ = +(refZone.z + midU * sin + midV * cos).toFixed(3);
  const totalW = Math.max(1.2, +(maxU - minU).toFixed(3));
  const totalD = Math.max(1.2, +(maxV - minV).toFixed(3));

  return {
    ...zone,
    level: targetLevel as FloorLevelId,
    x: centerX,
    z: centerZ,
    width: totalW,
    depth: totalD,
    rotationY: rot,
    wallHeight: maxWallH,
    points: undefined,
    roofConfig: {
      ...cfg,
      roofSpanMode: effectiveSpanMode,
    },
  };
}



