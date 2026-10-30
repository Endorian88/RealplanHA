import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  Check,
  Cpu,
  Layers,
  Plus,
  Power,
  Sparkles,
  Trash2,
  X,
  Zap,
} from 'lucide-react';
import {
  CabinetConfiguration,
  CabinetDoorStyle,
  DIN_RAIL_MODULE_PRESETS,
  DinRailModuleItem,
  DinRailModuleType,
  FloorLevelId,
  FloorplanZone,
  HAEntityState,
  PlacedAsset,
  isBinaryEntityActive,
} from '../types/floorplan';

interface CabinetPlannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  zones: FloorplanZone[];
  assets: PlacedAsset[];
  entities: Record<string, HAEntityState>;
  activeFloor: FloorLevelId;
  initialAssetId?: string | null;
  onSaveCabinetAsset: (
    updatedOrNewAsset: PlacedAsset,
    isNew: boolean
  ) => void;
  onToggleEntity?: (entityId: string) => void;
}

const CABINET_TEMPLATES: {
  id: string;
  name: string;
  badge: string;
  rows: number;
  bays: number;
  hasSmartMeterBay: boolean;
  modules: Omit<DinRailModuleItem, 'id'>[];
}[] = [
  {
    id: 'main_house_hv',
    name: 'Hauptverteilung Wohnhaus + Smart Meter',
    badge: '4 Hutschienen · Komplett',
    rows: 4,
    bays: 2,
    hasSmartMeterBay: true,
    modules: [
      { row: 0, type: 'surge_spd', label: 'ÜSS Typ 1+2 Blitzschutz', teWidth: 4 },
      { row: 0, type: 'smart_meter_3p', label: 'Shelly Pro 3EM Hauptzähler', teWidth: 4, entityId: 'sensor.zaehlerschrank_leistung' },
      { row: 0, type: 'din_psu_24v', label: '24V Smart-Home Netzteil', teWidth: 2 },
      { row: 0, type: 'zigbee_din_gateway', label: 'Bus-/LAN-Gateway', teWidth: 2 },
      { row: 1, type: 'rcd_fi', label: 'FI 1 · Erdgeschoss (40A/30mA)', teWidth: 4 },
      { row: 1, type: 'mcb_3p', label: 'Induktionsherd Küche C20', teWidth: 3 },
      { row: 1, type: 'mcb_1p', label: 'Küche Geschirrspüler B16', teWidth: 1 },
      { row: 1, type: 'mcb_1p', label: 'Wohnzimmer Licht & Steckd.', teWidth: 1 },
      { row: 1, type: 'mcb_1p', label: 'Flur & Haustür B16', teWidth: 1 },
      { row: 1, type: 'shelly_din_relay', label: 'Shelly Pro 2PM Außenlicht', teWidth: 2 },
      { row: 2, type: 'rcd_fi', label: 'FI 2 · Obergeschoss & Bad', teWidth: 4 },
      { row: 2, type: 'mcb_1p', label: 'Eltern-Suite Licht/Steckd.', teWidth: 1 },
      { row: 2, type: 'mcb_1p', label: 'Kinderzimmer B16', teWidth: 1 },
      { row: 2, type: 'mcb_1p', label: 'Spa-Bad & Fußbodenheizung', teWidth: 1 },
      { row: 2, type: 'mcb_1p', label: 'Home-Office & Server B16', teWidth: 1 },
      { row: 2, type: 'knx_actuator', label: '8-Kanal Rollladenaktor', teWidth: 4 },
      { row: 3, type: 'rcd_fi', label: 'FI 3 · Wärmepumpe & PV', teWidth: 4 },
      { row: 3, type: 'mcb_3p', label: 'Wärmepumpe Außengerät C25', teWidth: 3, entityId: 'sensor.wp_aufnahmeleistung' },
      { row: 3, type: 'mcb_3p', label: 'PV-Wechselrichter 10kW', teWidth: 3, entityId: 'sensor.pv_erzeugung_watt' },
      { row: 3, type: 'shelly_din_relay', label: 'Warmwasser-Freigabe', teWidth: 2 },
    ],
  },
  {
    id: 'sub_floor_uv',
    name: 'Etagen-Unterverteilung (3-reihig)',
    badge: '3 Hutschienen · OG / DG',
    rows: 3,
    bays: 1,
    hasSmartMeterBay: false,
    modules: [
      { row: 0, type: 'smart_meter_3p', label: 'Etagenzähler 3P', teWidth: 4, entityId: 'sensor.unterverteilung_etage_leistung' },
      { row: 0, type: 'rcd_fi', label: 'FI Etage 40A/30mA', teWidth: 4 },
      { row: 0, type: 'din_psu_24v', label: '24V DC Versorgung', teWidth: 2 },
      { row: 1, type: 'mcb_1p', label: 'Schlafzimmer B16', teWidth: 1 },
      { row: 1, type: 'mcb_1p', label: 'Kinderzimmer B16', teWidth: 1 },
      { row: 1, type: 'mcb_1p', label: 'Badezimmer B16', teWidth: 1 },
      { row: 1, type: 'mcb_1p', label: 'Flur & Treppen-LED B10', teWidth: 1 },
      { row: 1, type: 'shelly_din_relay', label: 'Shelly Pro Lichtsteuerung', teWidth: 2 },
      { row: 2, type: 'knx_actuator', label: '8x Jalousie-/Heizungsaktor', teWidth: 6 },
      { row: 2, type: 'zigbee_din_gateway', label: 'Etagen-Gateway PoE', teWidth: 2 },
    ],
  },
  {
    id: 'pv_wallbox_uv',
    name: 'PV-, Speicher-, Wärmepumpen- & Wallbox-UV',
    badge: '3 Hutschienen · Energie',
    rows: 3,
    bays: 1,
    hasSmartMeterBay: true,
    modules: [
      { row: 0, type: 'surge_spd', label: 'ÜSS Typ 1+2 Energie', teWidth: 4 },
      { row: 0, type: 'smart_meter_3p', label: 'EnFluRi Smart Meter', teWidth: 4, entityId: 'sensor.zaehlerschrank_leistung' },
      { row: 1, type: 'rcd_fi', label: 'FI Typ B (Allstromsensitiv)', teWidth: 4 },
      { row: 1, type: 'mcb_3p', label: 'EV-Wallbox 11kW C16', teWidth: 3 },
      { row: 1, type: 'mcb_3p', label: 'PV-Hybridwechselrichter', teWidth: 3 },
      { row: 2, type: 'mcb_3p', label: 'Hausakku Notstrom-Umschaltung', teWidth: 3 },
      { row: 2, type: 'mcb_3p', label: 'Wärmepumpe Monoblock C25', teWidth: 3, entityId: 'sensor.wp_aufnahmeleistung' },
      { row: 2, type: 'shelly_din_relay', label: 'SG-Ready Freigaberelais', teWidth: 2 },
    ],
  },
  {
    id: 'garage_garden_uv',
    name: 'Kompakt-Unterverteilung Garage & Garten',
    badge: '1 Hutschiene · Kompakt',
    rows: 1,
    bays: 1,
    hasSmartMeterBay: false,
    modules: [
      { row: 0, type: 'rcd_fi', label: 'FI Garten/Garage 30mA', teWidth: 4 },
      { row: 0, type: 'smart_meter_3p', label: 'Sub-Meter Garage', teWidth: 4, entityId: 'sensor.unterverteilung_garage_leistung' },
      { row: 0, type: 'mcb_1p', label: 'Torantrieb & Hoflicht B16', teWidth: 1 },
      { row: 0, type: 'mcb_1p', label: 'Poolpumpe & Gartensteckd.', teWidth: 1 },
      { row: 0, type: 'shelly_din_relay', label: 'Shelly Bewässerung/Pool', teWidth: 2 },
    ],
  },
];

export const CabinetPlannerModal: React.FC<CabinetPlannerModalProps> = ({
  isOpen,
  onClose,
  zones,
  assets,
  entities,
  activeFloor,
  initialAssetId,
  onSaveCabinetAsset,
  onToggleEntity,
}) => {
  const existingCabinets = useMemo(
    () =>
      assets.filter(
        (a) =>
          a.catalogId === 'electrical_meter_cabinet' ||
          a.catalogId === 'sub_distribution_board_1row' ||
          a.catalogId === 'sub_distribution_board_3row'
      ),
    [assets]
  );

  const [selectedCabinetId, setSelectedCabinetId] = useState<string>('new');
  const [cabinetName, setCabinetName] = useState<string>('Haupt- & Unterverteilung');
  const [catalogType, setCatalogType] = useState<
    'electrical_meter_cabinet' | 'sub_distribution_board_3row' | 'sub_distribution_board_1row'
  >('sub_distribution_board_3row');
  const [targetZoneId, setTargetZoneId] = useState<string>('');
  const [rows, setRows] = useState<number>(3);
  const [bays, setBays] = useState<number>(1);
  const [doorStyle, setDoorStyle] = useState<CabinetDoorStyle>('smoked_glass');
  const [hasSmartMeterBay, setHasSmartMeterBay] = useState<boolean>(true);
  const [primaryEntityId, setPrimaryEntityId] = useState<string>('sensor.unterverteilung_etage_leistung');
  const [modules, setModules] = useState<DinRailModuleItem[]>([]);
  const [selectedModuleId, setSelectedModuleId] = useState<string | null>(null);
  const [activeRowForAdd, setActiveRowForAdd] = useState<number>(0);

  const indoorZones = useMemo(
    () => zones.filter((z) => z.zoneType === 'indoor'),
    [zones]
  );

  // Sync state when modal opens or selected cabinet changes
  useEffect(() => {
    if (!isOpen) return;
    const targetAsset =
      (initialAssetId && existingCabinets.find((a) => a.id === initialAssetId)) ||
      existingCabinets[0] ||
      null;

    if (targetAsset) {
      setSelectedCabinetId(targetAsset.id);
      loadFromAsset(targetAsset);
    } else {
      setSelectedCabinetId('new');
      applyTemplate(CABINET_TEMPLATES[0]);
      const defaultZone =
        indoorZones.find((z) => (z.level ?? 0) === activeFloor) || indoorZones[0];
      if (defaultZone) setTargetZoneId(defaultZone.id);
    }
  }, [isOpen, initialAssetId]);

  const loadFromAsset = (asset: PlacedAsset) => {
    setCabinetName(asset.name || 'Unterverteiler');
    setCatalogType(
      (asset.catalogId as
        | 'electrical_meter_cabinet'
        | 'sub_distribution_board_3row'
        | 'sub_distribution_board_1row') || 'sub_distribution_board_3row'
    );
    const defaultRows =
      asset.catalogId === 'electrical_meter_cabinet'
        ? 4
        : asset.catalogId === 'sub_distribution_board_1row'
        ? 1
        : 3;
    const cfg = asset.cabinetConfig;
    const rCount = Math.max(1, Math.min(6, cfg?.rows ?? defaultRows));
    setRows(rCount);
    setBays(Math.max(1, Math.min(3, cfg?.bays ?? (asset.catalogId === 'electrical_meter_cabinet' ? 2 : 1))));
    setDoorStyle(cfg?.doorStyle ?? 'smoked_glass');
    setHasSmartMeterBay(cfg?.hasSmartMeterBay ?? (asset.catalogId === 'electrical_meter_cabinet'));
    setPrimaryEntityId(asset.entityId || asset.techConfig?.powerEntityId || '');

    if (cfg?.modules && cfg.modules.length > 0) {
      const normalized = cfg.modules.map((m) => ({
        ...m,
        teWidth: m.teWidth ?? m.teUnits ?? 2,
      }));
      setModules(normalized);
      setSelectedModuleId(normalized[0]?.id ?? null);
    } else {
      const fallbackTpl =
        asset.catalogId === 'electrical_meter_cabinet'
          ? CABINET_TEMPLATES[0]
          : asset.catalogId === 'sub_distribution_board_1row'
          ? CABINET_TEMPLATES[3]
          : CABINET_TEMPLATES[1];
      const seeded = fallbackTpl.modules.map((m, idx) => ({
        ...m,
        id: `din_mod_${idx}_${Date.now()}`,
      }));
      setModules(seeded);
      setSelectedModuleId(seeded[0]?.id ?? null);
    }
  };

  const applyTemplate = (tpl: (typeof CABINET_TEMPLATES)[number]) => {
    setRows(tpl.rows);
    setBays(tpl.bays);
    setHasSmartMeterBay(tpl.hasSmartMeterBay);
    const seeded = tpl.modules.map((m, idx) => ({
      ...m,
      id: `din_tpl_${idx}_${Date.now()}`,
    }));
    setModules(seeded);
    setSelectedModuleId(seeded[0]?.id ?? null);
    setActiveRowForAdd(0);
  };

  const maxTePerRow = bays === 1 ? 12 : bays === 2 ? 18 : 24;

  const selectedModule = useMemo(
    () => modules.find((m) => m.id === selectedModuleId) || null,
    [modules, selectedModuleId]
  );

  const handleAddModule = (presetType: DinRailModuleType, targetRow = activeRowForAdd) => {
    const preset =
      DIN_RAIL_MODULE_PRESETS.find((p) => p.type === presetType) ||
      DIN_RAIL_MODULE_PRESETS[1];
    const safeRow = Math.max(0, Math.min(rows - 1, targetRow));
    const newMod: DinRailModuleItem = {
      id: `din_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      row: safeRow,
      type: preset.type,
      label: preset.shortLabel,
      teWidth: preset.defaultTe,
      teUnits: preset.defaultTe,
    };
    setModules((prev) => [...prev, newMod]);
    setSelectedModuleId(newMod.id);
  };

  const handleUpdateSelectedModule = (patch: Partial<DinRailModuleItem>) => {
    if (!selectedModuleId) return;
    setModules((prev) =>
      prev.map((m) =>
        m.id === selectedModuleId
          ? {
              ...m,
              ...patch,
              teWidth: patch.teWidth ?? patch.teUnits ?? m.teWidth,
              teUnits: patch.teWidth ?? patch.teUnits ?? m.teWidth,
            }
          : m
      )
    );
  };

  const handleDeleteModule = (id: string) => {
    setModules((prev) => {
      const next = prev.filter((m) => m.id !== id);
      if (selectedModuleId === id) {
        setSelectedModuleId(next[0]?.id ?? null);
      }
      return next;
    });
  };

  const handleMoveModuleOrder = (id: string, dir: -1 | 1) => {
    setModules((prev) => {
      const target = prev.find((m) => m.id === id);
      if (!target) return prev;
      const rowMods = prev.filter((m) => m.row === target.row);
      const idxInRow = rowMods.findIndex((m) => m.id === id);
      const swapIdx = idxInRow + dir;
      if (swapIdx < 0 || swapIdx >= rowMods.length) return prev;
      const otherId = rowMods[swapIdx].id;
      const globalA = prev.findIndex((m) => m.id === id);
      const globalB = prev.findIndex((m) => m.id === otherId);
      const copy = [...prev];
      const temp = copy[globalA];
      copy[globalA] = copy[globalB];
      copy[globalB] = temp;
      return copy;
    });
  };

  const handleSave = () => {
    const cabinetConfig: CabinetConfiguration = {
      rows,
      bays,
      doorStyle,
      hasSmartMeterBay,
      modules: modules.map((m) => ({
        ...m,
        row: Math.max(0, Math.min(rows - 1, m.row)),
        teWidth: Math.max(1, Math.min(8, m.teWidth || m.teUnits || 1)),
        teUnits: Math.max(1, Math.min(8, m.teWidth || m.teUnits || 1)),
      })),
    };

    const existing = existingCabinets.find((a) => a.id === selectedCabinetId);
    if (existing) {
      const updated: PlacedAsset = {
        ...existing,
        name: cabinetName.trim() || existing.name,
        catalogId: catalogType,
        entityId: primaryEntityId.trim() || existing.entityId,
        cabinetConfig,
        techConfig: {
          ...existing.techConfig,
          powerEntityId: primaryEntityId.trim() || existing.techConfig?.powerEntityId,
        },
      };
      onSaveCabinetAsset(updated, false);
    } else {
      const hostZone =
        indoorZones.find((z) => z.id === targetZoneId) ||
        indoorZones.find((z) => (z.level ?? 0) === activeFloor) ||
        indoorZones[0];
      const zx = hostZone ? hostZone.x : 0;
      const zz = hostZone ? hostZone.z - hostZone.depth / 2 + 0.14 : 0;
      const zLevel = (hostZone?.level ?? activeFloor) as FloorLevelId;
      const dims =
        catalogType === 'electrical_meter_cabinet'
          ? { w: 0.95, h: 1.95, d: 0.24, y: 0 }
          : catalogType === 'sub_distribution_board_1row'
          ? { w: 0.36, h: 0.32, d: 0.12, y: 1.45 }
          : { w: 0.58, h: 0.78, d: 0.14, y: 1.18 };

      const created: PlacedAsset = {
        id: `asset_cabinet_${Date.now()}`,
        catalogId: catalogType,
        name: cabinetName.trim() || 'Unterverteiler',
        category: 'outdoor_energy',
        mountType: catalogType === 'electrical_meter_cabinet' ? 'floor' : 'wall',
        level: zLevel,
        position: [zx, dims.y, zz],
        rotationY: 0,
        scale: 1,
        customWidth: dims.w,
        customHeight: dims.h,
        customDepth: dims.d,
        entityId: primaryEntityId.trim() || undefined,
        cabinetConfig,
        techConfig: primaryEntityId.trim()
          ? { powerEntityId: primaryEntityId.trim() }
          : undefined,
      };
      onSaveCabinetAsset(created, true);
    }
    onClose();
  };

  if (!isOpen) return null;

  // Compute live total cabinet power
  const primaryEntity = primaryEntityId ? entities[primaryEntityId] : undefined;
  const totalCabinetPowerStr =
    primaryEntity?.attributes?.current_power_w !== undefined
      ? `${primaryEntity.attributes.current_power_w} W`
      : primaryEntity?.state || '420 W';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-3 sm:p-5">
      <div className="relative flex flex-col w-full max-w-6xl max-h-[92vh] rounded-2xl border border-amber-400/30 bg-slate-950/95 text-slate-100 shadow-2xl overflow-hidden">
        {/* Top Modal Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 border-b border-white/10 bg-slate-900/90">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-400/40 flex items-center justify-center text-amber-300">
              <Zap className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold tracking-tight text-white">
                  Grafischer 2D-Unterverteiler- & Zählerschrank-Editor
                </h2>
                <span className="px-2 py-0.5 rounded-md text-[10px] font-mono uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-400/30">
                  DIN-Hutschienen · Live-HA
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Interaktive 2D-Schrankansicht mit Hutschienen (TE), FI/LS-Automaten, Smart Meter, N/PE-Klemmen & Echtzeit-Schaltung
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Switch between existing cabinets or create a new one */}
            <select
              value={selectedCabinetId}
              onChange={(e) => {
                const val = e.target.value;
                setSelectedCabinetId(val);
                if (val === 'new') {
                  applyTemplate(CABINET_TEMPLATES[1]);
                  setCabinetName('Neue Unterverteilung');
                } else {
                  const found = existingCabinets.find((a) => a.id === val);
                  if (found) loadFromAsset(found);
                }
              }}
              className="rounded-lg bg-slate-900 border border-white/15 px-3 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-amber-400"
            >
              {existingCabinets.map((cab) => (
                <option key={cab.id} value={cab.id}>
                  📦 {cab.name} ({cab.level === -1 ? 'KG' : cab.level === 1 ? '1. OG' : cab.level === 2 ? 'DG' : 'EG'})
                </option>
              ))}
              <option value="new">＋ Neuen Verteilerschrank anlegen…</option>
            </select>

            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition"
              title="Schließen"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Main 3-Column Interactive Workspace */}
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 min-h-0 overflow-hidden">
          {/* Left Column: Cabinet Settings, Templates & DIN Module Catalog */}
          <div className="lg:col-span-3 border-r border-white/10 bg-slate-900/50 p-4 overflow-y-auto space-y-4">
            <div className="space-y-2.5">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-amber-300 flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5" />
                Schrank-Grunddaten
              </div>
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">Bezeichnung</label>
                <input
                  type="text"
                  value={cabinetName}
                  onChange={(e) => setCabinetName(e.target.value)}
                  className="w-full rounded-lg bg-slate-950 border border-white/15 px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-amber-400"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">Bauform</label>
                  <select
                    value={catalogType}
                    onChange={(e) =>
                      setCatalogType(
                        e.target.value as
                          | 'electrical_meter_cabinet'
                          | 'sub_distribution_board_3row'
                          | 'sub_distribution_board_1row'
                      )
                    }
                    className="w-full rounded-lg bg-slate-950 border border-white/15 px-2 py-1.5 text-xs text-white"
                  >
                    <option value="electrical_meter_cabinet">Zählerschrank (Groß)</option>
                    <option value="sub_distribution_board_3row">Unterverteiler (Mehrreihig)</option>
                    <option value="sub_distribution_board_1row">Kleinverteiler (Kompakt)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">3D-Schranktür</label>
                  <select
                    value={doorStyle}
                    onChange={(e) => setDoorStyle(e.target.value as CabinetDoorStyle)}
                    className="w-full rounded-lg bg-slate-950 border border-white/15 px-2 py-1.5 text-xs text-white"
                  >
                    <option value="smoked_glass">Rauchglastür</option>
                    <option value="open_inspection">Offen (Hutschienen frei)</option>
                    <option value="steel_white">Stahlblech Weiß</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">
                    Hutschienen ({rows})
                  </label>
                  <input
                    type="range"
                    min={1}
                    max={6}
                    value={rows}
                    onChange={(e) => setRows(Number(e.target.value))}
                    className="w-full accent-amber-400"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">
                    Felder ({bays} · {maxTePerRow} TE)
                  </label>
                  <input
                    type="range"
                    min={1}
                    max={3}
                    value={bays}
                    onChange={(e) => setBays(Number(e.target.value))}
                    className="w-full accent-amber-400"
                  />
                </div>
              </div>

              <label className="flex items-center justify-between gap-2 rounded-lg bg-slate-950/80 border border-white/10 px-2.5 py-1.5 text-xs cursor-pointer">
                <span className="text-slate-300">Digitales eHZ-Zählerfeld oben</span>
                <input
                  type="checkbox"
                  checked={hasSmartMeterBay}
                  onChange={(e) => setHasSmartMeterBay(e.target.checked)}
                  className="accent-amber-400"
                />
              </label>

              {selectedCabinetId === 'new' && indoorZones.length > 0 && (
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">Zielraum im Plan</label>
                  <select
                    value={targetZoneId}
                    onChange={(e) => setTargetZoneId(e.target.value)}
                    className="w-full rounded-lg bg-slate-950 border border-white/15 px-2.5 py-1.5 text-xs text-white"
                  >
                    {indoorZones.map((z) => (
                      <option key={z.id} value={z.id}>
                        {z.name} ({z.level === -1 ? 'KG' : z.level === 1 ? '1. OG' : z.level === 2 ? 'DG' : 'EG'})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-[11px] text-slate-400 mb-1">
                  Haupt-Leistungsentität (Saldierend)
                </label>
                <input
                  type="text"
                  list="cabinet-ha-entities"
                  value={primaryEntityId}
                  onChange={(e) => setPrimaryEntityId(e.target.value)}
                  placeholder="z.B. sensor.zaehlerschrank_leistung"
                  className="w-full rounded-lg bg-slate-950 border border-white/15 px-2.5 py-1.5 text-xs font-mono text-amber-200"
                />
              </div>
            </div>

            {/* 1-Click Templates */}
            <div className="pt-2 border-t border-white/10 space-y-2">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-cyan-300 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" />
                1-Klick Bestückungs-Vorlagen
              </div>
              <div className="grid grid-cols-1 gap-1.5">
                {CABINET_TEMPLATES.map((tpl) => (
                  <button
                    key={tpl.id}
                    type="button"
                    onClick={() => applyTemplate(tpl)}
                    className="text-left rounded-lg border border-white/10 bg-slate-950/80 hover:border-amber-400/50 hover:bg-amber-500/10 px-2.5 py-2 transition"
                  >
                    <div className="text-xs font-semibold text-white">{tpl.name}</div>
                    <div className="text-[10px] text-amber-300/90 font-mono">{tpl.badge}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Add DIN Rail Modules Catalog */}
            <div className="pt-2 border-t border-white/10 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-emerald-300">
                  DIN-Bausteine (+ Hutschiene {activeRowForAdd + 1})
                </span>
              </div>
              <div className="space-y-1.5">
                {DIN_RAIL_MODULE_PRESETS.map((preset) => (
                  <button
                    key={preset.type}
                    type="button"
                    onClick={() => handleAddModule(preset.type, activeRowForAdd)}
                    className="w-full flex items-center justify-between gap-2 rounded-lg border border-white/10 bg-slate-950/90 hover:border-emerald-400/50 hover:bg-emerald-500/10 px-2.5 py-1.5 text-left transition"
                  >
                    <div className="min-w-0">
                      <div className="text-xs font-medium text-slate-100 truncate">
                        {preset.shortLabel}
                      </div>
                      <div className="text-[10px] text-slate-400 truncate">{preset.name}</div>
                    </div>
                    <span
                      className="shrink-0 px-1.5 py-0.5 rounded text-[10px] font-mono font-bold text-white"
                      style={{ backgroundColor: preset.badgeColor }}
                    >
                      +{preset.defaultTe} TE
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Center Column: Interactive 2D Visual Distribution Cabinet Enclosure */}
          <div className="lg:col-span-6 bg-slate-950 p-4 sm:p-6 overflow-y-auto flex flex-col items-center">
            {/* Realistic Steel Enclosure Frame */}
            <div className="w-full max-w-2xl rounded-2xl border-4 border-slate-600 bg-gradient-to-b from-slate-800 via-slate-900 to-slate-950 p-4 shadow-[inset_0_2px_20px_rgba(0,0,0,0.85)] space-y-4">
              {/* Top Cabinet Header & N / PE Busbar Block */}
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-700 bg-slate-900/95 px-3.5 py-2.5">
                <div className="flex items-center gap-3">
                  {/* Blue N Terminal Bar */}
                  <div className="flex items-center gap-1 px-2.5 py-1 rounded bg-sky-900/70 border border-sky-400/50">
                    <span className="text-[10px] font-mono font-bold text-sky-300">N-Schiene</span>
                    <div className="flex gap-1 ml-1">
                      {[0, 1, 2, 3, 4, 5].map((screw) => (
                        <span
                          key={screw}
                          className="w-2 h-2 rounded-full bg-sky-300/80 border border-sky-950"
                        />
                      ))}
                    </div>
                  </div>
                  {/* Green/Yellow PE Terminal Bar */}
                  <div className="flex items-center gap-1 px-2.5 py-1 rounded bg-emerald-950/80 border border-lime-400/50">
                    <span className="text-[10px] font-mono font-bold text-lime-300">PE-Erde</span>
                    <div className="flex gap-1 ml-1">
                      {[0, 1, 2, 3, 4, 5].map((screw) => (
                        <span
                          key={screw}
                          className="w-2 h-2 rounded-full bg-lime-300/80 border border-emerald-950"
                        />
                      ))}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-mono text-slate-400">Gesamtlast:</span>
                  <span className="px-2.5 py-0.5 rounded-md bg-amber-500/20 border border-amber-400/40 text-xs font-mono font-bold text-amber-300">
                    ⚡ {totalCabinetPowerStr}
                  </span>
                </div>
              </div>

              {/* Optional Digital eHZ Smart Meter Bay */}
              {hasSmartMeterBay && (
                <div className="rounded-xl border border-emerald-500/30 bg-slate-900/90 p-3 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-14 rounded-lg bg-slate-950 border-2 border-emerald-400/50 flex flex-col items-center justify-center p-1">
                      <span className="text-[8px] font-mono text-emerald-400">eHZ 2-R</span>
                      <span className="text-[11px] font-mono font-bold text-emerald-300">
                        {totalCabinetPowerStr}
                      </span>
                    </div>
                    <div>
                      <div className="text-xs font-bold text-white">
                        Digitaler Zweirichtungszähler (eHZ / Smart Meter Gateway)
                      </div>
                      <div className="text-[11px] text-slate-400 font-mono">
                        {primaryEntityId || 'Saldierende Messung L1 + L2 + L3'}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-[10px] font-mono uppercase text-emerald-300">
                      Optische Schnittstelle OK
                    </div>
                    <div className="text-[11px] font-mono text-slate-400">
                      3× 230/400 V · 50 Hz
                    </div>
                  </div>
                </div>
              )}

              {/* DIN Rails (Hutschienen 1 .. rows) */}
              <div className="space-y-3.5">
                {Array.from({ length: rows }).map((_, rowIdx) => {
                  const rowMods = modules.filter((m) => m.row === rowIdx);
                  const usedTe = rowMods.reduce(
                    (acc, m) => acc + (m.teWidth || m.teUnits || 1),
                    0
                  );
                  const freeTe = Math.max(0, maxTePerRow - usedTe);
                  const isRowActive = activeRowForAdd === rowIdx;

                  return (
                    <div
                      key={rowIdx}
                      onClick={() => setActiveRowForAdd(rowIdx)}
                      className={`rounded-xl border p-3 transition cursor-pointer ${
                        isRowActive
                          ? 'border-amber-400/60 bg-slate-900/95 shadow-[0_0_20px_rgba(245,158,11,0.12)]'
                          : 'border-white/10 bg-slate-900/65 hover:border-white/25'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                              isRowActive
                                ? 'bg-amber-400 text-slate-950'
                                : 'bg-slate-800 text-slate-300'
                            }`}
                          >
                            Hutschiene {rowIdx + 1}
                          </span>
                          <span className="text-[11px] font-mono text-slate-400">
                            Belegt: {usedTe} / {maxTePerRow} TE
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveRowForAdd(rowIdx);
                            handleAddModule('mcb_1p', rowIdx);
                          }}
                          className="px-2 py-0.5 rounded bg-white/5 hover:bg-amber-500/20 border border-white/10 hover:border-amber-400/40 text-[10px] font-mono text-amber-300 flex items-center gap-1"
                        >
                          <Plus className="w-3 h-3" /> + LS B16
                        </button>
                      </div>

                      {/* 35mm Aluminum DIN Rail Visual Track */}
                      <div className="relative flex items-stretch gap-1 min-h-[92px] rounded-lg bg-slate-950/90 border border-slate-800 p-2 overflow-x-auto">
                        {/* Metallic 35mm DIN rail bar behind modules */}
                        <div className="pointer-events-none absolute inset-x-0 top-1/2 -translate-y-1/2 h-5 bg-gradient-to-b from-slate-500/35 via-slate-300/45 to-slate-600/35 border-y border-slate-400/40" />

                        {rowMods.map((mod) => {
                          const preset =
                            DIN_RAIL_MODULE_PRESETS.find((p) => p.type === mod.type) ||
                            DIN_RAIL_MODULE_PRESETS[1];
                          const te = Math.max(1, mod.teWidth || mod.teUnits || preset.defaultTe);
                          const isSelected = mod.id === selectedModuleId;
                          const boundEntity = mod.entityId ? entities[mod.entityId] : undefined;
                          const isOn = boundEntity ? isBinaryEntityActive(boundEntity) : true;
                          const powerVal =
                            boundEntity?.attributes?.current_power_w !== undefined
                              ? `${boundEntity.attributes.current_power_w}W`
                              : boundEntity?.domain === 'sensor'
                              ? boundEntity.state
                              : null;

                          return (
                            <div
                              key={mod.id}
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedModuleId(mod.id);
                                setActiveRowForAdd(rowIdx);
                              }}
                              style={{
                                width: `${Math.max(44, te * 38)}px`,
                              }}
                              className={`relative z-10 shrink-0 rounded-lg border-2 flex flex-col justify-between p-1.5 select-none transition ${
                                isSelected
                                  ? 'border-amber-400 bg-slate-800 shadow-[0_0_14px_rgba(245,158,11,0.45)] scale-[1.02]'
                                  : 'border-slate-600 bg-slate-800/95 hover:border-slate-400'
                              }`}
                            >
                              {/* Top screw terminals */}
                              <div className="flex items-center justify-between gap-1">
                                <span
                                  className="px-1 py-0.2 rounded text-[8px] font-mono font-bold text-white truncate"
                                  style={{ backgroundColor: preset.badgeColor }}
                                >
                                  {te}TE
                                </span>
                                {mod.type === 'rcd_fi' && (
                                  <span
                                    className="px-1 rounded bg-sky-500 text-[8px] font-bold text-slate-950"
                                    title="FI-Prüftaster (Test)"
                                  >
                                    T
                                  </span>
                                )}
                              </div>

                              {/* Module Label */}
                              <div className="my-1 text-center">
                                <div className="text-[10px] font-semibold text-white leading-tight line-clamp-2">
                                  {mod.label}
                                </div>
                              </div>

                              {/* Interactive Breaker Lever or LCD Smart Meter Screen */}
                              {mod.type === 'smart_meter_3p' ? (
                                <div className="rounded bg-emerald-950/90 border border-emerald-400/50 px-1 py-0.5 text-center font-mono text-[9px] text-emerald-300">
                                  {powerVal || '3P LCD'}
                                </div>
                              ) : (
                                <div className="flex items-center justify-center gap-1">
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setSelectedModuleId(mod.id);
                                      if (mod.entityId && onToggleEntity) {
                                        onToggleEntity(mod.entityId);
                                      }
                                    }}
                                    title={
                                      mod.entityId
                                        ? `Klicken zum Schalten (${mod.entityId})`
                                        : 'Sicherungshebel (aktiv)'
                                    }
                                    className={`w-full py-0.5 rounded text-[9px] font-mono font-bold transition ${
                                      isOn
                                        ? 'bg-emerald-500/80 text-slate-950 hover:bg-emerald-400'
                                        : 'bg-rose-500/80 text-white hover:bg-rose-400'
                                    }`}
                                  >
                                    {powerVal ? `${isOn ? 'EIN' : 'AUS'} · ${powerVal}` : isOn ? 'I · EIN' : '0 · AUS'}
                                  </button>
                                </div>
                              )}
                            </div>
                          );
                        })}

                        {/* Empty TE Reserve Covers (Blindabdeckungen) */}
                        {freeTe > 0 && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveRowForAdd(rowIdx);
                              handleAddModule('mcb_1p', rowIdx);
                            }}
                            style={{ width: `${Math.max(44, freeTe * 24)}px` }}
                            className="relative z-10 shrink-0 rounded-lg border border-dashed border-slate-700 bg-slate-900/50 hover:border-amber-400/50 hover:bg-amber-500/10 flex flex-col items-center justify-center p-1 text-slate-500 hover:text-amber-300 transition"
                            title="Freie Teilungseinheiten — Klicken zum Bestücken"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span className="text-[9px] font-mono">{freeTe} TE frei</span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Bottom 3-Phase Copper Busbar (Phasenschiene L1 / L2 / L3) */}
              <div className="rounded-xl border border-amber-500/30 bg-slate-900/95 px-3.5 py-2 flex items-center justify-between text-[10px] font-mono">
                <div className="flex items-center gap-2">
                  <span className="text-amber-300 font-bold">3-Phasen-Kammschiene:</span>
                  <span className="px-1.5 py-0.5 rounded bg-amber-900/50 text-amber-200 border border-amber-500/30">
                    L1 (Braun)
                  </span>
                  <span className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-200 border border-white/15">
                    L2 (Schwarz)
                  </span>
                  <span className="px-1.5 py-0.5 rounded bg-slate-700 text-slate-200 border border-white/15">
                    L3 (Grau)
                  </span>
                </div>
                <span className="text-slate-400">16 mm² Kupfer · Berührungsschutz IP2X</span>
              </div>
            </div>
          </div>

          {/* Right Column: Selected DIN Module Inspector */}
          <div className="lg:col-span-3 border-l border-white/10 bg-slate-900/50 p-4 overflow-y-auto space-y-4">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-amber-300 flex items-center gap-1.5">
              <Cpu className="w-3.5 h-3.5" />
              Ausgewähltes Hutschienen-Modul
            </div>

            {selectedModule ? (
              <div className="space-y-3 rounded-xl border border-white/10 bg-slate-950/90 p-3.5">
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">
                    Beschriftung (Stromkreis / Gerät)
                  </label>
                  <input
                    type="text"
                    value={selectedModule.label}
                    onChange={(e) => handleUpdateSelectedModule({ label: e.target.value })}
                    className="w-full rounded-lg bg-slate-900 border border-white/15 px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-amber-400"
                  />
                </div>

                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">Modultyp</label>
                  <select
                    value={selectedModule.type}
                    onChange={(e) => {
                      const newType = e.target.value as DinRailModuleType;
                      const preset = DIN_RAIL_MODULE_PRESETS.find((p) => p.type === newType);
                      handleUpdateSelectedModule({
                        type: newType,
                        teWidth: preset?.defaultTe ?? selectedModule.teWidth,
                      });
                    }}
                    className="w-full rounded-lg bg-slate-900 border border-white/15 px-2.5 py-1.5 text-xs text-white"
                  >
                    {DIN_RAIL_MODULE_PRESETS.map((p) => (
                      <option key={p.type} value={p.type}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">Hutschiene</label>
                    <select
                      value={selectedModule.row}
                      onChange={(e) =>
                        handleUpdateSelectedModule({ row: Number(e.target.value) })
                      }
                      className="w-full rounded-lg bg-slate-900 border border-white/15 px-2.5 py-1.5 text-xs text-white"
                    >
                      {Array.from({ length: rows }).map((_, rIdx) => (
                        <option key={rIdx} value={rIdx}>
                          Schiene {rIdx + 1}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">Breite (TE)</label>
                    <input
                      type="number"
                      min={1}
                      max={8}
                      value={selectedModule.teWidth || selectedModule.teUnits || 1}
                      onChange={(e) =>
                        handleUpdateSelectedModule({
                          teWidth: Math.max(1, Math.min(8, Number(e.target.value))),
                        })
                      }
                      className="w-full rounded-lg bg-slate-900 border border-white/15 px-2.5 py-1.5 text-xs text-white font-mono"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">
                    Home Assistant Entität (Schalter / Leistung)
                  </label>
                  <input
                    type="text"
                    list="cabinet-ha-entities"
                    value={selectedModule.entityId || ''}
                    onChange={(e) =>
                      handleUpdateSelectedModule({ entityId: e.target.value })
                    }
                    placeholder="z.B. switch.shelly_pro_kueche oder sensor.*_power"
                    className="w-full rounded-lg bg-slate-900 border border-white/15 px-2.5 py-1.5 text-xs font-mono text-amber-200"
                  />
                </div>

                {selectedModule.entityId && entities[selectedModule.entityId] && (
                  <div className="rounded-lg bg-emerald-500/10 border border-emerald-400/30 p-2.5 flex items-center justify-between">
                    <div>
                      <div className="text-[11px] font-semibold text-emerald-200">
                        {entities[selectedModule.entityId].attributes.friendly_name}
                      </div>
                      <div className="text-xs font-mono text-white">
                        Status: {entities[selectedModule.entityId].state}
                        {entities[selectedModule.entityId].attributes.current_power_w !== undefined
                          ? ` · ${entities[selectedModule.entityId].attributes.current_power_w} W`
                          : ''}
                      </div>
                    </div>
                    {onToggleEntity && (
                      <button
                        type="button"
                        onClick={() => onToggleEntity(selectedModule.entityId!)}
                        className="p-2 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-400/40"
                        title="Stromkreis / Aktor umschalten"
                      >
                        <Power className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                )}

                <div className="flex items-center justify-between gap-2 pt-2 border-t border-white/10">
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => handleMoveModuleOrder(selectedModule.id, -1)}
                      className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-xs text-slate-200 flex items-center gap-1"
                      title="Auf Hutschiene nach links schieben"
                    >
                      <ArrowUp className="w-3.5 h-3.5 -rotate-90" /> Links
                    </button>
                    <button
                      type="button"
                      onClick={() => handleMoveModuleOrder(selectedModule.id, 1)}
                      className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-xs text-slate-200 flex items-center gap-1"
                      title="Auf Hutschiene nach rechts schieben"
                    >
                      Rechts <ArrowDown className="w-3.5 h-3.5 -rotate-90" />
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleDeleteModule(selectedModule.id)}
                    className="px-2.5 py-1 rounded bg-rose-500/20 hover:bg-rose-500/30 border border-rose-400/40 text-xs text-rose-300 flex items-center gap-1"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Entfernen
                  </button>
                </div>
              </div>
            ) : (
              <div className="rounded-xl border border-white/10 bg-slate-950/60 p-4 text-xs text-slate-400">
                Klicke in der 2D-Schrankansicht auf einen Sicherungsautomaten, FI oder Smart Meter, um Beschriftung, Breite (TE) und Home Assistant Entität zu bearbeiten.
              </div>
            )}

            <datalist id="cabinet-ha-entities">
              {Object.values(entities).map((ent) => (
                <option key={ent.entity_id} value={ent.entity_id}>
                  {ent.attributes.friendly_name} ({ent.state})
                </option>
              ))}
            </datalist>
          </div>
        </div>

        {/* Bottom Modal Footer */}
        <div className="flex items-center justify-between gap-3 px-5 py-3 border-t border-white/10 bg-slate-900/90">
          <div className="text-xs text-slate-400">
            Gesamt: <strong className="text-white">{modules.length} Hutschienen-Module</strong> auf{' '}
            <strong className="text-white">{rows} Hutschienen</strong> (wird auch im 3D-Schrank hinter der Rauchglastür dargestellt)
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-white/15 bg-slate-800/80 hover:bg-slate-800 text-xs font-semibold text-slate-200 transition"
            >
              Abbrechen
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="px-5 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-bold flex items-center gap-1.5 shadow-lg shadow-amber-500/20 transition"
            >
              <Check className="w-4 h-4" />
              Unterverteiler im Plan übernehmen
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
