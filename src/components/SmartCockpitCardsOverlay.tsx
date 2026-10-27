import React, { useState } from 'react';
import {
  Activity,
  BatteryCharging,
  Camera,
  Car,
  ChevronDown,
  ChevronUp,
  Cpu,
  Droplets,
  Eye,
  Flame,
  Home,
  Lightbulb,
  Maximize2,
  Sun,
  Thermometer,
  Tv,
  Users,
  Wind,
  Zap,
} from 'lucide-react';
import {
  ActiveFloorView,
  FloorplanProject,
  HAEntityState,
} from '../types/floorplan';

interface SmartCockpitCardsOverlayProps {
  project: FloorplanProject;
  entities: Record<string, HAEntityState>;
  activeFloorFilter: ActiveFloorView;
  showEnergyFlow: boolean;
  showSensorCones: boolean;
  showPresenceAvatars: boolean;
  onToggleEnergyFlow: () => void;
  onToggleSensorCones: () => void;
  onTogglePresenceAvatars: () => void;
  onToggleEntity: (entityId: string) => void;
  onUpdatePersonRoom?: (entityId: string, roomName: string) => void;
  onFocusZone: (zoneId: string) => void;
}

type CockpitTabId = 'rooms' | 'energy' | 'cameras' | 'devices';

export const SmartCockpitCardsOverlay: React.FC<SmartCockpitCardsOverlayProps> = ({
  project,
  entities,
  activeFloorFilter,
  showEnergyFlow,
  showSensorCones,
  showPresenceAvatars,
  onToggleEnergyFlow,
  onToggleSensorCones,
  onTogglePresenceAvatars,
  onToggleEntity,
  onUpdatePersonRoom,
  onFocusZone,
}) => {
  const [activeTab, setActiveTab] = useState<CockpitTabId>('rooms');
  const [collapsed, setCollapsed] = useState(false);

  const indoorZones = project.zones.filter(
    (z) =>
      z.zoneType === 'indoor' &&
      (activeFloorFilter === 'all_stacked' || (z.level ?? 0) === activeFloorFilter)
  );

  // Energy Pro Metrics
  const pvEntity = entities['sensor.pv_roof_power'];
  const batEntity = entities['sensor.home_battery_soc'];
  const gridEntity = entities['sensor.grid_power'];
  const evEntity = entities['sensor.wallbox_power'];
  const homeLoadEntity = entities['sensor.home_load_power'];

  const pvW = Number(pvEntity?.state ?? 6840);
  const batSoc = Number(batEntity?.state ?? 84);
  const gridW = Number(gridEntity?.state ?? -2450);
  const evW = Number(evEntity?.state ?? 3680);
  const homeW = Number(homeLoadEntity?.state ?? 710);

  // Camera & Motion Entities
  const cameraEntities = Object.values(entities).filter((e) => e.domain === 'camera');
  const motionSensors = Object.values(entities).filter(
    (e) => e.domain === 'binary_sensor' && e.entity_id.includes('motion')
  );

  // Persons / Presence Avatars
  const personEntities = Object.values(entities).filter((e) => e.domain === 'person');

  return (
    <div className="pointer-events-auto w-[320px] sm:w-[350px] max-h-[calc(100vh-195px)] flex flex-col rounded-xl bg-slate-950/88 backdrop-blur-xl border border-slate-800/90 shadow-2xl overflow-hidden text-slate-100">
      {/* Header Bar */}
      <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-slate-800/80 bg-slate-900/70">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
          <span className="text-xs font-bold uppercase tracking-wider text-slate-100">
            Smart-Cockpit Cards
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={onTogglePresenceAvatars}
            title="Live 3D-Präsenz-Avatare in Räumen ein-/ausblenden"
            className={`px-2 py-1 rounded text-[10px] font-semibold flex items-center gap-1 transition-colors ${
              showPresenceAvatars
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                : 'bg-slate-800/70 text-slate-400 hover:text-slate-200'
            }`}
          >
            <Users className="w-3 h-3" />
            <span>Avatare</span>
          </button>
          <button
            onClick={() => setCollapsed((p) => !p)}
            className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-slate-800"
            title={collapsed ? 'Cockpit ausklappen' : 'Cockpit einklappen'}
          >
            {collapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {!collapsed && (
        <>
          {/* Category Tabs */}
          <div className="grid grid-cols-4 gap-1 p-1.5 bg-slate-900/50 border-b border-slate-800/70">
            <button
              onClick={() => setActiveTab('rooms')}
              className={`flex flex-col items-center justify-center py-1.5 rounded-lg text-[10px] font-semibold transition-all ${
                activeTab === 'rooms'
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <Home className="w-3.5 h-3.5 mb-0.5" />
              <span>Räume</span>
            </button>
            <button
              onClick={() => setActiveTab('energy')}
              className={`flex flex-col items-center justify-center py-1.5 rounded-lg text-[10px] font-semibold transition-all ${
                activeTab === 'energy'
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <Zap className="w-3.5 h-3.5 mb-0.5" />
              <span>Energie</span>
            </button>
            <button
              onClick={() => setActiveTab('cameras')}
              className={`flex flex-col items-center justify-center py-1.5 rounded-lg text-[10px] font-semibold transition-all ${
                activeTab === 'cameras'
                  ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <Camera className="w-3.5 h-3.5 mb-0.5" />
              <span>Kameras</span>
            </button>
            <button
              onClick={() => setActiveTab('devices')}
              className={`flex flex-col items-center justify-center py-1.5 rounded-lg text-[10px] font-semibold transition-all ${
                activeTab === 'devices'
                  ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <Cpu className="w-3.5 h-3.5 mb-0.5" />
              <span>Geräte</span>
            </button>
          </div>

          {/* Scrollable Card Content */}
          <div className="p-2.5 overflow-y-auto space-y-2.5 max-h-[420px] custom-scrollbar">
            {/* TAB 1: RAUM-STATUS-CARDS */}
            {activeTab === 'rooms' && (
              <>
                {personEntities.length > 0 && (
                  <div className="p-2.5 rounded-lg bg-slate-900/90 border border-slate-800/90 space-y-1.5">
                    <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-emerald-400">
                      <span className="flex items-center gap-1.5">
                        <Users className="w-3.5 h-3.5" />
                        Live Raum-Präsenz (3D-Avatare)
                      </span>
                      <span>{personEntities.length} aktiv</span>
                    </div>
                    <div className="grid grid-cols-1 gap-1.5">
                      {personEntities.map((person) => {
                        const currentRoom =
                          (person.attributes.room as string) || 'Wohn- & Essbereich';
                        return (
                          <div
                            key={person.entity_id}
                            className="flex items-center justify-between gap-2 px-2 py-1 rounded bg-slate-950/70 border border-slate-800/70 text-xs"
                          >
                            <div className="flex items-center gap-1.5 min-w-0">
                              <span
                                className="w-2.5 h-2.5 rounded-full shrink-0"
                                style={{
                                  backgroundColor:
                                    (person.attributes.avatar_color as string) || '#38bdf8',
                                }}
                              />
                              <span className="font-medium truncate">
                                {person.attributes.friendly_name}
                              </span>
                            </div>
                            <select
                              value={currentRoom}
                              onChange={(e) =>
                                onUpdatePersonRoom?.(person.entity_id, e.target.value)
                              }
                              className="bg-slate-900 border border-slate-700/80 rounded px-1.5 py-0.5 text-[11px] text-cyan-300 focus:outline-none"
                            >
                              {project.zones
                                .filter((z) => z.zoneType === 'indoor')
                                .map((z) => (
                                  <option key={z.id} value={z.name}>
                                    {z.name}
                                  </option>
                                ))}
                            </select>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {indoorZones.map((zone) => {
                  const zLevel = zone.level ?? 0;
                  const floorLabel =
                    zLevel === -1 ? 'KG' : zLevel === 0 ? 'EG' : zLevel === 1 ? '1.OG' : 'DG';

                  // Find assets inside zone bounds
                  const zoneAssets = project.assets.filter((a) => {
                    if ((a.level ?? 0) !== zLevel) return false;
                    return (
                      Math.abs(a.position[0] - zone.x) <= zone.width / 2 + 0.3 &&
                      Math.abs(a.position[2] - zone.z) <= zone.depth / 2 + 0.3
                    );
                  });

                  const lightAssets = zoneAssets.filter(
                    (a) => a.entityId && entities[a.entityId]?.domain === 'light'
                  );
                  const activeLights = lightAssets.filter(
                    (a) => a.entityId && entities[a.entityId]?.state === 'on'
                  );

                  // Find openings in this zone's bounds
                  const zoneOpenings = project.openings.filter((o) => {
                    if ((o.level ?? 0) !== zLevel) return false;
                    return (
                      Math.abs(o.x - zone.x) <= zone.width / 2 + 0.45 &&
                      Math.abs(o.z - zone.z) <= zone.depth / 2 + 0.45
                    );
                  });

                  const openWindows = zoneOpenings.filter(
                    (o) =>
                      (o.entityId && entities[o.entityId]?.state === 'on') ||
                      (o.tiltEntityId && entities[o.tiltEntityId]?.state === 'on')
                  );

                  // Synthetic or entity room climate metrics
                  const climateEntity = zone.climateEntityId
                    ? entities[zone.climateEntityId]
                    : undefined;
                  const tempVal =
                    climateEntity?.attributes?.current_temperature ??
                    (zone.name.toLowerCase().includes('bad')
                      ? 22.8
                      : zone.name.toLowerCase().includes('schlaf')
                      ? 19.6
                      : 21.4);
                  const humVal = zone.name.toLowerCase().includes('bad') ? 56 : 46;
                  const co2Val = activeLights.length > 0 ? 540 : 435;

                  return (
                    <div
                      key={zone.id}
                      className="p-2.5 rounded-lg bg-slate-900/80 border border-slate-800/80 hover:border-slate-700 transition-all space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-xs font-bold text-slate-100 flex items-center gap-1.5">
                            <span>{zone.name}</span>
                            <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-400 font-mono uppercase">
                              {floorLabel}
                            </span>
                          </div>
                          <div className="text-[10px] text-slate-400">
                            {(zone.width * zone.depth).toFixed(1)} m² Grundfläche
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          {lightAssets.length > 0 && (
                            <button
                              onClick={() => {
                                lightAssets.forEach((la) => {
                                  if (la.entityId) onToggleEntity(la.entityId);
                                });
                              }}
                              title="Raumlicht umschalten"
                              className={`px-2 py-1 rounded-md text-[10px] font-semibold flex items-center gap-1 transition-colors ${
                                activeLights.length > 0
                                  ? 'bg-amber-500/25 text-amber-300 border border-amber-500/40'
                                  : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                              }`}
                            >
                              <Lightbulb className="w-3 h-3" />
                              <span>
                                {activeLights.length}/{lightAssets.length}
                              </span>
                            </button>
                          )}
                          <button
                            onClick={() => onFocusZone(zone.id)}
                            title="Kamera auf Raum fokussieren"
                            className="p-1.5 rounded-md bg-slate-800/80 hover:bg-slate-700 text-slate-300"
                          >
                            <Maximize2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>

                      {/* Telemetry Metrics Bar */}
                      <div className="grid grid-cols-4 gap-1 pt-1 border-t border-slate-800/70 text-[11px]">
                        <div className="flex items-center gap-1 text-amber-300 font-mono">
                          <Thermometer className="w-3 h-3 shrink-0" />
                          <span>{tempVal}°C</span>
                        </div>
                        <div className="flex items-center gap-1 text-sky-300 font-mono">
                          <Droplets className="w-3 h-3 shrink-0" />
                          <span>{humVal}%</span>
                        </div>
                        <div className="flex items-center gap-1 text-emerald-300 font-mono">
                          <Wind className="w-3 h-3 shrink-0" />
                          <span>{co2Val}</span>
                        </div>
                        <div
                          className={`flex items-center justify-end gap-1 font-medium ${
                            openWindows.length > 0 ? 'text-cyan-300' : 'text-slate-500'
                          }`}
                        >
                          <span>
                            {openWindows.length > 0
                              ? `${openWindows.length} offen`
                              : 'Fenster zu'}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </>
            )}

            {/* TAB 2: ENERGIE-PRO-CARD & 3D-STROMFLUSS */}
            {activeTab === 'energy' && (
              <div className="space-y-2.5">
                <div className="p-3 rounded-xl bg-gradient-to-br from-slate-900 via-slate-900 to-amber-950/30 border border-amber-500/30 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                      <Zap className="w-4 h-4" />
                      Energie-Pro Echtzeit-Bilanz
                    </span>
                    <button
                      onClick={onToggleEnergyFlow}
                      className={`px-2 py-1 rounded-md text-[10px] font-semibold transition-all ${
                        showEnergyFlow
                          ? 'bg-amber-500 text-slate-950 shadow-sm'
                          : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                      }`}
                    >
                      {showEnergyFlow ? '3D-Stromfluss AN' : '3D-Stromfluss AUS'}
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="p-2 rounded-lg bg-slate-950/80 border border-slate-800">
                      <div className="flex items-center gap-1.5 text-[10px] text-amber-400 font-semibold">
                        <Sun className="w-3.5 h-3.5" />
                        <span>PV-Dachanlage</span>
                      </div>
                      <div className="text-sm font-bold font-mono text-white mt-0.5">
                        {(pvW / 1000).toFixed(2)} kW
                      </div>
                    </div>

                    <div className="p-2 rounded-lg bg-slate-950/80 border border-slate-800">
                      <div className="flex items-center gap-1.5 text-[10px] text-emerald-400 font-semibold">
                        <BatteryCharging className="w-3.5 h-3.5" />
                        <span>Hausspeicher</span>
                      </div>
                      <div className="text-sm font-bold font-mono text-white mt-0.5">
                        {batSoc}% SoC
                      </div>
                    </div>

                    <div className="p-2 rounded-lg bg-slate-950/80 border border-slate-800">
                      <div className="flex items-center gap-1.5 text-[10px] text-cyan-400 font-semibold">
                        <Car className="w-3.5 h-3.5" />
                        <span>Wallbox EV</span>
                      </div>
                      <div className="text-sm font-bold font-mono text-white mt-0.5">
                        {(evW / 1000).toFixed(2)} kW
                      </div>
                    </div>

                    <div className="p-2 rounded-lg bg-slate-950/80 border border-slate-800">
                      <div className="flex items-center gap-1.5 text-[10px] text-sky-400 font-semibold">
                        <Activity className="w-3.5 h-3.5" />
                        <span>Haus & Netz</span>
                      </div>
                      <div className="text-sm font-bold font-mono text-white mt-0.5">
                        {homeW} W{' '}
                        <span className="text-[10px] text-emerald-400">
                          ({gridW < 0 ? `${Math.abs(gridW)}W Einsp.` : `${gridW}W Bezug`})
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Autarky Progress Bar */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-[10px] text-slate-300">
                      <span>Autarkiegrad aktuell</span>
                      <span className="font-mono font-bold text-emerald-400">94%</span>
                    </div>
                    <div className="w-full h-1.5 rounded-full bg-slate-800 overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-amber-400 via-emerald-400 to-cyan-400 w-[94%]" />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 3: KAMERA-COCKPIT-CARD MIT 3D-SICHTKEGEL (FOV) */}
            {activeTab === 'cameras' && (
              <div className="space-y-2.5">
                <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-900/90 border border-slate-800">
                  <div>
                    <div className="text-xs font-bold text-sky-300 flex items-center gap-1.5">
                      <Eye className="w-3.5 h-3.5" />
                      <span>3D-Kamera-Sichtkegel (FOV)</span>
                    </div>
                    <div className="text-[10px] text-slate-400">
                      Zeigt Überwachungsbereich & rote Alarm-Kegel bei Bewegung
                    </div>
                  </div>
                  <button
                    onClick={onToggleSensorCones}
                    className={`px-2.5 py-1 rounded-md text-[10px] font-bold transition-all ${
                      showSensorCones
                        ? 'bg-sky-500 text-slate-950'
                        : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                    }`}
                  >
                    {showSensorCones ? '3D-Kegel AN' : '3D-Kegel AUS'}
                  </button>
                </div>

                {cameraEntities.map((cam) => {
                  const hasMotion = motionSensors.some((m) => m.state === 'on');
                  return (
                    <div
                      key={cam.entity_id}
                      className={`p-2.5 rounded-lg border transition-all space-y-2 ${
                        hasMotion
                          ? 'bg-rose-950/30 border-rose-500/60'
                          : 'bg-slate-900/80 border-slate-800'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span
                            className={`w-2 h-2 rounded-full ${
                              hasMotion ? 'bg-rose-500 animate-ping' : 'bg-emerald-400'
                            }`}
                          />
                          <span className="text-xs font-bold text-slate-100">
                            {cam.attributes.friendly_name}
                          </span>
                        </div>
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-950 text-sky-300 border border-slate-800">
                          LIVE · 4K HDR
                        </span>
                      </div>

                      {/* Simulated Live HUD Viewport */}
                      <div className="relative h-20 rounded-md bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 border border-slate-800/90 overflow-hidden flex items-center justify-center">
                        <div className="absolute inset-0 opacity-20 bg-[radial-gradient(#38bdf8_1px,transparent_1px)] [background-size:10px_10px]" />
                        <Camera className="w-6 h-6 text-slate-600" />
                        <div className="absolute top-1.5 left-2 text-[9px] font-mono text-slate-400">
                          {cam.entity_id}
                        </div>
                        <div className="absolute bottom-1.5 right-2 text-[9px] font-mono text-emerald-400">
                          FPS: 30 · RTSP
                        </div>
                      </div>
                    </div>
                  );
                })}

                {motionSensors.length > 0 && (
                  <div className="p-2 rounded-lg bg-slate-900/70 border border-slate-800 space-y-1.5">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      Bewegungsmelder-Simulation (Alarm-Test)
                    </div>
                    {motionSensors.map((ms) => (
                      <div
                        key={ms.entity_id}
                        className="flex items-center justify-between text-xs py-1"
                      >
                        <span className="text-slate-300 truncate">
                          {ms.attributes.friendly_name}
                        </span>
                        <button
                          onClick={() => onToggleEntity(ms.entity_id)}
                          className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                            ms.state === 'on'
                              ? 'bg-rose-500/25 text-rose-300 border border-rose-500/40'
                              : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                          }`}
                        >
                          {ms.state === 'on' ? 'BEWEGUNG AKTIV' : 'Ruhe (Testen)'}
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* TAB 4: GERÄTE- & MEDIA-CARDS */}
            {activeTab === 'devices' && (
              <div className="space-y-2">
                {/* Smart TV / Media Player */}
                {entities['media_player.living_room_oled'] && (
                  <div className="p-2.5 rounded-lg bg-slate-900/85 border border-slate-800 flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="p-2 rounded-lg bg-purple-500/20 text-purple-300">
                        <Tv className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="text-xs font-bold">
                          {entities['media_player.living_room_oled'].attributes.friendly_name}
                        </div>
                        <div className="text-[10px] text-slate-400">
                          Status:{' '}
                          {entities['media_player.living_room_oled'].state === 'playing'
                            ? 'Spielt ab (Dolby Vision)'
                            : 'Standby'}
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => onToggleEntity('media_player.living_room_oled')}
                      className={`px-2.5 py-1 rounded-md text-[10px] font-semibold ${
                        entities['media_player.living_room_oled'].state === 'playing'
                          ? 'bg-purple-500 text-slate-950'
                          : 'bg-slate-800 text-slate-300'
                      }`}
                    >
                      {entities['media_player.living_room_oled'].state === 'playing'
                        ? 'Aktiv'
                        : 'Einschalten'}
                    </button>
                  </div>
                )}

                {/* Robot Vacuum & Lawn Mower */}
                {Object.values(entities)
                  .filter((e) => e.domain === 'vacuum' || e.domain === 'lawn_mower')
                  .map((bot) => (
                    <div
                      key={bot.entity_id}
                      className="p-2.5 rounded-lg bg-slate-900/85 border border-slate-800 flex items-center justify-between"
                    >
                      <div className="flex items-center gap-2.5">
                        <div className="p-2 rounded-lg bg-emerald-500/20 text-emerald-300">
                          <Cpu className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="text-xs font-bold">
                            {bot.attributes.friendly_name}
                          </div>
                          <div className="text-[10px] text-slate-400">
                            Status: {bot.state} · Akku {bot.attributes.battery_level ?? 92}%
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={() => onToggleEntity(bot.entity_id)}
                        className={`px-2.5 py-1 rounded-md text-[10px] font-semibold ${
                          bot.state === 'cleaning' || bot.state === 'mowing'
                            ? 'bg-emerald-500 text-slate-950'
                            : 'bg-slate-800 text-slate-300'
                        }`}
                      >
                        {bot.state === 'cleaning' || bot.state === 'mowing'
                          ? 'Stopp'
                          : 'Starten'}
                      </button>
                    </div>
                  ))}

                {/* Climate / Heating & Fireplace */}
                {Object.values(entities)
                  .filter((e) => e.domain === 'climate')
                  .map((clim) => (
                    <div
                      key={clim.entity_id}
                      className="p-2.5 rounded-lg bg-slate-900/85 border border-slate-800 flex items-center justify-between"
                    >
                      <div className="flex items-center gap-2.5">
                        <div className="p-2 rounded-lg bg-amber-500/20 text-amber-300">
                          <Flame className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="text-xs font-bold">
                            {clim.attributes.friendly_name}
                          </div>
                          <div className="text-[10px] text-slate-400">
                            Soll: {clim.attributes.temperature ?? 21.5}°C · Ist:{' '}
                            {clim.attributes.current_temperature ?? 21.2}°C
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={() => onToggleEntity(clim.entity_id)}
                        className={`px-2.5 py-1 rounded-md text-[10px] font-semibold ${
                          clim.state === 'heat'
                            ? 'bg-amber-500 text-slate-950'
                            : 'bg-slate-800 text-slate-300'
                        }`}
                      >
                        {clim.state === 'heat' ? 'Heizt' : 'Eco'}
                      </button>
                    </div>
                  ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};
