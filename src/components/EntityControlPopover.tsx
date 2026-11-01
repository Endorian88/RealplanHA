import React, { useEffect, useState } from 'react';
import {
  BellRing,
  Camera,
  DoorOpen,
  Droplets,
  Lightbulb,
  Play,
  Power,
  ShieldAlert,
  Sliders,
  Thermometer,
  X,
  Zap,
} from 'lucide-react';
import {
  cleanDisplayLabel,
  HAEntityState,
  isOpeningActuatorControllable,
  PlacedAsset,
  resolveOpeningSensorState,
  WallOpening,
} from '../types/floorplan';

interface EntityControlPopoverProps {
  entity?: HAEntityState | null;
  asset?: PlacedAsset | null;
  opening?: WallOpening | null;
  entities?: Record<string, HAEntityState>;
  onClose: () => void;
  onToggleEntity: (entityId: string) => void;
  onUpdateAttributes: (
    entityId: string,
    patchState?: string,
    patchAttrs?: Partial<HAEntityState['attributes']>
  ) => void;
  onUpdateOpening?: (openingId: string, patch: Partial<WallOpening>) => void;
  onUpdateAsset?: (assetId: string, patch: Partial<PlacedAsset>) => void;
  onSetDualSensorTestState?: (
    openingId: string,
    targetState: 'closed' | 'tilted' | 'open'
  ) => void;
}

const RGB_SWATCHES: { name: string; rgb: [number, number, number]; hex: string }[] = [
  { name: 'Warmweiß', rgb: [255, 214, 153], hex: '#ffd699' },
  { name: 'Neutralweiß', rgb: [255, 244, 229], hex: '#fff4e5' },
  { name: 'Bernstein', rgb: [245, 158, 11], hex: '#f59e0b' },
  { name: 'Kristallblau', rgb: [14, 165, 233], hex: '#0ea5e9' },
  { name: 'Smaragd', rgb: [16, 185, 129], hex: '#10b981' },
  { name: 'Koralle', rgb: [244, 63, 94], hex: '#f43f5e' },
];

export const EntityControlPopover: React.FC<EntityControlPopoverProps> = ({
  entity,
  asset,
  opening,
  entities = {},
  onClose,
  onToggleEntity,
  onUpdateAttributes,
  onUpdateOpening,
  onUpdateAsset,
  onSetDualSensorTestState,
}) => {
  const isSmokeOrWater =
    entity?.attributes.device_class === 'smoke' ||
    entity?.attributes.device_class === 'moisture';
  const isAlarmActive =
    entity?.state === 'detected' || Boolean(entity?.attributes.alarm_test_active);

  const isOpeningControllable = opening
    ? isOpeningActuatorControllable(opening, entities)
    : false;
  const resolvedOpeningState = opening
    ? resolveOpeningSensorState(opening, entities, false)
    : 'closed';
  const shutterEntity =
    opening?.shutterEntityId && entities[opening.shutterEntityId]
      ? entities[opening.shutterEntityId]
      : null;

  return (
    <div className="fixed inset-x-2.5 bottom-14 top-auto max-h-[68dvh] sm:inset-x-auto sm:top-20 sm:bottom-auto sm:right-5 z-30 sm:w-84 rounded-xl bg-[#0f172a] border border-white/15 shadow-2xl p-3.5 sm:p-4 text-slate-100 sm:max-h-[82dvh] overflow-y-auto">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 pb-3 border-b border-white/10">
        <div>
          <div className="text-xs text-slate-400">
            {opening ? (
              <>
                <span>3D-Kinematik</span>
                {opening.entityId && (
                  <>
                    <span className="mx-1.5">·</span>
                    <span className="font-mono">{opening.entityId}</span>
                  </>
                )}
              </>
            ) : entity ? (
              <>
                {entity.domain}
                <span className="mx-1.5">·</span>
                <span className="font-mono">{entity.entity_id}</span>
              </>
            ) : null}
          </div>
          <h3 className="text-sm font-semibold text-white mt-0.5">
            {cleanDisplayLabel(opening?.name || asset?.name || entity?.attributes.friendly_name)}
          </h3>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          aria-label="Schließen"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Body Controls by Opening / Entity Domain */}
      <div className="mt-3.5 space-y-4">
        {/* 0. INTERAKTIVE 3D TÜR-, FENSTER- & TOR-KINEMATIK */}
        {opening && onUpdateOpening && (
          <div className="space-y-3 p-3 rounded-xl bg-slate-900/90 border border-sky-400/30">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-sky-300 flex items-center gap-1.5">
                <DoorOpen className="w-4 h-4" />
                <span>3D-Öffnungsstatus</span>
              </span>
              <span
                className={`font-mono text-[11px] px-2 py-0.5 rounded font-bold ${
                  resolvedOpeningState === 'open'
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-400/30'
                    : resolvedOpeningState === 'tilted'
                    ? 'bg-sky-500/20 text-sky-300 border border-sky-400/30'
                    : 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/30'
                }`}
              >
                {resolvedOpeningState === 'open'
                  ? 'GEÖFFNET'
                  : resolvedOpeningState === 'tilted'
                  ? 'GEKIPPT (14°)'
                  : 'GESCHLOSSEN'}
              </span>
            </div>

            {opening.actuatorEntityId && isOpeningControllable && (
              <button
                type="button"
                onClick={() => onToggleEntity(opening.actuatorEntityId!)}
                className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-bold transition-colors"
              >
                <Power className="w-4 h-4" />
                <span>
                  Tor / Antrieb schalten ({opening.actuatorEntityId})
                </span>
              </button>
            )}

            {!isOpeningControllable ? (
              <div className="p-2.5 rounded-lg bg-slate-950/90 border border-emerald-400/25 text-[11px] text-slate-300 space-y-1">
                <div className="font-semibold text-emerald-300">
                  Schreibgeschützter Kontaktsensor (Live-Status)
                </div>
                <p className="text-[10px] text-slate-400 leading-relaxed">
                  Dieses Element ist mit einem Nur-Lesen Sensor (
                  <span className="font-mono text-sky-300">
                    {opening.entityId || opening.openEntityId}
                  </span>
                  ) verknüpft und zeigt ausschließlich den echten Zustand aus Home Assistant an.
                  Falls ein steuerbarer Antrieb existiert, kannst du ihn im 3D-Baukasten als Aktor-Entität hinterlegen.
                </p>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-3 gap-1.5">
                  {(
                    [
                      { id: 'closed', label: 'Zu (0°)' },
                      { id: 'tilted', label: 'Kippen (14°)' },
                      { id: 'open', label: 'Öffnen (90°)' },
                    ] as const
                  ).map((btn) => {
                    const active = resolvedOpeningState === btn.id;
                    return (
                      <button
                        key={btn.id}
                        type="button"
                        onClick={() => {
                          const targetActuator = opening.actuatorEntityId || opening.entityId;
                          if (targetActuator) {
                            onToggleEntity(targetActuator);
                          } else {
                            onUpdateOpening(opening.id, {
                              previewStateOverride: btn.id,
                              openPositionPct: btn.id === 'open' ? 100 : 0,
                            });
                            onSetDualSensorTestState?.(opening.id, btn.id);
                          }
                        }}
                        className={`py-1.5 px-2 rounded-lg text-xs font-semibold transition-colors ${
                          active
                            ? btn.id === 'tilted'
                              ? 'bg-amber-400 text-slate-950 font-bold'
                              : btn.id === 'open'
                              ? 'bg-sky-400 text-slate-950 font-bold'
                              : 'bg-emerald-400 text-slate-950 font-bold'
                            : 'bg-slate-800 text-slate-200 hover:bg-slate-700'
                        }`}
                      >
                        {btn.label}
                      </button>
                    );
                  })}
                </div>

                {/* Stufenloser 3D-Öffnungsgrad (0% .. 100%) */}
                <div>
                  <div className="flex justify-between text-xs text-slate-400 mb-1">
                    <span>Öffnungswinkel / Schiebeweg</span>
                    <span className="font-mono text-sky-300 tabular-nums">
                      {opening.openPositionPct ??
                        (resolvedOpeningState === 'open' ? 100 : 0)}
                      %
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    step={5}
                    value={
                      opening.openPositionPct ??
                      (resolvedOpeningState === 'open' ? 100 : 0)
                    }
                    onChange={(e) => {
                      const pct = parseInt(e.target.value, 10);
                      onUpdateOpening(opening.id, {
                        openPositionPct: pct,
                        previewStateOverride: pct > 0 ? 'open' : 'closed',
                      });
                      onSetDualSensorTestState?.(
                        opening.id,
                        pct > 0 ? 'open' : 'closed'
                      );
                    }}
                    className="w-full accent-sky-400 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
                  />
                </div>
              </>
            )}

            {/* Anschlag & Richtung Schnellwahl */}
            <div className="grid grid-cols-2 gap-1.5 pt-1 border-t border-white/10">
              <button
                type="button"
                onClick={() =>
                  onUpdateOpening(opening.id, {
                    hingeSide:
                      (opening.hingeSide || 'left') === 'left' ? 'right' : 'left',
                  })
                }
                className="py-1 px-2 rounded bg-slate-800 hover:bg-slate-700 text-[11px] font-medium text-slate-200"
              >
                Anschlag: {(opening.hingeSide || 'left') === 'left' ? 'Links (DIN-L)' : 'Rechts (DIN-R)'}
              </button>
              <button
                type="button"
                onClick={() =>
                  onUpdateOpening(opening.id, {
                    openDirection:
                      (opening.openDirection || 'inward') === 'inward'
                        ? 'outward'
                        : 'inward',
                  })
                }
                className="py-1 px-2 rounded bg-slate-800 hover:bg-slate-700 text-[11px] font-medium text-slate-200"
              >
                Richtung: {(opening.openDirection || 'inward') === 'inward' ? 'Nach Innen' : 'Nach Außen'}
              </button>
            </div>

            {/* Integrierter 3D-Rollladen falls vorhanden */}
            {(shutterEntity || opening.shutterEntityId) && (
              <div className="pt-2 border-t border-white/10 space-y-1.5">
                <div className="flex justify-between text-xs text-amber-300">
                  <span>
                    3D-Rollladen ({shutterEntity?.attributes.friendly_name || opening.name})
                  </span>
                  <span className="font-mono tabular-nums">
                    {opening.shutterClosedPct !== undefined
                      ? 100 - opening.shutterClosedPct
                      : shutterEntity?.attributes.current_position ?? 100}
                    % offen
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={5}
                  value={
                    opening.shutterClosedPct !== undefined
                      ? 100 - opening.shutterClosedPct
                      : shutterEntity?.attributes.current_position ?? 100
                  }
                  onChange={(e) => {
                    const pos = parseInt(e.target.value, 10);
                    onUpdateOpening(opening.id, {
                      shutterClosedPct: 100 - pos,
                    });
                    if (shutterEntity) {
                      onUpdateAttributes(
                        shutterEntity.entity_id,
                        pos > 5 ? 'open' : 'closed',
                        { current_position: pos }
                      );
                    }
                  }}
                  className="w-full accent-amber-400 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
                />
              </div>
            )}
          </div>
        )}

        {/* 1. RAUCHMELDER & WASSERMELDER */}
        {entity && isSmokeOrWater && (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs bg-slate-900 p-3 rounded-lg border border-white/10">
              <div>
                <div className="text-slate-400">Sicherheitsstatus</div>
                <div
                  className={`text-sm font-semibold mt-0.5 ${
                    isAlarmActive ? 'text-red-400' : 'text-emerald-400'
                  }`}
                >
                  {isAlarmActive ? 'ALARM AUSGELÖST (3D-Warnlicht)' : 'Alles in Ordnung (Bereit)'}
                </div>
              </div>
              <ShieldAlert
                className={`w-6 h-6 ${isAlarmActive ? 'text-red-400' : 'text-emerald-400'}`}
              />
            </div>

            <div className="flex items-center justify-between text-xs text-slate-300 font-mono tabular-nums px-1">
              <span>Batterie: {entity.attributes.battery_level ?? 98}%</span>
              <span>·</span>
              <span>Zigbee LQI: {entity.attributes.linkquality_lqi ?? 235}</span>
            </div>

            <button
              type="button"
              onClick={() =>
                onUpdateAttributes(
                  entity.entity_id,
                  isAlarmActive ? 'clear' : 'detected',
                  { alarm_test_active: !isAlarmActive }
                )
              }
              className={`w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${
                isAlarmActive
                  ? 'bg-emerald-500 text-slate-950 hover:bg-emerald-400'
                  : 'bg-red-500 text-white hover:bg-red-600'
              }`}
            >
              <BellRing className="w-4 h-4" />
              <span>
                {isAlarmActive
                  ? 'Alarm quittieren & zurücksetzen'
                  : '3D-Probealarm im Raum auslösen'}
              </span>
            </button>
          </div>
        )}

        {entity && !opening && (
          <>
            {/* 2. SCHALTBARE STECKDOSEN (Smart Plugs) & SCHALTER */}
            {entity.domain === 'switch' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between bg-slate-900 p-3 rounded-lg border border-white/10">
                  <div>
                    <div className="text-xs text-slate-400">Schaltzustand</div>
                    <div className="text-sm font-semibold text-white mt-0.5">
                      {entity.state === 'on' ? 'Eingeschaltet (Strom fließt)' : 'Ausgeschaltet (0 W)'}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => onToggleEntity(entity.entity_id)}
                    className={`px-3.5 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 ${
                      entity.state === 'on'
                        ? 'bg-emerald-500 text-slate-950 hover:bg-emerald-400'
                        : 'bg-slate-800 text-slate-200 hover:bg-slate-700'
                    }`}
                  >
                    <Power className="w-3.5 h-3.5" />
                    <span>{entity.state === 'on' ? 'Ausschalten' : 'Einschalten'}</span>
                  </button>
                </div>

                {entity.attributes.current_power_w !== undefined && (
                  <div className="grid grid-cols-3 gap-2 text-center bg-slate-900/80 p-2.5 rounded-lg border border-white/5 font-mono tabular-nums">
                    <div>
                      <div className="text-[11px] text-slate-400 font-sans">Leistung</div>
                      <div className="text-sm font-semibold text-emerald-400">
                        {entity.state === 'on' ? entity.attributes.current_power_w : 0} W
                      </div>
                    </div>
                    <div>
                      <div className="text-[11px] text-slate-400 font-sans">Heute</div>
                      <div className="text-sm font-semibold text-slate-200">
                        {entity.attributes.today_energy_kwh ?? 0.45} kWh
                      </div>
                    </div>
                    <div>
                      <div className="text-[11px] text-slate-400 font-sans">Spannung</div>
                      <div className="text-sm font-semibold text-slate-200">
                        {entity.attributes.voltage_v ?? 230} V
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* 3. LICHTER & RGBW-STRIPS */}
            {entity.domain === 'light' && (
              <div className="space-y-3.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-300 flex items-center gap-1.5">
                    <Lightbulb className="w-4 h-4 text-amber-400" />
                    <span>3D-Lichtquelle ({entity.state === 'on' ? 'Ein' : 'Aus'})</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => onToggleEntity(entity.entity_id)}
                    className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                      entity.state === 'on'
                        ? 'bg-amber-500 text-slate-950'
                        : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                    }`}
                  >
                    {entity.state === 'on' ? 'Licht ausschalten' : 'Licht einschalten'}
                  </button>
                </div>

                <div>
                  <div className="flex justify-between text-xs text-slate-400 mb-1">
                    <span>Helligkeit</span>
                    <span className="font-mono text-slate-200 tabular-nums">
                      {Math.round(((entity.attributes.brightness ?? 255) / 255) * 100)}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min={10}
                    max={255}
                    value={entity.attributes.brightness ?? 220}
                    onChange={(e) =>
                      onUpdateAttributes(entity.entity_id, 'on', {
                        brightness: parseInt(e.target.value, 10),
                      })
                    }
                    className="w-full accent-amber-400 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
                  />
                </div>

                <div>
                  <div className="text-xs text-slate-400 mb-1.5">Lichtfarbe (PBR Lichtkegel)</div>
                  <div className="grid grid-cols-6 gap-1.5">
                    {RGB_SWATCHES.map((sw) => (
                      <button
                        key={sw.name}
                        type="button"
                        title={sw.name}
                        onClick={() =>
                          onUpdateAttributes(entity.entity_id, 'on', { rgb_color: sw.rgb })
                        }
                        style={{ backgroundColor: sw.hex }}
                        className="h-7 rounded-md border border-white/20 hover:scale-105 transition-transform"
                      />
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* 4. TÜREN, ROLLLÄDEN & GARAGENTOR */}
            {entity.domain === 'cover' && (
              <div className="space-y-3">
                <div className="flex justify-between text-xs text-slate-400">
                  <span>Öffnungsposition (3D-Kinematik)</span>
                  <span className="font-mono text-slate-200 tabular-nums">
                    {asset?.customOpenPct ??
                      entity.attributes.current_position ??
                      (entity.state === 'open' ? 100 : 0)}
                    %
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={
                    asset?.customOpenPct ??
                    entity.attributes.current_position ??
                    (entity.state === 'open' ? 100 : 0)
                  }
                  onChange={(e) => {
                    const pos = parseInt(e.target.value, 10);
                    if (asset && onUpdateAsset) {
                      onUpdateAsset(asset.id, { customOpenPct: pos });
                    }
                    onUpdateAttributes(entity.entity_id, pos > 5 ? 'open' : 'closed', {
                      current_position: pos,
                    });
                  }}
                  className="w-full accent-sky-400 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
                />
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { label: 'Schließen (0%)', pos: 0 },
                    { label: 'Lüften (50%)', pos: 50 },
                    { label: 'Öffnen (100%)', pos: 100 },
                  ].map((btn) => (
                    <button
                      key={btn.label}
                      type="button"
                      onClick={() => {
                        if (asset && onUpdateAsset) {
                          onUpdateAsset(asset.id, { customOpenPct: btn.pos });
                        }
                        onUpdateAttributes(
                          entity.entity_id,
                          btn.pos > 5 ? 'open' : 'closed',
                          { current_position: btn.pos }
                        );
                      }}
                      className="py-1.5 px-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200 whitespace-nowrap"
                    >
                      {btn.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* 5. KLIMA, FUSSBODENHEIZUNG & POOLWÄRMEPUMPE */}
            {entity.domain === 'climate' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between bg-slate-900 p-3 rounded-lg border border-white/10">
                  <div>
                    <div className="text-xs text-slate-400">Ist-Temperatur</div>
                    <div className="text-lg font-mono font-semibold text-white tabular-nums">
                      {entity.attributes.current_temperature ?? 21.5} °C
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-slate-400">Ziel-Sollwert</div>
                    <div className="text-lg font-mono font-semibold text-amber-400 tabular-nums">
                      {entity.attributes.target_temperature ?? 22.0} °C
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Thermometer className="w-4 h-4 text-amber-400 shrink-0" />
                  <input
                    type="range"
                    min={16}
                    max={30}
                    step={0.5}
                    value={entity.attributes.target_temperature ?? 22}
                    onChange={(e) =>
                      onUpdateAttributes(entity.entity_id, 'heat', {
                        target_temperature: parseFloat(e.target.value),
                      })
                    }
                    className="w-full accent-amber-400 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
                  />
                </div>
              </div>
            )}

            {/* 6. GARTENBEWÄSSERUNG (Versenkregner) */}
            {entity.domain === 'valve' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between bg-slate-900 p-3 rounded-lg border border-white/10">
                  <div>
                    <div className="text-xs text-slate-400">Bewässerungskreis</div>
                    <div className="text-sm font-semibold text-sky-300">
                      {entity.state === 'open' ? 'Beregnung aktiv (3D-Sprühnebel)' : 'Ventil geschlossen'}
                    </div>
                  </div>
                  <Droplets className="w-5 h-5 text-sky-400" />
                </div>
                <button
                  type="button"
                  onClick={() => onToggleEntity(entity.entity_id)}
                  className={`w-full py-2 px-4 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${
                    entity.state === 'open'
                      ? 'bg-slate-800 text-slate-200 hover:bg-slate-700'
                      : 'bg-sky-500 text-slate-950 hover:bg-sky-400'
                  }`}
                >
                  {entity.state === 'open' ? 'Beregnung stoppen' : 'Gartenbewässerung starten'}
                </button>
              </div>
            )}

            {/* 7. MÄHROBOTER & SAUGROBOTER */}
            {entity.domain === 'vacuum' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs bg-slate-900 p-3 rounded-lg border border-white/10 font-mono tabular-nums">
                  <span>Status: {entity.state === 'cleaning' ? 'AKTIV' : 'IN STATION'}</span>
                  <span>·</span>
                  <span>Akku: {entity.attributes.battery_level ?? 90}%</span>
                  <span>·</span>
                  <span>{entity.attributes.cleaned_area_m2 ?? 120} m²</span>
                </div>
                {asset?.catalogId === 'robot_vacuum_dock' && (
                  <div className="p-2.5 rounded-lg bg-slate-900/90 border border-emerald-500/30 space-y-2">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-slate-400">Aktueller Raum:</span>
                      <span className="font-mono font-bold text-emerald-300">
                        {(asset.vacuumConfig?.roomSensorEntityId &&
                          entities[asset.vacuumConfig.roomSensorEntityId]?.state) ||
                          (entity.attributes.current_room as string | undefined) ||
                          'Automatisch / Dock-Raum'}
                      </span>
                    </div>
                    {asset.vacuumConfig?.roomSensorEntityId &&
                      entities[asset.vacuumConfig.roomSensorEntityId] && (
                        <div>
                          <label className="block text-[10px] text-slate-400 mb-1">
                            Raum direkt wechseln (Simulations-/Test-Steuerung):
                          </label>
                          <input
                            type="text"
                            value={entities[asset.vacuumConfig.roomSensorEntityId]?.state || ''}
                            onChange={(e) => {
                              onUpdateAttributes(
                                asset.vacuumConfig!.roomSensorEntityId!,
                                e.target.value
                              );
                              if (entity.state !== 'cleaning') {
                                onUpdateAttributes(entity.entity_id, 'cleaning');
                              }
                            }}
                            placeholder="z.B. Wohnzimmer, Küche, Flur..."
                            className="w-full bg-slate-950 border border-emerald-400/30 rounded px-2 py-1 text-xs font-mono text-emerald-200"
                          />
                        </div>
                      )}
                  </div>
                )}
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => onUpdateAttributes(entity.entity_id, 'cleaning')}
                    className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg bg-emerald-500 text-slate-950 text-xs font-semibold whitespace-nowrap"
                  >
                    <Play className="w-3.5 h-3.5" />
                    <span>Starten</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      onUpdateAttributes(entity.entity_id, 'docked');
                      if (asset?.id && asset.vacuumConfig?.testTargetZoneId && onUpdateAsset) {
                        onUpdateAsset(asset.id, {
                          vacuumConfig: {
                            ...asset.vacuumConfig,
                            testTargetZoneId: undefined,
                          },
                        });
                      }
                    }}
                    className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg bg-slate-800 text-slate-200 text-xs font-medium whitespace-nowrap"
                  >
                    <span>Zur Ladestation</span>
                  </button>
                </div>
              </div>
            )}

            {/* 8. ÜBERWACHUNGSKAMERAS (LIVE-STREAM / SNAPSHOT + SIMULIERTES LIVE-BILD) */}
            {entity.domain === 'camera' && (
              <CameraPopoverLiveFeed entity={entity} />
            )}

            {/* 9. SENSOREN & ALARMANLAGE FALLBACK */}
            {!isSmokeOrWater &&
              !['switch', 'light', 'cover', 'climate', 'valve', 'vacuum', 'camera'].includes(
                entity.domain
              ) && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between bg-slate-900 p-3 rounded-lg border border-white/10">
                    <span className="text-xs text-slate-400 flex items-center gap-1.5">
                      <Sliders className="w-4 h-4 text-sky-400" />
                      <span>Aktueller Zustand</span>
                    </span>
                    <span className="font-mono text-sm font-semibold text-emerald-400 tabular-nums">
                      {entity.state} {entity.attributes.unit_of_measurement || ''}
                    </span>
                  </div>
                  {entity.attributes.current_power_w !== undefined && (
                    <div className="flex items-center justify-between text-xs px-1 font-mono tabular-nums text-slate-300">
                      <span className="flex items-center gap-1">
                        <Zap className="w-3.5 h-3.5 text-amber-400" />
                        Momentanleistung:
                      </span>
                      <span>{entity.attributes.current_power_w} W</span>
                    </div>
                  )}
                  {entity.domain !== 'binary_sensor' && entity.domain !== 'sensor' ? (
                    <button
                      type="button"
                      onClick={() => onToggleEntity(entity.entity_id)}
                      className="w-full py-2 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200 whitespace-nowrap"
                    >
                      Aktor schalten
                    </button>
                  ) : (
                    <div className="text-[11px] text-slate-400 text-center py-1">
                      Nur-Lesen Sensor (Status wird live aus Home Assistant übertragen)
                    </div>
                  )}
                </div>
              )}
          </>
        )}

        {/* 10. MULTI-ENTITÄTEN KLIMASENSOR ÜBERSICHT */}
        {asset?.sensorConfig && (
          <div className="space-y-2.5 p-3 rounded-xl bg-slate-900/95 border border-sky-400/30">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-sky-300 flex items-center gap-1.5">
                <Thermometer className="w-4 h-4" />
                <span>Multi-Klimasensor Messwerte</span>
              </span>
              {asset.sensorConfig.batteryEntityId && entities[asset.sensorConfig.batteryEntityId] && (
                <span className="font-mono text-[11px] px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-400/30">
                  🔋 {entities[asset.sensorConfig.batteryEntityId].state}%
                </span>
              )}
            </div>
            <div className="grid grid-cols-2 gap-1.5 text-xs">
              {[
                {
                  label: 'Temperatur',
                  id: asset.sensorConfig.temperatureEntityId || asset.entityId,
                  unit: '°C',
                },
                {
                  label: 'Luftfeuchte',
                  id: asset.sensorConfig.humidityEntityId,
                  unit: '%',
                },
                {
                  label: 'CO₂-Gehalt',
                  id: asset.sensorConfig.co2EntityId,
                  unit: 'ppm',
                },
                {
                  label: 'Luftqualität',
                  id: asset.sensorConfig.vocEntityId,
                  unit: '',
                },
                {
                  label: 'Luftdruck',
                  id: asset.sensorConfig.pressureEntityId,
                  unit: 'hPa',
                },
                {
                  label: 'Helligkeit',
                  id: asset.sensorConfig.illuminanceEntityId,
                  unit: 'lx',
                },
                {
                  label: 'Taupunkt',
                  id: asset.sensorConfig.dewPointEntityId,
                  unit: '°C',
                },
                {
                  label: 'Schimmelwarnung',
                  id: asset.sensorConfig.moldWarningEntityId,
                  unit: '',
                },
              ]
                .filter((item) => Boolean(item.id))
                .map((item) => {
                  const st = item.id ? entities[item.id] : undefined;
                  return (
                    <div
                      key={item.label}
                      className="p-2 rounded-lg bg-slate-950/90 border border-white/10 flex flex-col justify-between"
                    >
                      <span className="text-[10px] text-slate-400">{item.label}</span>
                      <span className="font-mono text-xs font-bold text-white tabular-nums mt-0.5">
                        {st
                          ? `${st.state} ${st.attributes.unit_of_measurement || item.unit}`
                          : item.id}
                      </span>
                    </div>
                  );
                })}
              {(asset.sensorConfig.extraEntities || []).map((ex) => {
                const st = entities[ex.entityId];
                return (
                  <div
                    key={ex.id}
                    className="p-2 rounded-lg bg-slate-950/90 border border-white/10 flex flex-col justify-between"
                  >
                    <span className="text-[10px] text-slate-400">{ex.label}</span>
                    <span className="font-mono text-xs font-bold text-sky-300 tabular-nums mt-0.5">
                      {st
                        ? `${st.state} ${ex.unit || st.attributes.unit_of_measurement || ''}`
                        : ex.entityId}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export const CameraPopoverLiveFeed: React.FC<{
  entity: HAEntityState;
  compact?: boolean;
  hasMotion?: boolean;
}> = ({ entity, compact = false, hasMotion = false }) => {
  const [refreshTick, setRefreshTick] = useState<number>(() => Date.now());
  const [streamMode, setStreamMode] = useState<'snapshot' | 'stream'>('snapshot');
  const [nightVision, setNightVision] = useState<boolean>(false);
  const [imgLoaded, setImgLoaded] = useState<boolean>(false);
  const [imgFailed, setImgFailed] = useState<boolean>(false);
  const [clockStr, setClockStr] = useState<string>(() =>
    new Date().toLocaleTimeString('de-DE')
  );

  useEffect(() => {
    const timer = window.setInterval(() => {
      setClockStr(new Date().toLocaleTimeString('de-DE'));
      if (streamMode === 'snapshot') {
        setRefreshTick(Date.now());
      }
    }, 2500);
    return () => window.clearInterval(timer);
  }, [streamMode]);

  // Resolve Home Assistant camera URL if available
  const resolvedCameraUrl = React.useMemo(() => {
    const rawPic =
      (entity.attributes.entity_picture as string | undefined) ||
      (entity.attributes.access_token
        ? `/api/camera_proxy/${entity.entity_id}?token=${entity.attributes.access_token}`
        : '');
    if (!rawPic) return '';

    let baseOrigin = '';
    try {
      const savedHa = localStorage.getItem('ha_ws_config_v1');
      if (savedHa) {
        const parsed = JSON.parse(savedHa);
        if (parsed?.haUrl && typeof parsed.haUrl === 'string' && parsed.haUrl.trim()) {
          baseOrigin = parsed.haUrl.trim().replace(/\/+$/, '');
        }
      }
    } catch {
      // ignore
    }

    let url = rawPic;
    if (streamMode === 'stream') {
      url = url.replace('/api/camera_proxy/', '/api/camera_proxy_stream/');
    }
    if (url.startsWith('/') && baseOrigin) {
      url = `${baseOrigin}${url}`;
    }
    if (streamMode === 'snapshot') {
      const sep = url.includes('?') ? '&' : '?';
      url = `${url}${sep}_ts=${refreshTick}`;
    }
    return url;
  }, [
    entity.entity_id,
    entity.attributes.entity_picture,
    entity.attributes.access_token,
    streamMode,
    refreshTick,
  ]);

  const isGardenOrBackyard =
    entity.entity_id.toLowerCase().includes('garten') ||
    entity.entity_id.toLowerCase().includes('terrasse') ||
    entity.entity_id.toLowerCase().includes('pool') ||
    String(entity.attributes.friendly_name || '')
      .toLowerCase()
      .includes('garten');

  return (
    <div className="space-y-2">
      <div
        className={`relative ${
          compact ? 'h-32' : 'h-44'
        } rounded-lg overflow-hidden bg-slate-950 border ${
          hasMotion ? 'border-rose-500/80' : 'border-sky-500/35'
        } select-none`}
      >
        {/* Real Home Assistant Camera Snapshot / MJPEG Stream if reachable */}
        {resolvedCameraUrl && !imgFailed && (
          <img
            src={resolvedCameraUrl}
            alt={entity.attributes.friendly_name || entity.entity_id}
            onLoad={() => {
              setImgLoaded(true);
              setImgFailed(false);
            }}
            onError={() => {
              setImgLoaded(false);
              setImgFailed(true);
            }}
            className={`absolute inset-0 w-full h-full object-cover z-10 transition-opacity duration-300 ${
              imgLoaded ? 'opacity-100' : 'opacity-0'
            } ${nightVision ? 'grayscale contrast-125 brightness-110' : ''}`}
          />
        )}

        {/* Realistic Simulated Live Architectural Camera Feed (always visible when no external stream is loaded) */}
        <svg
          viewBox="0 0 400 220"
          preserveAspectRatio="xMidYMid slice"
          className={`absolute inset-0 w-full h-full ${
            nightVision ? 'hue-rotate-90 saturate-50 contrast-125' : ''
          }`}
        >
          <defs>
            <linearGradient id={`sky-${entity.entity_id}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={nightVision ? '#042f2e' : '#0f172a'} />
              <stop offset="55%" stopColor={nightVision ? '#064e3b' : '#1e293b'} />
              <stop offset="100%" stopColor={nightVision ? '#022c22' : '#334155'} />
            </linearGradient>
            <linearGradient id={`ground-${entity.entity_id}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={isGardenOrBackyard ? '#14532d' : '#1e293b'} />
              <stop offset="100%" stopColor={isGardenOrBackyard ? '#052e16' : '#090d16'} />
            </linearGradient>
          </defs>

          {/* Sky & Horizon */}
          <rect width="400" height="125" fill={`url(#sky-${entity.entity_id})`} />
          <rect y="120" width="400" height="100" fill={`url(#ground-${entity.entity_id})`} />

          {isGardenOrBackyard ? (
            <g>
              {/* Garden Terrace, Pool & Trees Perspective */}
              <polygon points="40,120 360,120 400,220 0,220" fill="#064e3b" opacity="0.65" />
              {/* Wooden Deck / Terrace */}
              <polygon points="80,130 320,130 370,220 30,220" fill="#334155" opacity="0.85" />
              {/* Illuminated Pool Water */}
              <polygon
                points="115,148 285,148 310,205 90,205"
                fill="#0284c7"
                opacity="0.78"
                stroke="#38bdf8"
                strokeWidth="1.5"
              />
              {/* House Rear Facade & Patio Glass */}
              <rect x="95" y="52" width="210" height="72" fill="#1e293b" stroke="#475569" />
              <rect x="115" y="68" width="75" height="54" fill="#fef08a" opacity="0.65" />
              <rect x="205" y="68" width="75" height="54" fill="#fef08a" opacity="0.55" />
              {/* Trees */}
              <circle cx="48" cy="96" r="26" fill="#15803d" opacity="0.8" />
              <circle cx="352" cy="94" r="28" fill="#15803d" opacity="0.8" />
            </g>
          ) : (
            <g>
              {/* Driveway, Gate & House Entrance Perspective */}
              <polygon
                points="135,122 265,122 365,220 35,220"
                fill="#1e293b"
                stroke="#475569"
                strokeWidth="1"
              />
              {/* Driveway Lane Guide Lines */}
              <line
                x1="200"
                y1="128"
                x2="200"
                y2="220"
                stroke="#38bdf8"
                strokeDasharray="6 6"
                strokeWidth="1.5"
                opacity="0.45"
              />
              {/* Modern House & Garage */}
              <rect x="75" y="48" width="165" height="75" fill="#1e293b" stroke="#64748b" />
              <polygon points="65,48 158,18 250,48" fill="#0f172a" stroke="#475569" />
              {/* Illuminated Windows & Door */}
              <rect x="95" y="65" width="42" height="28" fill="#fde047" opacity="0.7" />
              <rect x="155" y="65" width="26" height="56" fill="#38bdf8" opacity="0.55" />
              {/* Garage Volume */}
              <rect x="240" y="66" width="92" height="57" fill="#0f172a" stroke="#475569" />
              <rect x="252" y="78" width="68" height="45" fill="#334155" />
              {/* Parked Car Silhouette in Driveway */}
              <rect
                x="162"
                y="148"
                width="76"
                height="38"
                rx="8"
                fill="#0284c7"
                opacity="0.85"
                stroke="#7dd3fc"
                strokeWidth="1.2"
              />
              <rect x="172" y="154" width="56" height="16" rx="4" fill="#0f172a" opacity="0.8" />
              <circle cx="174" cy="184" r="3.5" fill="#fef08a" />
              <circle cx="226" cy="184" r="3.5" fill="#fef047" />
            </g>
          )}

          {/* Subtle CCTV Grid & Crosshair */}
          <line x1="200" y1="95" x2="200" y2="125" stroke="#38bdf8" strokeWidth="0.7" opacity="0.4" />
          <line x1="185" y1="110" x2="215" y2="110" stroke="#38bdf8" strokeWidth="0.7" opacity="0.4" />

          {/* AI Motion Detection Bounding Box when active */}
          {hasMotion && (
            <g>
              <rect
                x="148"
                y="136"
                width="104"
                height="62"
                fill="none"
                stroke="#f43f5e"
                strokeWidth="2"
                strokeDasharray="5 3"
              />
              <rect x="148" y="120" width="92" height="16" fill="#f43f5e" />
              <text x="153" y="131" fill="#ffffff" fontSize="9" fontFamily="monospace" fontWeight="bold">
                BEWEGUNG 98%
              </text>
            </g>
          )}
        </svg>

        {/* Top HUD Bar */}
        <div className="absolute top-0 inset-x-0 z-20 flex items-center justify-between px-2.5 py-1.5 bg-gradient-to-b from-slate-950/90 via-slate-950/50 to-transparent text-[10px] font-mono">
          <div className="flex items-center gap-1.5">
            <span
              className={`w-2 h-2 rounded-full ${
                hasMotion ? 'bg-rose-500 animate-ping' : 'bg-emerald-400 animate-pulse'
              }`}
            />
            <span className="font-bold text-white truncate max-w-[150px]">
              {entity.attributes.friendly_name || entity.entity_id}
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-sky-300">
            <span className="px-1.5 py-0.5 rounded bg-slate-900/90 border border-white/10 text-[9px]">
              {imgLoaded ? 'HA LIVE' : 'LIVE SIM'} · {nightVision ? 'IR NIGHT' : '4K HDR'}
            </span>
          </div>
        </div>

        {/* Bottom HUD Bar */}
        <div className="absolute bottom-0 inset-x-0 z-20 flex items-center justify-between px-2.5 py-1.5 bg-gradient-to-t from-slate-950/90 via-slate-950/50 to-transparent text-[10px] font-mono text-slate-300">
          <span className="tabular-nums text-emerald-300">{clockStr}</span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setNightVision((v) => !v);
              }}
              className={`px-1.5 py-0.5 rounded text-[9px] border transition-colors ${
                nightVision
                  ? 'bg-emerald-500/30 text-emerald-200 border-emerald-400/50'
                  : 'bg-slate-900/80 text-slate-300 border-white/15 hover:bg-slate-800'
              }`}
            >
              {nightVision ? 'IR AN' : 'IR'}
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setStreamMode((m) => (m === 'snapshot' ? 'stream' : 'snapshot'));
                setImgFailed(false);
                setRefreshTick(Date.now());
              }}
              className="px-1.5 py-0.5 rounded bg-slate-900/80 hover:bg-slate-800 text-sky-300 border border-white/15 text-[9px]"
              title="Zwischen HA Snapshot (2.5s) und MJPEG Stream wechseln"
            >
              {streamMode === 'stream' ? 'MJPEG' : 'SNAP'}
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setImgFailed(false);
                setRefreshTick(Date.now());
              }}
              className="px-1.5 py-0.5 rounded bg-slate-900/80 hover:bg-slate-800 text-slate-200 border border-white/15 text-[9px]"
              title="Kamera-Einzelbild sofort neu laden"
            >
              ↻
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

