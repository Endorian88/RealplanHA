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
  | 'pathway_cobble'
  | 'asphalt_road'
  | 'sidewalk_pavers';

export type VisualStyleMode = 'archviz' | 'neon' | 'blueprint';

export type WeatherSimulationMode = 'auto_sun' | 'clear' | 'cloudy' | 'rain' | 'snow';

export type WallSegmentMode = 'full' | 'hidden' | 'half_height' | 'archway';

export type WallSurfaceFinish =
  | 'plaster'
  | 'wood_slats'
  | 'brick_exposed'
  | 'stone_tile'
  | 'concrete_loft'
  | 'wallpaper_accent'
  | 'glass_block';

export type WallSideId = 'north' | 'east' | 'south' | 'west';

export interface WallSideConfig {
  /** 'full' = Geschlossene Wand, 'hidden' = Ausgeblendet (Offene Küche), 'half_height' = Halbhohe Theke (1.10m), 'archway' = Rundbogen/Durchbruch */
  mode?: WallSegmentMode;
  /** Wand-Oberfläche / Akzentwand-Material */
  finish?: WallSurfaceFinish;
  /** Optionale eigene Wandfarbe für diese Wandseite */
  color?: string;
  /** Individuelle Wandstärke in Metern (0.08m .. 0.40m) */
  thickness?: number;
  /** Breite des Wanddurchbruchs / Rundbogens in Metern */
  archWidth?: number;
  /** Höhe des Wanddurchbruchs / Rundbogens in Metern */
  archHeight?: number;
}

export interface CustomWallSegment {
  id: string;
  name: string;
  level?: FloorLevelId;
  x1: number;
  z1: number;
  x2: number;
  z2: number;
  height?: number;
  thickness?: number;
  mode?: WallSegmentMode;
  finish?: WallSurfaceFinish;
  color?: string;
  locked?: boolean;
}

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
  /** Home Assistant window contact sensor (binary_sensor.*) or window entity */
  entityId?: string;
  /** Home Assistant roller shutter entity (cover.*) for this dormer window */
  shutterEntityId?: string;
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
  /** Default Home Assistant window contact sensor (binary_sensor.*) for this dormer */
  entityId?: string;
  /** Default Home Assistant roller shutter entity (cover.*) for this dormer */
  shutterEntityId?: string;
  /** Host roof slope angle in degrees (used by standalone catalog dormers for flush cheek geometry) */
  roofSlopeAngleDeg?: number;
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
  | 'flat_roof_dome'
  | 'chimney_sweep_hatch';

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
  /** Home Assistant window contact sensor (binary_sensor.*) */
  entityId?: string;
  /** Home Assistant roller shutter / blind entity (cover.*) */
  shutterEntityId?: string;
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

export type RoofPVSideId = 'front' | 'back' | 'left' | 'right';

export interface RoofPVSideConfig {
  enabled: boolean;
  /** Optional exact number of PV modules on this specific roof side (0 or undefined = automatic via coveragePct) */
  moduleCount?: number;
  /** Coverage percentage on this roof slope (30 .. 95, default 75) */
  coveragePct?: number;
}

export interface RoofPVConfig {
  /** Whether roof-mounted PV modules are generated on this roof */
  enabled: boolean;
  /** Which roof slope(s) have PV modules ('front' = Süd/Vorderseite, 'back' = Nord/Rückseite, 'both' = Beide Dachseiten, 'per_side' = Individuell pro Dachseite) */
  sides?: 'front' | 'back' | 'both' | 'per_side';
  /** Coverage percentage of the roof slope (30 .. 95, default 75) */
  coveragePct?: number;
  /** Optional exact number of PV modules to place on the roof (0 or undefined = automatic via coveragePct) */
  moduleCount?: number;
  /** Individual per-side PV configuration (front/Süd, back/Nord, left/West, right/Ost) */
  perSide?: Partial<Record<RoofPVSideId, RoofPVSideConfig>>;
  /** Home Assistant PV power entity (e.g. sensor.pv_erzeugung_watt) */
  entityId?: string;
  /** Installed peak power in kWp (e.g. 9.6) */
  kwPeak?: number;
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
  /** Per-building roof visibility override:
   * - 'auto': Follows global roof switcher (hidden when inspecting single floors, visible in Alle 3D)
   * - 'always_visible': Always keep this building's roof visible (e.g. Garage roof stays visible while Wohnhaus roof is hidden)
   * - 'always_hidden': Always hide this building's roof for unobstructed interior view
   */
  visibilityMode?: 'auto' | 'always_visible' | 'always_hidden';
  /** Roof-mounted PV Solar Modules directly integrated on the roof slopes */
  pvConfig?: RoofPVConfig;
}

export type IndoorZoneRole = 'wohnraum_building' | 'outbuilding' | 'room';

export interface FloorplanZone {
  id: string;
  name: string;
  zoneType: ZoneType;
  /**
   * Architectural role within the 2-tier building & room hierarchy:
   * - 'wohnraum_building': Main building shell / Wohnraum (Gebäude-Hülle & Basisboden)
   * - 'outbuilding': Outbuilding shell / Nebengebäude (Garage, Carport, Gartenhaus, Werkstatt)
   * - 'room': Interior room (Raum) created inside a Wohnraum or Nebengebäude (floor renders graphically above the building floor!)
   */
  zoneRole?: IndoorZoneRole;
  /** Floor level (-1 = KG, 0 = EG, 1 = 1. OG, 2 = DG). Defaults to 0 (EG) */
  level?: FloorLevelId;
  /** Associated Building / Gebäudeteil ID (e.g. 'main_house', 'outbuilding_garage', or a building zone ID) for hierarchy sorting, local grid snapping & co-rotation */
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
  /** Associated room presence / occupancy / motion sensor entity (binary_sensor.* or sensor.*) */
  presenceEntityId?: string;
  /** Outdoor perimeter style */
  outdoorPerimeter?: 'none' | 'hedge' | 'wood_fence' | 'stone_curb' | 'carport_roof' | 'chainlink_fence';
  /** Per-wall-side configuration for 2D/3D Wand-Designer (North/East/South/West) */
  wallSides?: Partial<Record<WallSideId, WallSideConfig>>;
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
  /** Whether this zone/room is locked against accidental dragging, resizing, or deletion in the editor */
  locked?: boolean;
  /** Optional custom 3D camera viewpoint saved for this room when focused */
  savedCameraView?: {
    position: [number, number, number];
    target: [number, number, number];
  };
}

export type OpeningType =
  | 'door'
  | 'double_patio_door'
  | 'window'
  | 'floor_window'
  | 'garage_door'
  | 'glass_block_window';
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
  | 'sectional_flush_glass'
  | 'up_and_over_classic'
  | 'roller_shutter_gate'
  | 'double_wing_gate';

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
  locked?: boolean;
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
  /** Direct state ('closed' | 'tilted' | 'open') */
  openState?: 'closed' | 'tilted' | 'open';
  /** Continuous opening percentage (0..100) for smooth 3D door/window/gate angle & slide control */
  openPositionPct?: number;
  /** Primary door/window/garage contact sensor or cover entity (Sensor A) */
  entityId?: string;
  /** Secondary contact sensor for Two-Sensor Tilt/Open logic (Sensor B: e.g. 1 active = Gekippt, both active = Geöffnet) */
  tiltEntityId?: string;
  /** Optional actuator entity (e.g. cover.*, switch.*, button.*, lock.*) if contact sensor is a read-only binary_sensor */
  actuatorEntityId?: string;
  /** Interaction mode in Live view:
   * - 'auto': read-only if binary_sensor without actuator, controllable if cover/switch/actuator
   * - 'sensor_only': strictly read-only live status indicator (clicking never opens/closes)
   * - 'actuator': controllable via click (toggles entityId or actuatorEntityId)
   * - 'sensor_and_actuator': reads status from entityId (sensor) and triggers actuatorEntityId on click
   */
  controlMode?: 'auto' | 'sensor_only' | 'actuator' | 'sensor_and_actuator';
  /** Floating 3D status icon display mode in Live 3D ('auto' | 'always' | 'when_active' | 'hidden') */
  statusBadgeMode?: 'auto' | 'always' | 'when_active' | 'hidden';
  /** Sensor evaluation mode: 'single' or 'dual_tilt_open' (2 sensors for Closed / Tilted / Open) */
  sensorLogicMode?: SensorLogicMode;
  /** Optional dual sensor rule configuration */
  dualSensorRule?: {
    enabled: boolean;
    sensorAEntityId: string;
    sensorBEntityId: string;
  };
  /** Optional shutter/blind cover entity */
  shutterEntityId?: string;
  /** Individual shutter closed percentage (0 = open, 100 = closed) for this specific window/door */
  shutterClosedPct?: number;
  /** Whether this door has exterior entrance steps (e.g. when basement protrudes 30 cm out of the ground) */
  hasExteriorSteps?: boolean;
  /** Architectural shape of the exterior entrance steps */
  exteriorStepsShape?: ExteriorStepsShapeType;
  /** Height of the raised basement plinth / entrance threshold above ground in meters (default 0.30 m) */
  exteriorPlinthHeight?: number;
  /** Number of exterior steps leading up to the door (1..8, default 2) */
  exteriorStepsCount?: number;
  /** Width of the exterior entrance landing & steps in meters */
  exteriorStepsWidth?: number;
  /** Total depth of the exterior landing + steps in meters */
  exteriorStepsDepth?: number;
  /** Material of the exterior steps ('granite' | 'travertine' | 'anthracite' | 'wood' | 'brick_clinker') */
  exteriorStepsMaterial?: 'granite' | 'travertine' | 'anthracite' | 'wood' | 'brick_clinker';
  /** Exterior step handrail side ('none' | 'both' | 'left' | 'right' | 'glass') */
  exteriorStepsRailing?: 'none' | 'both' | 'left' | 'right' | 'glass';
}

export type ExteriorStepsShapeType =
  | 'straight'
  | 'pyramid_3side'
  | 'curved_fan'
  | 'side_left'
  | 'side_right'
  | 'double_side_T'
  | 'corner_L'
  | 'kellertreppe_wall';

export interface ExteriorStairConfiguration {
  shape?: ExteriorStepsShapeType;
  plinthHeight?: number;
  stepCount?: number;
  width?: number;
  depth?: number;
  material?: 'granite' | 'travertine' | 'anthracite' | 'wood' | 'brick_clinker';
  railing?: 'none' | 'both' | 'left' | 'right' | 'glass';
}

export type StairShapeType =
  | 'straight'
  | 'quarter_bottom_left'
  | 'quarter_bottom_right'
  | 'quarter_top_left'
  | 'quarter_top_right'
  | 'l_landing_left'
  | 'l_landing_right'
  | 'half_s_curve'
  | 'double_winder_c_left'
  | 'double_winder_c_right'
  | 'double_winder_s_left'
  | 'double_winder_s_right'
  | 'u_podest'
  | 'u_winder'
  | 't_imperial'
  | 'curved_arc'
  | 'floating_cantilever'
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

export type RadiatorType =
  | 'flat_panel'
  | 'ribbed_classic'
  | 'towel_bathroom'
  | 'vertical_designer';

export interface RadiatorConfiguration {
  radiatorType?: RadiatorType;
  finishColor?: string;
  snapToWall?: boolean;
}

export type SofaShapeType = 'single' | 'l_left' | 'l_right' | 'u_shape';

export interface SofaConfiguration {
  shape?: SofaShapeType;
  hasOttoman?: boolean;
  showCoffeeTableAndRug?: boolean;
  fabricColor?: string;
  cushionColor?: string;
  depth?: number;
  chaiseDepth?: number;
}

export type AcousticWoodTone =
  | 'oak_natural'
  | 'walnut_dark'
  | 'ash_light'
  | 'teak_warm'
  | 'charcoal_black';

export interface AcousticPanelConfiguration {
  woodTone?: AcousticWoodTone;
  feltColor?: string;
}

export type WallPlannerCategory = 'kitchen' | 'living_wall' | 'wardrobe' | 'closet';

export type WallModuleType =
  | 'sink_unit'
  | 'cooktop_oven'
  | 'tall_fridge'
  | 'tall_oven'
  | 'drawer_base'
  | 'dishwasher_base'
  | 'corner_unit'
  | 'tv_lowboard'
  | 'media_acoustic_wall'
  | 'glass_vitrine'
  | 'wall_bookshelf'
  | 'wardrobe_bench_hooks'
  | 'wardrobe_mirror_cabinet'
  | 'wardrobe_shoe_cabinet'
  | 'closet_double_door'
  | 'closet_mirror_door'
  | 'closet_open_shelving';

export interface WallModuleConfiguration {
  category: WallPlannerCategory;
  moduleType: WallModuleType;
  frontColor?: string;
  countertopColor?: string;
  bodyWoodTone?: AcousticWoodTone;
  hasUpperCabinet?: boolean;
  hasLedStrip?: boolean;
  attachedZoneId?: string;
  attachedWallSide?: WallSideId;
  offsetAlongWall?: number;
  wallGroupId?: string;
}

export type AssetCategory =
  | 'fences_hedges'
  | 'sensors_plugs'
  | 'lighting'
  | 'climate_appliance'
  | 'media_camera'
  | 'outdoor_energy'
  | 'furniture'
  | 'shading'
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

export interface BuildingTechEntityConfig {
  /** Primary status or operating mode entity (e.g. sensor.wp_status, switch.waermepumpe) */
  statusEntityId?: string;
  /** Current power in W or kW (e.g. sensor.pv_erzeugung_watt, sensor.wp_aufnahmeleistung) */
  powerEntityId?: string;
  /** Daily energy yield or consumption in kWh (e.g. sensor.pv_tagesertrag_kwh) */
  dailyEnergyEntityId?: string;
  /** Daily energy yield alias */
  dailyYieldEntityId?: string;
  /** Heat pump / heating supply temperature (Vorlauftemperatur °C) */
  supplyTempEntityId?: string;
  /** Heat pump / heating return temperature (Rücklauftemperatur °C) */
  returnTempEntityId?: string;
  /** Heat pump COP / Arbeitszahl (e.g. sensor.wp_cop) */
  copEntityId?: string;
  /** Hot water buffer tank temperature (Speichertemperatur °C) */
  tankTempEntityId?: string;
  /** Storage temperature alias */
  storageTempEntityId?: string;
  /** Target temperature or climate entity */
  targetTempEntityId?: string;
  /** Battery state of charge in % (e.g. sensor.hausakku_soc) */
  socEntityId?: string;
  /** Battery state of charge alias */
  batterySocEntityId?: string;
  /** Grid import/export power in W (e.g. sensor.netzbezug_watt) */
  gridPowerEntityId?: string;
  /** Smart home server CPU load / system health (e.g. sensor.smarthome_hub_cpu) */
  cpuLoadEntityId?: string;
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
  locked?: boolean;
  /** Optional custom length/width in meters */
  customLength?: number;
  /** Optional custom width/depth in meters */
  customWidth?: number;
  /** Optional custom depth in meters */
  customDepth?: number;
  /** Optional custom height in meters */
  customHeight?: number;
  /** Optional individual window configuration for standalone placed roof dormers & skylights */
  dormerWindowConfig?: DormerWindowConfig;
  /** Optional customizable indoor staircase configuration (shape, curves, under-stair wall closure, railing, material) */
  stairConfig?: StairConfiguration;
  /** Optional customizable exterior steps configuration (shape, plinth height, step count, material, railing) */
  exteriorStairConfig?: ExteriorStairConfiguration;
  /** Optional radiator configuration (type, finishColor, wall-snap) */
  radiatorConfig?: RadiatorConfiguration;
  /** Optional sofa configuration (shape, ottoman, fabricColor, cushionColor) */
  sofaConfig?: SofaConfiguration;
  /** Optional acoustic wood panel configuration (woodTone, feltColor) */
  acousticPanelConfig?: AcousticPanelConfiguration;
  /** Optional modular wall planner configuration (kitchen, living wall, wardrobe, closet) */
  wallModuleConfig?: WallModuleConfiguration;
  /** Optional structured building services / Haustechnik telemetry entity bindings */
  techConfig?: BuildingTechEntityConfig;
  /** Lateral sliding direction for electric driveway gate ('left' | 'right') */
  gateSlideDirection?: 'left' | 'right';
  /** Manual opening percentage override (0..100) for gates/doors */
  customOpenPct?: number;
  /** Sun shade sail shape ('quad_4mast' | 'triangle_3mast' | 'trapezoid_wall') */
  sailShape?: 'quad_4mast' | 'triangle_3mast' | 'trapezoid_wall';
  /** Sun shade sail fabric color hex */
  sailColor?: string;
  /** Optional custom 2D corner offsets [dx, dz][] in meters relative to asset position for freely planned sun shade sails */
  sailCorners?: [number, number][];
  /** Optional exact number of PV modules for standalone freely placed solar_panel_array (1..36) */
  pvModuleCount?: number;
  /** Optional tilt angle in degrees for standalone freely placed solar_panel_array (0..45) */
  pvTiltDeg?: number;
  entityId?: string;
  /** Optional secondary entity for composite rules */
  secondaryEntityId?: string;
  /** Optional actuator entity (e.g. switch.*, cover.*, button.*) when primary entityId is a read-only sensor */
  actuatorEntityId?: string;
  /** Interaction mode in Live view ('auto' | 'sensor_only' | 'actuator' | 'sensor_and_actuator') */
  controlMode?: 'auto' | 'sensor_only' | 'actuator' | 'sensor_and_actuator';
  /** Floating 3D status icon display mode in Live 3D ('auto' | 'always' | 'when_active' | 'hidden') */
  statusBadgeMode?: 'auto' | 'always' | 'when_active' | 'hidden';
  /** Optional custom GLB/GLTF blob or data URL */
  customGlbUrl?: string;
  /** Optional light cone parameters */
  lightConfig?: {
    type: 'point' | 'spot';
    maxIntensity: number;
    distance: number;
  };
}

export function isRadiatorAsset(catalogId: string): boolean {
  return (
    catalogId === 'radiator_smart' ||
    catalogId === 'bathroom_towel_radiator' ||
    catalogId === 'wall_radiator_modern'
  );
}

export function isAcousticPanelAsset(catalogId: string): boolean {
  return catalogId === 'wall_acoustic_wood_panel';
}

export function isSofaAsset(catalogId: string): boolean {
  return catalogId === 'sofa_l_shape';
}

export function isWallModuleAsset(catalogId: string): boolean {
  return catalogId === 'wall_planner_module';
}

export function isWallSnapAsset(asset: Pick<PlacedAsset, 'catalogId' | 'mountType' | 'wallModuleConfig'>): boolean {
  if (
    isRadiatorAsset(asset.catalogId) ||
    isAcousticPanelAsset(asset.catalogId) ||
    isWallModuleAsset(asset.catalogId) ||
    Boolean(asset.wallModuleConfig) ||
    asset.catalogId === 'wall_tv_oled_77' ||
    asset.catalogId === 'wall_art_framed_triptych' ||
    asset.catalogId === 'sub_distribution_board_1row' ||
    asset.catalogId === 'sub_distribution_board_3row' ||
    asset.catalogId === 'electrical_meter_cabinet' ||
    asset.catalogId === 'home_battery_inverter' ||
    asset.catalogId === 'pv_inverter_system' ||
    asset.catalogId === 'wallbox_ev' ||
    asset.catalogId === 'kitchen_wall_line' ||
    asset.catalogId === 'wardrobe_closet' ||
    asset.catalogId === 'hallway_coat_rack'
  ) {
    return true;
  }
  return asset.mountType === 'wall';
}

export function isStairAsset(catalogId: string): boolean {
  return (
    catalogId === 'staircase_oak_glass' ||
    catalogId === 'staircase_spiral_steel' ||
    catalogId === 'staircase_curved_landing' ||
    catalogId === 'staircase_double_winder' ||
    catalogId === 'staircase_u_podest' ||
    catalogId === 'staircase_floating_cantilever'
  );
}

export function isExteriorStairAsset(catalogId: string): boolean {
  return (
    catalogId === 'entrance_steps_plinth' ||
    catalogId === 'outdoor_stairs_curved_fan' ||
    catalogId === 'outdoor_stairs_pyramid' ||
    catalogId === 'outdoor_stairs_kellertreppe'
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
    catalogId === 'double_swing_driveway_gate' ||
    catalogId === 'garden_pedestrian_gate' ||
    catalogId === 'electric_roller_gate'
  );
}

export function isWalkwayAsset(catalogId: string): boolean {
  return (
    catalogId === 'walkway_wood_deck' ||
    catalogId === 'walkway_natural_stone' ||
    catalogId === 'walkway_stepping_stones' ||
    catalogId === 'walkway_slate_anthracite' ||
    catalogId === 'road_segment_asphalt' ||
    catalogId === 'sidewalk_segment'
  );
}

export function isStreetOrSidewalkAsset(catalogId: string): boolean {
  return catalogId === 'road_segment_asphalt' || catalogId === 'sidewalk_segment';
}

export function isStreetLampAsset(catalogId: string): boolean {
  return (
    catalogId === 'street_lamp_modern_led' ||
    catalogId === 'street_lamp_classic' ||
    catalogId === 'street_lamp_classic_3head' ||
    catalogId === 'wall_lantern_park_classic'
  );
}

export function isWallDecorAsset(catalogId: string): boolean {
  return (
    catalogId === 'wall_tv_oled_77' ||
    catalogId === 'wall_art_framed_triptych' ||
    catalogId === 'wall_acoustic_wood_panel' ||
    catalogId === 'wall_radiator_modern'
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
    catalogId === 'fence_chainlink' ||
    catalogId === 'fence_chainlink_anthracite' ||
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
    catalogId === 'double_swing_driveway_gate' ||
    catalogId === 'outdoor_pergola_string_lights' ||
    isWalkwayAsset(catalogId)
  );
}

export function isPureFenceOrHedgeAsset(catalogId: string): boolean {
  return isFenceOrHedgeAsset(catalogId) && !isWalkwayAsset(catalogId) && catalogId !== 'outdoor_pergola_string_lights';
}

export function isBuildingTechAsset(catalogId: string): boolean {
  return (
    catalogId === 'solar_panel_array' ||
    catalogId === 'home_battery_inverter' ||
    catalogId === 'ev_wallbox' ||
    catalogId === 'pv_inverter_system' ||
    catalogId === 'heat_pump_outdoor_monoblock' ||
    catalogId === 'heat_pump_indoor_unit' ||
    catalogId === 'hot_water_buffer_tank' ||
    catalogId === 'electrical_meter_cabinet' ||
    catalogId === 'sub_distribution_board_1row' ||
    catalogId === 'sub_distribution_board_3row' ||
    catalogId === 'smart_home_server_hub'
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
  | 'lawn_mower'
  | 'valve'
  | 'lock'
  | 'alarm_control_panel'
  | 'person'
  | 'device_tracker'
  | 'button'
  | 'input_boolean'
  | 'weather';

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
    | 'gate'
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
  temperature?: number;
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
  /** Presence & Weather attributes */
  room?: string;
  room_zone_id?: string;
  room_name?: string;
  avatar_color?: string;
  person_avatar_color?: string;
  weather_condition?: 'sunny' | 'partlycloudy' | 'rainy' | 'snowy' | 'clear-night';
  wind_speed_kmh?: number;
}

export interface HAEntityState {
  entity_id: string;
  domain: HADomain;
  state: string;
  attributes: HAEntityAttributes;
  last_changed: string;
}

export interface PresencePersonConfig {
  id: string;
  name: string;
  /** Home Assistant person.* or device_tracker.* entity */
  entityId?: string;
  /** Optional room tracker entity (e.g. sensor.* / Bermuda / ESPresense) */
  roomEntityId?: string;
  /** Default or manually selected room name when home */
  defaultRoom?: string;
  /** Avatar hex color */
  avatarColor: string;
}

export type LiveCardIconId =
  | 'garage'
  | 'door'
  | 'window'
  | 'shutter'
  | 'light'
  | 'power'
  | 'climate'
  | 'presence'
  | 'battery'
  | 'solar'
  | 'temperature'
  | 'water'
  | 'smoke'
  | 'lock'
  | 'alert'
  | 'shield'
  | 'person'
  | 'camera'
  | 'car'
  | 'tv';

export interface CustomLiveCardItem {
  id: string;
  label: string;
  entityId: string;
  /** Optional separate actuator entity (e.g. cover.*, switch.*, button.*) if entityId is a sensor */
  actuatorEntityId?: string;
  /** Interaction mode: 'auto' | 'sensor_only' (nur Anzeige) | 'actuator' (schaltbar) | 'sensor_and_actuator' */
  controlMode?: 'auto' | 'sensor_only' | 'actuator' | 'sensor_and_actuator';
  icon: LiveCardIconId;
  /** 'always' = Immer sichtbar, 'when_active' = Nur anzeigen wenn aktiv/offen/an */
  visibilityRule: 'always' | 'when_active';
  /** Show as top warning/status badge & off-screen pin when active */
  pinAsAlertWhenActive?: boolean;
  /** Show in compact quick-action favorites bar */
  showInQuickBar?: boolean;
  /** Also show as a floating 3D status badge above the linked room/opening/object in 3D */
  showFloating3DIcon?: 'always' | 'when_active' | 'hidden';
  /** Optional target zoneId, openingId, or assetId for 3D camera focus & 3D floating icon */
  zoneId?: string;
  openingId?: string;
  assetId?: string;
  targetId?: string;
}

export interface LiveCockpitConfig {
  /** Configured household persons & trackers */
  persons?: PresencePersonConfig[];
  /** Custom user-defined live cards / status items / alerts */
  customCards?: CustomLiveCardItem[];
  customItems?: CustomLiveCardItem[];
  /** Whether to show dynamic top warning/status icons (e.g. Garage door open) */
  showActiveStatusHeader?: boolean;
  showDynamicStatusIcons?: boolean;
  showActiveAlertPills?: boolean;
  /** Whether to show off-screen edge pins when open garage/window/alarm is outside camera view */
  showOffscreenArrows?: boolean;
  showOffScreenEdgePins?: boolean;
  showOffscreenAlertPins?: boolean;
  /** Whether to show the compact quick-action favorites bar */
  showQuickAccessBar?: boolean;
  /** Automatically fly 3D camera to a single newly triggered active event (e.g. Garage door opened), or show the Multi-Event Summary Card when >= 2 events are active */
  autoJumpToActiveEvents?: boolean;
}

export interface FloorplanProject {
  title: string;
  version: string;
  zones: FloorplanZone[];
  openings: WallOpening[];
  assets: PlacedAsset[];
  /** Freely drawn partition walls & counter walls (Wand-Designer) */
  customWalls?: CustomWallSegment[];
  /** North compass orientation in degrees (0 = North is up / -Z, 0..360) */
  northAngle?: number;
  /** Customizable Live Cockpit Cards, Dynamic Warning Icons, Quick Bar & Presence Config */
  liveCockpitConfig?: LiveCockpitConfig;
  /** Optional manually pinned entity IDs in the Overview tab */
  manualOverviewIds?: string[];
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
  const st = String(entity.state || '').toLowerCase();
  return (
    st === 'on' ||
    st === 'open' ||
    st === 'opening' ||
    st === 'detected' ||
    st === 'home' ||
    st === 'occupied' ||
    st === 'playing' ||
    st === 'unlocked' ||
    (entity.attributes?.current_position ?? 0) > 25
  );
}

/**
 * Checks whether an opening (garage door, door, window) is controllable via click in Live mode:
 * - If bound ONLY to a read-only sensor (`binary_sensor.*` or `sensor.*`) without an `actuatorEntityId` (or `controlMode === 'sensor_only'`),
 *   it is READ-ONLY in Live view (clicking shows live status, never toggles the 3D door/gate).
 * - If bound to an actuator (`cover.*`, `switch.*`, `button.*`, `lock.*`, or has `actuatorEntityId`, or `controlMode === 'actuator'`),
 *   clicking controls the actuator.
 */
export function isOpeningActuatorControllable(
  opening: WallOpening,
  entities?: Record<string, HAEntityState>
): boolean {
  if (opening.controlMode === 'sensor_only') return false;
  if (opening.controlMode === 'actuator' || opening.controlMode === 'sensor_and_actuator') {
    return true;
  }
  if (opening.actuatorEntityId && opening.actuatorEntityId.trim().length > 0) {
    return true;
  }
  if (opening.dualSensorRule?.enabled || opening.sensorLogicMode === 'dual_tilt_open' || opening.tiltEntityId) {
    return false;
  }
  const eid = opening.entityId?.trim();
  if (!eid) {
    // Pure 3D architectural opening without any Home Assistant sensor bound -> allow 3D preview toggle
    return true;
  }
  const domain = entities?.[eid]?.domain || eid.split('.')[0];
  if (
    domain === 'binary_sensor' ||
    domain === 'sensor'
  ) {
    return false;
  }
  return (
    domain === 'cover' ||
    domain === 'switch' ||
    domain === 'button' ||
    domain === 'lock' ||
    domain === 'input_boolean'
  );
}

export function isAssetActuatorControllable(
  asset: PlacedAsset,
  entities?: Record<string, HAEntityState>
): boolean {
  if (asset.controlMode === 'sensor_only') return false;
  if (asset.controlMode === 'actuator' || asset.controlMode === 'sensor_and_actuator') {
    return true;
  }
  if (asset.actuatorEntityId && asset.actuatorEntityId.trim().length > 0) {
    return true;
  }
  const eid = asset.entityId?.trim();
  if (!eid) return false;
  const domain = entities?.[eid]?.domain || eid.split('.')[0];
  if (domain === 'binary_sensor' || domain === 'sensor') {
    return false;
  }
  return (
    domain === 'light' ||
    domain === 'switch' ||
    domain === 'cover' ||
    domain === 'fan' ||
    domain === 'lock' ||
    domain === 'media_player' ||
    domain === 'vacuum' ||
    domain === 'lawn_mower' ||
    domain === 'climate' ||
    domain === 'valve' ||
    domain === 'button' ||
    domain === 'input_boolean'
  );
}

/**
 * Evaluates a window, door, or garage door opening's physical state ('closed' | 'tilted' | 'open')
 * supporting both single-sensor and two-sensor composite rules.
 * IMPORTANT: When a Home Assistant sensor (`entityId` / `tiltEntityId`) is bound and the opening is
 * read-only (sensor-driven), live entity states ALWAYS take priority over stale manual `openState` / `previewStateOverride`!
 */
export function resolveOpeningSensorState(
  opening: WallOpening,
  entities: Record<string, HAEntityState>,
  allowPreviewOverride = false
): 'closed' | 'tilted' | 'open' {
  const hasBoundSensor = Boolean(
    (opening.entityId && entities[opening.entityId]) ||
      (opening.tiltEntityId && entities[opening.tiltEntityId]) ||
      (opening.dualSensorRule?.enabled &&
        (entities[opening.dualSensorRule.sensorAEntityId] ||
          entities[opening.dualSensorRule.sensorBEntityId]))
  );
  const isReadOnlySensor = hasBoundSensor && !isOpeningActuatorControllable(opening, entities);

  if (allowPreviewOverride && opening.previewStateOverride) {
    return opening.previewStateOverride;
  }

  // If bound to a read-only sensor (e.g. binary_sensor garage door contact), strictly evaluate the live sensor!
  if (hasBoundSensor) {
    const ent1 = opening.dualSensorRule?.enabled
      ? entities[opening.dualSensorRule.sensorAEntityId]
      : opening.entityId
      ? entities[opening.entityId]
      : undefined;
    const ent2 = opening.dualSensorRule?.enabled
      ? entities[opening.dualSensorRule.sensorBEntityId]
      : opening.tiltEntityId
      ? entities[opening.tiltEntityId]
      : undefined;

    if (
      opening.dualSensorRule?.enabled ||
      opening.sensorLogicMode === 'dual_tilt_open' ||
      opening.tiltEntityId
    ) {
      const s1Active = isBinaryEntityActive(ent1);
      const s2Active = isBinaryEntityActive(ent2);
      if (s1Active && s2Active) return 'open';
      if (s1Active || s2Active) return 'tilted';
      return 'closed';
    }

    if (!isReadOnlySensor && opening.previewStateOverride) {
      return opening.previewStateOverride;
    }

    if (ent1?.state === 'tilted') return 'tilted';
    return isBinaryEntityActive(ent1) ? 'open' : 'closed';
  }

  if (opening.previewStateOverride) {
    return opening.previewStateOverride;
  }
  if (opening.openState) {
    return opening.openState;
  }

  return 'closed';
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

export interface BuildingPresetInfo {
  id: string;
  name: string;
  label: string;
  hint: string;
  badge: string;
  colorHex: string;
  category: 'wohnraum' | 'outbuilding';
}

export const BUILDING_PRESETS: BuildingPresetInfo[] = [
  {
    id: 'main_house',
    name: 'Wohnraum 1 (Hauptgebäude / Wohnhaus)',
    label: 'Wohnraum 1 (Hauptgebäude)',
    hint: 'Wohnhaus / Hauptgebäude',
    badge: 'Wohnraum 1',
    colorHex: '#38bdf8',
    category: 'wohnraum',
  },
  {
    id: 'main_house_2',
    name: 'Wohnraum 2 (Zweites Wohngebäude / Anbau)',
    label: 'Wohnraum 2 (Zweites Wohngebäude)',
    hint: 'Anbau / Zweithaus',
    badge: 'Wohnraum 2',
    colorHex: '#60a5fa',
    category: 'wohnraum',
  },
  {
    id: 'guest_wing',
    name: 'Wohnraum 3 (Seitenflügel / Wintergarten)',
    label: 'Wohnraum 3 (Seitenflügel / Wintergarten)',
    hint: 'Wintergarten / Büroflügel',
    badge: 'Wohnraum 3',
    colorHex: '#c084fc',
    category: 'wohnraum',
  },
  {
    id: 'outbuilding_garage',
    name: 'Nebengebäude 1 (Garage 1)',
    label: 'Nebengebäude 1 (Garage 1)',
    hint: 'Garage / Carport',
    badge: 'Nebengebäude 1',
    colorHex: '#fbbf24',
    category: 'outbuilding',
  },
  {
    id: 'outbuilding_garage_2',
    name: 'Nebengebäude 2 (Zweitgarage / Carport)',
    label: 'Nebengebäude 2 (Zweitgarage / Carport)',
    hint: 'Zweitgarage / Carport',
    badge: 'Nebengebäude 2',
    colorHex: '#f97316',
    category: 'outbuilding',
  },
  {
    id: 'outbuilding_workshop',
    name: 'Nebengebäude 3 (Werkstatt / Schuppen)',
    label: 'Nebengebäude 3 (Werkstatt / Schuppen)',
    hint: 'Werkstatt / Technik',
    badge: 'Nebengebäude 3',
    colorHex: '#eab308',
    category: 'outbuilding',
  },
  {
    id: 'garden_pavilion',
    name: 'Nebengebäude 4 (Gartenhaus / Gewächshaus / Poolhaus)',
    label: 'Nebengebäude 4 (Gartenhaus / Poolhaus)',
    hint: 'Gartenhaus / Poolhaus',
    badge: 'Nebengebäude 4',
    colorHex: '#34d399',
    category: 'outbuilding',
  },
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
  const hasShutter = cfg?.hasShutter ?? Boolean(cfg?.shutterEntityId);
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
      entityId: cfg?.entityId,
      shutterEntityId: cfg?.shutterEntityId,
    });
  }
  return units;
}

/**
 * Checks whether two indoor zones physically touch, overlap, or sit within `tolerance` meters horizontally.
 * Ensures two separate garages placed across the yard never merge into one giant building!
 */
export function areZonesHorizontallyAdjacent(
  a: FloorplanZone,
  b: FloorplanZone,
  tolerance = 0.65
): boolean {
  if (a.id === b.id) return true;
  const aCorners = getZoneCorners(a);
  const bCorners = getZoneCorners(b);
  let aMinX = Infinity,
    aMaxX = -Infinity,
    aMinZ = Infinity,
    aMaxZ = -Infinity;
  for (const [x, z] of aCorners) {
    if (x < aMinX) aMinX = x;
    if (x > aMaxX) aMaxX = x;
    if (z < aMinZ) aMinZ = z;
    if (z > aMaxZ) aMaxZ = z;
  }
  let bMinX = Infinity,
    bMaxX = -Infinity,
    bMinZ = Infinity,
    bMaxZ = -Infinity;
  for (const [x, z] of bCorners) {
    if (x < bMinX) bMinX = x;
    if (x > bMaxX) bMaxX = x;
    if (z < bMinZ) bMinZ = z;
    if (z > bMaxZ) bMaxZ = z;
  }
  const overlapX = aMaxX + tolerance >= bMinX && bMaxX + tolerance >= aMinX;
  const overlapZ = aMaxZ + tolerance >= bMinZ && bMaxZ + tolerance >= aMinZ;
  return overlapX && overlapZ;
}

/**
 * Resolves whether an indoor zone is a building container ('wohnraum_building' or 'outbuilding')
 * vs. an interior room ('room') placed inside a building.
 * Ensures that even legacy zones without an explicit `zoneRole` are accurately classified so
 * interior room floors always render graphically above the containing Wohnraum / Nebengebäude floor!
 */
export function resolveZoneRole(
  zone: FloorplanZone,
  allZones: FloorplanZone[]
): IndoorZoneRole {
  if (zone.zoneType !== 'indoor') return 'room';
  if (zone.zoneRole) return zone.zoneRole;

  const myArea = computeZoneAreaM2(zone);
  const myLevel = zone.level ?? 0;
  const sameLevelIndoor = allZones.filter(
    (z) => z.zoneType === 'indoor' && z.id !== zone.id && (z.level ?? 0) === myLevel
  );

  // 1. If this zone sits inside a larger indoor zone on the same floor level, it is an interior 'room'!
  const enclosingZone = sameLevelIndoor.find(
    (other) =>
      computeZoneAreaM2(other) > myArea * 1.08 &&
      areZonesHorizontallyAdjacent(other, zone, -0.18)
  );
  if (enclosingZone) {
    return 'room';
  }

  // 2. If this zone encloses any smaller indoor zone on the same floor level, it is a building shell!
  const enclosesSmallerRoom = sameLevelIndoor.some(
    (other) =>
      computeZoneAreaM2(other) < myArea * 0.92 &&
      areZonesHorizontallyAdjacent(zone, other, -0.18)
  );
  const bId = zone.buildingId || '';
  const lowerName = zone.name.toLowerCase();
  const isOutbuildingBld =
    bId.startsWith('outbuilding_') ||
    bId === 'garden_pavilion' ||
    lowerName.includes('nebengebäude') ||
    lowerName.includes('garage') ||
    lowerName.includes('carport') ||
    lowerName.includes('gartenhaus');

  if (enclosesSmallerRoom) {
    return isOutbuildingBld ? 'outbuilding' : 'wohnraum_building';
  }

  if (lowerName.includes('wohnraum') || lowerName.includes('hauptgebäude')) {
    return 'wohnraum_building';
  }
  if (isOutbuildingBld) {
    return 'outbuilding';
  }
  return 'room';
}

export function isInteriorRoomZone(
  zone: FloorplanZone,
  allZones: FloorplanZone[]
): boolean {
  if (zone.zoneType !== 'indoor') return false;
  return resolveZoneRole(zone, allZones) === 'room';
}

/**
 * Finds all indoor rooms that belong to the same physical building as `seedZone` via BFS spatial adjacency:
 * - Rooms that overlap in 2D footprint (e.g. rooms drawn inside a building hull or on upper/lower floors KG/EG/1.OG/DG)
 *   always belong to the same physical building.
 * - Side-by-side touching rooms (`<= 0.75m`) belong to the same building if they share the same `buildingId`
 *   or if either one uses the default `'main_house'`.
 * - Separate garages or outbuildings placed at a distance (>0.75m apart) form their own independent building cluster!
 */
export function getConnectedBuildingCluster(
  seedZone: FloorplanZone,
  allZones: FloorplanZone[]
): FloorplanZone[] {
  const indoorZones = allZones.filter((z) => z.zoneType === 'indoor');
  if (seedZone.zoneType !== 'indoor') return [seedZone];
  const visited = new Set<string>([seedZone.id]);
  const queue: FloorplanZone[] = [seedZone];
  const cluster: FloorplanZone[] = [seedZone];

  while (queue.length > 0) {
    const cur = queue.shift()!;
    const curBld = cur.buildingId || 'main_house';
    for (const cand of indoorZones) {
      if (visited.has(cand.id)) continue;
      const candBld = cand.buildingId || 'main_house';
      // Check if footprints overlap in 2D (e.g. room inside building shell or stacked across floors)
      const overlapsFootprint = areZonesHorizontallyAdjacent(cur, cand, -0.04);
      const touchesSideBySide = areZonesHorizontallyAdjacent(cur, cand, 0.85);
      const compatibleBld =
        candBld === curBld ||
        overlapsFootprint ||
        curBld === 'main_house' ||
        candBld === 'main_house';
      if (touchesSideBySide && compatibleBld) {
        visited.add(cand.id);
        queue.push(cand);
        cluster.push(cand);
      }
    }
  }
  return cluster;
}

/**
 * Returns a deterministic cluster key for the physical building containing `seedZone`.
 * Guaranteed to return the exact same key for every room in the same connected building cluster.
 */
export function getBuildingClusterKey(
  seedZone: FloorplanZone,
  allZones: FloorplanZone[]
): string {
  const cluster = getConnectedBuildingCluster(seedZone, allZones);
  const sortedIds = cluster.map((z) => z.id).sort();
  return `bld_cluster::${sortedIds[0] || seedZone.id}`;
}

export function areZonesInSameBuilding(
  a: FloorplanZone,
  b: FloorplanZone,
  allZones?: FloorplanZone[]
): boolean {
  if (a.id === b.id) return true;
  if (allZones && allZones.length > 0) {
    const cluster = getConnectedBuildingCluster(a, allZones);
    return cluster.some((z) => z.id === b.id);
  }
  const aBld = a.buildingId || 'main_house';
  const bBld = b.buildingId || 'main_house';
  if (areZonesHorizontallyAdjacent(a, b, -0.18)) return true;
  if (aBld !== bBld && aBld !== 'main_house' && bBld !== 'main_house') return false;
  return areZonesHorizontallyAdjacent(a, b, 0.75);
}

/**
 * Returns all selectable Building Containers (both user-created Wohnraum / Nebengebäude zones and standard presets)
 * so the user can assign any Raum cleanly to a Wohnraum or Nebengebäude without empty parentheses!
 */
export function getAvailableBuildingOptions(
  allZones: FloorplanZone[]
): { id: string; label: string; category: 'wohnraum' | 'outbuilding'; hostZone?: FloorplanZone }[] {
  const options: {
    id: string;
    label: string;
    category: 'wohnraum' | 'outbuilding';
    hostZone?: FloorplanZone;
  }[] = [];
  const usedIds = new Set<string>();

  // 1. First list any explicit Wohnraum or Nebengebäude building shells created in the project
  const buildingShells = allZones.filter(
    (z) =>
      z.zoneType === 'indoor' &&
      (resolveZoneRole(z, allZones) === 'wohnraum_building' ||
        resolveZoneRole(z, allZones) === 'outbuilding')
  );

  for (const shell of buildingShells) {
    const role = resolveZoneRole(shell, allZones);
    const cat: 'wohnraum' | 'outbuilding' =
      role === 'outbuilding' ? 'outbuilding' : 'wohnraum';
    const bId = shell.buildingId || shell.id;
    if (!usedIds.has(bId)) {
      usedIds.add(bId);
      const prefix = cat === 'outbuilding' ? 'Nebengebäude' : 'Wohnraum (Gebäude)';
      options.push({
        id: bId,
        label: `${prefix}: ${shell.name}`,
        category: cat,
        hostZone: shell,
      });
    }
  }

  // 2. Append standard presets so the user can always pick Wohnraum 1..3 or Nebengebäude 1..4
  for (const bp of BUILDING_PRESETS) {
    if (!usedIds.has(bp.id)) {
      usedIds.add(bp.id);
      options.push({
        id: bp.id,
        label: `${bp.label} — ${bp.hint}`,
        category: bp.category,
      });
    }
  }

  return options;
}

export interface BuildingHierarchyGroup {
  clusterKey: string;
  buildingKey: string;
  buildingId: string;
  buildingName: string;
  label: string;
  category: 'wohnraum' | 'outbuilding';
  /** Optional container/hull zone if the user created a Wohnraum or Nebengebäude shell */
  hullZone?: FloorplanZone;
  /** Interior rooms (Räume) inside this building */
  childRooms: FloorplanZone[];
  /** All zones in this building (hullZone first, then childRooms) */
  zones: FloorplanZone[];
}

/**
 * Groups all indoor zones into their parent Wohnraum (Hauptgebäude) or Nebengebäude (Garage/Carport/Gartenhaus),
 * and subordinates interior rooms (Räume) cleanly underneath their building!
 */
export function getBuildingHierarchyGroups(
  allZones: FloorplanZone[]
): BuildingHierarchyGroup[] {
  const indoorZones = allZones.filter((z) => z.zoneType === 'indoor');
  const groupsMap = new Map<string, FloorplanZone[]>();

  // Identify all building shells (Wohnraum / Nebengebäude) so any room overlapping a shell without an explicit different buildingId joins that shell
  const shells = indoorZones.filter((z) => {
    const r = resolveZoneRole(z, allZones);
    return r === 'wohnraum_building' || r === 'outbuilding';
  });

  for (const z of indoorZones) {
    let effectiveBldKey = z.buildingId || '';
    if (!effectiveBldKey || effectiveBldKey === 'main_house') {
      // Check if this room sits inside a specific Wohnraum or Nebengebäude shell
      const enclosingShell = shells.find(
        (sh) =>
          sh.id !== z.id &&
          computeZoneAreaM2(sh) > computeZoneAreaM2(z) &&
          areZonesHorizontallyAdjacent(sh, z, -0.15)
      );
      if (enclosingShell) {
        effectiveBldKey = enclosingShell.buildingId || enclosingShell.id;
      } else if (!effectiveBldKey) {
        effectiveBldKey = explicitBldIdOrDefault(undefined, [z]);
      }
    }
    const list = groupsMap.get(effectiveBldKey) || [];
    if (!list.some((item) => item.id === z.id)) {
      list.push(z);
    }
    groupsMap.set(effectiveBldKey, list);
  }

  const groups: BuildingHierarchyGroup[] = [];
  for (const [bKey, bZones] of groupsMap.entries()) {
    // Sort: building shells (Wohnraum / Nebengebäude) first, then by floor level (KG -> EG -> 1. OG -> DG), then by area descending
    const sorted = bZones.slice().sort((a, b) => {
      const roleA = resolveZoneRole(a, allZones) === 'room' ? 1 : 0;
      const roleB = resolveZoneRole(b, allZones) === 'room' ? 1 : 0;
      if (roleA !== roleB) return roleA - roleB;
      const lvlDiff = (a.level ?? 0) - (b.level ?? 0);
      if (lvlDiff !== 0) return lvlDiff;
      const areaDiff = computeZoneAreaM2(b) - computeZoneAreaM2(a);
      if (Math.abs(areaDiff) > 2) return areaDiff;
      return a.name.localeCompare(b.name, 'de');
    });

    const hullZone = sorted.find((z) => {
      const r = resolveZoneRole(z, allZones);
      return r === 'wohnraum_building' || r === 'outbuilding';
    });
    const childRooms = sorted.filter((z) => z.id !== hullZone?.id);

    const preset = BUILDING_PRESETS.find((b) => b.id === bKey);
    const isOutbuilding =
      preset?.category === 'outbuilding' ||
      bKey.startsWith('outbuilding_') ||
      bKey === 'garden_pavilion' ||
      (hullZone && resolveZoneRole(hullZone, allZones) === 'outbuilding');
    const category: 'wohnraum' | 'outbuilding' = isOutbuilding ? 'outbuilding' : 'wohnraum';

    let buildingName =
      preset?.label ||
      (isOutbuilding ? 'Nebengebäude / Garage' : 'Wohnraum (Hauptgebäude)');
    if (hullZone) {
      const prefix = isOutbuilding ? 'Nebengebäude' : 'Wohnraum (Gebäude)';
      buildingName = hullZone.name.toLowerCase().includes(prefix.split(' ')[0].toLowerCase())
        ? hullZone.name
        : `${prefix}: ${hullZone.name}`;
    }

    groups.push({
      clusterKey: `bld_group::${bKey}`,
      buildingKey: `bld_group::${bKey}`,
      buildingId: bKey,
      buildingName,
      label: buildingName,
      category,
      hullZone,
      childRooms,
      zones: sorted,
    });
  }

  // Sort Wohnraum (Hauptgebäude) first, then Nebengebäude
  groups.sort((a, b) => {
    const aCat = a.category === 'wohnraum' ? 0 : 1;
    const bCat = b.category === 'wohnraum' ? 0 : 1;
    if (aCat !== bCat) return aCat - bCat;
    const aMain = a.buildingId === 'main_house' ? 0 : 1;
    const bMain = b.buildingId === 'main_house' ? 0 : 1;
    if (aMain !== bMain) return aMain - bMain;
    return b.zones.length - a.zones.length;
  });

  return groups;
}

function explicitBldIdOrDefault(
  explicitId: string | undefined,
  clusterZones: FloorplanZone[]
): string {
  if (explicitId) return explicitId;
  if (clusterZones.length === 1) {
    const lower = clusterZones[0].name.toLowerCase();
    if (lower.includes('garage') || lower.includes('carport') || lower.includes('nebengebäude')) {
      return 'outbuilding_garage';
    }
    if (lower.includes('gartenhaus') || lower.includes('schuppen') || lower.includes('gewächshaus') || lower.includes('poolhaus')) {
      return 'garden_pavilion';
    }
  }
  return clusterZones[0]?.buildingId || 'main_house';
}

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
  const zLevel = zone.level ?? 0;
  const cluster = getConnectedBuildingCluster(zone, allZones);
  if (zLevel === 0) {
    return cluster.some((uz) => (uz.level ?? 0) >= 1);
  }
  if (zLevel === 1) {
    // Any pitched roof placed on 1. OG sits flush on the EG ceiling/walls ('og_in_roof') unless explicitly set to 'single_floor' without EG below
    if (cfg.roofSpanMode !== 'single_floor') return true;
    const hasEGBelow = cluster.some((lz) => (lz.level ?? 0) === 0);
    if (hasEGBelow) return true;
    return cluster.some((uz) => (uz.level ?? 0) >= 2);
  }
  return false;
}

/**
 * Computes the effective footprint zone for a roof:
 * - If `footprintScope === 'building'` (or multi-story roof spanning from EG without explicit `'zone'` scope),
 *   merges all spatially connected indoor rooms of the same building cluster on the base floor into one unified building envelope.
 * - Otherwise returns `zone` unchanged.
 */
export function computeRoofHostFootprintZone(
  zone: FloorplanZone,
  allZones: FloorplanZone[]
): FloorplanZone {
  const cfg = zone.roofConfig;
  if (!cfg || cfg.type === 'none') return zone;

  const clusterZones = getConnectedBuildingCluster(zone, allZones);
  const isMultiStory = isBuildingMultiStoryRoof(zone, allZones);
  const hasDG = clusterZones.some((uz) => (uz.level ?? 0) >= 2);
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

  if (!useWholeBuilding) {
    return {
      ...zone,
      roofConfig: {
        ...cfg,
        roofSpanMode: effectiveSpanMode,
      },
    };
  }

  const targetLevel = isMultiStory ? 0 : (zone.level ?? 0);
  let siblingZones = clusterZones.filter((z) => (z.level ?? 0) === targetLevel);
  if (siblingZones.length === 0) {
    siblingZones = clusterZones.filter((z) => (z.level ?? 0) === (zone.level ?? 0));
  }
  if (siblingZones.length <= 1 && siblingZones[0]?.id === zone.id) {
    return {
      ...zone,
      level: targetLevel as FloorLevelId,
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

export function getLinearAssetDefaultWidth(catalogId: string): number {
  if (isStreetOrSidewalkAsset(catalogId)) return 6.0;
  if (isDrivewayGateAsset(catalogId)) return 3.6;
  if (catalogId.includes('gate') || catalogId === 'garden_hedge_arch_gate') return 1.1;
  if (isWalkwayAsset(catalogId)) return 2.8;
  return 2.4;
}

/**
 * Computes the effective [widthX, depthZ, heightY] footprint of a PlacedAsset in meters,
 * taking into account customLength, customWidth, customDepth, customHeight, stairConfig,
 * sofaConfig, radiatorConfig, acousticPanelConfig, and wallModuleConfig.
 */
export function getAssetEffectiveFootprint(
  asset: PlacedAsset,
  catalogItem?: CatalogItem
): [number, number, number] {
  const s = asset.scale || 1;
  const baseW = catalogItem?.width ?? 0.6;
  const baseD = catalogItem?.depth ?? 0.6;
  const baseH = catalogItem?.height ?? 0.8;

  if (isStairAsset(asset.catalogId)) {
    const sc = asset.stairConfig || {};
    const shape =
      sc.shape ||
      (asset.catalogId === 'staircase_spiral_steel'
        ? 'spiral'
        : asset.catalogId === 'staircase_curved_landing'
        ? 'l_landing_right'
        : asset.catalogId === 'staircase_double_winder'
        ? 'double_winder_c_right'
        : asset.catalogId === 'staircase_u_podest'
        ? 'u_podest'
        : asset.catalogId === 'staircase_floating_cantilever'
        ? 'floating_cantilever'
        : 'straight');
    const runW = sc.width ?? asset.customWidth ?? baseW;
    const totalRun = sc.totalRun ?? asset.customLength ?? baseD;
    const totalRise = sc.totalRise ?? asset.customHeight ?? baseH;
    if (shape === 'spiral') {
      const d = Math.max(1.4, runW);
      return [d * s, d * s, totalRise * s];
    }
    if (shape === 'u_podest' || shape === 'u_winder') {
      return [Math.max(1.8, runW * 2.05) * s, Math.max(2.0, totalRun * 0.72) * s, totalRise * s];
    }
    if (shape === 't_imperial') {
      return [Math.max(2.4, runW * 2.4) * s, Math.max(2.2, totalRun * 0.85) * s, totalRise * s];
    }
    return [runW * s, totalRun * s, totalRise * s];
  }

  if (isSofaAsset(asset.catalogId)) {
    const sc = asset.sofaConfig || {};
    const shape = sc.shape || 'l_right';
    const w = asset.customLength ?? asset.customWidth ?? (shape === 'single' ? 2.2 : shape === 'u_shape' ? 3.2 : baseW);
    const d =
      asset.customDepth ??
      sc.depth ??
      (shape === 'single' ? 1.02 : shape === 'u_shape' ? 2.2 : baseD);
    const h = asset.customHeight ?? baseH;
    return [w * s, d * s, h * s];
  }

  if (isRadiatorAsset(asset.catalogId)) {
    const rc = asset.radiatorConfig || {};
    const rType =
      rc.radiatorType ||
      (asset.catalogId === 'bathroom_towel_radiator'
        ? 'towel_bathroom'
        : asset.catalogId === 'wall_radiator_modern'
        ? 'vertical_designer'
        : 'flat_panel');
    const defaultW =
      rType === 'vertical_designer' ? 0.6 : rType === 'towel_bathroom' ? 0.6 : 1.15;
    const defaultH =
      rType === 'vertical_designer' ? 1.8 : rType === 'towel_bathroom' ? 1.55 : 0.62;
    const w = asset.customLength ?? asset.customWidth ?? defaultW;
    const d = asset.customDepth ?? 0.14;
    const h = asset.customHeight ?? defaultH;
    return [w * s, d * s, h * s];
  }

  if (isAcousticPanelAsset(asset.catalogId)) {
    const w = asset.customLength ?? asset.customWidth ?? baseW;
    const d = asset.customDepth ?? 0.06;
    const h = asset.customHeight ?? baseH;
    return [w * s, d * s, h * s];
  }

  if (isWallModuleAsset(asset.catalogId) || asset.wallModuleConfig) {
    const w = asset.customLength ?? asset.customWidth ?? baseW;
    const d = asset.customDepth ?? baseD;
    const h = asset.customHeight ?? baseH;
    return [w * s, d * s, h * s];
  }

  const w = asset.customLength ?? baseW;
  const d = asset.customDepth ?? asset.customWidth ?? baseD;
  const h = asset.customHeight ?? baseH;
  return [w * s, d * s, h * s];
}

export interface WallSnapResult {
  position: [number, number];
  rotationY: number;
  snapped: boolean;
  zoneId?: string;
  wallSide?: WallSideId;
}

/**
 * Magnetically snaps wall-mounted or flush-wall assets (Radiators, Acoustic Panels, Wall Modules, Wall TVs, etc.)
 * to the nearest interior wall of a room on the same floor level, aligning rotationY so the asset faces into the room.
 */
export function snapAssetToNearestRoomWall(
  worldX: number,
  worldZ: number,
  asset: PlacedAsset,
  zones: FloorplanZone[],
  catalogItem?: CatalogItem,
  snapThresholdM = 0.65
): WallSnapResult {
  const assetLevel = asset.level ?? 0;
  const indoorZones = zones.filter(
    (z) => z.zoneType === 'indoor' && (z.level ?? 0) === assetLevel
  );
  if (indoorZones.length === 0) {
    return { position: [worldX, worldZ], rotationY: asset.rotationY, snapped: false };
  }

  const [footW, footD] = getAssetEffectiveFootprint(asset, catalogItem);
  const halfW = footW / 2;
  const halfD = footD / 2;
  const wallInset = 0.08 + halfD; // Wall half-thickness (~8cm) + half asset depth so back sits flush against inner wall face

  // Prefer interior rooms ('room') over building shells ('wohnraum_building') when point is inside both
  const sortedZones = indoorZones.slice().sort((a, b) => {
    const roleA = resolveZoneRole(a, zones) === 'room' ? 0 : 1;
    const roleB = resolveZoneRole(b, zones) === 'room' ? 0 : 1;
    if (roleA !== roleB) return roleA - roleB;
    return computeZoneAreaM2(a) - computeZoneAreaM2(b);
  });

  let bestDist = snapThresholdM;
  let bestPos: [number, number] = [worldX, worldZ];
  let bestRot = asset.rotationY;
  let bestZoneId: string | undefined;
  let bestSide: WallSideId | undefined;

  for (const z of sortedZones) {
    const zRot = z.rotationY || 0;
    const cos = Math.cos(zRot);
    const sin = Math.sin(zRot);
    const dx = worldX - z.x;
    const dz = worldZ - z.z;
    // Transform world point into room local coordinates (lx, lz)
    const lx = dx * cos - dz * sin;
    const lz = dx * sin + dz * cos;

    const rHalfW = z.width / 2;
    const rHalfD = z.depth / 2;

    // Check if near or inside this room
    if (Math.abs(lx) > rHalfW + snapThresholdM || Math.abs(lz) > rHalfD + snapThresholdM) {
      continue;
    }

    const clampX = Math.max(-rHalfW + halfW + 0.08, Math.min(rHalfW - halfW - 0.08, lx));
    const clampZ = Math.max(-rHalfD + halfW + 0.08, Math.min(rHalfD - halfW - 0.08, lz));

    const candidates: {
      side: WallSideId;
      dist: number;
      localX: number;
      localZ: number;
      localRotY: number;
    }[] = [
      {
        side: 'north',
        dist: Math.abs(lz - -rHalfD),
        localX: clampX,
        localZ: -rHalfD + wallInset,
        localRotY: 0, // Back at -Z, front faces +Z (into room)
      },
      {
        side: 'south',
        dist: Math.abs(lz - rHalfD),
        localX: clampX,
        localZ: rHalfD - wallInset,
        localRotY: Math.PI, // Back at +Z, front faces -Z (into room)
      },
      {
        side: 'west',
        dist: Math.abs(lx - -rHalfW),
        localX: -rHalfW + wallInset,
        localZ: clampZ,
        localRotY: Math.PI / 2, // Back at -X, front faces +X (into room)
      },
      {
        side: 'east',
        dist: Math.abs(lx - rHalfW),
        localX: rHalfW - wallInset,
        localZ: clampZ,
        localRotY: -Math.PI / 2, // Back at +X, front faces -X (into room)
      },
    ];

    for (const c of candidates) {
      if (z.wallSides?.[c.side]?.mode === 'hidden') continue;
      if (c.dist < bestDist) {
        bestDist = c.dist;
        const invCos = Math.cos(-zRot);
        const invSin = Math.sin(-zRot);
        const wx = z.x + c.localX * invCos - c.localZ * invSin;
        const wz = z.z + c.localX * invSin + c.localZ * invCos;
        bestPos = [+(wx.toFixed(3)), +(wz.toFixed(3))];
        bestRot = c.localRotY + zRot;
        bestZoneId = z.id;
        bestSide = c.side;
      }
    }
  }

  return {
    position: bestPos,
    rotationY: bestRot,
    snapped: bestZoneId !== undefined,
    zoneId: bestZoneId,
    wallSide: bestSide,
  };
}

/**
 * Hard Wall Collision Stop:
 * Clamps the position of an indoor asset (furniture, sofa, bed, table, stair, etc.) so that its rotated 2D bounding box
 * stops flush against the interior walls of the room it is currently in, preventing furniture from being pushed into walls.
 */
export function clampAssetPositionInsideRoomWalls(
  targetX: number,
  targetZ: number,
  prevX: number,
  prevZ: number,
  asset: PlacedAsset,
  zones: FloorplanZone[],
  catalogItem?: CatalogItem
): [number, number] {
  // Outdoor fences, trees, walkways, and roof assets are not clamped to interior room walls
  if (
    isFenceOrHedgeAsset(asset.catalogId) ||
    isWalkwayAsset(asset.catalogId) ||
    isTreeAsset(asset.catalogId) ||
    isExteriorStairAsset(asset.catalogId) ||
    asset.category === 'outdoor_energy' ||
    asset.category === 'shading' ||
    asset.mountType === 'ceiling'
  ) {
    return [targetX, targetZ];
  }

  const assetLevel = asset.level ?? 0;
  const indoorZones = zones.filter(
    (z) => z.zoneType === 'indoor' && (z.level ?? 0) === assetLevel
  );
  if (indoorZones.length === 0) return [targetX, targetZ];

  // Prioritize specific interior rooms ('room') over outer building shells ('wohnraum_building')
  const sortedZones = indoorZones.slice().sort((a, b) => {
    const roleA = resolveZoneRole(a, zones) === 'room' ? 0 : 1;
    const roleB = resolveZoneRole(b, zones) === 'room' ? 0 : 1;
    if (roleA !== roleB) return roleA - roleB;
    return computeZoneAreaM2(a) - computeZoneAreaM2(b);
  });

  // Find the room that contains either the previous position or the target position
  const findContainingZone = (px: number, pz: number): FloorplanZone | undefined => {
    for (const z of sortedZones) {
      const zRot = z.rotationY || 0;
      const cos = Math.cos(zRot);
      const sin = Math.sin(zRot);
      const dx = px - z.x;
      const dz = pz - z.z;
      const lx = dx * cos - dz * sin;
      const lz = dx * sin + dz * cos;
      if (Math.abs(lx) <= z.width / 2 + 0.05 && Math.abs(lz) <= z.depth / 2 + 0.05) {
        return z;
      }
    }
    return undefined;
  };

  const hostZone = findContainingZone(targetX, targetZ) || findContainingZone(prevX, prevZ);
  if (!hostZone) return [targetX, targetZ];

  const zRot = hostZone.rotationY || 0;
  const cos = Math.cos(zRot);
  const sin = Math.sin(zRot);
  const dx = targetX - hostZone.x;
  const dz = targetZ - hostZone.z;
  let lx = dx * cos - dz * sin;
  let lz = dx * sin + dz * cos;

  // If the user dragged the center far outside this room (e.g. moving furniture to another room), allow crossing
  const rHalfW = hostZone.width / 2;
  const rHalfD = hostZone.depth / 2;
  if (Math.abs(lx) > rHalfW + 0.45 || Math.abs(lz) > rHalfD + 0.45) {
    return [targetX, targetZ];
  }

  const [footW, footD] = getAssetEffectiveFootprint(asset, catalogItem);
  const relAngle = (asset.rotationY || 0) - zRot;
  const absCos = Math.abs(Math.cos(relAngle));
  const absSin = Math.abs(Math.sin(relAngle));
  // Effective half-extents of the rotated asset in room local axes
  const extX = (footW * absCos + footD * absSin) / 2;
  const extZ = (footW * absSin + footD * absCos) / 2;

  const wallMargin = isStairAsset(asset.catalogId) ? 0.08 : 0.08; // Inner wall thickness clearance

  const minX =
    hostZone.wallSides?.west?.mode === 'hidden'
      ? -rHalfW
      : Math.min(0, -rHalfW + wallMargin + extX);
  const maxX =
    hostZone.wallSides?.east?.mode === 'hidden'
      ? rHalfW
      : Math.max(0, rHalfW - wallMargin - extX);
  const minZ =
    hostZone.wallSides?.north?.mode === 'hidden'
      ? -rHalfD
      : Math.min(0, -rHalfD + wallMargin + extZ);
  const maxZ =
    hostZone.wallSides?.south?.mode === 'hidden'
      ? rHalfD
      : Math.max(0, rHalfD - wallMargin - extZ);

  lx = Math.max(minX, Math.min(maxX, lx));
  lz = Math.max(minZ, Math.min(maxZ, lz));

  const invCos = Math.cos(-zRot);
  const invSin = Math.sin(-zRot);
  const clampedWx = hostZone.x + lx * invCos - lz * invSin;
  const clampedWz = hostZone.z + lx * invSin + lz * invCos;

  return [+(clampedWx.toFixed(3)), +(clampedWz.toFixed(3))];
}

/**
 * Fits an indoor staircase flush into its containing room (either wall-to-wall across the room's clear width/depth
 * or tucked cleanly into the nearest wall corner without protruding through walls in 2D or 3D).
 */
export function fitStairAssetToRoomWalls(
  asset: PlacedAsset,
  zones: FloorplanZone[],
  mode: 'wall_to_wall' | 'flush_corner' = 'wall_to_wall'
): Partial<PlacedAsset> | null {
  const assetLevel = asset.level ?? 0;
  const indoorZones = zones
    .filter((z) => z.zoneType === 'indoor' && (z.level ?? 0) === assetLevel)
    .sort((a, b) => {
      const roleA = resolveZoneRole(a, zones) === 'room' ? 0 : 1;
      const roleB = resolveZoneRole(b, zones) === 'room' ? 0 : 1;
      if (roleA !== roleB) return roleA - roleB;
      return computeZoneAreaM2(a) - computeZoneAreaM2(b);
    });

  let hostZone: FloorplanZone | undefined;
  for (const z of indoorZones) {
    const zRot = z.rotationY || 0;
    const cos = Math.cos(zRot);
    const sin = Math.sin(zRot);
    const dx = asset.position[0] - z.x;
    const dz = asset.position[2] - z.z;
    const lx = dx * cos - dz * sin;
    const lz = dx * sin + dz * cos;
    if (Math.abs(lx) <= z.width / 2 + 0.4 && Math.abs(lz) <= z.depth / 2 + 0.4) {
      hostZone = z;
      break;
    }
  }
  if (!hostZone) return null;

  const zRot = hostZone.rotationY || 0;
  const cos = Math.cos(zRot);
  const sin = Math.sin(zRot);
  const dx = asset.position[0] - hostZone.x;
  const dz = asset.position[2] - hostZone.z;
  let lx = dx * cos - dz * sin;
  let lz = dx * sin + dz * cos;

  const wallClearance = 0.16; // Both walls' inner thickness (2 x 0.08m)
  const netRoomW = Math.max(1.2, +(hostZone.width - wallClearance).toFixed(2));
  const netRoomD = Math.max(1.2, +(hostZone.depth - wallClearance).toFixed(2));

  const sc = asset.stairConfig || {};
  const relAngle = (asset.rotationY || 0) - zRot;
  const isRotated90 = Math.abs(Math.sin(relAngle)) > 0.707;

  let nextWidth = sc.width ?? 1.06;
  let nextRun = sc.totalRun ?? 3.1;

  if (mode === 'wall_to_wall') {
    // Span totalRun wall-to-wall along the stair's run axis, or clamp to room interior
    if (isRotated90) {
      nextRun = Math.min(4.5, Math.max(1.8, netRoomW));
      nextWidth = Math.min(nextWidth, netRoomD);
      lx = 0;
      const maxZ = Math.max(0, netRoomD / 2 - nextWidth / 2);
      lz = lz >= 0 ? maxZ : -maxZ;
    } else {
      nextRun = Math.min(4.5, Math.max(1.8, netRoomD));
      nextWidth = Math.min(nextWidth, netRoomW);
      lz = 0;
      const maxX = Math.max(0, netRoomW / 2 - nextWidth / 2);
      lx = lx >= 0 ? maxX : -maxX;
    }
  } else {
    // Flush corner fit: clamp run and width so they fit inside the room and snap into the nearest wall corner
    if (isRotated90) {
      nextRun = Math.min(nextRun, netRoomW);
      nextWidth = Math.min(nextWidth, netRoomD);
      const maxX = Math.max(0, netRoomW / 2 - nextRun / 2);
      const maxZ = Math.max(0, netRoomD / 2 - nextWidth / 2);
      lx = lx >= 0 ? maxX : -maxX;
      lz = lz >= 0 ? maxZ : -maxZ;
    } else {
      nextRun = Math.min(nextRun, netRoomD);
      nextWidth = Math.min(nextWidth, netRoomW);
      const maxX = Math.max(0, netRoomW / 2 - nextWidth / 2);
      const maxZ = Math.max(0, netRoomD / 2 - nextRun / 2);
      lx = lx >= 0 ? maxX : -maxX;
      lz = lz >= 0 ? maxZ : -maxZ;
    }
  }

  const invCos = Math.cos(-zRot);
  const invSin = Math.sin(-zRot);
  const wx = +(hostZone.x + lx * invCos - lz * invSin).toFixed(3);
  const wz = +(hostZone.z + lx * invSin + lz * invCos).toFixed(3);

  return {
    position: [wx, asset.position[1], wz],
    scale: 1,
    customWidth: nextWidth,
    customLength: nextRun,
    stairConfig: {
      ...sc,
      width: nextWidth,
      totalRun: nextRun,
      totalRise: sc.totalRise ?? hostZone.wallHeight ?? 2.6,
    },
  };
}

