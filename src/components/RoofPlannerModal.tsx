import React, { useMemo, useRef, useState } from 'react';
import {
  Copy,
  Home,
  Plus,
  RotateCw,
  Sun,
  Trash2,
  X,
} from 'lucide-react';
import { getEffectiveRoofDormers } from '../three/assetBuilder';
import {
  DormerWindowStyle,
  DormerWindowUnit,
  FloorplanZone,
  getEffectiveDormerWindows,
  HAEntityState,
  OpeningFrameColor,
  RoofChimneyItem,
  RoofChimneyStyle,
  RoofDormerItem,
  RoofDormerType,
  RoofPVModuleItem,
  RoofPVSideId,
  RoofSkylightItem,
  RoofSkylightStyle,
  ZoneRoofConfig,
} from '../types/floorplan';

interface RoofPlannerModalProps {
  zone: FloorplanZone;
  entities: Record<string, HAEntityState>;
  onUpdateZone: (zoneId: string, patch: Partial<FloorplanZone>) => void;
  onClose: () => void;
  initialTab?: 'dormers' | 'pv' | 'skylights_chimneys';
}

export const RoofPlannerModal: React.FC<RoofPlannerModalProps> = ({
  zone,
  entities,
  onUpdateZone,
  onClose,
  initialTab,
}) => {
  const roofCfg: ZoneRoofConfig = zone.roofConfig || {
    type: 'gable',
    pitchDeg: 35,
    overhang: 0.35,
    gableOverhang: 0.35,
    material: 'anthracite_tile',
    ridgeDirection: 'x',
  };

  const [activeTab, setActiveTab] = useState<'dormers' | 'pv' | 'skylights_chimneys'>(
    initialTab || 'dormers'
  );
  const [blueprintView, setBlueprintView] = useState<'top_plan' | 'elevation_front' | 'elevation_back'>('top_plan');
  const [selectedDormerId, setSelectedDormerId] = useState<string | null>(null);
  const [selectedWindowIndex, setSelectedWindowIndex] = useState<number>(0);
  const [selectedSkylightId, setSelectedSkylightId] = useState<string | null>(null);
  const [selectedChimneyId, setSelectedChimneyId] = useState<string | null>(null);
  const [selectedPvModuleId, setSelectedPvModuleId] = useState<string | null>(null);

  const svgRef = useRef<SVGSVGElement | null>(null);

  const ridgeAlongX = (roofCfg.ridgeDirection || 'x') === 'x';
  const wallLen = Math.max(2.0, ridgeAlongX ? zone.width : zone.depth);
  const wallSpan = Math.max(2.0, ridgeAlongX ? zone.depth : zone.width);
  const eavesOverhang = roofCfg.overhang ?? 0.35;
  const gableOverhang = roofCfg.gableOverhang ?? eavesOverhang;
  const totalRidgeLen = wallLen + gableOverhang * 2;
  const totalSpan = wallSpan + eavesOverhang * 2;
  const halfRidge = wallLen / 2;
  const halfSpan = totalSpan / 2;

  const pitchDeg = roofCfg.pitchDeg ?? 35;
  const pitchRad = (pitchDeg * Math.PI) / 180;
  const kniestockH = roofCfg.type === 'flat' ? 0 : (roofCfg.kniestockHeight ?? 0.75);
  const ridgeH =
    roofCfg.type === 'flat'
      ? 0.25
      : Math.min(6.8, Math.max(1.2, halfSpan * Math.tan(pitchRad)));

  const dormersList = useMemo(
    () => (roofCfg.type !== 'flat' ? getEffectiveRoofDormers(roofCfg, wallLen) : []),
    [roofCfg, wallLen]
  );
  const skylightsList = roofCfg.skylights || [];
  const chimneysList = roofCfg.chimneys || [];
  const pvModulesList = roofCfg.pvConfig?.modules || [];

  const activeDormer =
    dormersList.find((d) => d.id === selectedDormerId) || dormersList[0] || null;
  const activeSkylight =
    skylightsList.find((s) => s.id === selectedSkylightId) || skylightsList[0] || null;
  const activeChimney =
    chimneysList.find((c) => c.id === selectedChimneyId) || chimneysList[0] || null;
  const activePvModule =
    pvModulesList.find((m) => m.id === selectedPvModuleId) || pvModulesList[0] || null;

  const updateRoofCfg = (patch: Partial<ZoneRoofConfig>) => {
    onUpdateZone(zone.id, {
      roofConfig: {
        ...roofCfg,
        ...patch,
      },
    });
  };

  const commitDormers = (nextDormers: RoofDormerItem[]) => {
    updateRoofCfg({
      dormers: nextDormers,
      dormerType: nextDormers.length > 0 ? nextDormers[0].type : 'none',
    });
  };

  const addDormer = (side: 'front' | 'back' = 'front') => {
    const base = [...dormersList];
    const newItem: RoofDormerItem = {
      id: `dormer_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
      name: `Gaube ${base.length + 1}`,
      type: 'gable',
      side,
      offsetAlongRidge: 0,
      width: 1.8,
      height: 1.35,
      sillHeight: 0.28,
      eavesSetback: 0.35,
      windowCount: 2,
      windowStyle: 'mullion_cross',
      windowFrameColor: 'anthracite',
      windowOpenState: 'closed',
      windows: [
        {
          id: `dwin_${Date.now()}_1`,
          sashCount: 1,
          hingeSide: 'left',
          windowStyle: 'mullion_cross',
          windowFrameColor: 'anthracite',
          windowOpenState: 'closed',
          hasShutter: false,
          shutterClosedPct: 0,
        },
        {
          id: `dwin_${Date.now()}_2`,
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
    commitDormers([...base, newItem]);
    setSelectedDormerId(newItem.id);
    setSelectedWindowIndex(0);
    setActiveTab('dormers');
  };

  const addSkylight = (isSweepHatch = false) => {
    const base = [...skylightsList];
    const newSky: RoofSkylightItem = {
      id: `skylight_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
      name: isSweepHatch
        ? `Ausstiegsluke ${base.length + 1}`
        : `Dachfenster ${base.length + 1}`,
      style: isSweepHatch ? 'chimney_sweep_hatch' : 'velux_pivot',
      side: base.length % 2 === 0 ? 'front' : 'back',
      offsetAlongRidge: 0,
      slopePosition: isSweepHatch ? 0.28 : 0.5,
      width: isSweepHatch ? 0.55 : 1.14,
      length: isSweepHatch ? 0.65 : 1.4,
      frameColor: 'anthracite',
      openState: 'closed',
      hasShutter: false,
      shutterClosedPct: 0,
    };
    updateRoofCfg({ skylights: [...base, newSky] });
    setSelectedSkylightId(newSky.id);
    setActiveTab('skylights_chimneys');
  };

  const addChimney = () => {
    const base = [...chimneysList];
    const newChim: RoofChimneyItem = {
      id: `chimney_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
      name: `Schornstein ${base.length + 1}`,
      style: 'brick_classic',
      offsetX: +(wallLen * 0.2).toFixed(2),
      offsetZ: -0.35,
      width: 0.6,
      height: 1.45,
    };
    updateRoofCfg({ chimneys: [...base, newChim] });
    setSelectedChimneyId(newChim.id);
    setActiveTab('skylights_chimneys');
  };

  const allEntities = useMemo(() => Object.values(entities), [entities]);
  const binaryContactEntities = useMemo(
    () =>
      allEntities.filter(
        (ent) =>
          ent.domain === 'binary_sensor' ||
          ent.entity_id.startsWith('binary_sensor.') ||
          ent.entity_id.startsWith('sensor.')
      ),
    [allEntities]
  );
  const coverEntities = useMemo(
    () =>
      allEntities.filter(
        (ent) => ent.domain === 'cover' || ent.entity_id.startsWith('cover.')
      ),
    [allEntities]
  );
  const pvSensorEntities = useMemo(
    () =>
      allEntities.filter(
        (ent) =>
          ent.domain === 'sensor' ||
          ent.entity_id.toLowerCase().includes('pv') ||
          ent.entity_id.toLowerCase().includes('solar') ||
          ent.entity_id.toLowerCase().includes('power')
      ),
    [allEntities]
  );

  // Dragging handler on the 2D SVG blueprint
  const startDragItem = (
    kind: 'dormer' | 'skylight' | 'chimney',
    itemId: string,
    e: React.PointerEvent
  ) => {
    e.stopPropagation();
    const svgEl = svgRef.current;
    if (!svgEl) return;

    const startClientX = e.clientX;
    const startClientY = e.clientY;
    const rect = svgEl.getBoundingClientRect();
    const metersPerPxX = (totalRidgeLen * 1.18) / Math.max(100, rect.width);
    const metersPerPxY = (totalSpan * 1.25) / Math.max(100, rect.height);

    const origDormer = dormersList.find((d) => d.id === itemId);
    const origSkylight = skylightsList.find((s) => s.id === itemId);
    const origChimney = chimneysList.find((c) => c.id === itemId);

    const origX =
      kind === 'dormer'
        ? origDormer?.offsetAlongRidge ?? 0
        : kind === 'skylight'
        ? origSkylight?.offsetAlongRidge ?? 0
        : origChimney?.offsetX ?? 0;

    const origSlopePos = origSkylight?.slopePosition ?? 0.5;
    const origEavesSetback = origDormer?.eavesSetback ?? 0.35;
    const origChimneyZ = origChimney?.offsetZ ?? 0;

    const onMove = (ev: PointerEvent) => {
      const dxM = (ev.clientX - startClientX) * metersPerPxX;
      const dyM = (ev.clientY - startClientY) * metersPerPxY;

      if (kind === 'dormer' && origDormer) {
        const maxOff = Math.max(0.2, halfRidge - origDormer.width / 2 - 0.15);
        const nextOff = Number(
          Math.max(-maxOff, Math.min(maxOff, origX + dxM)).toFixed(2)
        );
        let nextSetback = origEavesSetback;
        if (blueprintView === 'top_plan') {
          const zDir = origDormer.side === 'back' ? -1 : 1;
          nextSetback = Number(
            Math.max(
              0.05,
              Math.min(wallSpan * 0.34, origEavesSetback - dyM * zDir)
            ).toFixed(2)
          );
        }
        commitDormers(
          dormersList.map((d) =>
            d.id === itemId
              ? { ...d, offsetAlongRidge: nextOff, eavesSetback: nextSetback }
              : d
          )
        );
      } else if (kind === 'skylight' && origSkylight) {
        const maxOff = Math.max(0.2, halfRidge - origSkylight.width / 2 - 0.15);
        const nextOff = Number(
          Math.max(-maxOff, Math.min(maxOff, origX + dxM)).toFixed(2)
        );
        let nextSlopePos = origSlopePos;
        if (blueprintView === 'top_plan') {
          const zDir = origSkylight.side === 'back' ? -1 : 1;
          nextSlopePos = Number(
            Math.max(
              0.2,
              Math.min(0.82, origSlopePos + (dyM * zDir) / Math.max(0.8, halfSpan))
            ).toFixed(2)
          );
        } else {
          nextSlopePos = Number(
            Math.max(
              0.2,
              Math.min(0.82, origSlopePos + dyM / Math.max(0.8, ridgeH))
            ).toFixed(2)
          );
        }
        updateRoofCfg({
          skylights: skylightsList.map((s) =>
            s.id === itemId
              ? { ...s, offsetAlongRidge: nextOff, slopePosition: nextSlopePos }
              : s
          ),
        });
      } else if (kind === 'chimney' && origChimney) {
        const maxOffX = Math.max(0.2, halfRidge - 0.3);
        const maxOffZ = Math.max(0.2, wallSpan / 2 - 0.3);
        const nextX = Number(
          Math.max(-maxOffX, Math.min(maxOffX, origX + dxM)).toFixed(2)
        );
        const nextZ =
          blueprintView === 'top_plan'
            ? Number(
                Math.max(-maxOffZ, Math.min(maxOffZ, origChimneyZ + dyM)).toFixed(2)
              )
            : origChimneyZ;
        updateRoofCfg({
          chimneys: chimneysList.map((c) =>
            c.id === itemId ? { ...c, offsetX: nextX, offsetZ: nextZ } : c
          ),
        });
      }
    };

    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  const getPvSideConfig = (sideId: RoofPVSideId) => {
    const pv = roofCfg.pvConfig;
    if (pv?.perSide && pv.perSide[sideId] !== undefined) {
      return pv.perSide[sideId]!;
    }
    const defaultEnabled =
      sideId === 'front'
        ? pv?.sides !== 'back'
        : sideId === 'back'
        ? pv?.sides === 'back' || pv?.sides === 'both'
        : false;
    return {
      enabled: defaultEnabled,
      moduleCount: pv?.moduleCount,
      coveragePct: pv?.coveragePct ?? 75,
    };
  };

  const updatePvSideConfig = (
    sideId: RoofPVSideId,
    patch: { enabled?: boolean; moduleCount?: number; coveragePct?: number }
  ) => {
    const curPv = roofCfg.pvConfig || { enabled: true, sides: 'per_side', kwPeak: 9.6 };
    const sides: RoofPVSideId[] = ['front', 'back', 'left', 'right'];
    const nextPerSide: NonNullable<typeof curPv.perSide> = {};
    for (const sId of sides) {
      const cur = getPvSideConfig(sId);
      nextPerSide[sId] = sId === sideId ? { ...cur, ...patch } : cur;
    }
    updateRoofCfg({
      pvConfig: {
        ...curPv,
        enabled: true,
        sides: 'per_side',
        perSide: nextPerSide,
      },
    });
  };

  const commitPvModules = (nextModules: RoofPVModuleItem[]) => {
    const curPv = roofCfg.pvConfig || { enabled: true, sides: 'per_side', kwPeak: 9.6 };
    updateRoofCfg({
      pvConfig: {
        ...curPv,
        enabled: true,
        modules: nextModules,
        kwPeak: Number((Math.max(1, nextModules.length) * 0.44).toFixed(2)),
      },
    });
  };

  const addSinglePvModule = (side: RoofPVSideId = 'front', orientation: 'portrait' | 'landscape' = 'portrait') => {
    const base = [...pvModulesList];
    const idx = base.filter((m) => m.side === side).length;
    const col = idx % 6;
    const row = Math.floor(idx / 6);
    const newMod: RoofPVModuleItem = {
      id: `pvmod_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
      side,
      offsetX: Number(Math.max(-halfRidge + 0.8, Math.min(halfRidge - 0.8, -2.5 + col * 1.16)).toFixed(2)),
      slopeOffset: Number(Math.min(0.82, 0.32 + row * 0.36).toFixed(2)),
      orientation,
    };
    commitPvModules([...base, newMod]);
    setSelectedPvModuleId(newMod.id);
    setActiveTab('pv');
    setBlueprintView('top_plan');
  };

  // Compute simulated PV modules in Top-Down view with automatic keep-out around Dormers & Skylights
  const pvSimulation = useMemo(() => {
    const pv = roofCfg.pvConfig;
    if (!pv?.enabled) return { frontRects: [], backRects: [], allItems: [] as (RoofPVModuleItem & { x: number; z: number; w: number; d: number; isCustom: boolean })[], totalModules: 0 };

    const modWPortrait = 1.08;
    const modHPortrait = 1.62;

    if (pv.modules && pv.modules.length > 0) {
      const customRects = pv.modules.map((m) => {
        const isLand = m.orientation === 'landscape';
        const w = isLand ? 1.68 : modWPortrait;
        const d = (isLand ? 1.08 : modHPortrait) * 0.76;
        const zSign = m.side === 'back' ? -1 : 1;
        const cz = zSign * Math.max(0.25, Math.min(halfSpan - 0.25, m.slopeOffset * halfSpan));
        return {
          ...m,
          x: m.offsetX,
          z: cz,
          w,
          d,
          isCustom: true,
        };
      });
      const frontRects = customRects.filter((r) => r.side !== 'back');
      const backRects = customRects.filter((r) => r.side === 'back');
      return {
        frontRects,
        backRects,
        allItems: customRects,
        totalModules: customRects.length,
      };
    }

    const frontCfg = getPvSideConfig('front');
    const backCfg = getPvSideConfig('back');

    const modW = modWPortrait;
    const modH = modHPortrait;
    const gapX = 0.06;
    const gapY = 0.08;

    const buildSlopeModules = (
      side: 'front' | 'back',
      enabled: boolean,
      targetCount?: number,
      covPct?: number
    ) => {
      if (!enabled) return [];
      const zSign = side === 'front' ? 1 : -1;
      const cov = (covPct ?? pv.coveragePct ?? 75) / 100;
      const maxCols = Math.max(
        1,
        Math.floor(((totalRidgeLen - 0.8) * Math.sqrt(cov)) / (modW + gapX))
      );
      const maxRows = Math.max(
        1,
        Math.floor(((halfSpan - 0.5) * Math.sqrt(cov)) / (modH * 0.78 + gapY))
      );

      const candidates: (RoofPVModuleItem & { x: number; z: number; w: number; d: number; isCustom: boolean })[] = [];
      const gridW = maxCols * modW + (maxCols - 1) * gapX;

      for (let r = 0; r < maxRows; r++) {
        for (let c = 0; c < maxCols; c++) {
          const cx = -gridW / 2 + modW / 2 + c * (modW + gapX);
          const distFromRidge = 0.35 + (modH * 0.78) / 2 + r * (modH * 0.78 + gapY);
          const cz = zSign * Math.min(halfSpan - 0.35, distFromRidge);

          // Check keep-out against dormers on this slope
          const hitsDormer = dormersList.some((d) => {
            if (d.side !== side) return false;
            const dFrontZ = wallSpan / 2 - (d.eavesSetback ?? 0.35);
            const dBackZ = Math.max(0.1, dFrontZ - 1.5);
            const inX = Math.abs(cx - d.offsetAlongRidge) < d.width / 2 + modW / 2 + 0.12;
            const inZ = Math.abs(cz) >= dBackZ - 0.35 && Math.abs(cz) <= dFrontZ + 0.35;
            return inX && inZ;
          });
          if (hitsDormer) continue;

          // Check keep-out against skylights on this slope
          const hitsSkylight = skylightsList.some((s) => {
            if (s.side !== side) return false;
            const sZ = (s.slopePosition ?? 0.5) * halfSpan;
            const inX = Math.abs(cx - s.offsetAlongRidge) < s.width / 2 + modW / 2 + 0.1;
            const inZ = Math.abs(Math.abs(cz) - sZ) < s.length / 2 + (modH * 0.78) / 2 + 0.1;
            return inX && inZ;
          });
          if (hitsSkylight) continue;

          candidates.push({
            id: `autogen_${side}_${r}_${c}`,
            side,
            offsetX: Number(cx.toFixed(2)),
            slopeOffset: Number(Math.min(0.86, Math.max(0.18, Math.abs(cz) / Math.max(0.8, halfSpan))).toFixed(2)),
            orientation: 'portrait',
            x: cx,
            z: cz,
            w: modW,
            d: modH * 0.76,
            isCustom: false,
          });
        }
      }

      if (targetCount && targetCount > 0) {
        return candidates.slice(0, targetCount);
      }
      return candidates;
    };

    const frontRects = buildSlopeModules(
      'front',
      frontCfg.enabled,
      frontCfg.moduleCount,
      frontCfg.coveragePct
    );
    const backRects = buildSlopeModules(
      'back',
      backCfg.enabled,
      backCfg.moduleCount,
      backCfg.coveragePct
    );
    const allItems = [...backRects, ...frontRects];
    return {
      frontRects,
      backRects,
      allItems,
      totalModules: allItems.length,
    };
  }, [roofCfg.pvConfig, totalRidgeLen, halfSpan, wallSpan, dormersList, skylightsList]);

  const convertGridToIndividualModules = (): RoofPVModuleItem[] => {
    const items: RoofPVModuleItem[] = pvSimulation.allItems.map((it, idx) => ({
      id: it.isCustom ? it.id : `pvmod_${Date.now()}_${idx}`,
      side: it.side,
      offsetX: Number(it.offsetX.toFixed(2)),
      slopeOffset: Number(it.slopeOffset.toFixed(2)),
      orientation: it.orientation || 'portrait',
    }));
    commitPvModules(items);
    if (items[0]) setSelectedPvModuleId(items[0].id);
    return items;
  };

  const startDragPvModule = (modItem: RoofPVModuleItem & { x: number; z: number; isCustom: boolean }, e: React.PointerEvent) => {
    e.stopPropagation();
    const svgEl = svgRef.current;
    if (!svgEl) return;

    let workingList = pvModulesList;
    let targetId = modItem.id;
    if (!modItem.isCustom || workingList.length === 0) {
      workingList = pvSimulation.allItems.map((it, idx) => ({
        id: it.id === modItem.id ? `pvmod_sel_${Date.now()}` : `pvmod_${Date.now()}_${idx}`,
        side: it.side,
        offsetX: Number(it.offsetX.toFixed(2)),
        slopeOffset: Number(it.slopeOffset.toFixed(2)),
        orientation: it.orientation || 'portrait',
      }));
      const found = workingList.find((w) => w.id.startsWith('pvmod_sel_'));
      if (found) targetId = found.id;
      commitPvModules(workingList);
    }
    setSelectedPvModuleId(targetId);
    setActiveTab('pv');

    const origMod = workingList.find((m) => m.id === targetId);
    if (!origMod) return;

    const startClientX = e.clientX;
    const startClientY = e.clientY;
    const rect = svgEl.getBoundingClientRect();
    const metersPerPxX = (totalRidgeLen * 1.18) / Math.max(100, rect.width);
    const metersPerPxY = (totalSpan * 1.25) / Math.max(100, rect.height);
    const origX = origMod.offsetX;
    const origZ = (origMod.side === 'back' ? -1 : 1) * origMod.slopeOffset * halfSpan;

    const onMove = (ev: PointerEvent) => {
      const dxM = (ev.clientX - startClientX) * metersPerPxX;
      const dyM = (ev.clientY - startClientY) * metersPerPxY;
      const maxX = Math.max(0.3, totalRidgeLen / 2 - 0.55);
      const nextX = Number(Math.max(-maxX, Math.min(maxX, origX + dxM)).toFixed(2));
      const rawZ = origZ + dyM;
      const nextSide: RoofPVSideId =
        roofCfg.type === 'mono_pitch' ? 'front' : rawZ < 0 ? 'back' : 'front';
      const nextSlopeOffset = Number(
        Math.max(0.16, Math.min(0.86, Math.abs(rawZ) / Math.max(0.8, halfSpan))).toFixed(2)
      );

      workingList = workingList.map((m) =>
        m.id === targetId
          ? { ...m, side: nextSide, offsetX: nextX, slopeOffset: nextSlopeOffset }
          : m
      );
      commitPvModules(workingList);
    };

    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  // SVG Coordinate System
  const svgW = 860;
  const svgH = 380;

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-2 sm:p-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[96vw] xl:max-w-[1440px] h-[92vh] rounded-2xl bg-slate-950 border border-white/15 shadow-2xl text-slate-100 flex flex-col overflow-hidden"
      >
        {/* Modal Top Header */}
        <div className="px-4 py-3 border-b border-white/10 bg-slate-900/90 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-400/40 flex items-center justify-center text-amber-300">
              <Home className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
                <span>Dach-, Dachgauben-, PV- & Dachfenster-Planer</span>
                <span className="px-2 py-0.5 rounded-md bg-sky-500/20 border border-sky-400/30 text-[11px] font-mono text-sky-300">
                  {zone.name} · {wallLen.toFixed(1)}×{wallSpan.toFixed(1)}m
                </span>
              </h2>
              <p className="text-[11px] text-slate-400">
                Gauben, Gaubenfenster (inkl. Rollläden & Home Assistant Entitäten), PV-Modulfelder und Dachfenster visuell planen · Raum- & Kniestockwände wachsen automatisch bis in die Gaube
              </p>
            </div>
          </div>

          {/* Primary Tab Switcher */}
          <div className="flex items-center gap-1.5 bg-slate-950 p-1 rounded-xl border border-white/10">
            <button
              type="button"
              onClick={() => setActiveTab('dormers')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                activeTab === 'dormers'
                  ? 'bg-amber-400 text-slate-950 shadow'
                  : 'text-slate-300 hover:text-white hover:bg-slate-900'
              }`}
            >
              <span>🏠 Dachgauben ({dormersList.length})</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveTab('pv');
                setBlueprintView('top_plan');
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                activeTab === 'pv'
                  ? 'bg-emerald-400 text-slate-950 shadow'
                  : 'text-slate-300 hover:text-white hover:bg-slate-900'
              }`}
            >
              <Sun className="w-3.5 h-3.5" />
              <span>
                PV-Anlage ({roofCfg.pvConfig?.enabled ? `${pvSimulation.totalModules} Mod.` : 'Aus'})
              </span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('skylights_chimneys')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                activeTab === 'skylights_chimneys'
                  ? 'bg-sky-400 text-slate-950 shadow'
                  : 'text-slate-300 hover:text-white hover:bg-slate-900'
              }`}
            >
              <span>
                🪟 Dachfenster ({skylightsList.length}) & Kamin ({chimneysList.length})
              </span>
            </button>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-200 flex items-center gap-1.5 border border-white/10"
          >
            <X className="w-4 h-4" />
            <span>Fertig & Schließen</span>
          </button>
        </div>

        {/* Main Split Content: Left Interactive 2D Roof Blueprint + Right Detail Inspector */}
        <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-12 overflow-hidden">
          {/* LEFT 7 COLS: Interactive 2D Roof Blueprint (Top-Down Plan OR Elevation View) */}
          <div className="lg:col-span-7 flex flex-col border-b lg:border-b-0 lg:border-r border-white/10 bg-[#070b14] min-h-[300px]">
            {/* Blueprint View Mode Bar */}
            <div className="px-4 py-2.5 border-b border-white/10 bg-slate-900/60 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setBlueprintView('top_plan')}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-colors ${
                    blueprintView === 'top_plan'
                      ? 'bg-sky-400 text-slate-950'
                      : 'bg-slate-900 text-slate-300 hover:bg-slate-800 border border-white/10'
                  }`}
                >
                  📐 Draufsicht (Dachflächen, PV & Gauben)
                </button>
                <button
                  type="button"
                  onClick={() => setBlueprintView('elevation_front')}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-colors ${
                    blueprintView === 'elevation_front'
                      ? 'bg-amber-400 text-slate-950'
                      : 'bg-slate-900 text-slate-300 hover:bg-slate-800 border border-white/10'
                  }`}
                >
                  🏠 Aufriss Vorderseite ({ridgeAlongX ? 'Süd' : 'Ost'})
                </button>
                <button
                  type="button"
                  onClick={() => setBlueprintView('elevation_back')}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-colors ${
                    blueprintView === 'elevation_back'
                      ? 'bg-amber-400 text-slate-950'
                      : 'bg-slate-900 text-slate-300 hover:bg-slate-800 border border-white/10'
                  }`}
                >
                  🏠 Aufriss Rückseite ({ridgeAlongX ? 'Nord' : 'West'})
                </button>
              </div>

              {/* Quick Add Action Buttons */}
              <div className="flex items-center gap-1.5 flex-wrap">
                <button
                  type="button"
                  onClick={() => addSinglePvModule('front', 'portrait')}
                  className="px-2.5 py-1 rounded-lg bg-emerald-400 hover:bg-emerald-300 text-slate-950 text-[11px] font-bold flex items-center gap-1 shadow"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>+ PV-Modul</span>
                </button>
                {roofCfg.type !== 'flat' && (
                  <button
                    type="button"
                    onClick={() =>
                      addDormer(blueprintView === 'elevation_back' ? 'back' : 'front')
                    }
                    className="px-2.5 py-1 rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 text-[11px] font-bold flex items-center gap-1 shadow"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>+ Dachgaube</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => addSkylight(false)}
                  className="px-2.5 py-1 rounded-lg bg-sky-400 hover:bg-sky-300 text-slate-950 text-[11px] font-bold flex items-center gap-1 shadow"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>+ Dachfenster</span>
                </button>
                <button
                  type="button"
                  onClick={addChimney}
                  className="px-2.5 py-1 rounded-lg bg-orange-400 hover:bg-orange-300 text-slate-950 text-[11px] font-bold flex items-center gap-1 shadow"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>+ Schornstein</span>
                </button>
              </div>
            </div>

            {/* Interactive SVG Canvas */}
            <div className="flex-1 relative flex items-center justify-center p-3 overflow-hidden select-none">
              {blueprintView === 'top_plan' ? (
                (() => {
                  const scale = Math.min(
                    (svgW - 110) / Math.max(4, totalRidgeLen),
                    (svgH - 80) / Math.max(4, totalSpan)
                  );
                  const cx = svgW / 2;
                  const cy = svgH / 2;
                  const rW = totalRidgeLen * scale;
                  const rD = totalSpan * scale;
                  const wallW = wallLen * scale;
                  const wallD = wallSpan * scale;

                  return (
                    <svg
                      ref={svgRef}
                      viewBox={`0 0 ${svgW} ${svgH}`}
                      className="w-full h-full max-h-[520px] rounded-xl bg-[#0b1220] border border-white/10 shadow-inner"
                    >
                      <defs>
                        <pattern
                          id="roofTileGrid"
                          width="18"
                          height="12"
                          patternUnits="userSpaceOnUse"
                        >
                          <path
                            d="M 18 0 L 0 0 0 12"
                            fill="none"
                            stroke="rgba(148,163,184,0.10)"
                            strokeWidth="1"
                          />
                        </pattern>
                      </defs>

                      {/* Outer Roof Footprint (incl. Overhangs) */}
                      <rect
                        x={cx - rW / 2}
                        y={cy - rD / 2}
                        width={rW}
                        height={rD}
                        rx={6}
                        fill="#1e293b"
                        stroke="#64748b"
                        strokeWidth={2}
                      />
                      <rect
                        x={cx - rW / 2}
                        y={cy - rD / 2}
                        width={rW}
                        height={rD}
                        fill="url(#roofTileGrid)"
                      />

                      {/* Dashed Building Wall Footprint inside Overhang */}
                      <rect
                        x={cx - wallW / 2}
                        y={cy - wallD / 2}
                        width={wallW}
                        height={wallD}
                        fill="none"
                        stroke="rgba(56,189,248,0.45)"
                        strokeWidth={1.5}
                        strokeDasharray="6 4"
                      />

                      {/* Ridge Line (Firstlinie) */}
                      {roofCfg.type !== 'flat' && roofCfg.type !== 'mono_pitch' && (
                        <line
                          x1={cx - rW / 2}
                          y1={cy}
                          x2={cx + rW / 2}
                          y2={cy}
                          stroke="#f59e0b"
                          strokeWidth={2.5}
                        />
                      )}

                      {/* Slope Direction Labels */}
                      <text
                        x={cx}
                        y={cy - rD / 2 - 10}
                        textAnchor="middle"
                        fill="#94a3b8"
                        fontSize="11"
                        fontWeight="bold"
                      >
                        RÜCKSEITE ({ridgeAlongX ? 'Nord-Dachfläche' : 'West-Dachfläche'}) ·{' '}
                        {totalRidgeLen.toFixed(2)}m Firstlänge
                      </text>
                      <text
                        x={cx}
                        y={cy + rD / 2 + 18}
                        textAnchor="middle"
                        fill="#94a3b8"
                        fontSize="11"
                        fontWeight="bold"
                      >
                        VORDERSEITE ({ridgeAlongX ? 'Süd-Dachfläche' : 'Ost-Dachfläche'}) ·{' '}
                        Traufüberstand {(roofCfg.overhang ?? 0.35).toFixed(2)}m
                      </text>

                      {/* PV Solar Modules Preview & Interactive Single-Module Drag & Drop */}
                      {pvSimulation.allItems.map((mod, mIdx) => {
                        const mx = cx + mod.x * scale - (mod.w * scale) / 2;
                        const my = cy + mod.z * scale - (mod.d * scale) / 2;
                        const mw = mod.w * scale;
                        const md = mod.d * scale;
                        const isSel =
                          activeTab === 'pv' &&
                          mod.isCustom &&
                          activePvModule?.id === mod.id;
                        return (
                          <g
                            key={mod.id || `pv_${mIdx}`}
                            onPointerDown={(e) => startDragPvModule(mod, e)}
                            className="cursor-grab active:cursor-grabbing"
                          >
                            <rect
                              x={mx}
                              y={my}
                              width={mw}
                              height={md}
                              rx={2}
                              fill={
                                isSel
                                  ? 'rgba(16, 185, 129, 0.65)'
                                  : mod.isCustom
                                  ? 'rgba(16, 185, 129, 0.45)'
                                  : 'rgba(16, 185, 129, 0.30)'
                              }
                              stroke={isSel ? '#fde047' : '#34d399'}
                              strokeWidth={isSel ? 2.4 : 1.2}
                            />
                            <line
                              x1={mx + mw / 2}
                              y1={my}
                              x2={mx + mw / 2}
                              y2={my + md}
                              stroke="rgba(52,211,153,0.4)"
                              strokeWidth={0.8}
                            />
                            <line
                              x1={mx}
                              y1={my + md / 2}
                              x2={mx + mw}
                              y2={my + md / 2}
                              stroke="rgba(52,211,153,0.3)"
                              strokeWidth={0.8}
                            />
                            {mod.isCustom && (
                              <text
                                x={mx + mw / 2}
                                y={my + md / 2 + 3}
                                textAnchor="middle"
                                fill={isSel ? '#fef08a' : '#d1fae5'}
                                fontSize="8.5"
                                fontWeight="bold"
                              >
                                #{mIdx + 1}
                              </text>
                            )}
                          </g>
                        );
                      })}

                      {/* Roof Dormers (Dachgauben) in Top-Down View */}
                      {dormersList.map((d, idx) => {
                        const zSign = d.side === 'back' ? -1 : 1;
                        const zFrontAbs = wallSpan / 2 - (d.eavesSetback ?? 0.35);
                        const dDepth = Math.min(zFrontAbs - 0.1, 1.55);
                        const zCenter = zSign * (zFrontAbs - dDepth / 2);
                        const dx = cx + d.offsetAlongRidge * scale - (d.width * scale) / 2;
                        const dy = cy + zCenter * scale - (dDepth * scale) / 2;
                        const dw = d.width * scale;
                        const dd = dDepth * scale;
                        const isSel = activeDormer?.id === d.id && activeTab === 'dormers';

                        return (
                          <g
                            key={d.id}
                            onPointerDown={(e) => {
                              setSelectedDormerId(d.id);
                              setActiveTab('dormers');
                              startDragItem('dormer', d.id, e);
                            }}
                            className="cursor-grab active:cursor-grabbing"
                          >
                            <rect
                              x={dx}
                              y={dy}
                              width={dw}
                              height={dd}
                              rx={4}
                              fill={isSel ? 'rgba(245, 158, 11, 0.38)' : 'rgba(51, 65, 85, 0.92)'}
                              stroke={isSel ? '#fbbf24' : '#cbd5e1'}
                              strokeWidth={isSel ? 2.5 : 1.5}
                            />
                            <line
                              x1={dx + dw / 2}
                              y1={dy}
                              x2={dx + dw / 2}
                              y2={dy + dd}
                              stroke="#fbbf24"
                              strokeWidth={1.2}
                              strokeDasharray="3 2"
                            />
                            <text
                              x={dx + dw / 2}
                              y={dy + dd / 2 + 4}
                              textAnchor="middle"
                              fill="#fef08a"
                              fontSize="10"
                              fontWeight="bold"
                            >
                              {d.name || `Gaube #${idx + 1}`} ({d.width.toFixed(2)}m)
                            </text>
                          </g>
                        );
                      })}

                      {/* Skylights (Dachfenster) in Top-Down View */}
                      {skylightsList.map((s, idx) => {
                        const zSign = s.side === 'back' ? -1 : 1;
                        const sZ = zSign * ((s.slopePosition ?? 0.5) * halfSpan);
                        const sx = cx + s.offsetAlongRidge * scale - (s.width * scale) / 2;
                        const sy = cy + sZ * scale - (s.length * scale * 0.75) / 2;
                        const sw = s.width * scale;
                        const sl = s.length * scale * 0.75;
                        const isSel =
                          activeSkylight?.id === s.id && activeTab === 'skylights_chimneys';

                        return (
                          <g
                            key={s.id}
                            onPointerDown={(e) => {
                              setSelectedSkylightId(s.id);
                              setActiveTab('skylights_chimneys');
                              startDragItem('skylight', s.id, e);
                            }}
                            className="cursor-grab active:cursor-grabbing"
                          >
                            <rect
                              x={sx}
                              y={sy}
                              width={sw}
                              height={sl}
                              rx={3}
                              fill="rgba(56, 189, 248, 0.42)"
                              stroke={isSel ? '#38bdf8' : '#e0f2fe'}
                              strokeWidth={isSel ? 2.5 : 1.5}
                            />
                            <text
                              x={sx + sw / 2}
                              y={sy + sl / 2 + 3}
                              textAnchor="middle"
                              fill="#e0f2fe"
                              fontSize="9.5"
                              fontWeight="bold"
                            >
                              🪟 #{idx + 1}
                            </text>
                          </g>
                        );
                      })}

                      {/* Chimneys (Schornsteine) in Top-Down View */}
                      {chimneysList.map((c, idx) => {
                        const chX = cx + c.offsetX * scale - (c.width * scale) / 2;
                        const chY = cy + c.offsetZ * scale - (c.width * scale) / 2;
                        const chW = Math.max(16, c.width * scale);
                        const chD = Math.max(16, c.width * scale);
                        const isSel =
                          activeChimney?.id === c.id && activeTab === 'skylights_chimneys';

                        return (
                          <g
                            key={c.id}
                            onPointerDown={(e) => {
                              setSelectedChimneyId(c.id);
                              setActiveTab('skylights_chimneys');
                              startDragItem('chimney', c.id, e);
                            }}
                            className="cursor-grab active:cursor-grabbing"
                          >
                            <rect
                              x={chX}
                              y={chY}
                              width={chW}
                              height={chD}
                              rx={3}
                              fill="#9a3412"
                              stroke={isSel ? '#fb923c' : '#fed7aa'}
                              strokeWidth={isSel ? 2.5 : 1.5}
                            />
                            <circle
                              cx={chX + chW / 2}
                              cy={chY + chD / 2}
                              r={Math.min(chW, chD) * 0.25}
                              fill="#1e293b"
                            />
                            <text
                              x={chX + chW / 2}
                              y={chY - 4}
                              textAnchor="middle"
                              fill="#fdba74"
                              fontSize="9"
                              fontWeight="bold"
                            >
                              Kamin #{idx + 1}
                            </text>
                          </g>
                        );
                      })}
                    </svg>
                  );
                })()
              ) : (
                /* ELEVATION VIEW (Vorderseite / Rückseite mit Dachschräge, Kniestock & Gaubenfenstern) */
                (() => {
                  const viewSide: 'front' | 'back' =
                    blueprintView === 'elevation_back' ? 'back' : 'front';
                  const totalElevH = kniestockH + ridgeH + 0.8;
                  const scale = Math.min(
                    (svgW - 110) / Math.max(4, totalRidgeLen),
                    (svgH - 90) / Math.max(2.6, totalElevH)
                  );
                  const cx = svgW / 2;
                  const baseY = svgH - 42;
                  const eavesY = baseY - kniestockH * scale;
                  const ridgeY = eavesY - ridgeH * scale;
                  const rW = totalRidgeLen * scale;
                  const wallW = wallLen * scale;

                  const sideDormers = dormersList.filter((d) => d.side === viewSide);
                  const sideSkylights = skylightsList.filter((s) => s.side === viewSide);

                  return (
                    <svg
                      ref={svgRef}
                      viewBox={`0 0 ${svgW} ${svgH}`}
                      className="w-full h-full max-h-[520px] rounded-xl bg-[#0b1220] border border-white/10 shadow-inner"
                    >
                      <line
                        x1={cx - rW / 2 - 25}
                        y1={baseY}
                        x2={cx + rW / 2 + 25}
                        y2={baseY}
                        stroke="#475569"
                        strokeWidth={2}
                      />

                      {kniestockH > 0.02 && (
                        <rect
                          x={cx - wallW / 2}
                          y={eavesY}
                          width={wallW}
                          height={kniestockH * scale}
                          fill="rgba(226, 232, 240, 0.14)"
                          stroke="rgba(148, 163, 184, 0.55)"
                          strokeWidth={1.5}
                        />
                      )}

                      <polygon
                        points={
                          roofCfg.type === 'hipped' || roofCfg.type === 'tent'
                            ? `${cx - rW / 2},${eavesY} ${cx - Math.max(0, (totalRidgeLen - totalSpan) / 2) * scale},${ridgeY} ${cx + Math.max(0, (totalRidgeLen - totalSpan) / 2) * scale},${ridgeY} ${cx + rW / 2},${eavesY}`
                            : `${cx - rW / 2},${eavesY} ${cx - rW / 2},${ridgeY} ${cx + rW / 2},${ridgeY} ${cx + rW / 2},${eavesY}`
                        }
                        fill="#1e293b"
                        stroke="#94a3b8"
                        strokeWidth={2}
                      />

                      <text
                        x={cx}
                        y={ridgeY - 12}
                        textAnchor="middle"
                        fill="#e2e8f0"
                        fontSize="11"
                        fontWeight="bold"
                      >
                        AUFRISS {viewSide === 'front' ? 'VORDERSEITE' : 'RÜCKSEITE'} · Firsthöhe{' '}
                        {(kniestockH + ridgeH).toFixed(2)}m · Kniestock {kniestockH.toFixed(2)}m
                      </text>

                      {/* Skylights on this Slope */}
                      {sideSkylights.map((s) => {
                        const sx = cx + s.offsetAlongRidge * scale - (s.width * scale) / 2;
                        const sy =
                          ridgeY +
                          (s.slopePosition ?? 0.5) * (eavesY - ridgeY) -
                          (s.length * scale * 0.55) / 2;
                        const sw = s.width * scale;
                        const sh = s.length * scale * 0.55;
                        const isSel =
                          activeSkylight?.id === s.id && activeTab === 'skylights_chimneys';

                        return (
                          <g
                            key={s.id}
                            onPointerDown={(e) => {
                              setSelectedSkylightId(s.id);
                              setActiveTab('skylights_chimneys');
                              startDragItem('skylight', s.id, e);
                            }}
                            className="cursor-grab active:cursor-grabbing"
                          >
                            <rect
                              x={sx}
                              y={sy}
                              width={sw}
                              height={sh}
                              rx={3}
                              fill="rgba(56, 189, 248, 0.35)"
                              stroke={isSel ? '#38bdf8' : '#bae6fd'}
                              strokeWidth={isSel ? 2.5 : 1.5}
                            />
                            {s.hasShutter && (s.shutterClosedPct ?? 0) > 0 && (
                              <rect
                                x={sx + 2}
                                y={sy + 2}
                                width={sw - 4}
                                height={((sh - 4) * (s.shutterClosedPct ?? 0)) / 100}
                                fill="rgba(71, 85, 105, 0.88)"
                              />
                            )}
                          </g>
                        );
                      })}

                      {/* Dormers on this Slope with Individual Windows, Shutters & Automatic Wall Extension Preview */}
                      {sideDormers.map((d, dIdx) => {
                        const zWallAbs = wallSpan / 2;
                        const zFrontAbs = Math.max(
                          0.2,
                          zWallAbs - (d.eavesSetback ?? 0.35)
                        );
                        const yBaseM = ridgeH * (1 - zFrontAbs / Math.max(0.2, halfSpan));
                        const dormerBottomY = eavesY - yBaseM * scale;
                        const dw = d.width * scale;
                        const dh = d.height * scale;
                        const dx = cx + d.offsetAlongRidge * scale - dw / 2;
                        const dy = dormerBottomY - dh;
                        const isSel = activeDormer?.id === d.id && activeTab === 'dormers';
                        const winUnits = getEffectiveDormerWindows(d);
                        const sillPx = (d.sillHeight ?? 0.28) * scale;
                        const winAreaW = Math.max(16, dw - 14);
                        const winAreaH = Math.max(14, dh - sillPx - 8);
                        const singleWinW = winAreaW / Math.max(1, winUnits.length);

                        return (
                          <g
                            key={d.id}
                            onPointerDown={(e) => {
                              setSelectedDormerId(d.id);
                              setActiveTab('dormers');
                              startDragItem('dormer', d.id, e);
                            }}
                            className="cursor-grab active:cursor-grabbing"
                          >
                            {/* Automatic Wall / Kniestock Extension indicator below dormer */}
                            <rect
                              x={dx + 2}
                              y={dormerBottomY}
                              width={dw - 4}
                              height={Math.max(0, baseY - dormerBottomY)}
                              fill="rgba(56, 189, 248, 0.08)"
                              stroke="rgba(56, 189, 248, 0.45)"
                              strokeDasharray="4 3"
                            />

                            {d.type === 'gable' ? (
                              <polygon
                                points={`${dx - 5},${dy} ${dx + dw / 2},${dy - Math.min(28, dw * 0.22)} ${dx + dw + 5},${dy}`}
                                fill="#334155"
                                stroke={isSel ? '#fbbf24' : '#94a3b8'}
                                strokeWidth={1.8}
                              />
                            ) : (
                              <rect
                                x={dx - 4}
                                y={dy - 6}
                                width={dw + 8}
                                height={6}
                                fill="#334155"
                                stroke={isSel ? '#fbbf24' : '#94a3b8'}
                                strokeWidth={1.5}
                              />
                            )}

                            <rect
                              x={dx}
                              y={dy}
                              width={dw}
                              height={dh}
                              fill="#e2e8f0"
                              stroke={isSel ? '#fbbf24' : '#64748b'}
                              strokeWidth={isSel ? 2.5 : 1.5}
                            />

                            {winUnits.map((wUnit, wIdx) => {
                              const wx = dx + 7 + wIdx * singleWinW + 2;
                              const wy = dy + 6;
                              const ww = Math.max(8, singleWinW - 4);
                              const wh = winAreaH;
                              const isWinSel = isSel && selectedWindowIndex === wIdx;
                              return (
                                <g
                                  key={wUnit.id || wIdx}
                                  onClick={(ev) => {
                                    ev.stopPropagation();
                                    setSelectedDormerId(d.id);
                                    setSelectedWindowIndex(wIdx);
                                    setActiveTab('dormers');
                                  }}
                                >
                                  <rect
                                    x={wx}
                                    y={wy}
                                    width={ww}
                                    height={wh}
                                    fill="rgba(56, 189, 248, 0.45)"
                                    stroke={isWinSel ? '#f59e0b' : '#1e293b'}
                                    strokeWidth={isWinSel ? 2.2 : 1.4}
                                  />
                                  {wUnit.hasShutter && (wUnit.shutterClosedPct ?? 0) > 0 && (
                                    <rect
                                      x={wx + 1}
                                      y={wy + 1}
                                      width={ww - 2}
                                      height={((wh - 2) * (wUnit.shutterClosedPct ?? 0)) / 100}
                                      fill="rgba(51, 65, 85, 0.9)"
                                    />
                                  )}
                                </g>
                              );
                            })}

                            <text
                              x={dx + dw / 2}
                              y={dormerBottomY + 14}
                              textAnchor="middle"
                              fill="#fbbf24"
                              fontSize="10"
                              fontWeight="bold"
                            >
                              {d.name || `Gaube #${dIdx + 1}`} ({d.width.toFixed(2)}×
                              {d.height.toFixed(2)}m)
                            </text>
                          </g>
                        );
                      })}
                    </svg>
                  );
                })()
              )}
            </div>

            {/* Bottom Help Bar */}
            <div className="px-4 py-2 border-t border-white/10 bg-slate-900/70 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-400">
              <span>
                💡 Tipp: Ziehe Dachgauben, Dachfenster oder Schornsteine direkt mit der Maus auf dem Dach!
              </span>
              <span className="text-sky-300 font-semibold">
                🧱 Raumwände & freie Wände (Kniestock) im 1. OG wachsen unter einer Gaube automatisch bis in die Gaube hoch
              </span>
            </div>
          </div>

          {/* RIGHT 5 COLS: Context-Sensitive Configuration Panel */}
          <div className="lg:col-span-5 flex flex-col min-h-0 bg-slate-950 overflow-y-auto p-4 space-y-4">
            {/* TAB 1: DACHGAUBEN & GAUBENFENSTER */}
            {activeTab === 'dormers' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-xs font-bold text-amber-300 uppercase tracking-wider">
                      🏠 Dachgauben & Gaubenfenster ({dormersList.length})
                    </h3>
                    <p className="text-[11px] text-slate-400">
                      Jede Gaube einzeln positionieren, Fenster, Rollläden & Home Assistant Entitäten zuweisen
                    </p>
                  </div>
                  {roofCfg.type !== 'flat' && (
                    <button
                      type="button"
                      onClick={() => addDormer('front')}
                      className="px-3 py-1.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-bold shadow flex items-center gap-1"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Gaube hinzufügen</span>
                    </button>
                  )}
                </div>

                {roofCfg.type === 'flat' ? (
                  <div className="p-4 rounded-xl bg-slate-900 border border-white/10 text-xs text-slate-400">
                    Bei einem Flachdach sind keine Dachgauben möglich. Wechsle auf den Tab „🪟 Dachfenster“, um Flachdach-Lichtkuppeln zu planen, oder auf „☀️ PV-Anlage“.
                  </div>
                ) : dormersList.length === 0 ? (
                  <div className="p-6 rounded-xl bg-slate-900/70 border border-dashed border-white/15 text-center space-y-2">
                    <div className="text-xs font-semibold text-slate-300">
                      Noch keine Dachgaube auf diesem Dach geplant
                    </div>
                    <p className="text-[11px] text-slate-400">
                      Klicke auf „+ Gaube hinzufügen“, um eine Sattel-, Schlepp-, Kasten- oder Rundbogengaube inkl. Fenstern und Rollläden zu erstellen.
                    </p>
                  </div>
                ) : (
                  <>
                    {/* Dormer Selector Pills */}
                    <div className="flex flex-wrap gap-1.5">
                      {dormersList.map((d, idx) => {
                        const isSel = activeDormer?.id === d.id;
                        return (
                          <button
                            key={d.id}
                            type="button"
                            onClick={() => {
                              setSelectedDormerId(d.id);
                              setSelectedWindowIndex(0);
                            }}
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${
                              isSel
                                ? 'bg-amber-400 text-slate-950 border-amber-300 shadow'
                                : 'bg-slate-900 text-slate-300 border-white/10 hover:bg-slate-800'
                            }`}
                          >
                            #{idx + 1} {d.name || 'Dachgaube'} (
                            {d.side === 'back' ? 'Rückseite' : 'Vorderseite'})
                          </button>
                        );
                      })}
                    </div>

                    {activeDormer &&
                      (() => {
                        const updateActiveDormer = (patch: Partial<RoofDormerItem>) => {
                          commitDormers(
                            dormersList.map((d) =>
                              d.id === activeDormer.id ? { ...d, ...patch } : d
                            )
                          );
                        };
                        const winUnits = getEffectiveDormerWindows(activeDormer);
                        const safeWinIdx = Math.min(
                          Math.max(0, selectedWindowIndex),
                          winUnits.length - 1
                        );
                        const activeWin: DormerWindowUnit = winUnits[safeWinIdx];

                        const updateActiveWin = (wPatch: Partial<DormerWindowUnit>) => {
                          const nextWins = winUnits.map((w, i) =>
                            i === safeWinIdx ? { ...w, ...wPatch } : w
                          );
                          updateActiveDormer({
                            windows: nextWins,
                            windowCount: Math.min(3, Math.max(1, nextWins.length)) as 1 | 2 | 3,
                          });
                        };

                        return (
                          <div className="space-y-3 p-3.5 rounded-2xl bg-slate-900/90 border border-amber-400/30">
                            <div className="flex items-center justify-between gap-2 border-b border-white/10 pb-2.5">
                              <input
                                type="text"
                                value={activeDormer.name || ''}
                                placeholder="Name der Dachgaube..."
                                onChange={(e) =>
                                  updateActiveDormer({ name: e.target.value })
                                }
                                className="bg-slate-950 border border-white/15 rounded-lg px-2.5 py-1 text-xs font-bold text-white flex-1"
                              />
                              <button
                                type="button"
                                onClick={() => {
                                  const clone: RoofDormerItem = {
                                    ...activeDormer,
                                    id: `dormer_${Date.now()}`,
                                    name: `${activeDormer.name || 'Gaube'} (Kopie)`,
                                    offsetAlongRidge: Number(
                                      Math.min(
                                        halfRidge - activeDormer.width / 2,
                                        activeDormer.offsetAlongRidge + activeDormer.width + 0.4
                                      ).toFixed(2)
                                    ),
                                  };
                                  commitDormers([...dormersList, clone]);
                                  setSelectedDormerId(clone.id);
                                }}
                                className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-[11px] font-semibold text-slate-200 flex items-center gap-1 border border-white/10"
                              >
                                <Copy className="w-3.5 h-3.5" />
                                <span>Duplizieren</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  const next = dormersList.filter(
                                    (d) => d.id !== activeDormer.id
                                  );
                                  commitDormers(next);
                                  setSelectedDormerId(next[0]?.id || null);
                                }}
                                className="px-2.5 py-1 rounded-lg bg-rose-500/20 hover:bg-rose-500/35 text-[11px] font-semibold text-rose-300 flex items-center gap-1 border border-rose-400/30"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                <span>Löschen</span>
                              </button>
                            </div>

                            {/* Gaubenform & Dachseite */}
                            <div className="grid grid-cols-2 gap-2.5">
                              <div>
                                <label className="block text-[10px] text-slate-400 mb-1">
                                  Gauben-Bauform
                                </label>
                                <select
                                  value={activeDormer.type}
                                  onChange={(e) =>
                                    updateActiveDormer({
                                      type: e.target.value as Exclude<RoofDormerType, 'none'>,
                                    })
                                  }
                                  className="w-full bg-slate-950 border border-white/15 rounded-lg px-2 py-1.5 text-xs text-white"
                                >
                                  <option value="gable">Satteldachgaube / Giebelgaube</option>
                                  <option value="shed">Schleppgaube</option>
                                  <option value="flat_box">Moderne Flachdach-Kastengaube</option>
                                  <option value="trapezoid">Trapezgaube</option>
                                  <option value="arched">Rundbogengaube / Tonnengaube</option>
                                </select>
                              </div>
                              <div>
                                <label className="block text-[10px] text-slate-400 mb-1">
                                  Dachseite
                                </label>
                                <select
                                  value={activeDormer.side}
                                  onChange={(e) => {
                                    const nextSide = e.target.value as 'front' | 'back';
                                    updateActiveDormer({ side: nextSide });
                                    if (blueprintView !== 'top_plan') {
                                      setBlueprintView(
                                        nextSide === 'back'
                                          ? 'elevation_back'
                                          : 'elevation_front'
                                      );
                                    }
                                  }}
                                  className="w-full bg-slate-950 border border-white/15 rounded-lg px-2 py-1.5 text-xs text-white"
                                >
                                  <option value="front">
                                    Vorderseite ({ridgeAlongX ? 'Süd' : 'Ost'})
                                  </option>
                                  <option value="back">
                                    Rückseite ({ridgeAlongX ? 'Nord' : 'West'})
                                  </option>
                                </select>
                              </div>
                            </div>

                            {/* Dimensions & Position Sliders */}
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 pt-1">
                              <div>
                                <div className="flex justify-between text-[10px] text-slate-300">
                                  <span>Position First</span>
                                  <span className="font-mono text-amber-300">
                                    {activeDormer.offsetAlongRidge.toFixed(2)}m
                                  </span>
                                </div>
                                <input
                                  type="range"
                                  min={-Math.max(0.5, halfRidge - activeDormer.width / 2)}
                                  max={Math.max(0.5, halfRidge - activeDormer.width / 2)}
                                  step={0.05}
                                  value={activeDormer.offsetAlongRidge}
                                  onChange={(e) =>
                                    updateActiveDormer({
                                      offsetAlongRidge: parseFloat(e.target.value),
                                    })
                                  }
                                  className="w-full accent-amber-400"
                                />
                              </div>
                              <div>
                                <div className="flex justify-between text-[10px] text-slate-300">
                                  <span>Gaubenbreite</span>
                                  <span className="font-mono text-amber-300">
                                    {activeDormer.width.toFixed(2)}m
                                  </span>
                                </div>
                                <input
                                  type="range"
                                  min={0.8}
                                  max={Math.min(6.5, wallLen * 0.8)}
                                  step={0.05}
                                  value={activeDormer.width}
                                  onChange={(e) =>
                                    updateActiveDormer({
                                      width: parseFloat(e.target.value),
                                    })
                                  }
                                  className="w-full accent-amber-400"
                                />
                              </div>
                              <div>
                                <div className="flex justify-between text-[10px] text-slate-300">
                                  <span>Gaubenhöhe</span>
                                  <span className="font-mono text-amber-300">
                                    {activeDormer.height.toFixed(2)}m
                                  </span>
                                </div>
                                <input
                                  type="range"
                                  min={0.75}
                                  max={2.3}
                                  step={0.05}
                                  value={activeDormer.height}
                                  onChange={(e) =>
                                    updateActiveDormer({
                                      height: parseFloat(e.target.value),
                                    })
                                  }
                                  className="w-full accent-amber-400"
                                />
                              </div>
                              <div>
                                <div className="flex justify-between text-[10px] text-slate-300">
                                  <span>Brüstungshöhe</span>
                                  <span className="font-mono text-slate-200">
                                    {(activeDormer.sillHeight ?? 0.28).toFixed(2)}m
                                  </span>
                                </div>
                                <input
                                  type="range"
                                  min={0.08}
                                  max={0.85}
                                  step={0.02}
                                  value={activeDormer.sillHeight ?? 0.28}
                                  onChange={(e) =>
                                    updateActiveDormer({
                                      sillHeight: parseFloat(e.target.value),
                                    })
                                  }
                                  className="w-full accent-sky-400"
                                />
                              </div>
                              <div>
                                <div className="flex justify-between text-[10px] text-slate-300">
                                  <span>Trauf-Rücksprung</span>
                                  <span className="font-mono text-slate-200">
                                    {(activeDormer.eavesSetback ?? 0.35).toFixed(2)}m
                                  </span>
                                </div>
                                <input
                                  type="range"
                                  min={0.0}
                                  max={Math.min(2.2, wallSpan * 0.34)}
                                  step={0.05}
                                  value={activeDormer.eavesSetback ?? 0.35}
                                  onChange={(e) =>
                                    updateActiveDormer({
                                      eavesSetback: parseFloat(e.target.value),
                                    })
                                  }
                                  className="w-full accent-sky-400"
                                />
                              </div>
                              <div>
                                <label className="block text-[10px] text-slate-300 mb-0.5">
                                  Fenster-Einheiten
                                </label>
                                <div className="grid grid-cols-3 gap-1">
                                  {([1, 2, 3] as const).map((cnt) => (
                                    <button
                                      key={cnt}
                                      type="button"
                                      onClick={() => {
                                        const nextWins: DormerWindowUnit[] = Array.from(
                                          { length: cnt },
                                          (_, i) =>
                                            winUnits[i] || {
                                              id: `dwin_${Date.now()}_${i}`,
                                              sashCount: 1,
                                              hingeSide: i % 2 === 0 ? 'left' : 'right',
                                              windowStyle:
                                                activeDormer.windowStyle || 'mullion_cross',
                                              windowFrameColor:
                                                activeDormer.windowFrameColor || 'anthracite',
                                              windowOpenState: 'closed',
                                              hasShutter: false,
                                              shutterClosedPct: 0,
                                            }
                                        );
                                        updateActiveDormer({
                                          windowCount: cnt,
                                          windows: nextWins,
                                        });
                                        setSelectedWindowIndex(0);
                                      }}
                                      className={`py-1 rounded text-xs font-bold ${
                                        winUnits.length === cnt
                                          ? 'bg-sky-400 text-slate-950'
                                          : 'bg-slate-950 text-slate-300 border border-white/10'
                                      }`}
                                    >
                                      {cnt}×
                                    </button>
                                  ))}
                                </div>
                              </div>
                            </div>

                            {/* Individual Window Unit Configuration (Fenster, Rollladen & HA-Entitäten) */}
                            <div className="p-3 rounded-xl bg-slate-950 border border-sky-400/30 space-y-2.5">
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-xs font-bold text-sky-300">
                                  🪟 Gaubenfenster einzeln konfigurieren
                                </span>
                                <div className="flex items-center gap-1">
                                  {winUnits.map((wU, wIdx) => (
                                    <button
                                      key={wU.id || wIdx}
                                      type="button"
                                      onClick={() => setSelectedWindowIndex(wIdx)}
                                      className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-colors ${
                                        safeWinIdx === wIdx
                                          ? 'bg-sky-400 text-slate-950'
                                          : 'bg-slate-900 text-slate-300 border border-white/10'
                                      }`}
                                    >
                                      Fenster {wIdx + 1}
                                    </button>
                                  ))}
                                </div>
                              </div>

                              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                <div>
                                  <label className="block text-[10px] text-slate-400 mb-0.5">
                                    Verglasung / Sprossen
                                  </label>
                                  <select
                                    value={activeWin.windowStyle || 'mullion_cross'}
                                    onChange={(e) =>
                                      updateActiveWin({
                                        windowStyle: e.target.value as DormerWindowStyle,
                                      })
                                    }
                                    className="w-full bg-slate-900 border border-white/15 rounded px-2 py-1 text-[11px] text-white"
                                  >
                                    <option value="mullion_cross">Kreuzsprossen</option>
                                    <option value="modern_single">Klarglas Modern</option>
                                    <option value="industrial_loft">Loft-Sprossengitter</option>
                                    <option value="arched_classic">Kämpferprofil</option>
                                    <option value="frosted_privacy">Milchglas / Bad</option>
                                  </select>
                                </div>
                                <div>
                                  <label className="block text-[10px] text-slate-400 mb-0.5">
                                    Rahmenfarbe
                                  </label>
                                  <select
                                    value={activeWin.windowFrameColor || 'anthracite'}
                                    onChange={(e) =>
                                      updateActiveWin({
                                        windowFrameColor: e.target.value as OpeningFrameColor,
                                      })
                                    }
                                    className="w-full bg-slate-900 border border-white/15 rounded px-2 py-1 text-[11px] text-white"
                                  >
                                    <option value="anthracite">Anthrazit (RAL 7016)</option>
                                    <option value="white">Reinweiß</option>
                                    <option value="oak">Natur-Eiche</option>
                                    <option value="matte_black">Tiefschwarz</option>
                                    <option value="alu_silver">Gebürstetes Alu</option>
                                  </select>
                                </div>
                                <div>
                                  <label className="block text-[10px] text-slate-400 mb-0.5">
                                    3D-Öffnungszustand
                                  </label>
                                  <select
                                    value={activeWin.windowOpenState || 'closed'}
                                    onChange={(e) =>
                                      updateActiveWin({
                                        windowOpenState: e.target.value as
                                          | 'closed'
                                          | 'tilted'
                                          | 'open',
                                      })
                                    }
                                    className="w-full bg-slate-900 border border-white/15 rounded px-2 py-1 text-[11px] text-white"
                                  >
                                    <option value="closed">Geschlossen</option>
                                    <option value="tilted">Gekippt</option>
                                    <option value="open">Geöffnet (Drehflügel)</option>
                                  </select>
                                </div>
                              </div>

                              {/* Rollladen Toggle & Behanghöhe */}
                              <div className="p-2.5 rounded-lg bg-slate-900 border border-white/10 space-y-2">
                                <div className="flex items-center justify-between">
                                  <label className="flex items-center gap-2 text-xs font-semibold text-slate-200 cursor-pointer">
                                    <input
                                      type="checkbox"
                                      checked={Boolean(activeWin.hasShutter)}
                                      onChange={(e) =>
                                        updateActiveWin({
                                          hasShutter: e.target.checked,
                                          shutterClosedPct: e.target.checked
                                            ? activeWin.shutterClosedPct ?? 35
                                            : 0,
                                        })
                                      }
                                      className="accent-amber-400 w-4 h-4 rounded"
                                    />
                                    <span>Außen-Rollladen an diesem Gaubenfenster</span>
                                  </label>
                                  {activeWin.hasShutter && (
                                    <span className="text-[11px] font-mono text-amber-300">
                                      {activeWin.shutterClosedPct ?? 0}% geschlossen
                                    </span>
                                  )}
                                </div>
                                {activeWin.hasShutter && (
                                  <input
                                    type="range"
                                    min={0}
                                    max={100}
                                    step={5}
                                    value={activeWin.shutterClosedPct ?? 0}
                                    onChange={(e) =>
                                      updateActiveWin({
                                        shutterClosedPct: parseInt(e.target.value, 10),
                                      })
                                    }
                                    className="w-full accent-amber-400"
                                  />
                                )}
                              </div>

                              {/* Home Assistant Entities for Window Contact & Roller Shutter */}
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                <div>
                                  <label className="block text-[10px] text-sky-300 font-semibold mb-0.5">
                                    HA Fensterkontakt (binary_sensor.*)
                                  </label>
                                  <input
                                    type="text"
                                    list="dormer-contact-entities"
                                    value={activeWin.entityId || ''}
                                    placeholder="z.B. binary_sensor.gaube_fenster"
                                    onChange={(e) =>
                                      updateActiveWin({
                                        entityId: e.target.value || undefined,
                                      })
                                    }
                                    className="w-full bg-slate-900 border border-white/15 rounded px-2 py-1 text-[11px] text-white font-mono"
                                  />
                                  <datalist id="dormer-contact-entities">
                                    {binaryContactEntities.map((ent) => (
                                      <option key={ent.entity_id} value={ent.entity_id}>
                                        {ent.attributes?.friendly_name || ent.entity_id}
                                      </option>
                                    ))}
                                  </datalist>
                                </div>
                                <div>
                                  <label className="block text-[10px] text-amber-300 font-semibold mb-0.5">
                                    HA Rollladen-Entität (cover.*)
                                  </label>
                                  <input
                                    type="text"
                                    list="dormer-cover-entities"
                                    value={activeWin.shutterEntityId || ''}
                                    placeholder="z.B. cover.gaube_rollladen"
                                    onChange={(e) =>
                                      updateActiveWin({
                                        shutterEntityId: e.target.value || undefined,
                                        hasShutter: Boolean(e.target.value) || activeWin.hasShutter,
                                      })
                                    }
                                    className="w-full bg-slate-900 border border-white/15 rounded px-2 py-1 text-[11px] text-white font-mono"
                                  />
                                  <datalist id="dormer-cover-entities">
                                    {coverEntities.map((ent) => (
                                      <option key={ent.entity_id} value={ent.entity_id}>
                                        {ent.attributes?.friendly_name || ent.entity_id}
                                      </option>
                                    ))}
                                  </datalist>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })()}
                  </>
                )}
              </div>
            )}

            {/* TAB 2: PV-ANLAGE IN DRAUFSICHT */}
            {activeTab === 'pv' && (
              <div className="space-y-4">
                <div className="p-3.5 rounded-2xl bg-slate-900/90 border border-emerald-400/35 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-xs font-bold text-emerald-300 uppercase tracking-wider">
                        ☀️ PV-Anlage / Solarmodule auf dem Dach
                      </h3>
                      <p className="text-[11px] text-slate-400">
                        Module werden in der Draufsicht automatisch um geplante Dachgauben & Dachfenster herum ausgespart
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        const cur = roofCfg.pvConfig;
                        const nextEnabled = !cur?.enabled;
                        updateRoofCfg({
                          pvConfig: {
                            enabled: nextEnabled,
                            sides: 'per_side',
                            perSide: cur?.perSide || {
                              front: { enabled: true, coveragePct: 75 },
                              back: { enabled: false, coveragePct: 75 },
                            },
                            coveragePct: cur?.coveragePct ?? 75,
                            kwPeak: cur?.kwPeak ?? 9.6,
                            entityId: cur?.entityId,
                          },
                        });
                      }}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors ${
                        roofCfg.pvConfig?.enabled
                          ? 'bg-emerald-400 text-slate-950 shadow'
                          : 'bg-slate-800 text-slate-300 border border-white/10'
                      }`}
                    >
                      {roofCfg.pvConfig?.enabled ? '✓ PV-Anlage aktiv' : 'PV-Anlage aktivieren'}
                    </button>
                  </div>

                  {roofCfg.pvConfig?.enabled && (
                    <div className="space-y-3 pt-2 border-t border-white/10">
                      {/* EINZELMODUL-PLANER (Individuelle PV-Module frei platzieren, verschieben, drehen & löschen) */}
                      <div className="p-3 rounded-xl bg-slate-950 border border-emerald-400/40 space-y-2.5">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <div className="text-xs font-bold text-emerald-300 flex items-center gap-1.5">
                              <span>🧩 Einzelmodul-Planer (Draufsicht)</span>
                              <span className="px-2 py-0.5 rounded bg-emerald-500/20 border border-emerald-400/40 text-[10px] font-mono">
                                {pvModulesList.length > 0
                                  ? `${pvModulesList.length} Einzelmodule aktiv`
                                  : `Auto-Raster (${pvSimulation.totalModules} Mod.)`}
                              </span>
                            </div>
                            <p className="text-[10px] text-slate-400">
                              Jedes PV-Modul einzeln in der 2D-Draufsicht anklicken & verschieben, drehen (Hoch-/Querformat) oder gezielt löschen
                            </p>
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-1.5">
                          <button
                            type="button"
                            onClick={() => addSinglePvModule('front', 'portrait')}
                            className="px-2.5 py-1.5 rounded-lg bg-emerald-400 hover:bg-emerald-300 text-slate-950 text-[11px] font-bold flex items-center gap-1"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span>+ Einzelmodul (Vorderseite)</span>
                          </button>
                          {roofCfg.type !== 'mono_pitch' && (
                            <button
                              type="button"
                              onClick={() => addSinglePvModule('back', 'portrait')}
                              className="px-2.5 py-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-400/40 text-emerald-200 text-[11px] font-bold flex items-center gap-1"
                            >
                              <Plus className="w-3.5 h-3.5" />
                              <span>+ Einzelmodul (Rückseite)</span>
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => convertGridToIndividualModules()}
                            className="px-2.5 py-1.5 rounded-lg bg-amber-400/20 hover:bg-amber-400/30 border border-amber-400/40 text-amber-200 text-[11px] font-bold"
                            title="Wandelt das aktuelle Auto-Raster in frei verschiebbare Einzelmodule um"
                          >
                            🪄 Raster in Einzelmodule umwandeln ({pvSimulation.totalModules})
                          </button>
                          {pvModulesList.length > 0 && (
                            <button
                              type="button"
                              onClick={() => {
                                updateRoofCfg({
                                  pvConfig: {
                                    ...roofCfg.pvConfig!,
                                    modules: undefined,
                                  },
                                });
                                setSelectedPvModuleId(null);
                              }}
                              className="px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-white/15 text-slate-300 text-[10.5px] font-semibold"
                            >
                              ↺ Zurück zu Auto-Raster
                            </button>
                          )}
                        </div>

                        {pvModulesList.length > 0 && activePvModule && (
                          <div className="p-2.5 rounded-lg bg-slate-900 border border-emerald-400/30 space-y-2">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <span className="text-[11px] font-bold text-emerald-200">
                                Ausgewähltes PV-Modul #{pvModulesList.findIndex((m) => m.id === activePvModule.id) + 1} ({activePvModule.side === 'back' ? 'Rückseite' : 'Vorderseite'})
                              </span>
                              <div className="flex items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => {
                                    const nextOri =
                                      activePvModule.orientation === 'landscape'
                                        ? 'portrait'
                                        : 'landscape';
                                    commitPvModules(
                                      pvModulesList.map((m) =>
                                        m.id === activePvModule.id
                                          ? { ...m, orientation: nextOri }
                                          : m
                                      )
                                    );
                                  }}
                                  className="px-2 py-1 rounded bg-slate-950 hover:bg-slate-800 border border-white/15 text-[10px] font-semibold text-amber-200 flex items-center gap-1"
                                >
                                  <RotateCw className="w-3 h-3" />
                                  <span>
                                    {activePvModule.orientation === 'landscape'
                                      ? 'Querformat (1,68×1,08m)'
                                      : 'Hochformat (1,08×1,68m)'}
                                  </span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    const dup: RoofPVModuleItem = {
                                      ...activePvModule,
                                      id: `pvmod_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
                                      offsetX: Number(
                                        Math.min(halfRidge - 0.6, activePvModule.offsetX + 1.14).toFixed(2)
                                      ),
                                    };
                                    commitPvModules([...pvModulesList, dup]);
                                    setSelectedPvModuleId(dup.id);
                                  }}
                                  className="px-2 py-1 rounded bg-slate-950 hover:bg-slate-800 border border-white/15 text-[10px] text-slate-200 flex items-center gap-1"
                                  title="Modul rechts daneben duplizieren"
                                >
                                  <Copy className="w-3 h-3" />
                                  <span>Duplizieren</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    const next = pvModulesList.filter(
                                      (m) => m.id !== activePvModule.id
                                    );
                                    commitPvModules(next);
                                    setSelectedPvModuleId(next[0]?.id || null);
                                  }}
                                  className="px-2 py-1 rounded bg-rose-500/20 hover:bg-rose-500/35 border border-rose-400/30 text-[10px] font-bold text-rose-300 flex items-center gap-1"
                                >
                                  <Trash2 className="w-3 h-3" />
                                  <span>Modul löschen</span>
                                </button>
                              </div>
                            </div>

                            <div className="grid grid-cols-3 gap-2 text-[10px]">
                              <div>
                                <label className="block text-slate-400 mb-0.5">Dachfläche</label>
                                <select
                                  value={activePvModule.side}
                                  onChange={(e) =>
                                    commitPvModules(
                                      pvModulesList.map((m) =>
                                        m.id === activePvModule.id
                                          ? { ...m, side: e.target.value as RoofPVSideId }
                                          : m
                                      )
                                    )
                                  }
                                  className="w-full bg-slate-950 border border-white/15 rounded px-1.5 py-1 text-white"
                                >
                                  <option value="front">Vorderseite ({ridgeAlongX ? 'Süd' : 'Ost'})</option>
                                  {roofCfg.type !== 'mono_pitch' && (
                                    <option value="back">Rückseite ({ridgeAlongX ? 'Nord' : 'West'})</option>
                                  )}
                                </select>
                              </div>
                              <div>
                                <div className="flex justify-between text-slate-400">
                                  <span>Position First (X)</span>
                                  <span className="font-mono text-emerald-300">
                                    {activePvModule.offsetX.toFixed(2)}m
                                  </span>
                                </div>
                                <input
                                  type="range"
                                  min={-Math.max(0.5, totalRidgeLen / 2 - 0.55)}
                                  max={Math.max(0.5, totalRidgeLen / 2 - 0.55)}
                                  step={0.05}
                                  value={activePvModule.offsetX}
                                  onChange={(e) =>
                                    commitPvModules(
                                      pvModulesList.map((m) =>
                                        m.id === activePvModule.id
                                          ? { ...m, offsetX: parseFloat(e.target.value) }
                                          : m
                                      )
                                    )
                                  }
                                  className="w-full accent-emerald-400"
                                />
                              </div>
                              <div>
                                <div className="flex justify-between text-slate-400">
                                  <span>Position First➔Traufe</span>
                                  <span className="font-mono text-emerald-300">
                                    {Math.round(activePvModule.slopeOffset * 100)}%
                                  </span>
                                </div>
                                <input
                                  type="range"
                                  min={0.16}
                                  max={0.86}
                                  step={0.02}
                                  value={activePvModule.slopeOffset}
                                  onChange={(e) =>
                                    commitPvModules(
                                      pvModulesList.map((m) =>
                                        m.id === activePvModule.id
                                          ? { ...m, slopeOffset: parseFloat(e.target.value) }
                                          : m
                                      )
                                    )
                                  }
                                  className="w-full accent-emerald-400"
                                />
                              </div>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Front Slope PV */}
                      {(() => {
                        const fCfg = getPvSideConfig('front');
                        return (
                          <div className="p-3 rounded-xl bg-slate-950 border border-white/10 space-y-2">
                            <div className="flex items-center justify-between">
                              <label className="flex items-center gap-2 text-xs font-bold text-emerald-200 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={fCfg.enabled}
                                  onChange={(e) =>
                                    updatePvSideConfig('front', { enabled: e.target.checked })
                                  }
                                  className="accent-emerald-400 w-4 h-4 rounded"
                                />
                                <span>
                                  Vorderseite ({ridgeAlongX ? 'Süd-Fläche' : 'Ost-Fläche'}) ·{' '}
                                  {pvSimulation.frontRects.length} Module
                                </span>
                              </label>
                            </div>
                            {fCfg.enabled && (
                              <div className="grid grid-cols-2 gap-2.5">
                                <div>
                                  <div className="flex justify-between text-[10px] text-slate-400">
                                    <span>Modulanzahl (0 = Auto)</span>
                                    <span className="font-mono text-emerald-300">
                                      {(fCfg.moduleCount ?? 0) === 0
                                        ? 'Auto'
                                        : `${fCfg.moduleCount} Stk.`}
                                    </span>
                                  </div>
                                  <input
                                    type="range"
                                    min={0}
                                    max={48}
                                    step={1}
                                    value={fCfg.moduleCount ?? 0}
                                    onChange={(e) => {
                                      const val = parseInt(e.target.value, 10);
                                      updatePvSideConfig('front', {
                                        moduleCount: val > 0 ? val : undefined,
                                      });
                                    }}
                                    className="w-full accent-emerald-400"
                                  />
                                </div>
                                <div>
                                  <div className="flex justify-between text-[10px] text-slate-400">
                                    <span>Flächenbelegung</span>
                                    <span className="font-mono text-emerald-300">
                                      {fCfg.coveragePct ?? 75}%
                                    </span>
                                  </div>
                                  <input
                                    type="range"
                                    min={20}
                                    max={95}
                                    step={5}
                                    value={fCfg.coveragePct ?? 75}
                                    onChange={(e) =>
                                      updatePvSideConfig('front', {
                                        coveragePct: parseInt(e.target.value, 10),
                                      })
                                    }
                                    className="w-full accent-emerald-400"
                                  />
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })()}

                      {/* Back Slope PV */}
                      {roofCfg.type !== 'mono_pitch' &&
                        (() => {
                          const bCfg = getPvSideConfig('back');
                          return (
                            <div className="p-3 rounded-xl bg-slate-950 border border-white/10 space-y-2">
                              <div className="flex items-center justify-between">
                                <label className="flex items-center gap-2 text-xs font-bold text-emerald-200 cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={bCfg.enabled}
                                    onChange={(e) =>
                                      updatePvSideConfig('back', { enabled: e.target.checked })
                                    }
                                    className="accent-emerald-400 w-4 h-4 rounded"
                                  />
                                  <span>
                                    Rückseite ({ridgeAlongX ? 'Nord-Fläche' : 'West-Fläche'}) ·{' '}
                                    {pvSimulation.backRects.length} Module
                                  </span>
                                </label>
                              </div>
                              {bCfg.enabled && (
                                <div className="grid grid-cols-2 gap-2.5">
                                  <div>
                                    <div className="flex justify-between text-[10px] text-slate-400">
                                      <span>Modulanzahl (0 = Auto)</span>
                                      <span className="font-mono text-emerald-300">
                                        {(bCfg.moduleCount ?? 0) === 0
                                          ? 'Auto'
                                          : `${bCfg.moduleCount} Stk.`}
                                      </span>
                                    </div>
                                    <input
                                      type="range"
                                      min={0}
                                      max={48}
                                      step={1}
                                      value={bCfg.moduleCount ?? 0}
                                      onChange={(e) => {
                                        const val = parseInt(e.target.value, 10);
                                        updatePvSideConfig('back', {
                                          moduleCount: val > 0 ? val : undefined,
                                        });
                                      }}
                                      className="w-full accent-emerald-400"
                                    />
                                  </div>
                                  <div>
                                    <div className="flex justify-between text-[10px] text-slate-400">
                                      <span>Flächenbelegung</span>
                                      <span className="font-mono text-emerald-300">
                                        {bCfg.coveragePct ?? 75}%
                                      </span>
                                    </div>
                                    <input
                                      type="range"
                                      min={20}
                                      max={95}
                                      step={5}
                                      value={bCfg.coveragePct ?? 75}
                                      onChange={(e) =>
                                        updatePvSideConfig('back', {
                                          coveragePct: parseInt(e.target.value, 10),
                                        })
                                      }
                                      className="w-full accent-emerald-400"
                                    />
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })()}

                      {/* Hip Roof Left / Right Slopes */}
                      {(roofCfg.type === 'hipped' || roofCfg.type === 'tent') && (
                        <div className="grid grid-cols-2 gap-2 p-2.5 rounded-xl bg-slate-950 border border-white/10">
                          <label className="flex items-center gap-2 text-xs text-slate-200 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={getPvSideConfig('left').enabled}
                              onChange={(e) =>
                                updatePvSideConfig('left', { enabled: e.target.checked })
                              }
                              className="accent-emerald-400"
                            />
                            <span>Walm Links belegen</span>
                          </label>
                          <label className="flex items-center gap-2 text-xs text-slate-200 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={getPvSideConfig('right').enabled}
                              onChange={(e) =>
                                updatePvSideConfig('right', { enabled: e.target.checked })
                              }
                              className="accent-emerald-400"
                            />
                            <span>Walm Rechts belegen</span>
                          </label>
                        </div>
                      )}

                      {/* kWp & Home Assistant Solar Sensor */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                        <div>
                          <label className="block text-[10px] text-slate-400 mb-1">
                            Nennleistung (kWp) · ~{(pvSimulation.totalModules * 0.44).toFixed(1)} kWp
                          </label>
                          <input
                            type="number"
                            step={0.2}
                            min={0.8}
                            max={60}
                            value={
                              roofCfg.pvConfig.kwPeak ??
                              +(pvSimulation.totalModules * 0.44).toFixed(1)
                            }
                            onChange={(e) =>
                              updateRoofCfg({
                                pvConfig: {
                                  ...roofCfg.pvConfig!,
                                  kwPeak: parseFloat(e.target.value) || 0,
                                },
                              })
                            }
                            className="w-full bg-slate-950 border border-white/15 rounded-lg px-2.5 py-1.5 text-xs text-white font-mono"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] text-emerald-300 font-semibold mb-1">
                            Home Assistant PV-Sensor (sensor.*)
                          </label>
                          <input
                            type="text"
                            list="pv-sensor-entities"
                            value={roofCfg.pvConfig.entityId || ''}
                            placeholder="z.B. sensor.pv_power"
                            onChange={(e) =>
                              updateRoofCfg({
                                pvConfig: {
                                  ...roofCfg.pvConfig!,
                                  entityId: e.target.value || undefined,
                                },
                              })
                            }
                            className="w-full bg-slate-950 border border-white/15 rounded-lg px-2.5 py-1.5 text-xs text-white font-mono"
                          />
                          <datalist id="pv-sensor-entities">
                            {pvSensorEntities.map((ent) => (
                              <option key={ent.entity_id} value={ent.entity_id}>
                                {ent.attributes?.friendly_name || ent.entity_id}
                              </option>
                            ))}
                          </datalist>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* TAB 3: DACHFENSTER & SCHORNSTEIN */}
            {activeTab === 'skylights_chimneys' && (
              <div className="space-y-4">
                {/* Skylights Section */}
                <div className="p-3.5 rounded-2xl bg-slate-900/90 border border-sky-400/35 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <h3 className="text-xs font-bold text-sky-300 uppercase tracking-wider">
                        🪟 Dachflächenfenster & Ausstiegsluken ({skylightsList.length})
                      </h3>
                      <p className="text-[11px] text-slate-400">
                        Echter Dachdurchbruch mit Glas, Öffnungsstatus, Rollladen & HA-Entität
                      </p>
                    </div>
                    <div className="flex gap-1.5">
                      <button
                        type="button"
                        onClick={() => addSkylight(false)}
                        className="px-2.5 py-1 rounded-lg bg-sky-400 hover:bg-sky-300 text-slate-950 text-[11px] font-bold"
                      >
                        + Dachfenster
                      </button>
                      <button
                        type="button"
                        onClick={() => addSkylight(true)}
                        className="px-2.5 py-1 rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 text-[11px] font-bold"
                      >
                        + Ausstiegsluke
                      </button>
                    </div>
                  </div>

                  {skylightsList.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {skylightsList.map((s, idx) => (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => setSelectedSkylightId(s.id)}
                          className={`px-2.5 py-1 rounded-lg text-xs font-bold border ${
                            activeSkylight?.id === s.id
                              ? 'bg-sky-400 text-slate-950 border-sky-300'
                              : 'bg-slate-950 text-slate-300 border-white/10'
                          }`}
                        >
                          #{idx + 1} {s.name || 'Dachfenster'}
                        </button>
                      ))}
                    </div>
                  )}

                  {activeSkylight &&
                    (() => {
                      const updateSky = (patch: Partial<RoofSkylightItem>) => {
                        updateRoofCfg({
                          skylights: skylightsList.map((s) =>
                            s.id === activeSkylight.id ? { ...s, ...patch } : s
                          ),
                        });
                      };
                      return (
                        <div className="p-3 rounded-xl bg-slate-950 border border-white/10 space-y-2.5">
                          <div className="flex items-center justify-between gap-2">
                            <input
                              type="text"
                              value={activeSkylight.name || ''}
                              onChange={(e) => updateSky({ name: e.target.value })}
                              className="bg-slate-900 border border-white/15 rounded px-2 py-1 text-xs font-bold text-white flex-1"
                            />
                            <button
                              type="button"
                              onClick={() => {
                                const next = skylightsList.filter(
                                  (s) => s.id !== activeSkylight.id
                                );
                                updateRoofCfg({ skylights: next });
                                setSelectedSkylightId(next[0]?.id || null);
                              }}
                              className="px-2.5 py-1 rounded bg-rose-500/20 text-rose-300 text-[11px] font-semibold border border-rose-400/30"
                            >
                              Löschen
                            </button>
                          </div>

                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                            <div>
                              <label className="block text-[10px] text-slate-400 mb-0.5">
                                Bauart
                              </label>
                              <select
                                value={activeSkylight.style}
                                onChange={(e) =>
                                  updateSky({
                                    style: e.target.value as RoofSkylightStyle,
                                  })
                                }
                                className="w-full bg-slate-900 border border-white/15 rounded px-2 py-1 text-[11px] text-white"
                              >
                                <option value="velux_pivot">Schwingfenster (Klassik)</option>
                                <option value="velux_twin">Zwillings-Dachfenster</option>
                                <option value="panoramic_studio">Panorama-Studiofenster</option>
                                <option value="cabrio_balcony">Cabrio-Dachbalkon</option>
                                <option value="flat_roof_dome">Flachdach-Lichtkuppel</option>
                                <option value="chimney_sweep_hatch">
                                  Schornsteinfeger-Ausstiegsluke
                                </option>
                              </select>
                            </div>
                            <div>
                              <label className="block text-[10px] text-slate-400 mb-0.5">
                                Dachseite
                              </label>
                              <select
                                value={activeSkylight.side}
                                onChange={(e) =>
                                  updateSky({ side: e.target.value as 'front' | 'back' })
                                }
                                className="w-full bg-slate-900 border border-white/15 rounded px-2 py-1 text-[11px] text-white"
                              >
                                <option value="front">Vorderseite</option>
                                <option value="back">Rückseite</option>
                              </select>
                            </div>
                            <div>
                              <label className="block text-[10px] text-slate-400 mb-0.5">
                                Öffnungszustand
                              </label>
                              <select
                                value={activeSkylight.openState || 'closed'}
                                onChange={(e) =>
                                  updateSky({
                                    openState: e.target.value as 'closed' | 'tilted' | 'open',
                                  })
                                }
                                className="w-full bg-slate-900 border border-white/15 rounded px-2 py-1 text-[11px] text-white"
                              >
                                <option value="closed">Geschlossen</option>
                                <option value="tilted">Lüftungsklappe / Gekippt</option>
                                <option value="open">Weit geöffnet</option>
                              </select>
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <div className="flex justify-between text-[10px] text-slate-400">
                                <span>Position First</span>
                                <span className="font-mono text-sky-300">
                                  {activeSkylight.offsetAlongRidge.toFixed(2)}m
                                </span>
                              </div>
                              <input
                                type="range"
                                min={-Math.max(0.5, halfRidge - activeSkylight.width / 2)}
                                max={Math.max(0.5, halfRidge - activeSkylight.width / 2)}
                                step={0.05}
                                value={activeSkylight.offsetAlongRidge}
                                onChange={(e) =>
                                  updateSky({
                                    offsetAlongRidge: parseFloat(e.target.value),
                                  })
                                }
                                className="w-full accent-sky-400"
                              />
                            </div>
                            <div>
                              <div className="flex justify-between text-[10px] text-slate-400">
                                <span>Höhe auf Schräge</span>
                                <span className="font-mono text-sky-300">
                                  {Math.round((1 - (activeSkylight.slopePosition ?? 0.5)) * 100)}%
                                </span>
                              </div>
                              <input
                                type="range"
                                min={0.2}
                                max={0.82}
                                step={0.02}
                                value={activeSkylight.slopePosition ?? 0.5}
                                onChange={(e) =>
                                  updateSky({
                                    slopePosition: parseFloat(e.target.value),
                                  })
                                }
                                className="w-full accent-sky-400"
                              />
                            </div>
                            <div>
                              <div className="flex justify-between text-[10px] text-slate-400">
                                <span>Breite</span>
                                <span className="font-mono text-slate-200">
                                  {activeSkylight.width.toFixed(2)}m
                                </span>
                              </div>
                              <input
                                type="range"
                                min={0.45}
                                max={2.6}
                                step={0.05}
                                value={activeSkylight.width}
                                onChange={(e) =>
                                  updateSky({ width: parseFloat(e.target.value) })
                                }
                                className="w-full accent-sky-400"
                              />
                            </div>
                            <div>
                              <div className="flex justify-between text-[10px] text-slate-400">
                                <span>Länge</span>
                                <span className="font-mono text-slate-200">
                                  {activeSkylight.length.toFixed(2)}m
                                </span>
                              </div>
                              <input
                                type="range"
                                min={0.55}
                                max={2.2}
                                step={0.05}
                                value={activeSkylight.length}
                                onChange={(e) =>
                                  updateSky({ length: parseFloat(e.target.value) })
                                }
                                className="w-full accent-sky-400"
                              />
                            </div>
                          </div>

                          {/* Skylight Roller Shutter & HA Entities */}
                          <div className="p-2.5 rounded-lg bg-slate-900 border border-white/10 space-y-2">
                            <div className="flex items-center justify-between">
                              <label className="flex items-center gap-2 text-xs font-semibold text-slate-200 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={Boolean(activeSkylight.hasShutter)}
                                  onChange={(e) =>
                                    updateSky({
                                      hasShutter: e.target.checked,
                                      shutterClosedPct: e.target.checked
                                        ? activeSkylight.shutterClosedPct ?? 40
                                        : 0,
                                    })
                                  }
                                  className="accent-amber-400 w-4 h-4 rounded"
                                />
                                <span>Dachfenster-Außenrollladen / Hitzeschutzmarkise</span>
                              </label>
                              {activeSkylight.hasShutter && (
                                <span className="text-[11px] font-mono text-amber-300">
                                  {activeSkylight.shutterClosedPct ?? 0}% zu
                                </span>
                              )}
                            </div>
                            {activeSkylight.hasShutter && (
                              <input
                                type="range"
                                min={0}
                                max={100}
                                step={5}
                                value={activeSkylight.shutterClosedPct ?? 0}
                                onChange={(e) =>
                                  updateSky({
                                    shutterClosedPct: parseInt(e.target.value, 10),
                                  })
                                }
                                className="w-full accent-amber-400"
                              />
                            )}
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            <div>
                              <label className="block text-[10px] text-sky-300 font-semibold mb-0.5">
                                HA Fensterkontakt (binary_sensor.*)
                              </label>
                              <input
                                type="text"
                                list="dormer-contact-entities"
                                value={activeSkylight.entityId || ''}
                                placeholder="binary_sensor.dachfenster"
                                onChange={(e) =>
                                  updateSky({ entityId: e.target.value || undefined })
                                }
                                className="w-full bg-slate-900 border border-white/15 rounded px-2 py-1 text-[11px] text-white font-mono"
                              />
                            </div>
                            <div>
                              <label className="block text-[10px] text-amber-300 font-semibold mb-0.5">
                                HA Rollladen (cover.*)
                              </label>
                              <input
                                type="text"
                                list="dormer-cover-entities"
                                value={activeSkylight.shutterEntityId || ''}
                                placeholder="cover.dachfenster_rollo"
                                onChange={(e) =>
                                  updateSky({
                                    shutterEntityId: e.target.value || undefined,
                                    hasShutter:
                                      Boolean(e.target.value) || activeSkylight.hasShutter,
                                  })
                                }
                                className="w-full bg-slate-900 border border-white/15 rounded px-2 py-1 text-[11px] text-white font-mono"
                              />
                            </div>
                          </div>
                        </div>
                      );
                    })()}
                </div>

                {/* Chimneys Section */}
                <div className="p-3.5 rounded-2xl bg-slate-900/90 border border-orange-400/35 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-xs font-bold text-orange-300 uppercase tracking-wider">
                        🧱 Schornsteine & Dachkamine ({chimneysList.length})
                      </h3>
                      <p className="text-[11px] text-slate-400">
                        Gemauerte Kamine und Edelstahl-Abgasrohre
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={addChimney}
                      className="px-2.5 py-1 rounded-lg bg-orange-400 hover:bg-orange-300 text-slate-950 text-[11px] font-bold"
                    >
                      + Schornstein
                    </button>
                  </div>

                  {chimneysList.length > 0 && activeChimney && (
                    <div className="p-3 rounded-xl bg-slate-950 border border-white/10 space-y-2.5">
                      <div className="flex items-center justify-between gap-2">
                        <select
                          value={activeChimney.style}
                          onChange={(e) =>
                            updateRoofCfg({
                              chimneys: chimneysList.map((c) =>
                                c.id === activeChimney.id
                                  ? { ...c, style: e.target.value as RoofChimneyStyle }
                                  : c
                              ),
                            })
                          }
                          className="bg-slate-900 border border-white/15 rounded px-2 py-1 text-xs text-white flex-1"
                        >
                          <option value="brick_classic">Klinker-Schornstein (Rotbraun)</option>
                          <option value="plaster_modern">Putz-Schornstein (Weiß / Modern)</option>
                          <option value="slate_clad">Schiefer-Verkleidung (Anthrazit)</option>
                          <option value="stainless_flue">Edelstahl-Außenwandkamin</option>
                          <option value="double_brick_flue">Doppelzügiger Klinkerkamin</option>
                        </select>
                        <button
                          type="button"
                          onClick={() => {
                            const next = chimneysList.filter(
                              (c) => c.id !== activeChimney.id
                            );
                            updateRoofCfg({ chimneys: next });
                            setSelectedChimneyId(next[0]?.id || null);
                          }}
                          className="px-2.5 py-1 rounded bg-rose-500/20 text-rose-300 text-[11px] font-semibold border border-rose-400/30"
                        >
                          Löschen
                        </button>
                      </div>

                      <div className="grid grid-cols-3 gap-2">
                        <div>
                          <div className="text-[10px] text-slate-400">
                            Pos X ({activeChimney.offsetX.toFixed(1)}m)
                          </div>
                          <input
                            type="range"
                            min={-halfRidge + 0.3}
                            max={halfRidge - 0.3}
                            step={0.1}
                            value={activeChimney.offsetX}
                            onChange={(e) =>
                              updateRoofCfg({
                                chimneys: chimneysList.map((c) =>
                                  c.id === activeChimney.id
                                    ? { ...c, offsetX: parseFloat(e.target.value) }
                                    : c
                                ),
                              })
                            }
                            className="w-full accent-orange-400"
                          />
                        </div>
                        <div>
                          <div className="text-[10px] text-slate-400">
                            Pos Z ({activeChimney.offsetZ.toFixed(1)}m)
                          </div>
                          <input
                            type="range"
                            min={-wallSpan / 2 + 0.3}
                            max={wallSpan / 2 - 0.3}
                            step={0.1}
                            value={activeChimney.offsetZ}
                            onChange={(e) =>
                              updateRoofCfg({
                                chimneys: chimneysList.map((c) =>
                                  c.id === activeChimney.id
                                    ? { ...c, offsetZ: parseFloat(e.target.value) }
                                    : c
                                ),
                              })
                            }
                            className="w-full accent-orange-400"
                          />
                        </div>
                        <div>
                          <div className="text-[10px] text-slate-400">
                            Höhe ({activeChimney.height.toFixed(2)}m)
                          </div>
                          <input
                            type="range"
                            min={0.5}
                            max={2.4}
                            step={0.05}
                            value={activeChimney.height}
                            onChange={(e) =>
                              updateRoofCfg({
                                chimneys: chimneysList.map((c) =>
                                  c.id === activeChimney.id
                                    ? { ...c, height: parseFloat(e.target.value) }
                                    : c
                                ),
                              })
                            }
                            className="w-full accent-orange-400"
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
