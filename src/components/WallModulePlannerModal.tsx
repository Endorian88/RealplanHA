import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Layers,
  Maximize2,
  Plus,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import {
  AcousticWoodTone,
  FloorplanZone,
  PlacedAsset,
  WallModuleType,
  WallOpening,
  WallPlannerCategory,
  WallSideId,
} from '../types/floorplan';

export interface WallModuleDraftItem {
  id: string;
  moduleType: WallModuleType;
  label: string;
  width: number;
  height: number;
  depth: number;
  hasUpperCabinet: boolean;
}

interface ModuleCatalogDef {
  moduleType: WallModuleType;
  category: WallPlannerCategory;
  label: string;
  shortLabel: string;
  defaultWidth: number;
  defaultHeight: number;
  defaultDepth: number;
  hasUpperDefault: boolean;
  badge: string;
}

export const WALL_PLANNER_MODULE_CATALOG: ModuleCatalogDef[] = [
  // 1. KÜCHE (KÜCHENPLANER)
  {
    moduleType: 'tall_fridge',
    category: 'kitchen',
    label: 'Kühl-/Gefrier-Hochschrank',
    shortLabel: 'Kühlschrank',
    defaultWidth: 0.6,
    defaultHeight: 2.15,
    defaultDepth: 0.6,
    hasUpperDefault: false,
    badge: 'Hochschrank · 60 cm',
  },
  {
    moduleType: 'tall_oven',
    category: 'kitchen',
    label: 'Backofen- & Dampfgarer-Hochschrank',
    shortLabel: 'Backofen-Turm',
    defaultWidth: 0.6,
    defaultHeight: 2.15,
    defaultDepth: 0.6,
    hasUpperDefault: false,
    badge: 'Geräteturm · 60 cm',
  },
  {
    moduleType: 'sink_unit',
    category: 'kitchen',
    label: 'Spülenschrank mit Design-Armatur',
    shortLabel: 'Spüle',
    defaultWidth: 0.8,
    defaultHeight: 0.9,
    defaultDepth: 0.6,
    hasUpperDefault: true,
    badge: 'Wasser · 60–90 cm',
  },
  {
    moduleType: 'dishwasher_base',
    category: 'kitchen',
    label: 'Geschirrspüler (Vollintegriert)',
    shortLabel: 'Spülmaschine',
    defaultWidth: 0.6,
    defaultHeight: 0.9,
    defaultDepth: 0.6,
    hasUpperDefault: true,
    badge: 'Gerät · 60 cm',
  },
  {
    moduleType: 'cooktop_oven',
    category: 'kitchen',
    label: 'Induktions-Kochfeld & Herdschrank',
    shortLabel: 'Kochfeld',
    defaultWidth: 0.9,
    defaultHeight: 0.9,
    defaultDepth: 0.6,
    hasUpperDefault: true,
    badge: 'Kochen · 60–100 cm',
  },
  {
    moduleType: 'drawer_base',
    category: 'kitchen',
    label: 'Auszug-/Schubladen-Unterschrank',
    shortLabel: 'Schubladen',
    defaultWidth: 0.8,
    defaultHeight: 0.9,
    defaultDepth: 0.6,
    hasUpperDefault: true,
    badge: 'Stauraum · 40–120 cm',
  },

  // 2. WOHNWAND / MEDIENWAND
  {
    moduleType: 'media_acoustic_wall',
    category: 'living_wall',
    label: 'TV-Medienwand mit Akustiklamellen & OLED',
    shortLabel: 'TV + Akustikwand',
    defaultWidth: 1.8,
    defaultHeight: 2.25,
    defaultDepth: 0.44,
    hasUpperDefault: false,
    badge: 'Highlight · 120–240 cm',
  },
  {
    moduleType: 'tv_lowboard',
    category: 'living_wall',
    label: 'Design-Lowboard / Sideboard',
    shortLabel: 'Lowboard',
    defaultWidth: 1.2,
    defaultHeight: 0.46,
    defaultDepth: 0.44,
    hasUpperDefault: false,
    badge: 'Lowboard · 80–200 cm',
  },
  {
    moduleType: 'glass_vitrine',
    category: 'living_wall',
    label: 'Hochvitrine mit Rauchglas & LED',
    shortLabel: 'Glas-Vitrine',
    defaultWidth: 0.6,
    defaultHeight: 2.1,
    defaultDepth: 0.42,
    hasUpperDefault: false,
    badge: 'Vitrine · 50–90 cm',
  },
  {
    moduleType: 'wall_bookshelf',
    category: 'living_wall',
    label: 'Offenes Architektur-Bücherregal',
    shortLabel: 'Bücherregal',
    defaultWidth: 0.8,
    defaultHeight: 2.1,
    defaultDepth: 0.38,
    hasUpperDefault: false,
    badge: 'Regal · 40–100 cm',
  },

  // 3. GARDEROBE / DIELE
  {
    moduleType: 'wardrobe_bench_hooks',
    category: 'wardrobe',
    label: 'Garderobenbank mit Sitzpolster & Hakenpaneel',
    shortLabel: 'Sitzbank + Haken',
    defaultWidth: 1.0,
    defaultHeight: 1.95,
    defaultDepth: 0.45,
    hasUpperDefault: false,
    badge: 'Bank · 80–140 cm',
  },
  {
    moduleType: 'wardrobe_mirror_cabinet',
    category: 'wardrobe',
    label: 'Garderoben-Spiegelschrank (Raumhoch)',
    shortLabel: 'Spiegelschrank',
    defaultWidth: 0.6,
    defaultHeight: 2.15,
    defaultDepth: 0.45,
    hasUpperDefault: false,
    badge: 'Spiegel · 50–80 cm',
  },
  {
    moduleType: 'wardrobe_shoe_cabinet',
    category: 'wardrobe',
    label: 'Schuh- & Dielenschrank (Hoch)',
    shortLabel: 'Schuhschrank',
    defaultWidth: 0.8,
    defaultHeight: 2.15,
    defaultDepth: 0.45,
    hasUpperDefault: false,
    badge: 'Schuhe · 60–100 cm',
  },

  // 4. SCHRANKSYSTEM / ANKLEIDE
  {
    moduleType: 'closet_double_door',
    category: 'closet',
    label: '2-Türiger Kleiderschrank (Raumhoch)',
    shortLabel: 'Kleiderschrank',
    defaultWidth: 1.0,
    defaultHeight: 2.25,
    defaultDepth: 0.6,
    hasUpperDefault: false,
    badge: 'Schrank · 80–120 cm',
  },
  {
    moduleType: 'closet_mirror_door',
    category: 'closet',
    label: 'Spiegeltür-Kleiderschrank',
    shortLabel: 'Spiegel-Schrank',
    defaultWidth: 1.0,
    defaultHeight: 2.25,
    defaultDepth: 0.6,
    hasUpperDefault: false,
    badge: 'Spiegel · 80–120 cm',
  },
  {
    moduleType: 'closet_open_shelving',
    category: 'closet',
    label: 'Offenes Ankleide-Regalmodul (Eiche/Nussbaum)',
    shortLabel: 'Ankleide Offen',
    defaultWidth: 0.8,
    defaultHeight: 2.25,
    defaultDepth: 0.58,
    hasUpperDefault: false,
    badge: 'Offen · 50–100 cm',
  },
];

interface WallPresetTemplate {
  id: string;
  category: WallPlannerCategory;
  name: string;
  subtitle: string;
  modules: { moduleType: WallModuleType; widthRatio: number; minW: number; maxW: number }[];
}

const WALL_PRESET_TEMPLATES: WallPresetTemplate[] = [
  {
    id: 'kitchen_complete_line',
    category: 'kitchen',
    name: 'Komplette Familien-Küchenzeile',
    subtitle: 'Kühlschrank · Schubladen · Spüle · Spülmaschine · Kochfeld · Backofen-Turm',
    modules: [
      { moduleType: 'tall_fridge', widthRatio: 0.16, minW: 0.6, maxW: 0.7 },
      { moduleType: 'drawer_base', widthRatio: 0.16, minW: 0.45, maxW: 0.9 },
      { moduleType: 'sink_unit', widthRatio: 0.2, minW: 0.6, maxW: 0.9 },
      { moduleType: 'dishwasher_base', widthRatio: 0.16, minW: 0.6, maxW: 0.65 },
      { moduleType: 'cooktop_oven', widthRatio: 0.2, minW: 0.6, maxW: 1.0 },
      { moduleType: 'tall_oven', widthRatio: 0.16, minW: 0.6, maxW: 0.7 },
    ],
  },
  {
    id: 'kitchen_compact_bistro',
    category: 'kitchen',
    name: 'Kompakte Single- / Apartment-Küche',
    subtitle: 'Kühlschrank · Spüle · Schubladen · Induktions-Kochfeld',
    modules: [
      { moduleType: 'tall_fridge', widthRatio: 0.24, minW: 0.6, maxW: 0.65 },
      { moduleType: 'sink_unit', widthRatio: 0.26, minW: 0.6, maxW: 0.8 },
      { moduleType: 'drawer_base', widthRatio: 0.22, minW: 0.45, maxW: 0.8 },
      { moduleType: 'cooktop_oven', widthRatio: 0.28, minW: 0.6, maxW: 0.9 },
    ],
  },
  {
    id: 'living_media_panorama',
    category: 'living_wall',
    name: 'Architektur-Wohnwand mit OLED & Akustikpaneel',
    subtitle: 'Glas-Vitrine · Lowboard · TV-Akustikwand · Bücherregal',
    modules: [
      { moduleType: 'glass_vitrine', widthRatio: 0.18, minW: 0.55, maxW: 0.8 },
      { moduleType: 'tv_lowboard', widthRatio: 0.24, minW: 0.8, maxW: 1.2 },
      { moduleType: 'media_acoustic_wall', widthRatio: 0.4, minW: 1.4, maxW: 2.2 },
      { moduleType: 'wall_bookshelf', widthRatio: 0.18, minW: 0.55, maxW: 0.9 },
    ],
  },
  {
    id: 'living_minimal_lowboard',
    category: 'living_wall',
    name: 'Minimalistisches Designer-Lowboard + Vitrine',
    subtitle: 'Lowboard · TV-Akustikwand · Glas-Vitrine',
    modules: [
      { moduleType: 'tv_lowboard', widthRatio: 0.34, minW: 0.8, maxW: 1.4 },
      { moduleType: 'media_acoustic_wall', widthRatio: 0.44, minW: 1.4, maxW: 2.0 },
      { moduleType: 'glass_vitrine', widthRatio: 0.22, minW: 0.6, maxW: 0.85 },
    ],
  },
  {
    id: 'wardrobe_hallway_complete',
    category: 'wardrobe',
    name: 'Komplette Dielen-Garderobe mit Sitzbank',
    subtitle: 'Spiegelschrank · Garderobenbank mit Haken · Schuhschrank',
    modules: [
      { moduleType: 'wardrobe_mirror_cabinet', widthRatio: 0.28, minW: 0.55, maxW: 0.8 },
      { moduleType: 'wardrobe_bench_hooks', widthRatio: 0.42, minW: 0.8, maxW: 1.4 },
      { moduleType: 'wardrobe_shoe_cabinet', widthRatio: 0.3, minW: 0.6, maxW: 1.0 },
    ],
  },
  {
    id: 'closet_master_dressing',
    category: 'closet',
    name: 'Raumhohe Master-Ankleide & Einbauschrank',
    subtitle: 'Kleiderschrank · Spiegelschrank · Offenes Ankleideregal · Kleiderschrank',
    modules: [
      { moduleType: 'closet_double_door', widthRatio: 0.28, minW: 0.8, maxW: 1.2 },
      { moduleType: 'closet_mirror_door', widthRatio: 0.26, minW: 0.8, maxW: 1.1 },
      { moduleType: 'closet_open_shelving', widthRatio: 0.2, minW: 0.6, maxW: 0.9 },
      { moduleType: 'closet_double_door', widthRatio: 0.26, minW: 0.8, maxW: 1.2 },
    ],
  },
];

const FRONT_COLOR_PRESETS = [
  { hex: '#334155', label: 'Schiefer-Anthrazit' },
  { hex: '#f8fafc', label: 'Alpinweiß Matt' },
  { hex: '#e7e5e4', label: 'Kaschmir / Sandbeige' },
  { hex: '#4d6b53', label: 'Salbeigrün' },
  { hex: '#1e293b', label: 'Tiefschwarz / Graphit' },
  { hex: '#855836', label: 'Nussbaum / Eiche' },
];

const COUNTERTOP_COLOR_PRESETS = [
  { hex: '#d6d3d1', label: 'Travertin / Marmor Hell' },
  { hex: '#27272a', label: 'Nero Assoluto Granit' },
  { hex: '#c89d66', label: 'Massivholz Wildeiche' },
  { hex: '#94a3b8', label: 'Sichtbeton Grau' },
];

interface WallModulePlannerModalProps {
  zone: FloorplanZone;
  initialWallSide?: WallSideId;
  initialCategory?: WallPlannerCategory;
  openings: WallOpening[];
  existingAssets: PlacedAsset[];
  onApplyWallModules: (
    zoneId: string,
    wallSide: WallSideId,
    category: WallPlannerCategory,
    newAssets: PlacedAsset[],
    replaceExistingOnWall: boolean
  ) => void;
  onClose: () => void;
}

export const WallModulePlannerModal: React.FC<WallModulePlannerModalProps> = ({
  zone,
  initialWallSide = 'north',
  initialCategory,
  openings,
  existingAssets,
  onApplyWallModules,
  onClose,
}) => {
  const inferredDefaultCategory = useMemo<WallPlannerCategory>(() => {
    if (initialCategory) return initialCategory;
    const lower = zone.name.toLowerCase();
    if (lower.includes('küche') || lower.includes('kueche') || lower.includes('koch')) {
      return 'kitchen';
    }
    if (lower.includes('flur') || lower.includes('diele') || lower.includes('eingang')) {
      return 'wardrobe';
    }
    if (lower.includes('schlaf') || lower.includes('ankleide') || lower.includes('kind')) {
      return 'closet';
    }
    return 'kitchen';
  }, [initialCategory, zone.name]);

  const [wallSide, setWallSide] = useState<WallSideId>(initialWallSide);
  const [category, setCategory] = useState<WallPlannerCategory>(inferredDefaultCategory);
  const [frontColor, setFrontColor] = useState<string>('#334155');
  const [countertopColor, setCountertopColor] = useState<string>('#d6d3d1');
  const [bodyWoodTone, setBodyWoodTone] = useState<AcousticWoodTone>('oak_natural');
  const [hasUpperCabinets, setHasUpperCabinets] = useState<boolean>(true);
  const [hasLedStrip, setHasLedStrip] = useState<boolean>(true);
  const [startOffsetM, setStartOffsetM] = useState<number>(0);
  const [replaceExistingOnWall, setReplaceExistingOnWall] = useState<boolean>(true);
  const [draftModules, setDraftModules] = useState<WallModuleDraftItem[]>([]);

  // Clear interior wall length in meters (subtracting 2 x 8cm interior wall thickness)
  const netWallLengthM = useMemo(() => {
    const rawLen = wallSide === 'north' || wallSide === 'south' ? zone.width : zone.depth;
    return Math.max(1.2, +(rawLen - 0.16).toFixed(2));
  }, [wallSide, zone.width, zone.depth]);

  // Detect any doors or windows sitting on this selected wall so the user sees keep-out zones in the elevation
  const wallOpeningsOnThisSide = useMemo(() => {
    const zLevel = zone.level ?? 0;
    const zRot = zone.rotationY || 0;
    const cos = Math.cos(zRot);
    const sin = Math.sin(zRot);
    const rHalfW = zone.width / 2;
    const rHalfD = zone.depth / 2;

    const result: { id: string; name: string; type: string; offsetFromLeft: number; width: number; height: number; sillHeight: number }[] = [];

    for (const op of openings) {
      if ((op.level ?? 0) !== zLevel) continue;
      const dx = op.x - zone.x;
      const dz = op.z - zone.z;
      const lx = dx * cos - dz * sin;
      const lz = dx * sin + dz * cos;

      const tol = 0.42;
      if (wallSide === 'north' && Math.abs(lz - -rHalfD) < tol && Math.abs(lx) <= rHalfW) {
        const fromLeft = Math.max(0, lx + netWallLengthM / 2 - op.width / 2);
        result.push({
          id: op.id,
          name: op.name,
          type: op.type,
          offsetFromLeft: +fromLeft.toFixed(2),
          width: op.width,
          height: op.height,
          sillHeight: op.sillHeight,
        });
      } else if (wallSide === 'south' && Math.abs(lz - rHalfD) < tol && Math.abs(lx) <= rHalfW) {
        const fromLeft = Math.max(0, netWallLengthM / 2 - lx - op.width / 2);
        result.push({
          id: op.id,
          name: op.name,
          type: op.type,
          offsetFromLeft: +fromLeft.toFixed(2),
          width: op.width,
          height: op.height,
          sillHeight: op.sillHeight,
        });
      } else if (wallSide === 'west' && Math.abs(lx - -rHalfW) < tol && Math.abs(lz) <= rHalfD) {
        const fromLeft = Math.max(0, netWallLengthM / 2 - lz - op.width / 2);
        result.push({
          id: op.id,
          name: op.name,
          type: op.type,
          offsetFromLeft: +fromLeft.toFixed(2),
          width: op.width,
          height: op.height,
          sillHeight: op.sillHeight,
        });
      } else if (wallSide === 'east' && Math.abs(lx - rHalfW) < tol && Math.abs(lz) <= rHalfD) {
        const fromLeft = Math.max(0, lz + netWallLengthM / 2 - op.width / 2);
        result.push({
          id: op.id,
          name: op.name,
          type: op.type,
          offsetFromLeft: +fromLeft.toFixed(2),
          width: op.width,
          height: op.height,
          sillHeight: op.sillHeight,
        });
      }
    }
    return result;
  }, [openings, zone, wallSide, netWallLengthM]);

  // Load existing wall modules on this wall if present, otherwise initialize with the first preset for the category
  useEffect(() => {
    const existingOnWall = existingAssets.filter(
      (a) =>
        a.wallModuleConfig?.attachedZoneId === zone.id &&
        a.wallModuleConfig?.attachedWallSide === wallSide
    );

    if (existingOnWall.length > 0) {
      const firstCfg = existingOnWall[0].wallModuleConfig!;
      setCategory(firstCfg.category);
      if (firstCfg.frontColor) setFrontColor(firstCfg.frontColor);
      if (firstCfg.countertopColor) setCountertopColor(firstCfg.countertopColor);
      if (firstCfg.bodyWoodTone) setBodyWoodTone(firstCfg.bodyWoodTone);
      setHasUpperCabinets(firstCfg.hasUpperCabinet !== false);
      setHasLedStrip(firstCfg.hasLedStrip !== false);

      const sorted = existingOnWall
        .slice()
        .sort(
          (a, b) =>
            (a.wallModuleConfig?.offsetAlongWall ?? 0) -
            (b.wallModuleConfig?.offsetAlongWall ?? 0)
        );
      setDraftModules(
        sorted.map((a, idx) => {
          const def =
            WALL_PLANNER_MODULE_CATALOG.find(
              (c) => c.moduleType === a.wallModuleConfig?.moduleType
            ) || WALL_PLANNER_MODULE_CATALOG[0];
          return {
            id: `mod_${Date.now()}_${idx}`,
            moduleType: def.moduleType,
            label: def.label,
            width: a.customLength ?? a.customWidth ?? def.defaultWidth,
            height: a.customHeight ?? def.defaultHeight,
            depth: a.customDepth ?? def.defaultDepth,
            hasUpperCabinet: a.wallModuleConfig?.hasUpperCabinet ?? def.hasUpperDefault,
          };
        })
      );
      return;
    }

    // Apply default preset for the selected category
    const defaultPreset =
      WALL_PRESET_TEMPLATES.find((p) => p.category === category) || WALL_PRESET_TEMPLATES[0];
    applyPresetTemplate(defaultPreset, netWallLengthM);
  }, [zone.id, wallSide]);

  const applyPresetTemplate = (preset: WallPresetTemplate, targetWallLen: number) => {
    setCategory(preset.category);
    const usableLen = Math.max(1.2, Math.min(targetWallLen, 4.2));
    const items: WallModuleDraftItem[] = [];
    let sumW = 0;

    for (let i = 0; i < preset.modules.length; i++) {
      const pm = preset.modules[i];
      const def =
        WALL_PLANNER_MODULE_CATALOG.find((c) => c.moduleType === pm.moduleType) ||
        WALL_PLANNER_MODULE_CATALOG[0];
      const rawW = Math.round((usableLen * pm.widthRatio) / 0.1) * 0.1;
      const w = Number(Math.max(pm.minW, Math.min(pm.maxW, rawW)).toFixed(2));
      if (sumW + w <= targetWallLen + 0.05 || items.length < 2) {
        items.push({
          id: `mod_${Date.now()}_${i}`,
          moduleType: def.moduleType,
          label: def.label,
          width: w,
          height: def.defaultHeight,
          depth: def.defaultDepth,
          hasUpperCabinet: def.hasUpperDefault,
        });
        sumW += w;
      }
    }
    setStartOffsetM(Number(Math.max(0, (targetWallLen - sumW) / 2).toFixed(2)));
    setDraftModules(items);
  };

  const totalPlannedWidthM = useMemo(
    () => Number(draftModules.reduce((acc, m) => acc + m.width, 0).toFixed(2)),
    [draftModules]
  );

  const remainingWallWidthM = useMemo(
    () => Number(Math.max(0, netWallLengthM - startOffsetM - totalPlannedWidthM).toFixed(2)),
    [netWallLengthM, startOffsetM, totalPlannedWidthM]
  );

  const handleAddModule = (def: ModuleCatalogDef) => {
    const avail = Math.max(0.4, netWallLengthM - totalPlannedWidthM);
    const w = Number(Math.min(def.defaultWidth, Math.max(0.4, avail)).toFixed(2));
    setDraftModules((prev) => [
      ...prev,
      {
        id: `mod_${Date.now()}_${prev.length}`,
        moduleType: def.moduleType,
        label: def.label,
        width: w,
        height: def.defaultHeight,
        depth: def.defaultDepth,
        hasUpperCabinet: def.hasUpperDefault,
      },
    ]);
  };

  const handleFillRemainingWidth = (idx: number) => {
    const item = draftModules[idx];
    if (!item) return;
    const othersWidth = draftModules.reduce((acc, m, i) => (i === idx ? acc : acc + m.width), 0);
    const rest = Number(Math.max(0.4, netWallLengthM - startOffsetM - othersWidth).toFixed(2));
    setDraftModules((prev) =>
      prev.map((m, i) => (i === idx ? { ...m, width: rest } : m))
    );
  };

  const handleScaleAllToFullWall = () => {
    if (draftModules.length === 0 || totalPlannedWidthM <= 0.1) return;
    const factor = netWallLengthM / totalPlannedWidthM;
    let running = 0;
    const next = draftModules.map((m, i) => {
      if (i === draftModules.length - 1) {
        const lastW = Number(Math.max(0.35, netWallLengthM - running).toFixed(2));
        return { ...m, width: lastW };
      }
      const w = Number(Math.max(0.35, Math.round(m.width * factor * 20) / 20).toFixed(2));
      running += w;
      return { ...m, width: w };
    });
    setStartOffsetM(0);
    setDraftModules(next);
  };

  const handleCenterOnWall = () => {
    const centeredOffset = Math.max(0, Number(((netWallLengthM - totalPlannedWidthM) / 2).toFixed(2)));
    setStartOffsetM(centeredOffset);
  };

  const handleCommitToWall = () => {
    if (draftModules.length === 0) return;

    const zRot = zone.rotationY || 0;
    const invCos = Math.cos(-zRot);
    const invSin = Math.sin(-zRot);
    const rHalfW = zone.width / 2;
    const rHalfD = zone.depth / 2;
    const wallThicknessHalf = 0.08;
    const groupId = `wallgrp_${zone.id}_${wallSide}_${Date.now()}`;

    let cursorAlongWall = startOffsetM;
    const createdAssets: PlacedAsset[] = [];

    draftModules.forEach((mod, idx) => {
      const centerAlongWall = cursorAlongWall + mod.width / 2;
      cursorAlongWall += mod.width;

      const halfD = mod.depth / 2;
      const wallInset = wallThicknessHalf + halfD;

      let localX = 0;
      let localZ = 0;
      let localRotY = 0;

      if (wallSide === 'north') {
        localX = -netWallLengthM / 2 + centerAlongWall;
        localZ = -rHalfD + wallInset;
        localRotY = 0;
      } else if (wallSide === 'south') {
        localX = netWallLengthM / 2 - centerAlongWall;
        localZ = rHalfD - wallInset;
        localRotY = Math.PI;
      } else if (wallSide === 'west') {
        localX = -rHalfW + wallInset;
        localZ = netWallLengthM / 2 - centerAlongWall;
        localRotY = Math.PI / 2;
      } else {
        // east
        localX = rHalfW - wallInset;
        localZ = -netWallLengthM / 2 + centerAlongWall;
        localRotY = -Math.PI / 2;
      }

      const wx = +(zone.x + localX * invCos - localZ * invSin).toFixed(3);
      const wz = +(zone.z + localX * invSin + localZ * invCos).toFixed(3);

      createdAssets.push({
        id: `wallmod_${Date.now()}_${idx}`,
        catalogId: 'wall_planner_module',
        name: `${mod.label} (${Math.round(mod.width * 100)} cm)`,
        category: 'furniture',
        mountType: 'floor',
        level: zone.level ?? 0,
        position: [wx, 0, wz],
        rotationY: localRotY + zRot,
        scale: 1,
        customLength: mod.width,
        customWidth: mod.width,
        customDepth: mod.depth,
        customHeight: mod.height,
        wallModuleConfig: {
          category,
          moduleType: mod.moduleType,
          frontColor,
          countertopColor,
          bodyWoodTone,
          hasUpperCabinet: hasUpperCabinets && mod.hasUpperCabinet,
          hasLedStrip,
          attachedZoneId: zone.id,
          attachedWallSide: wallSide,
          offsetAlongWall: +(centerAlongWall - mod.width / 2).toFixed(2),
          wallGroupId: groupId,
        },
      });
    });

    onApplyWallModules(zone.id, wallSide, category, createdAssets, replaceExistingOnWall);
    onClose();
  };

  const categoryModules = useMemo(
    () => WALL_PLANNER_MODULE_CATALOG.filter((m) => m.category === category),
    [category]
  );

  const categoryPresets = useMemo(
    () => WALL_PRESET_TEMPLATES.filter((p) => p.category === category),
    [category]
  );

  const wallSideLabels: Record<WallSideId, string> = {
    north: 'Nordwand (Oben)',
    east: 'Ostwand (Rechts)',
    south: 'Südwand (Unten)',
    west: 'Westwand (Links)',
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
      <div className="w-full max-w-5xl bg-slate-900 border border-amber-400/35 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-5 py-3.5 bg-slate-950 border-b border-white/10 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-400/20 border border-amber-400/40 flex items-center justify-center text-amber-300">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
                <span>Wand- & Einbau-Planer (Modul-Baukasten)</span>
                <span className="px-2 py-0.5 rounded bg-sky-500/20 border border-sky-400/30 text-[11px] font-mono text-sky-300">
                  {zone.name} · {wallSideLabels[wallSide]} ({netWallLengthM.toFixed(2)} m)
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Wähle Wandseite & System (Küche, Wohnwand, Garderobe oder Schrank) — mit 1-Klick-Vorlagen oder Einzelmodulen exakt auf Wandmaß planen.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
          {/* Top Bar: 1. Wandseite wählen & 2. Planungs-Kategorie wählen */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            <div className="p-3 rounded-xl bg-slate-950 border border-white/10 space-y-1.5">
              <div className="text-[11px] font-bold text-slate-300 flex items-center justify-between">
                <span>1. Raumwand auswählen</span>
                <span className="font-mono text-amber-300">
                  Netto-Wandlänge: {netWallLengthM.toFixed(2)} m
                </span>
              </div>
              <div className="grid grid-cols-4 gap-1.5">
                {(['north', 'east', 'south', 'west'] as WallSideId[]).map((side) => {
                  const len =
                    side === 'north' || side === 'south'
                      ? Math.max(1.2, +(zone.width - 0.16).toFixed(2))
                      : Math.max(1.2, +(zone.depth - 0.16).toFixed(2));
                  return (
                    <button
                      key={side}
                      type="button"
                      onClick={() => setWallSide(side)}
                      className={`py-2 px-2 rounded-lg text-xs font-bold border transition-colors ${
                        wallSide === side
                          ? 'bg-amber-400 text-slate-950 border-amber-300 shadow-sm'
                          : 'bg-slate-900 text-slate-300 hover:bg-slate-800 border-white/10'
                      }`}
                    >
                      <div>
                        {side === 'north'
                          ? 'Nord (Oben)'
                          : side === 'east'
                          ? 'Ost (Rechts)'
                          : side === 'south'
                          ? 'Süd (Unten)'
                          : 'West (Links)'}
                      </div>
                      <div className="text-[10px] font-mono opacity-80">{len.toFixed(2)} m</div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="p-3 rounded-xl bg-slate-950 border border-white/10 space-y-1.5">
              <div className="text-[11px] font-bold text-slate-300">
                2. Einbau-System für diese Wand wählen
              </div>
              <div className="grid grid-cols-4 gap-1.5">
                {(
                  [
                    { id: 'kitchen', label: '🍳 Küchenplaner', sub: 'Küchenzeile' },
                    { id: 'living_wall', label: '📺 Wohnwand', sub: 'TV & Vitrine' },
                    { id: 'wardrobe', label: '🧥 Garderobe', sub: 'Bank & Spiegel' },
                    { id: 'closet', label: '🚪 Schränke', sub: 'Einbauschrank' },
                  ] as const
                ).map((cat) => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => {
                      setCategory(cat.id);
                      const firstPreset = WALL_PRESET_TEMPLATES.find(
                        (p) => p.category === cat.id
                      );
                      if (firstPreset) {
                        applyPresetTemplate(firstPreset, netWallLengthM);
                      }
                    }}
                    className={`py-2 px-2 rounded-lg text-xs font-bold border transition-colors ${
                      category === cat.id
                        ? 'bg-sky-400 text-slate-950 border-sky-300 shadow-sm'
                        : 'bg-slate-900 text-slate-300 hover:bg-slate-800 border-white/10'
                    }`}
                  >
                    <div className="truncate">{cat.label}</div>
                    <div className="text-[10px] opacity-80 truncate">{cat.sub}</div>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Interactive 2D Frontal Wall Elevation (Wand-Aufriss) */}
          <div className="p-4 rounded-xl bg-slate-950 border border-sky-400/30 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="text-xs font-bold text-sky-300">
                  Live Wand-Aufriss (Frontalansicht von innen auf die {wallSideLabels[wallSide]})
                </div>
                <div className="text-[11px] text-slate-400">
                  Geplante Breite:{' '}
                  <strong className="text-amber-300 font-mono">
                    {totalPlannedWidthM.toFixed(2)} m
                  </strong>{' '}
                  von{' '}
                  <strong className="text-white font-mono">{netWallLengthM.toFixed(2)} m</strong> ·
                  Freie Restbreite:{' '}
                  <strong className="text-emerald-300 font-mono">
                    {remainingWallWidthM.toFixed(2)} m
                  </strong>
                </div>
              </div>

              <div className="flex items-center gap-1.5 flex-wrap">
                <button
                  type="button"
                  onClick={() => setStartOffsetM(0)}
                  className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 border border-white/15 text-[11px] font-semibold text-slate-200"
                >
                  ⇤ Links bündig
                </button>
                <button
                  type="button"
                  onClick={handleCenterOnWall}
                  className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 border border-white/15 text-[11px] font-semibold text-slate-200"
                >
                  ↔ An Wand zentrieren
                </button>
                <button
                  type="button"
                  onClick={handleScaleAllToFullWall}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-400/20 hover:bg-amber-400/30 border border-amber-400/50 text-[11px] font-bold text-amber-300"
                >
                  <Maximize2 className="w-3.5 h-3.5" />
                  <span>Wand komplett füllen ({netWallLengthM.toFixed(2)} m)</span>
                </button>
              </div>
            </div>

            {/* SVG Wall Elevation Blueprint */}
            <div className="w-full bg-slate-900/90 rounded-xl border border-white/10 p-3 overflow-x-auto">
              <svg
                viewBox={`-20 -20 ${Math.max(400, netWallLengthM * 140) + 40} 250`}
                className="w-full h-48 select-none"
              >
                {(() => {
                  const pxPerM = 140;
                  const wallW = netWallLengthM * pxPerM;
                  const wallH = 200; // ~2.6m wall height

                  let curX = startOffsetM * pxPerM;

                  return (
                    <>
                      {/* Wall background */}
                      <rect
                        x={0}
                        y={0}
                        width={wallW}
                        height={wallH}
                        fill="#1e293b"
                        stroke="#475569"
                        strokeWidth={2}
                        rx={4}
                      />

                      {/* 50cm grid lines on wall */}
                      {Array.from({ length: Math.floor(netWallLengthM * 2) + 1 }).map((_, idx) => {
                        const gx = idx * 0.5 * pxPerM;
                        return (
                          <g key={idx}>
                            <line
                              x1={gx}
                              y1={0}
                              x2={gx}
                              y2={wallH}
                              stroke="rgba(148,163,184,0.12)"
                              strokeDasharray="3 3"
                            />
                            <text
                              x={gx}
                              y={wallH + 16}
                              textAnchor="middle"
                              fill="#94a3b8"
                              fontSize={9}
                              fontFamily="monospace"
                            >
                              {(idx * 0.5).toFixed(1)}m
                            </text>
                          </g>
                        );
                      })}

                      {/* Existing Windows & Doors on this wall (Keep-Out Zones) */}
                      {wallOpeningsOnThisSide.map((op) => {
                        const ox = op.offsetFromLeft * pxPerM;
                        const ow = op.width * pxPerM;
                        const oh = Math.min(wallH, (op.height / 2.6) * wallH);
                        const oy = wallH - ((op.sillHeight + op.height) / 2.6) * wallH;
                        return (
                          <g key={op.id}>
                            <rect
                              x={ox}
                              y={Math.max(2, oy)}
                              width={ow}
                              height={oh}
                              fill="rgba(56, 189, 248, 0.16)"
                              stroke="#38bdf8"
                              strokeWidth={1.5}
                              strokeDasharray="4 2"
                            />
                            <text
                              x={ox + ow / 2}
                              y={Math.max(18, oy + oh / 2)}
                              textAnchor="middle"
                              fill="#7dd3fc"
                              fontSize={9}
                              fontWeight={700}
                            >
                              {op.type === 'door' ? '🚪 Tür' : '🪟 Fenster'} ({op.width.toFixed(2)}m)
                            </text>
                          </g>
                        );
                      })}

                      {/* Planned Wall Modules */}
                      {draftModules.map((mod, idx) => {
                        const mw = mod.width * pxPerM;
                        const mh = Math.min(wallH - 6, (mod.height / 2.6) * wallH);
                        const mx = curX;
                        const my = wallH - mh;
                        curX += mw;

                        const showUpper =
                          category === 'kitchen' && hasUpperCabinets && mod.hasUpperCabinet;

                        return (
                          <g key={mod.id}>
                            {/* Upper cabinet if kitchen base */}
                            {showUpper && (
                              <rect
                                x={mx + 2}
                                y={wallH - (2.15 / 2.6) * wallH}
                                width={Math.max(8, mw - 4)}
                                height={(0.68 / 2.6) * wallH}
                                fill="#92400e"
                                fillOpacity={0.55}
                                stroke="#f59e0b"
                                strokeWidth={1.2}
                                rx={3}
                              />
                            )}

                            {/* Main module body */}
                            <rect
                              x={mx + 1.5}
                              y={my}
                              width={Math.max(8, mw - 3)}
                              height={mh}
                              fill={frontColor}
                              stroke="#fbbf24"
                              strokeWidth={1.8}
                              rx={4}
                            />

                            {/* Countertop line for base units */}
                            {mod.height <= 1.0 && (
                              <rect
                                x={mx + 1}
                                y={my - 4}
                                width={Math.max(8, mw - 2)}
                                height={5}
                                fill={countertopColor}
                                rx={1.5}
                              />
                            )}

                            {/* Module Label & Width */}
                            <text
                              x={mx + mw / 2}
                              y={my + mh / 2 - 4}
                              textAnchor="middle"
                              fill="#ffffff"
                              fontSize={10}
                              fontWeight={700}
                            >
                              #{idx + 1}{' '}
                              {WALL_PLANNER_MODULE_CATALOG.find(
                                (c) => c.moduleType === mod.moduleType
                              )?.shortLabel || mod.label}
                            </text>
                            <text
                              x={mx + mw / 2}
                              y={my + mh / 2 + 10}
                              textAnchor="middle"
                              fill="#fde68a"
                              fontSize={9.5}
                              fontFamily="monospace"
                              fontWeight={700}
                            >
                              {Math.round(mod.width * 100)} cm
                            </text>
                          </g>
                        );
                      })}
                    </>
                  );
                })()}
              </svg>
            </div>

            {/* Start Offset Slider */}
            <div className="flex items-center gap-3">
              <span className="text-xs text-slate-300 shrink-0">
                Abstand von linker Wandecke:
              </span>
              <input
                type="range"
                min={0}
                max={Math.max(0, +(netWallLengthM - 0.4).toFixed(2))}
                step={0.05}
                value={startOffsetM}
                onChange={(e) => setStartOffsetM(parseFloat(e.target.value))}
                className="flex-1 accent-amber-400"
              />
              <span className="font-mono text-xs font-bold text-amber-300 w-16 text-right">
                {startOffsetM.toFixed(2)} m
              </span>
            </div>
          </div>

          {/* Presets & Individual Module Kit */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            {/* Left 5 cols: Presets + Add Single Modules + Colors */}
            <div className="lg:col-span-5 space-y-3">
              {/* 1-Click Presets */}
              <div className="p-3 rounded-xl bg-slate-950 border border-amber-400/30 space-y-2">
                <div className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Komplett-Vorlagen für diese Wand</span>
                </div>
                <div className="space-y-1.5">
                  {categoryPresets.map((preset) => (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => applyPresetTemplate(preset, netWallLengthM)}
                      className="w-full p-2.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-white/10 hover:border-amber-400/50 text-left transition-colors"
                    >
                      <div className="text-xs font-bold text-white">{preset.name}</div>
                      <div className="text-[10px] text-slate-400 mt-0.5">{preset.subtitle}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Add Individual Modules */}
              <div className="p-3 rounded-xl bg-slate-950 border border-sky-400/30 space-y-2">
                <div className="text-xs font-bold text-sky-300">
                  + Einzelmodul zur Wand hinzufügen
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  {categoryModules.map((mod) => (
                    <button
                      key={mod.moduleType}
                      type="button"
                      onClick={() => handleAddModule(mod)}
                      className="p-2 rounded-lg bg-slate-900 hover:bg-slate-800 border border-white/10 hover:border-sky-400/50 text-left transition-colors flex flex-col justify-between"
                    >
                      <div className="text-[11px] font-bold text-white leading-snug">
                        + {mod.shortLabel}
                      </div>
                      <div className="text-[9.5px] text-sky-300 font-mono mt-1">{mod.badge}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Styling: Front Color, Countertop Color & Wood Tone */}
              <div className="p-3 rounded-xl bg-slate-950 border border-white/10 space-y-2.5">
                <div className="text-xs font-bold text-slate-200">
                  Frontfarbe, Arbeitsplatte & Beleuchtung
                </div>

                <div>
                  <div className="flex items-center justify-between text-[10px] text-slate-400 mb-1">
                    <span>Frontfarbe (Schränke & Auszüge)</span>
                    <input
                      type="color"
                      value={frontColor}
                      onChange={(e) => setFrontColor(e.target.value)}
                      className="w-6 h-5 rounded cursor-pointer bg-transparent"
                    />
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {FRONT_COLOR_PRESETS.map((c) => (
                      <button
                        key={c.hex}
                        type="button"
                        onClick={() => setFrontColor(c.hex)}
                        className={`px-2 py-1 rounded text-[10px] font-semibold flex items-center gap-1.5 border ${
                          frontColor.toLowerCase() === c.hex.toLowerCase()
                            ? 'border-amber-400 bg-amber-500/20 text-amber-200'
                            : 'border-white/10 bg-slate-900 text-slate-300'
                        }`}
                      >
                        <span
                          className="w-2.5 h-2.5 rounded-full border border-white/20"
                          style={{ backgroundColor: c.hex }}
                        />
                        <span>{c.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {category === 'kitchen' && (
                  <>
                    <div>
                      <div className="text-[10px] text-slate-400 mb-1">Arbeitsplatten-Design</div>
                      <div className="flex flex-wrap gap-1">
                        {COUNTERTOP_COLOR_PRESETS.map((c) => (
                          <button
                            key={c.hex}
                            type="button"
                            onClick={() => setCountertopColor(c.hex)}
                            className={`px-2 py-1 rounded text-[10px] font-semibold flex items-center gap-1.5 border ${
                              countertopColor.toLowerCase() === c.hex.toLowerCase()
                                ? 'border-sky-400 bg-sky-500/20 text-sky-200'
                                : 'border-white/10 bg-slate-900 text-slate-300'
                            }`}
                          >
                            <span
                              className="w-2.5 h-2.5 rounded-full border border-white/20"
                              style={{ backgroundColor: c.hex }}
                            />
                            <span>{c.label}</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-1.5 pt-1">
                      <button
                        type="button"
                        onClick={() => setHasUpperCabinets((v) => !v)}
                        className={`py-1.5 px-2 rounded-lg text-[11px] font-semibold border ${
                          hasUpperCabinets
                            ? 'bg-amber-400 text-slate-950 border-amber-300 font-bold'
                            : 'bg-slate-900 text-slate-300 border-white/10'
                        }`}
                      >
                        {hasUpperCabinets ? '✓ Hängeschränke AN' : 'Ohne Hängeschränke'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setHasLedStrip((v) => !v)}
                        className={`py-1.5 px-2 rounded-lg text-[11px] font-semibold border ${
                          hasLedStrip
                            ? 'bg-emerald-400 text-slate-950 border-emerald-300 font-bold'
                            : 'bg-slate-900 text-slate-300 border-white/10'
                        }`}
                      >
                        {hasLedStrip ? '✓ Nischen-LED AN' : 'Ohne LED-Band'}
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Right 7 cols: Ordered List of Planned Wall Modules */}
            <div className="lg:col-span-7 p-3.5 rounded-xl bg-slate-950 border border-white/10 flex flex-col justify-between space-y-3">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white">
                    Geplante Module an dieser Wand (von links nach rechts: {draftModules.length})
                  </span>
                  {draftModules.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setDraftModules([])}
                      className="text-[11px] text-red-300 hover:text-red-200"
                    >
                      Alle leeren
                    </button>
                  )}
                </div>

                {draftModules.length === 0 ? (
                  <div className="p-8 text-center text-xs text-slate-400 border border-dashed border-white/10 rounded-xl">
                    Noch keine Module auf dieser Wand. Wähle links eine Komplett-Vorlage oder klicke auf „+ Einzelmodul“.
                  </div>
                ) : (
                  <div className="space-y-2 max-h-[360px] overflow-y-auto pr-1">
                    {draftModules.map((mod, idx) => (
                      <div
                        key={mod.id}
                        className="p-2.5 rounded-xl bg-slate-900 border border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5"
                      >
                        <div className="flex items-center gap-2.5">
                          <span className="w-6 h-6 rounded-lg bg-amber-400/20 border border-amber-400/40 text-amber-300 font-mono text-xs font-bold flex items-center justify-center shrink-0">
                            {idx + 1}
                          </span>
                          <div>
                            <select
                              value={mod.moduleType}
                              onChange={(e) => {
                                const nextType = e.target.value as WallModuleType;
                                const def = WALL_PLANNER_MODULE_CATALOG.find(
                                  (c) => c.moduleType === nextType
                                );
                                if (!def) return;
                                setDraftModules((prev) =>
                                  prev.map((m, i) =>
                                    i === idx
                                      ? {
                                          ...m,
                                          moduleType: def.moduleType,
                                          label: def.label,
                                          height: def.defaultHeight,
                                          depth: def.defaultDepth,
                                          hasUpperCabinet: def.hasUpperDefault,
                                        }
                                      : m
                                  )
                                );
                              }}
                              className="bg-slate-950 border border-white/15 rounded-lg px-2 py-1 text-xs font-bold text-white"
                            >
                              {WALL_PLANNER_MODULE_CATALOG.map((c) => (
                                <option key={c.moduleType} value={c.moduleType}>
                                  {c.label}
                                </option>
                              ))}
                            </select>
                            <div className="text-[10px] text-slate-400 mt-0.5 font-mono">
                              Breite: {Math.round(mod.width * 100)} cm · Höhe:{' '}
                              {Math.round(mod.height * 100)} cm · Tiefe:{' '}
                              {Math.round(mod.depth * 100)} cm
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 flex-wrap justify-end">
                          {/* Standard Width Quick Buttons */}
                          {[0.4, 0.6, 0.8, 0.9, 1.0, 1.2].map((wVal) => (
                            <button
                              key={wVal}
                              type="button"
                              onClick={() =>
                                setDraftModules((prev) =>
                                  prev.map((m, i) => (i === idx ? { ...m, width: wVal } : m))
                                )
                              }
                              className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold transition-colors ${
                                Math.abs(mod.width - wVal) < 0.02
                                  ? 'bg-amber-400 text-slate-950'
                                  : 'bg-slate-950 text-slate-300 hover:bg-slate-800 border border-white/10'
                              }`}
                            >
                              {Math.round(wVal * 100)}
                            </button>
                          ))}

                          <button
                            type="button"
                            onClick={() => handleFillRemainingWidth(idx)}
                            title="Passt dieses Modul exakt an die verbleibende Restbreite der Wand an"
                            className="px-2 py-0.5 rounded bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-400/40 text-[10px] font-semibold text-emerald-300"
                          >
                            Rest füllen
                          </button>

                          {/* Move Left / Right */}
                          <button
                            type="button"
                            disabled={idx === 0}
                            onClick={() => {
                              setDraftModules((prev) => {
                                const copy = [...prev];
                                const tmp = copy[idx - 1];
                                copy[idx - 1] = copy[idx];
                                copy[idx] = tmp;
                                return copy;
                              });
                            }}
                            className="p-1 rounded bg-slate-950 hover:bg-slate-800 text-slate-300 disabled:opacity-30"
                            title="Nach links schieben"
                          >
                            <ArrowLeft className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            disabled={idx === draftModules.length - 1}
                            onClick={() => {
                              setDraftModules((prev) => {
                                const copy = [...prev];
                                const tmp = copy[idx + 1];
                                copy[idx + 1] = copy[idx];
                                copy[idx] = tmp;
                                return copy;
                              });
                            }}
                            className="p-1 rounded bg-slate-950 hover:bg-slate-800 text-slate-300 disabled:opacity-30"
                            title="Nach rechts schieben"
                          >
                            <ArrowRight className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              setDraftModules((prev) => prev.filter((_, i) => i !== idx))
                            }
                            className="p-1 rounded bg-red-500/20 hover:bg-red-500/35 text-red-300"
                            title="Modul entfernen"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Footer inside right column */}
              <div className="pt-3 border-t border-white/10 flex flex-wrap items-center justify-between gap-3">
                <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={replaceExistingOnWall}
                    onChange={(e) => setReplaceExistingOnWall(e.target.checked)}
                    className="rounded accent-amber-400"
                  />
                  <span>Bisherige Wandmodule an dieser Wandseite ersetzen</span>
                </label>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300"
                  >
                    Abbrechen
                  </button>
                  <button
                    type="button"
                    disabled={draftModules.length === 0}
                    onClick={handleCommitToWall}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 disabled:opacity-40 text-slate-950 text-xs font-bold shadow-lg"
                  >
                    <Check className="w-4 h-4" />
                    <span>
                      Jetzt bündig an {wallSideLabels[wallSide].split(' ')[0]} platzieren (
                      {draftModules.length} Module)
                    </span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
