import React, { useState } from 'react';
import {
  Building2,
  Camera,
  ChevronDown,
  ChevronUp,
  CloudRain,
  Compass,
  Eye,
  Flame,
  Focus,
  Gauge,
  LayoutGrid,
  Layers,
  Palette,
  Pause,
  Play,
  Radar,
  Sun,
  Users,
  Zap,
} from 'lucide-react';
import {
  ActiveFloorView,
  CameraPresetId,
  FloorplanZone,
  PerformanceMode,
  VisualStyleMode,
  WeatherSimulationMode,
} from '../types/floorplan';

interface BottomControlDockProps {
  zones: FloorplanZone[];
  activeFloor: ActiveFloorView;
  onChangeActiveFloor: (floor: ActiveFloorView) => void;
  performanceMode: PerformanceMode;
  onChangePerformanceMode: (mode: PerformanceMode) => void;
  focusedZoneId: string | null;
  onSelectFocusedZone: (zoneId: string | null) => void;
  sunHour: number;
  onChangeSunHour: (hour: number) => void;
  cameraPreset: CameraPresetId;
  onChangeCameraPreset: (preset: CameraPresetId) => void;
  wallCutaway: boolean;
  onToggleWallCutaway: () => void;
  showClimateHeatmap: boolean;
  onToggleClimateHeatmap: () => void;
  showEnergyFlow: boolean;
  onToggleEnergyFlow: () => void;
  showSensorRadii: boolean;
  onToggleSensorRadii: () => void;
  showFloatingBadges: boolean;
  onToggleFloatingBadges: () => void;
  visualStyle?: VisualStyleMode;
  onChangeVisualStyle?: (style: VisualStyleMode) => void;
  weatherMode?: WeatherSimulationMode;
  onChangeWeatherMode?: (weather: WeatherSimulationMode) => void;
  showPresenceAvatars?: boolean;
  onTogglePresenceAvatars?: () => void;
  showSmartCockpitCards?: boolean;
  onToggleSmartCockpitCards?: () => void;
  cameraIdleMode?: boolean;
  onToggleCameraIdleMode?: () => void;
  autoIdleAfterInactivity?: boolean;
  onToggleAutoIdleAfterInactivity?: () => void;
  northAngle?: number;
  onChangeNorthAngle?: (angleDeg: number) => void;
  isRealTimeClock?: boolean;
  onToggleRealTimeClock?: () => void;
}

const PRESET_LABELS: { id: CameraPresetId; label: string }[] = [
  { id: 'overview', label: 'Gesamtanwesen' },
  { id: 'living_kitchen', label: 'Wohnbereich' },
  { id: 'garden_pool', label: 'Garten & Pool' },
  { id: 'driveway_solar', label: 'Einfahrt & Solar' },
  { id: 'top_blueprint', label: '2D-Draufsicht' },
];

const FLOOR_BUTTONS: { id: ActiveFloorView; short: string; label: string }[] = [
  { id: -1, short: 'KG', label: 'Keller (KG)' },
  { id: 0, short: 'EG', label: 'Erdgeschoss (EG)' },
  { id: 1, short: '1. OG', label: '1. Obergeschoss' },
  { id: 2, short: 'DG', label: 'Dachgeschoss (DG)' },
  { id: 'all_stacked', short: 'Alle 3D', label: 'Alle Etagen (3D-Stapel)' },
];

const PERF_MODES: { id: PerformanceMode; label: string; hint: string }[] = [
  {
    id: 'eco',
    label: 'Eco / Tablet',
    hint: 'Maximale FPS für Wand-Tablets, Mini-PCs & ältere Laptops (1.0x Auflösung, Kontaktschatten)',
  },
  {
    id: 'balanced',
    label: 'Performant',
    hint: 'Optimierter Standard: Smart-Idle-Rendering, gecachte Schatten & gepoolte Raumlichter',
  },
  {
    id: 'ultra',
    label: 'Ultra',
    hint: 'Maximale Kantenglättung & hochauflösende 2048px Schatten für schnelle Desktop-GPUs',
  },
];

export const BottomControlDock: React.FC<BottomControlDockProps> = ({
  zones,
  activeFloor,
  onChangeActiveFloor,
  performanceMode,
  onChangePerformanceMode,
  focusedZoneId,
  onSelectFocusedZone,
  sunHour,
  onChangeSunHour,
  cameraPreset,
  onChangeCameraPreset,
  wallCutaway,
  onToggleWallCutaway,
  showClimateHeatmap,
  onToggleClimateHeatmap,
  showEnergyFlow,
  onToggleEnergyFlow,
  showSensorRadii,
  onToggleSensorRadii,
  showFloatingBadges,
  onToggleFloatingBadges,
  visualStyle = 'archviz',
  onChangeVisualStyle,
  weatherMode = 'auto_sun',
  onChangeWeatherMode,
  showPresenceAvatars = true,
  onTogglePresenceAvatars,
  showSmartCockpitCards = true,
  onToggleSmartCockpitCards,
  cameraIdleMode = false,
  onToggleCameraIdleMode,
  autoIdleAfterInactivity = false,
  onToggleAutoIdleAfterInactivity,
  northAngle = 0,
  onChangeNorthAngle,
  isRealTimeClock = true,
  onToggleRealTimeClock,
}) => {
  const [collapsed, setCollapsed] = useState<boolean>(() =>
    typeof window !== 'undefined' ? window.innerWidth < 768 : false
  );

  const formattedTime = `${String(Math.floor(sunHour)).padStart(2, '0')}:${String(
    Math.round((sunHour % 1) * 60) % 60
  ).padStart(2, '0')} Uhr`;

  // Strictly indoor rooms only in Raum-Fokus (excludes Gartenrasen, Bürgersteig, Einfahrt, etc.)
  const visibleFloorZones = zones.filter(
    (z) =>
      z.zoneType === 'indoor' &&
      (activeFloor === 'all_stacked' || (z.level ?? 0) === activeFloor)
  );

  return (
    <div className="fixed bottom-2 sm:bottom-3.5 left-1/2 -translate-x-1/2 w-[min(1140px,96vw)] z-30 flex flex-col items-center pointer-events-none">
      {/* Collapse / Expand Zen Mode Handle + Quick Mobile Floor Bar when collapsed */}
      <div className="pointer-events-auto flex items-center gap-1.5 px-2.5 sm:px-3.5 py-1 rounded-t-lg bg-[#0f172a] border border-b-0 border-white/10 shadow-lg max-w-full overflow-x-auto no-scrollbar">
        {collapsed && (
          <div className="flex items-center gap-1 pr-1.5 border-r border-white/10 shrink-0">
            {FLOOR_BUTTONS.map((fb) => {
              const isSelected = activeFloor === fb.id;
              return (
                <button
                  key={String(fb.id)}
                  type="button"
                  onClick={() => {
                    onSelectFocusedZone(null);
                    onChangeActiveFloor(fb.id);
                  }}
                  className={`px-2 py-0.5 rounded text-[11px] font-semibold transition-colors whitespace-nowrap ${
                    isSelected
                      ? 'bg-amber-400 text-slate-950'
                      : 'text-slate-300 hover:text-white'
                  }`}
                >
                  {fb.short}
                </button>
              );
            })}
          </div>
        )}
        <button
          type="button"
          onClick={() => setCollapsed((prev) => !prev)}
          className="flex items-center gap-1.5 text-xs font-medium text-slate-300 hover:text-white transition-colors whitespace-nowrap shrink-0 py-0.5"
        >
          {collapsed ? (
            <>
              <ChevronUp className="w-3.5 h-3.5 text-amber-400" />
              <span className="sm:hidden">3D-Steuerdock</span>
              <span className="hidden sm:inline">Raum-Fokus, Sonnenstand & 3D-Steuerdock einblenden</span>
            </>
          ) : (
            <>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
              <span>Steuerdock ausblenden (Zen-Modus)</span>
            </>
          )}
        </button>
      </div>

      {/* Main Dock Surface (No backdrop-filter over WebGL per performance discipline) */}
      {!collapsed && (
        <div className="pointer-events-auto w-full max-h-[46dvh] sm:max-h-none overflow-y-auto rounded-xl bg-[#0f172a] border border-white/10 shadow-2xl px-3 sm:px-4 py-2 sm:py-2.5 flex flex-col gap-2">
          {/* Row 1: Stockwerke (Floor Switcher) + Room Focus Quick-Select */}
          <div className="flex flex-wrap items-center gap-2 pb-1.5 border-b border-white/10">
            {/* Stockwerk Switcher */}
            <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-white/10 shrink-0 overflow-x-auto max-w-full">
              <div className="flex items-center gap-1 px-1.5 text-[11px] font-bold text-amber-400 uppercase tracking-wider">
                <Building2 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Etage:</span>
              </div>
              {FLOOR_BUTTONS.map((fb) => {
                const isSelected = activeFloor === fb.id;
                return (
                  <button
                    key={String(fb.id)}
                    type="button"
                    onClick={() => {
                      onSelectFocusedZone(null);
                      onChangeActiveFloor(fb.id);
                    }}
                    title={fb.label}
                    className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-colors whitespace-nowrap ${
                      isSelected
                        ? 'bg-amber-400 text-slate-950 shadow-sm'
                        : 'text-slate-300 hover:text-white hover:bg-slate-800'
                    }`}
                  >
                    {fb.short}
                  </button>
                );
              })}
            </div>

            {/* Room Focus Quick-Select with Automatic Dimming of Other Rooms */}
            <div className="flex items-center gap-1.5 overflow-x-auto flex-1 py-0.5">
              <div className="flex items-center gap-1 text-xs font-semibold text-sky-400 whitespace-nowrap shrink-0 pl-1 pr-1">
                <Focus className="w-3.5 h-3.5" />
                <span>Raum-Fokus:</span>
              </div>
              <button
                type="button"
                onClick={() => onSelectFocusedZone(null)}
                className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                  focusedZoneId === null
                    ? 'bg-sky-400 text-slate-950 shadow-sm'
                    : 'bg-slate-900 text-slate-300 hover:text-white hover:bg-slate-800 border border-white/10'
                }`}
              >
                Alle Räume
              </button>
              {visibleFloorZones.map((zone) => {
                const isFocused = focusedZoneId === zone.id;
                const lvlTag =
                  activeFloor === 'all_stacked'
                    ? zone.level === -1
                      ? ' (KG)'
                      : zone.level === 1
                      ? ' (OG)'
                      : zone.level === 2
                      ? ' (DG)'
                      : ' (EG)'
                    : '';
                return (
                  <button
                    key={zone.id}
                    type="button"
                    onClick={() => onSelectFocusedZone(isFocused ? null : zone.id)}
                    className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5 ${
                      isFocused
                        ? 'bg-sky-400 text-slate-950 font-semibold shadow-sm'
                        : 'bg-slate-900/90 text-slate-300 hover:text-white hover:bg-slate-800 border border-white/5'
                    }`}
                  >
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        zone.zoneType === 'indoor' ? 'bg-amber-400' : 'bg-emerald-400'
                      }`}
                    />
                    <span>
                      {zone.name}
                      {lvlTag}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Row 2: Sun Day/Night Slider & Camera Presets */}
          <div className="flex flex-wrap items-center justify-between gap-4">
            {/* Day/Night Sun Control + Real-Time Clock Sync */}
            <div className="flex items-center gap-2.5 min-w-[260px] flex-1">
              <div className="flex items-center gap-1.5 text-xs font-medium text-amber-300 whitespace-nowrap shrink-0">
                <Sun className="w-4 h-4" />
                <span>Uhrzeit</span>
                <span className="font-mono text-slate-100 ml-0.5 tabular-nums font-bold">
                  {formattedTime}
                </span>
              </div>
              {onToggleRealTimeClock && (
                <button
                  type="button"
                  onClick={onToggleRealTimeClock}
                  title="Synchronisiert den 3D-Sonnenstand und Straßenlaternen automatisch mit der aktuellen Echtzeit-Uhr"
                  className={`px-2 py-0.5 rounded text-[10.5px] font-bold transition-colors whitespace-nowrap shrink-0 ${
                    isRealTimeClock
                      ? 'bg-emerald-400 text-slate-950 shadow-sm'
                      : 'bg-slate-800 text-slate-300 hover:bg-slate-700 border border-white/10'
                  }`}
                >
                  {isRealTimeClock ? '● Echtzeit' : 'Echtzeit'}
                </button>
              )}
              <input
                type="range"
                min={0}
                max={23.75}
                step={0.25}
                value={sunHour}
                onChange={(e) => onChangeSunHour(parseFloat(e.target.value))}
                className="w-full accent-amber-400 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
                aria-label="Tageszeit und Sonnenstand"
              />
              <div className="hidden sm:flex items-center gap-1 shrink-0">
                {[
                  { label: '08:00', val: 8 },
                  { label: '14:30', val: 14.5 },
                  { label: '19:45', val: 19.75 },
                  { label: '22:30', val: 22.5 },
                ].map((preset) => (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => onChangeSunHour(preset.val)}
                    className={`px-2 py-1 rounded text-[11px] font-mono tabular-nums transition-colors whitespace-nowrap shrink-0 ${
                      !isRealTimeClock && Math.abs(sunHour - preset.val) < 0.6
                        ? 'bg-amber-500 text-slate-950 font-semibold'
                        : 'bg-slate-800/90 text-slate-300 hover:bg-slate-700'
                    }`}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
              {onChangeNorthAngle && (
                <button
                  type="button"
                  onClick={() => onChangeNorthAngle((northAngle + 45) % 360)}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    onChangeNorthAngle(0);
                  }}
                  title="Nordstern / Nord-Ausrichtung für Sonnenverlauf (+45° drehen, Rechtsklick = 0°)"
                  className="flex items-center gap-1 px-2 py-1 rounded bg-slate-900 hover:bg-slate-800 border border-amber-400/35 text-[11px] font-mono text-amber-300 shrink-0"
                >
                  <Compass
                    className="w-3.5 h-3.5 text-amber-400 transition-transform"
                    style={{ transform: `rotate(${northAngle}deg)` }}
                  />
                  <span>N {Math.round(northAngle)}°</span>
                </button>
              )}
            </div>

            {/* Camera View Presets + Slow Camera Idle Orbit Tour */}
            <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-lg border border-white/5 overflow-x-auto">
              <Camera className="w-3.5 h-3.5 text-slate-400 ml-1.5 mr-1 shrink-0" />
              {PRESET_LABELS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    onSelectFocusedZone(null);
                    onChangeCameraPreset(item.id);
                  }}
                  className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                    cameraPreset === item.id && focusedZoneId === null && !cameraIdleMode
                      ? 'bg-sky-500 text-slate-950 font-semibold'
                      : 'text-slate-300 hover:text-white hover:bg-slate-800'
                  }`}
                >
                  {item.label}
                </button>
              ))}
              {onToggleCameraIdleMode && (
                <button
                  type="button"
                  onClick={onToggleCameraIdleMode}
                  title="3D-Kamerafahrt durch die Gebäude, Innenräume & um das Grundstück starten/pausieren"
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                    cameraIdleMode
                      ? 'bg-amber-400 text-slate-950 shadow-sm'
                      : 'bg-slate-800 text-amber-300 hover:bg-slate-700 border border-amber-400/30'
                  }`}
                >
                  {cameraIdleMode ? (
                    <Pause className="w-3 h-3" />
                  ) : (
                    <Play className="w-3 h-3" />
                  )}
                  <span>Haus- & Raum-Tour</span>
                </button>
              )}
              {onToggleAutoIdleAfterInactivity && (
                <button
                  type="button"
                  onClick={onToggleAutoIdleAfterInactivity}
                  title="Auto-Idle: Startet die langsame Kamerafahrt automatisch nach 25 Sek. ohne Maus-/Touch-Eingabe"
                  className={`px-2 py-1 rounded-md text-[10.5px] font-semibold transition-colors whitespace-nowrap shrink-0 ${
                    autoIdleAfterInactivity
                      ? 'bg-emerald-400 text-slate-950'
                      : 'bg-slate-950 text-slate-400 hover:text-slate-200 border border-white/10'
                  }`}
                >
                  Auto-Idle {autoIdleAfterInactivity ? 'AN' : 'AUS'}
                </button>
              )}
            </div>
          </div>

          {/* Row 3: Performance, Design-Modus (ArchViz/Neon/CAD), Live-Wetter & Smart-Cockpit Overlays */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-1.5 border-t border-white/10">
            <div className="flex flex-wrap items-center gap-1.5">
              {/* GPU / Performance Mode Selector */}
              <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-white/10 shrink-0">
                <div className="flex items-center gap-1 px-1 text-[10.5px] font-semibold text-emerald-400 whitespace-nowrap">
                  <Gauge className="w-3 h-3" />
                </div>
                {PERF_MODES.map((pm) => {
                  const isSelected = performanceMode === pm.id;
                  return (
                    <button
                      key={pm.id}
                      type="button"
                      onClick={() => onChangePerformanceMode(pm.id)}
                      title={pm.hint}
                      className={`px-2 py-0.5 rounded text-[10.5px] font-semibold transition-colors whitespace-nowrap ${
                        isSelected
                          ? 'bg-emerald-400 text-slate-950'
                          : 'text-slate-300 hover:text-white hover:bg-slate-800'
                      }`}
                    >
                      {pm.label}
                    </button>
                  );
                })}
              </div>

              {/* Design-Modus-Umschalter (ArchViz / Neon-Glow / Blueprint-CAD) */}
              {onChangeVisualStyle && (
                <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-white/10 shrink-0">
                  <Palette className="w-3 h-3 text-fuchsia-400 ml-1" />
                  {(
                    [
                      { id: 'archviz', label: 'ArchViz' },
                      { id: 'neon', label: 'Neon-Glow' },
                      { id: 'blueprint', label: 'CAD-Blueprint' },
                    ] as const
                  ).map((st) => (
                    <button
                      key={st.id}
                      type="button"
                      onClick={() => onChangeVisualStyle(st.id)}
                      className={`px-2 py-0.5 rounded text-[10.5px] font-semibold transition-colors whitespace-nowrap ${
                        visualStyle === st.id
                          ? 'bg-fuchsia-400 text-slate-950'
                          : 'text-slate-300 hover:text-white hover:bg-slate-800'
                      }`}
                    >
                      {st.label}
                    </button>
                  ))}
                </div>
              )}

              {/* Live 3D Weather Switcher */}
              {onChangeWeatherMode && (
                <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-white/10 shrink-0">
                  <CloudRain className="w-3 h-3 text-sky-400 ml-1" />
                  {(
                    [
                      { id: 'auto_sun', label: 'Sonne/Auto' },
                      { id: 'rain', label: 'Regen' },
                      { id: 'snow', label: 'Schnee' },
                    ] as const
                  ).map((wm) => (
                    <button
                      key={wm.id}
                      type="button"
                      onClick={() => onChangeWeatherMode(wm.id)}
                      className={`px-2 py-0.5 rounded text-[10.5px] font-semibold transition-colors whitespace-nowrap ${
                        weatherMode === wm.id
                          ? 'bg-sky-400 text-slate-950'
                          : 'text-slate-300 hover:text-white hover:bg-slate-800'
                      }`}
                    >
                      {wm.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              {onToggleSmartCockpitCards && (
                <button
                  type="button"
                  onClick={onToggleSmartCockpitCards}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-colors whitespace-nowrap shrink-0 ${
                    showSmartCockpitCards
                      ? 'bg-amber-400 text-slate-950 border-amber-300'
                      : 'bg-slate-900 border-white/10 text-slate-300 hover:text-white'
                  }`}
                >
                  <LayoutGrid className="w-3.5 h-3.5" />
                  <span>Cockpit-Cards</span>
                </button>
              )}

              {onTogglePresenceAvatars && (
                <button
                  type="button"
                  onClick={onTogglePresenceAvatars}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium border transition-colors whitespace-nowrap shrink-0 ${
                    showPresenceAvatars
                      ? 'bg-fuchsia-500/20 border-fuchsia-400/50 text-fuchsia-200'
                      : 'bg-slate-900 border-white/10 text-slate-300 hover:text-white'
                  }`}
                >
                  <Users className="w-3.5 h-3.5" />
                  <span>Personen 3D</span>
                </button>
              )}

              <button
                type="button"
                onClick={onToggleWallCutaway}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium border transition-colors whitespace-nowrap shrink-0 ${
                  wallCutaway
                    ? 'bg-amber-500/20 border-amber-400/50 text-amber-200'
                    : 'bg-slate-900 border-white/10 text-slate-300 hover:text-white'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>Wände absenken</span>
              </button>

              <button
                type="button"
                onClick={onToggleSensorRadii}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium border transition-colors whitespace-nowrap shrink-0 ${
                  showSensorRadii
                    ? 'bg-red-500/20 border-red-400/50 text-red-200'
                    : 'bg-slate-900 border-white/10 text-slate-300 hover:text-white'
                }`}
              >
                <Radar className="w-3.5 h-3.5" />
                <span>FOV & Radien</span>
              </button>

              <button
                type="button"
                onClick={onToggleEnergyFlow}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium border transition-colors whitespace-nowrap shrink-0 ${
                  showEnergyFlow
                    ? 'bg-emerald-500/20 border-emerald-400/50 text-emerald-200'
                    : 'bg-slate-900 border-white/10 text-slate-300 hover:text-white'
                }`}
              >
                <Zap className="w-3.5 h-3.5" />
                <span>Energiefluss</span>
              </button>

              <button
                type="button"
                onClick={onToggleClimateHeatmap}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium border transition-colors whitespace-nowrap shrink-0 ${
                  showClimateHeatmap
                    ? 'bg-orange-500/20 border-orange-400/50 text-orange-200'
                    : 'bg-slate-900 border-white/10 text-slate-300 hover:text-white'
                }`}
              >
                <Flame className="w-3.5 h-3.5" />
                <span>Klima</span>
              </button>

              <button
                type="button"
                onClick={onToggleFloatingBadges}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium border transition-colors whitespace-nowrap shrink-0 ${
                  showFloatingBadges
                    ? 'bg-sky-500/20 border-sky-400/50 text-sky-200'
                    : 'bg-slate-900 border-white/10 text-slate-300 hover:text-white'
                }`}
              >
                <Eye className="w-3.5 h-3.5" />
                <span>Labels</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
