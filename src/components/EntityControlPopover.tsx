import React from 'react';
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
  HAEntityState,
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

  const resolvedOpeningState = opening
    ? resolveOpeningSensorState(opening, entities)
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
            {opening?.name || asset?.name || entity?.attributes.friendly_name}
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
                <span>3D-Animation & Öffnungsstatus</span>
              </span>
              <span className="font-mono text-[11px] text-amber-300">
                {resolvedOpeningState === 'open'
                  ? 'GEÖFFNET'
                  : resolvedOpeningState === 'tilted'
                  ? 'GEKIPPT (14°)'
                  : 'GESCHLOSSEN'}
              </span>
            </div>

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
                      onUpdateOpening(opening.id, {
                        previewStateOverride: btn.id,
                        openPositionPct: btn.id === 'open' ? 100 : 0,
                      });
                      onSetDualSensorTestState?.(opening.id, btn.id);
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
                    onClick={() => onUpdateAttributes(entity.entity_id, 'docked')}
                    className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg bg-slate-800 text-slate-200 text-xs font-medium whitespace-nowrap"
                  >
                    <span>Zur Ladestation</span>
                  </button>
                </div>
              </div>
            )}

            {/* 8. ÜBERWACHUNGSKAMERAS */}
            {entity.domain === 'camera' && (
              <div className="space-y-2.5">
                <div className="relative h-36 rounded-lg overflow-hidden bg-slate-900 border border-white/10 flex flex-col justify-between p-3">
                  <div className="flex items-center justify-between text-[11px] font-mono text-slate-300">
                    <span>LIVE · 4K HDR · 30 FPS</span>
                    <span>{entity.attributes.camera_location || 'Außenbereich'}</span>
                  </div>
                  <div className="flex items-center justify-center gap-2 text-xs text-sky-300">
                    <Camera className="w-5 h-5" />
                    <span>RTSP / WebRTC Stream aktiv</span>
                  </div>
                  <div className="text-[11px] font-mono text-slate-400 tabular-nums">
                    2026-10-24 · PoE Stream verschlüsselt
                  </div>
                </div>
              </div>
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
                  <button
                    type="button"
                    onClick={() => onToggleEntity(entity.entity_id)}
                    className="w-full py-2 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200 whitespace-nowrap"
                  >
                    Zustand umschalten / Testen
                  </button>
                </div>
              )}
          </>
        )}
      </div>
    </div>
  );
};
