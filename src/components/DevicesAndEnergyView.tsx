import React, { useState } from 'react';
import {
  BellRing,
  Droplets,
  Lightbulb,
  Plug,
  Power,
  ShieldCheck,
  SunMedium,
  Thermometer,
  X,
  Zap,
} from 'lucide-react';
import { FloorplanProject, HAEntityState } from '../types/floorplan';

interface DevicesAndEnergyViewProps {
  project: FloorplanProject;
  entities: Record<string, HAEntityState>;
  onToggleEntity: (entityId: string) => void;
  onTriggerSmokeTest: (entityId: string) => void;
  onFocusEntityIn3D: (entityId: string) => void;
  onClose: () => void;
}

export const DevicesAndEnergyView: React.FC<DevicesAndEnergyViewProps> = ({
  entities,
  onToggleEntity,
  onTriggerSmokeTest,
  onFocusEntityIn3D,
  onClose,
}) => {
  const [filterGroup, setFilterGroup] = useState<
    'all' | 'plugs' | 'smoke_security' | 'outdoor' | 'lights_climate'
  >('all');

  const allList = Object.values(entities);

  // Calculate real-time power metrics
  const pvGenerationW =
    entities['sensor.pv_erzeugung_aktuell']?.attributes.current_power_w ?? 0;
  const batterySoc =
    entities['sensor.heimspeicher_soc']?.attributes.battery_level ?? 92;
  const totalConsumptionW = allList.reduce((acc, ent) => {
    if (ent.entity_id === 'sensor.pv_erzeugung_aktuell') return acc;
    if (ent.entity_id === 'sensor.heimspeicher_soc') return acc;
    const isOn =
      ent.state === 'on' || ent.state === 'heat' || ent.state === 'playing';
    return acc + (isOn ? ent.attributes.current_power_w || 0 : 0);
  }, 320); // 320W base house load

  const filteredEntities = allList.filter((ent) => {
    if (filterGroup === 'plugs') {
      return ent.domain === 'switch';
    }
    if (filterGroup === 'smoke_security') {
      return (
        ent.domain === 'binary_sensor' ||
        ent.domain === 'alarm_control_panel' ||
        ent.domain === 'camera' ||
        ent.entity_id.includes('co2')
      );
    }
    if (filterGroup === 'outdoor') {
      return (
        ent.domain === 'valve' ||
        ent.domain === 'vacuum' ||
        ent.entity_id.includes('aussen') ||
        ent.entity_id.includes('pool') ||
        ent.entity_id.includes('garten') ||
        ent.entity_id.includes('wallbox') ||
        ent.entity_id.includes('pv_') ||
        ent.entity_id.includes('ev_')
      );
    }
    if (filterGroup === 'lights_climate') {
      return ent.domain === 'light' || ent.domain === 'climate' || ent.domain === 'cover';
    }
    return true;
  });

  return (
    <div className="fixed inset-x-2.5 sm:inset-x-6 top-16 sm:top-20 bottom-14 sm:bottom-28 z-30 max-w-6xl mx-auto rounded-2xl bg-[#0f172a] border border-white/15 shadow-2xl flex flex-col overflow-hidden">
      {/* Header */}
      <div className="px-3.5 sm:px-6 py-3 sm:py-4 border-b border-white/10 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-sm sm:text-lg font-bold text-white">
            Smart-Home-Geräte, Rauchmelder, Schaltsteckdosen & Energiebilanz
          </h2>
          <p className="text-[11px] sm:text-xs text-slate-400 mt-0.5">
            Alle {allList.length} verknüpften Home Assistant Entitäten für Innenräume & Außenanlagen
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="px-3 sm:px-3.5 py-1.5 sm:py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200 flex items-center gap-1.5 whitespace-nowrap shrink-0"
        >
          <X className="w-4 h-4" />
          <span className="hidden sm:inline">Zurück zum 3D-Haus</span>
          <span className="sm:hidden">Schließen</span>
        </button>
      </div>

      {/* Live Energy & Safety Summary Strip */}
      <div className="px-3.5 sm:px-6 py-2.5 sm:py-3.5 bg-slate-900/90 border-b border-white/10 grid grid-cols-2 md:grid-cols-4 gap-2.5 sm:gap-4">
        <div className="p-3 rounded-xl bg-[#0f172a] border border-white/8">
          <div className="text-xs text-slate-400 flex items-center gap-1.5">
            <SunMedium className="w-4 h-4 text-emerald-400" />
            <span>PV-Solarerzeugung</span>
          </div>
          <div className="text-xl font-mono font-bold text-emerald-400 mt-1 tabular-nums">
            {pvGenerationW} W
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">
            Tagesertrag: 28,4 kWh · Dach Süd-Ost
          </div>
        </div>

        <div className="p-3 rounded-xl bg-[#0f172a] border border-white/8">
          <div className="text-xs text-slate-400 flex items-center gap-1.5">
            <Plug className="w-4 h-4 text-amber-400" />
            <span>Hausverbrauch & Steckdosen</span>
          </div>
          <div className="text-xl font-mono font-bold text-amber-300 mt-1 tabular-nums">
            {totalConsumptionW} W
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">
            Inkl. Wallbox, Waschmaschine & Espresso
          </div>
        </div>

        <div className="p-3 rounded-xl bg-[#0f172a] border border-white/8">
          <div className="text-xs text-slate-400 flex items-center gap-1.5">
            <Zap className="w-4 h-4 text-sky-400" />
            <span>Heimspeicher & E-Auto</span>
          </div>
          <div className="text-xl font-mono font-bold text-sky-300 mt-1 tabular-nums">
            {batterySoc}% · EV 78%
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">
            Autarkiegrad aktuell: 96%
          </div>
        </div>

        <div className="p-3 rounded-xl bg-[#0f172a] border border-white/8">
          <div className="text-xs text-slate-400 flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>Rauch- & Wassermelder</span>
          </div>
          <div className="text-xl font-mono font-bold text-white mt-1 tabular-nums">
            6 Melder aktiv
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">
            4× Rauchmelder · 2× Wassermelder
          </div>
        </div>
      </div>

      {/* Category Filter Bar */}
      <div className="px-6 py-2.5 border-b border-white/10 flex flex-wrap items-center gap-1.5">
        {[
          { id: 'all', label: 'Alle Entitäten (34)' },
          { id: 'plugs', label: 'Schaltbare Steckdosen & Taster' },
          { id: 'smoke_security', label: 'Rauchmelder, Wassermelder & Kameras' },
          { id: 'outdoor', label: 'Außenanlagen, Pool, Bewässerung & Solar' },
          { id: 'lights_climate', label: 'Lichter, Rollläden & Raumklima' },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setFilterGroup(tab.id as typeof filterGroup)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
              filterGroup === tab.id
                ? 'bg-sky-500 text-slate-950 font-semibold'
                : 'bg-slate-900 text-slate-300 hover:bg-slate-800'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Entity Grid */}
      <div className="flex-1 overflow-y-auto p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
        {filteredEntities.map((ent) => {
          const isSmoke =
            ent.attributes.device_class === 'smoke' ||
            ent.attributes.device_class === 'moisture';
          const isAlarm =
            ent.state === 'detected' || Boolean(ent.attributes.alarm_test_active);

          return (
            <div
              key={ent.entity_id}
              className="p-3.5 rounded-xl bg-slate-900/95 border border-white/10 flex flex-col justify-between gap-3"
            >
              <div>
                <div className="flex items-center justify-between text-[11px] text-slate-400">
                  <span className="font-mono truncate">{ent.entity_id}</span>
                  <span className="font-mono font-semibold text-slate-200 tabular-nums ml-2 shrink-0">
                    {ent.state.toUpperCase()}
                  </span>
                </div>
                <div className="text-sm font-semibold text-white mt-1">
                  {ent.attributes.friendly_name}
                </div>

                {/* Unboxed clean metadata line */}
                <div className="text-xs text-slate-400 mt-1.5 font-mono tabular-nums">
                  {ent.attributes.current_power_w !== undefined && (
                    <span>
                      Leistung: {ent.state === 'on' || ent.domain === 'sensor' ? ent.attributes.current_power_w : 0} W
                      {ent.attributes.today_energy_kwh !== undefined &&
                        ` · ${ent.attributes.today_energy_kwh} kWh`}
                    </span>
                  )}
                  {ent.attributes.battery_level !== undefined && (
                    <span>
                      Batterie: {ent.attributes.battery_level}%
                      {ent.attributes.linkquality_lqi !== undefined &&
                        ` · LQI ${ent.attributes.linkquality_lqi}`}
                    </span>
                  )}
                  {ent.attributes.current_temperature !== undefined && (
                    <span>
                      Ist: {ent.attributes.current_temperature} °C
                      {ent.attributes.target_temperature !== undefined &&
                        ` · Soll: ${ent.attributes.target_temperature} °C`}
                    </span>
                  )}
                  {ent.attributes.water_flow_lmin !== undefined && (
                    <span>
                      Durchfluss: {ent.state === 'open' ? ent.attributes.water_flow_lmin : 0} L/min
                    </span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2 border-t border-white/8">
                {isSmoke ? (
                  <button
                    type="button"
                    onClick={() => onTriggerSmokeTest(ent.entity_id)}
                    className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap ${
                      isAlarm
                        ? 'bg-emerald-500 text-slate-950'
                        : 'bg-red-500/20 hover:bg-red-500/30 text-red-300 border border-red-500/30'
                    }`}
                  >
                    <BellRing className="w-3.5 h-3.5" />
                    <span>{isAlarm ? 'Alarm stoppen' : '3D-Probealarm'}</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => onToggleEntity(ent.entity_id)}
                    className="flex-1 py-1.5 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium text-white flex items-center justify-center gap-1.5 whitespace-nowrap"
                  >
                    <Power className="w-3.5 h-3.5 text-amber-400" />
                    <span>Schalten</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => onFocusEntityIn3D(ent.entity_id)}
                  className="py-1.5 px-3 rounded-lg bg-sky-500/15 hover:bg-sky-500/25 border border-sky-400/30 text-xs font-medium text-sky-300 whitespace-nowrap shrink-0"
                >
                  Im 3D-Raum zeigen
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
