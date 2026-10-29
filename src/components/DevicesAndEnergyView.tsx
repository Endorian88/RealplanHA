import React, { useMemo, useState } from 'react';
import {
  Activity,
  Battery,
  Blinds,
  CheckCircle2,
  Cpu,
  DoorOpen,
  Droplets,
  Eye,
  Flame,
  Lightbulb,
  Plus,
  Power,
  Radio,
  Search,
  ShieldAlert,
  Sun,
  Trash2,
  Wifi,
  Zap,
} from 'lucide-react';
import { ASSET_CATALOG } from '../data/catalogAndInitialState';
import {
  FloorplanProject,
  HAEntityState,
  isOpeningActuatorControllable,
  PlacedAsset,
  resolveOpeningSensorState,
  WallOpening,
} from '../types/floorplan';

interface DevicesAndEnergyViewProps {
  project: FloorplanProject;
  entities: Record<string, HAEntityState>;
  onToggleEntity: (entityId: string) => void;
  onTriggerAlarmTest: (entityId: string) => void;
  onFocusEntityIn3D: (entityId: string) => void;
  onFocusAssetOrOpeningIn3D?: (target: { assetId?: string; openingId?: string; entityId?: string }) => void;
  onAddManualOverviewEntity?: (entityId: string) => void;
  onRemoveManualOverviewEntity?: (entityId: string) => void;
}

type OverviewFilterCategory =
  | 'all'
  | 'sensors_contacts'
  | 'plugs_distribution'
  | 'lighting'
  | 'shading_gates_outdoor'
  | 'manual';

interface OverviewItemRow {
  key: string;
  title: string;
  subtitle: string;
  category: OverviewFilterCategory;
  sourceLabel: string;
  isManualOnly: boolean;
  entityId?: string;
  actuatorEntityId?: string;
  shutterEntityId?: string;
  asset?: PlacedAsset;
  opening?: WallOpening;
  levelLabel: string;
}

function getLevelShortLabel(level?: number): string {
  if (level === -1) return 'KG';
  if (level === 1) return '1. OG';
  if (level === 2) return 'DG';
  return 'EG';
}

export const DevicesAndEnergyView: React.FC<DevicesAndEnergyViewProps> = ({
  project,
  entities,
  onToggleEntity,
  onTriggerAlarmTest,
  onFocusEntityIn3D,
  onFocusAssetOrOpeningIn3D,
  onAddManualOverviewEntity,
  onRemoveManualOverviewEntity,
}) => {
  const [filterCat, setFilterCat] = useState<OverviewFilterCategory>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [manualInputId, setManualInputId] = useState('');

  const manualIds = project.manualOverviewIds || [];

  // Collect strictly ONLY items placed in the plan (assets, openings, roof PV/dormers/skylights, zone climate/presence)
  // plus entities explicitly added manually by the user (`manualOverviewIds`).
  const overviewItems = useMemo<OverviewItemRow[]>(() => {
    const rows: OverviewItemRow[] = [];
    const seenEntityIds = new Set<string>();

    // 1. All Placed Assets from the 2D/3D Plan (Lamps, Sun Sails, Sub-Distribution Boards, Sensors, Plugs, Gates, Outdoor Seating, etc.)
    for (const asset of project.assets) {
      const catMeta = ASSET_CATALOG.find((c) => c.id === asset.catalogId);
      const entId = asset.entityId || undefined;
      const actId = asset.actuatorEntityId || undefined;
      if (entId) seenEntityIds.add(entId);
      if (actId) seenEntityIds.add(actId);

      // Also track techConfig entities if present
      if (asset.techConfig) {
        Object.values(asset.techConfig).forEach((v) => {
          if (typeof v === 'string' && v) seenEntityIds.add(v);
        });
      }

      let cat: OverviewFilterCategory = 'shading_gates_outdoor';
      if (
        asset.category === 'lighting' ||
        asset.catalogId.includes('lamp') ||
        asset.catalogId.includes('light') ||
        asset.catalogId.includes('lantern')
      ) {
        cat = 'lighting';
      } else if (
        asset.catalogId === 'smart_plug' ||
        asset.catalogId === 'power_strip' ||
        asset.catalogId === 'wall_switch_double' ||
        asset.catalogId === 'electrical_meter_cabinet' ||
        asset.catalogId === 'sub_distribution_board_1row' ||
        asset.catalogId === 'sub_distribution_board_3row' ||
        asset.catalogId === 'pv_inverter_system' ||
        asset.catalogId === 'home_battery_inverter' ||
        asset.catalogId === 'ev_wallbox'
      ) {
        cat = 'plugs_distribution';
      } else if (
        asset.category === 'sensors_plugs' ||
        asset.catalogId.includes('sensor') ||
        asset.catalogId.includes('detector') ||
        asset.catalogId.includes('camera') ||
        asset.catalogId.includes('doorbell')
      ) {
        cat = 'sensors_contacts';
      } else {
        cat = 'shading_gates_outdoor';
      }

      rows.push({
        key: `asset_${asset.id}`,
        title: asset.name,
        subtitle: catMeta?.badgeText || catMeta?.name || asset.catalogId,
        category: cat,
        sourceLabel: 'Im Plan platziert',
        isManualOnly: false,
        entityId: entId,
        actuatorEntityId: actId,
        asset,
        levelLabel: getLevelShortLabel(asset.level),
      });
    }

    // 2. All Placed Wall Openings (Windows, Doors, Garage Doors, Shutters) that are in the plan
    for (const op of project.openings) {
      if (op.entityId) seenEntityIds.add(op.entityId);
      if (op.tiltEntityId) seenEntityIds.add(op.tiltEntityId);
      if (op.shutterEntityId) seenEntityIds.add(op.shutterEntityId);
      if (op.actuatorEntityId) seenEntityIds.add(op.actuatorEntityId);

      const isGarageOrGate = op.type === 'garage_door';
      const hasShutter = Boolean(op.shutterEntityId);
      const cat: OverviewFilterCategory =
        isGarageOrGate || hasShutter ? 'shading_gates_outdoor' : 'sensors_contacts';

      const typeLabel =
        op.type === 'garage_door'
          ? 'Garagentor / Sektionaltor'
          : op.type === 'door'
          ? 'Tür / Hauseingang'
          : op.type === 'double_patio_door'
          ? 'Hebeschiebetür / Terrassentür'
          : 'Fenster';

      rows.push({
        key: `opening_${op.id}`,
        title: op.name,
        subtitle: `${typeLabel} (${op.width.toFixed(2)}×${op.height.toFixed(2)}m)`,
        category: cat,
        sourceLabel: 'Im Plan platziert',
        isManualOnly: false,
        entityId: op.entityId,
        actuatorEntityId: op.actuatorEntityId,
        shutterEntityId: op.shutterEntityId,
        opening: op,
        levelLabel: getLevelShortLabel(op.level),
      });
    }

    // 3. Roof PV Systems & Dormer/Skylight sensors configured in the plan's zones
    for (const z of project.zones) {
      if (z.roofConfig?.pvConfig?.enabled) {
        const pvEnt = z.roofConfig.pvConfig.entityId;
        if (pvEnt) seenEntityIds.add(pvEnt);
        rows.push({
          key: `zone_pv_${z.id}`,
          title: `PV-Dachanlage (${z.name})`,
          subtitle: `${z.roofConfig.pvConfig.kwPeak ?? 9.6} kWp Dach-Photovoltaik`,
          category: 'plugs_distribution',
          sourceLabel: 'Dach-Konfigurator',
          isManualOnly: false,
          entityId: pvEnt,
          levelLabel: getLevelShortLabel(z.level),
        });
      }
      if (z.presenceEntityId) {
        seenEntityIds.add(z.presenceEntityId);
        rows.push({
          key: `zone_pres_${z.id}`,
          title: `Raum-Präsenz (${z.name})`,
          subtitle: 'Verknüpfter Raum-Präsenzmelder',
          category: 'sensors_contacts',
          sourceLabel: 'Raum-Zuordnung',
          isManualOnly: false,
          entityId: z.presenceEntityId,
          levelLabel: getLevelShortLabel(z.level),
        });
      }
    }

    // 4. Manually Added Entities in Overview (`project.manualOverviewIds`)
    for (const manId of manualIds) {
      if (seenEntityIds.has(manId)) continue;
      seenEntityIds.add(manId);
      const ent = entities[manId];
      rows.push({
        key: `manual_${manId}`,
        title: (ent?.attributes?.friendly_name as string) || manId,
        subtitle: ent ? `Home Assistant · ${ent.domain}` : 'Manuell hinzugefügte Entität',
        category: 'manual',
        sourceLabel: 'Manuell hinzugefügt',
        isManualOnly: true,
        entityId: manId,
        levelLabel: 'HA',
      });
    }

    return rows;
  }, [project.assets, project.openings, project.zones, manualIds, entities]);

  const filteredRows = useMemo(() => {
    return overviewItems.filter((row) => {
      const matchesTab =
        filterCat === 'all'
          ? true
          : filterCat === 'manual'
          ? row.isManualOnly
          : row.category === filterCat;
      if (!matchesTab) return false;
      if (!searchTerm.trim()) return true;
      const q = searchTerm.toLowerCase();
      return (
        row.title.toLowerCase().includes(q) ||
        row.subtitle.toLowerCase().includes(q) ||
        (row.entityId && row.entityId.toLowerCase().includes(q)) ||
        (row.actuatorEntityId && row.actuatorEntityId.toLowerCase().includes(q))
      );
    });
  }, [overviewItems, filterCat, searchTerm]);

  // Metrics calculated strictly from placed/manual items
  const placedPowerEntities = overviewItems
    .map((r) => (r.entityId ? entities[r.entityId] : undefined))
    .filter((e): e is HAEntityState => Boolean(e && typeof e.attributes.current_power_w === 'number'));

  const totalPowerW = placedPowerEntities.reduce(
    (sum, e) => sum + (e.attributes.current_power_w ?? 0),
    0
  );

  const countByCat = (cat: OverviewFilterCategory) =>
    cat === 'all'
      ? overviewItems.length
      : cat === 'manual'
      ? overviewItems.filter((i) => i.isManualOnly).length
      : overviewItems.filter((i) => i.category === cat).length;

  const handleAddManual = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = manualInputId.trim();
    if (!trimmed || !onAddManualOverviewEntity) return;
    onAddManualOverviewEntity(trimmed);
    setManualInputId('');
  };

  return (
    <div className="w-full h-full overflow-y-auto pt-20 pb-28 px-4 sm:px-6 max-w-7xl mx-auto text-slate-100">
      {/* Header & Summary */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-5">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
            <Activity className="w-6 h-6 text-amber-400" />
            <span>Overview — Eingeplante Geräte, Lampen, Sonnensegel & Sensoren</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Zeigt ausschließlich Elemente, die aktiv in deinem 2D/3D-Plan platziert oder hier manuell hinzugefügt wurden.
          </p>
        </div>

        {/* Compact KPI Pills */}
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="px-3.5 py-2 rounded-xl bg-slate-900/90 border border-white/10">
            <div className="text-[10px] uppercase tracking-wider text-slate-400">
              Elemente im Plan
            </div>
            <div className="text-base font-bold font-mono text-white">
              {overviewItems.length}
            </div>
          </div>
          <div className="px-3.5 py-2 rounded-xl bg-slate-900/90 border border-emerald-500/30">
            <div className="text-[10px] uppercase tracking-wider text-emerald-300">
              Saldierte Leistung (Plan)
            </div>
            <div className="text-base font-bold font-mono text-emerald-400">
              {totalPowerW} W
            </div>
          </div>
        </div>
      </div>

      {/* Top Controls: Search + Manual Entity Addition */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 mb-5">
        <div className="lg:col-span-5 relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="In eingeplanten Lampen, Sonnensegeln, Sensoren, UV suchen…"
            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-900/90 border border-white/10 text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-400"
          />
        </div>

        <form
          onSubmit={handleAddManual}
          className="lg:col-span-7 flex flex-wrap sm:flex-nowrap items-center gap-2 bg-slate-900/90 border border-white/10 rounded-xl p-1.5"
        >
          <input
            type="text"
            list="overview-ha-entities-datalist"
            value={manualInputId}
            onChange={(e) => setManualInputId(e.target.value)}
            placeholder="Zusätzliche Home Assistant Entität manuell zur Overview hinzufügen (z.B. sensor.strom_uv)…"
            className="flex-1 min-w-[200px] bg-slate-950 border border-white/10 rounded-lg px-3 py-1.5 text-xs font-mono text-amber-300 placeholder-slate-500 focus:outline-none focus:border-amber-400"
          />
          <datalist id="overview-ha-entities-datalist">
            {Object.keys(entities).map((id) => (
              <option
                key={id}
                value={id}
                label={String(entities[id]?.attributes?.friendly_name || id)}
              />
            ))}
          </datalist>
          <button
            type="submit"
            className="px-3.5 py-1.5 rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-bold flex items-center gap-1.5 shrink-0 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Manuell hinzufügen</span>
          </button>
        </form>
      </div>

      {/* Category Filter Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-2 mb-5 no-scrollbar">
        {(
          [
            { id: 'all', label: 'Alle im Plan', icon: Activity },
            {
              id: 'lighting',
              label: 'Lampen, Park- & Wandleuchten',
              icon: Lightbulb,
            },
            {
              id: 'shading_gates_outdoor',
              label: 'Sonnensegel, Tore, Rollläden & Außen',
              icon: Sun,
            },
            {
              id: 'plugs_distribution',
              label: 'Unterverteilungen, Steckdosen & PV',
              icon: Zap,
            },
            {
              id: 'sensors_contacts',
              label: 'Sensoren, Kontakte & Melder',
              icon: ShieldAlert,
            },
            {
              id: 'manual',
              label: 'Manuell hinzugefügt',
              icon: Plus,
            },
          ] as const
        ).map((tab) => {
          const Icon = tab.icon;
          const active = filterCat === tab.id;
          const cnt = countByCat(tab.id);
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setFilterCat(tab.id)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border transition-colors whitespace-nowrap shrink-0 ${
                active
                  ? 'bg-amber-400 text-slate-950 border-amber-300 shadow-sm'
                  : 'bg-slate-900/80 text-slate-300 border-white/10 hover:text-white hover:bg-slate-800'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
              <span
                className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                  active ? 'bg-slate-950/20 text-slate-950 font-bold' : 'bg-slate-800 text-slate-400'
                }`}
              >
                {cnt}
              </span>
            </button>
          );
        })}
      </div>

      {/* Empty State if nothing matches */}
      {filteredRows.length === 0 ? (
        <div className="p-8 rounded-2xl bg-slate-900/70 border border-white/10 text-center space-y-2">
          <div className="text-sm font-bold text-slate-200">
            Keine Einträge in dieser Ansicht gefunden
          </div>
          <p className="text-xs text-slate-400 max-w-md mx-auto">
            Platziere Geräte, Lampen, Sonnensegel, Unterverteilungen oder Sensoren im Tab{' '}
            <strong className="text-amber-300">2D / 3D Planer & Katalog</strong> oder füge oben
            eine Entität manuell zur Overview hinzu.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {filteredRows.map((row) => {
            const primaryEntId =
              row.entityId || row.actuatorEntityId || row.shutterEntityId;
            const ent = primaryEntId ? entities[primaryEntId] : undefined;
            const toggleEntId =
              row.actuatorEntityId || row.shutterEntityId || row.entityId;

            const isControllable = row.opening
              ? isOpeningActuatorControllable(row.opening, entities) ||
                Boolean(row.opening.shutterEntityId)
              : row.asset
              ? row.asset.controlMode !== 'sensor_only' &&
                Boolean(
                  toggleEntId &&
                    entities[toggleEntId] &&
                    ['light', 'switch', 'cover', 'climate', 'media_player', 'vacuum', 'lawn_mower', 'valve', 'lock'].includes(
                      entities[toggleEntId].domain
                    )
                )
              : Boolean(
                  toggleEntId &&
                    entities[toggleEntId] &&
                    ['light', 'switch', 'cover', 'climate', 'input_boolean'].includes(
                      entities[toggleEntId].domain
                    )
                );

            const isSmokeOrLeak =
              ent?.attributes.device_class === 'smoke' ||
              ent?.attributes.device_class === 'moisture';
            const isAlarmActive =
              ent?.state === 'detected' || Boolean(ent?.attributes.alarm_test_active);

            let stateBadgeText = ent ? `${ent.state}` : '3D-Objekt im Plan';
            let isActiveVisual = false;

            if (row.opening) {
              const opState = resolveOpeningSensorState(row.opening, entities, false);
              stateBadgeText =
                opState === 'open'
                  ? 'OFFEN'
                  : opState === 'tilted'
                  ? 'GEKIPPT'
                  : 'GESCHLOSSEN';
              isActiveVisual = opState !== 'closed';
            } else if (ent) {
              const st = String(ent.state).toLowerCase();
              isActiveVisual =
                st === 'on' ||
                st === 'open' ||
                st === 'detected' ||
                st === 'playing' ||
                st === 'cleaning' ||
                st === 'mowing' ||
                st === 'heat';
              if (ent.attributes.unit_of_measurement && !String(ent.state).includes(ent.attributes.unit_of_measurement)) {
                stateBadgeText = `${ent.state} ${ent.attributes.unit_of_measurement}`;
              } else {
                stateBadgeText = String(ent.state).toUpperCase();
              }
            } else if (row.asset?.catalogId === 'sun_shade_sail') {
              const corners = row.asset.sailCorners?.length || (row.asset.sailShape === 'triangle_3mast' ? 3 : 4);
              stateBadgeText = `${corners}-Punkt Sonnensegel`;
            }

            return (
              <div
                key={row.key}
                className={`p-4 rounded-xl border transition-all flex flex-col justify-between gap-3 ${
                  isAlarmActive
                    ? 'bg-red-950/60 border-red-400/70 shadow-lg'
                    : isActiveVisual
                    ? 'bg-slate-900/95 border-amber-400/45 shadow-md'
                    : 'bg-slate-900/80 border-white/10 hover:border-white/20'
                }`}
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div
                        className={`p-2 rounded-lg shrink-0 ${
                          row.category === 'lighting'
                            ? 'bg-amber-500/20 text-amber-300'
                            : row.category === 'plugs_distribution'
                            ? 'bg-emerald-500/20 text-emerald-300'
                            : row.category === 'sensors_contacts'
                            ? 'bg-sky-500/20 text-sky-300'
                            : 'bg-purple-500/20 text-purple-300'
                        }`}
                      >
                        {row.category === 'lighting' ? (
                          <Lightbulb className="w-4 h-4" />
                        ) : row.category === 'plugs_distribution' ? (
                          <Zap className="w-4 h-4" />
                        ) : row.category === 'sensors_contacts' ? (
                          <ShieldAlert className="w-4 h-4" />
                        ) : (
                          <Sun className="w-4 h-4" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="font-bold text-sm text-white truncate">
                          {row.title}
                        </div>
                        <div className="text-[11px] text-slate-400 truncate">
                          {row.subtitle}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <span className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 font-mono text-[10px] font-semibold">
                        {row.levelLabel}
                      </span>
                      {row.isManualOnly && onRemoveManualOverviewEntity && row.entityId && (
                        <button
                          type="button"
                          onClick={() => onRemoveManualOverviewEntity(row.entityId!)}
                          className="p-1 rounded bg-rose-500/15 hover:bg-rose-500/30 text-rose-300"
                          title="Aus Overview entfernen"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Entity ID & Telemetry Details */}
                  <div className="mt-3 pt-2.5 border-t border-white/5 flex flex-wrap items-center justify-between gap-1.5 text-[11px]">
                    <span className="font-mono text-slate-400 truncate max-w-[200px]">
                      {primaryEntId || 'Ohne HA-Entität (3D-Asset)'}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded font-mono text-[10.5px] font-bold ${
                        isAlarmActive
                          ? 'bg-red-500 text-white'
                          : isActiveVisual
                          ? 'bg-amber-400/20 text-amber-300 border border-amber-400/30'
                          : 'bg-slate-800 text-slate-300'
                      }`}
                    >
                      {stateBadgeText}
                    </span>
                  </div>

                  {ent && (
                    <div className="mt-2 flex flex-wrap items-center gap-3 text-[11px] text-slate-400">
                      {typeof ent.attributes.current_power_w === 'number' && (
                        <span className="font-mono text-emerald-300">
                          ⚡ {ent.attributes.current_power_w} W
                        </span>
                      )}
                      {typeof ent.attributes.today_energy_kwh === 'number' && (
                        <span className="font-mono text-slate-300">
                          Heute: {ent.attributes.today_energy_kwh} kWh
                        </span>
                      )}
                      {typeof ent.attributes.battery_level === 'number' && (
                        <span className="flex items-center gap-1 font-mono">
                          <Battery className="w-3 h-3 text-emerald-400" />
                          {ent.attributes.battery_level}%
                        </span>
                      )}
                      {typeof ent.attributes.linkquality_lqi === 'number' && (
                        <span className="flex items-center gap-1 font-mono">
                          <Wifi className="w-3 h-3 text-sky-400" />
                          {ent.attributes.linkquality_lqi} LQI
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* Action Footer */}
                <div className="flex items-center gap-2 pt-1">
                  {isControllable && toggleEntId && (
                    <button
                      type="button"
                      onClick={() => onToggleEntity(toggleEntId)}
                      className={`flex-1 py-1.5 px-2.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-colors ${
                        isActiveVisual
                          ? 'bg-amber-400 hover:bg-amber-300 text-slate-950'
                          : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-white/10'
                      }`}
                    >
                      <Power className="w-3.5 h-3.5" />
                      <span>{isActiveVisual ? 'Ausschalten / Schließen' : 'Einschalten / Öffnen'}</span>
                    </button>
                  )}

                  {isSmokeOrLeak && primaryEntId && (
                    <button
                      type="button"
                      onClick={() => onTriggerAlarmTest(primaryEntId)}
                      className="py-1.5 px-2.5 rounded-lg bg-red-500/20 hover:bg-red-500/30 border border-red-400/40 text-red-200 text-xs font-semibold"
                    >
                      Test-Alarm
                    </button>
                  )}

                  {(row.asset || row.opening || primaryEntId) && (
                    <button
                      type="button"
                      onClick={() => {
                        if (onFocusAssetOrOpeningIn3D && (row.asset || row.opening)) {
                          onFocusAssetOrOpeningIn3D({
                            assetId: row.asset?.id,
                            openingId: row.opening?.id,
                            entityId: primaryEntId,
                          });
                        } else if (primaryEntId) {
                          onFocusEntityIn3D(primaryEntId);
                        }
                      }}
                      className="py-1.5 px-2.5 rounded-lg bg-sky-500/15 hover:bg-sky-500/25 border border-sky-400/35 text-sky-200 text-xs font-semibold flex items-center gap-1 ml-auto"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>In 3D zeigen</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
