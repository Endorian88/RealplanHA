import React, { useEffect, useRef, useState } from 'react';
import {
  Building2,
  Camera,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
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
  Settings2,
  SlidersHorizontal,
  Sun,
  Users,
  X,
  Zap,
} from 'lucide-react';
import {
  ActiveFloorView,
  CameraPresetId,
  FloorplanZone,
  HolidayThemeMode,
  PerformanceMode,
  resolveActiveHolidayTheme,
  resolveZoneRole,
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
  show3DCards?: boolean;
  onToggle3DCards?: () => void;
  visualStyle?: VisualStyleMode;
  onChangeVisualStyle?: (style: VisualStyleMode) => void;
  weatherMode?: WeatherSimulationMode;
  onChangeWeatherMode?: (weather: WeatherSimulationMode) => void;
  weatherEntityId?: string;
  weatherEntities?: { id: string; label: string; state: string }[];
  onChangeWeatherEntityId?: (entityId: string) => void;
  holidayThemeMode?: HolidayThemeMode;
  onChangeHolidayThemeMode?: (mode: HolidayThemeMode) => void;
  showPresenceAvatars?: boolean;
  onTogglePresenceAvatars?: () => void;
  showSmartCockpitCards?: boolean;
  onToggleSmartCockpitCards?: () => void;
  cameraIdleMode?: boolean;
  onToggleCameraIdleMode?: () => void;
  onOpenTourConfig?: () => void;
  autoIdleAfterInactivity?: boolean;
  onToggleAutoIdleAfterInactivity?: () => void;
  northAngle?: number;
  onChangeNorthAngle?: (angleDeg: number) => void;
  isRealTimeClock?: boolean;
  onToggleRealTimeClock?: () => void;
  collapsed?: boolean;
  onToggleCollapsed?: () => void;
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
  show3DCards = true,
  onToggle3DCards,
  visualStyle = 'archviz',
  onChangeVisualStyle,
  weatherMode = 'auto_sun',
  onChangeWeatherMode,
  weatherEntityId = '',
  weatherEntities = [],
  onChangeWeatherEntityId,
  holidayThemeMode = 'auto',
  onChangeHolidayThemeMode,
  showPresenceAvatars = true,
  onTogglePresenceAvatars,
  showSmartCockpitCards = true,
  onToggleSmartCockpitCards,
  cameraIdleMode = false,
  onToggleCameraIdleMode,
  onOpenTourConfig,
  autoIdleAfterInactivity = false,
  onToggleAutoIdleAfterInactivity,
  northAngle = 0,
  onChangeNorthAngle,
  isRealTimeClock = true,
  onToggleRealTimeClock,
  collapsed: controlledCollapsed,
  onToggleCollapsed,
}) => {
  const [internalCollapsed, setInternalCollapsed] = useState<boolean>(() =>
    typeof window !== 'undefined' ? window.innerWidth < 768 : false
  );
  const collapsed = controlledCollapsed !== undefined ? controlledCollapsed : internalCollapsed;
  const handleToggleCollapsed = () => {
    if (onToggleCollapsed) {
      onToggleCollapsed();
    } else {
      setInternalCollapsed((prev) => !prev);
    }
  };

  const [showDetailsMenu, setShowDetailsMenu] = useState(false);
  const [showWeatherPopover, setShowWeatherPopover] = useState(false);
  const dockRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!showDetailsMenu) return;
    const handlePointerDownOutside = (e: PointerEvent) => {
      if (dockRef.current && !dockRef.current.contains(e.target as Node)) {
        setShowDetailsMenu(false);
        setShowWeatherPopover(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowDetailsMenu(false);
        setShowWeatherPopover(false);
      }
    };
    window.addEventListener('pointerdown', handlePointerDownOutside);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('pointerdown', handlePointerDownOutside);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [showDetailsMenu]);

  const formattedTime = `${String(Math.floor(sunHour)).padStart(2, '0')}:${String(
    Math.round((sunHour % 1) * 60) % 60
  ).padStart(2, '0')}`;

  // Filter strictly to real indoor rooms (excluding outer building hulls like Wohnraum / Haus / Nebengebäude when rooms exist)
  const allIndoorOnFloor = zones.filter(
    (z) =>
      z.zoneType === 'indoor' &&
      (activeFloor === 'all_stacked' || (z.level ?? 0) === activeFloor)
  );
  const dedicatedRoomsOnFloor = allIndoorOnFloor.filter(
    (z) =>
      resolveZoneRole(z, zones) === 'room' &&
      z.name.trim().toLowerCase() !== 'haus' &&
      z.name.trim().toLowerCase() !== 'wohnraum'
  );
  const visibleFloorZones =
    dedicatedRoomsOnFloor.length > 0 ? dedicatedRoomsOnFloor : allIndoorOnFloor;

  const currentRoomIdx = focusedZoneId
    ? visibleFloorZones.findIndex((z) => z.id === focusedZoneId)
    : -1;

  const handleCycleRoom = (dir: -1 | 1) => {
    if (visibleFloorZones.length === 0) return;
    if (currentRoomIdx === -1) {
      const nextIdx = dir === 1 ? 0 : visibleFloorZones.length - 1;
      onSelectFocusedZone(visibleFloorZones[nextIdx].id);
    } else {
      const nextIdx =
        (currentRoomIdx + dir + visibleFloorZones.length) % visibleFloorZones.length;
      onSelectFocusedZone(visibleFloorZones[nextIdx].id);
    }
  };

  const activeOverlaysCount = [
    showClimateHeatmap,
    showEnergyFlow,
    showSensorRadii,
    visualStyle !== 'archviz',
    weatherMode !== 'auto_sun',
  ].filter(Boolean).length;

  return (
    <div
      ref={dockRef}
      className="fixed bottom-2 sm:bottom-3 left-1/2 -translate-x-1/2 w-[min(1180px,96vw)] z-30 flex flex-col items-center pointer-events-none"
    >
      {/* Popover Detail Drawer: Ansicht, Sonnenstand, Kamera, Wetter & Smart-Overlays */}
      {!collapsed && showDetailsMenu && (
        <div className="pointer-events-auto w-full mb-2 rounded-2xl bg-[#0b1120] border border-white/15 shadow-[0_16px_48px_rgba(0,0,0,0.75)] p-3 sm:p-4 text-xs text-slate-200 space-y-3 animate-in fade-in slide-in-from-bottom-2 duration-150">
          <div className="flex items-center justify-between border-b border-white/10 pb-2">
            <div className="flex items-center gap-2">
              <SlidersHorizontal className="w-4 h-4 text-amber-400" />
              <span className="font-bold text-white text-xs sm:text-sm">
                Ansicht, Atmosphäre, Kamera & Smart-Overlays
              </span>
            </div>
            <button
              type="button"
              onClick={() => setShowDetailsMenu(false)}
              className="p-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white border border-white/10 transition-colors"
              title="Menü schließen (ESC)"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Section 1: Tageszeit & Sonnenstand + Kamera-Perspektiven */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {/* Tageszeit & Nord-Ausrichtung */}
            <div className="rounded-xl bg-slate-950/90 border border-white/10 p-2.5 flex flex-col gap-2">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 text-amber-300 font-semibold">
                  <Sun className="w-3.5 h-3.5" />
                  <span>Tageszeit & Sonnenverlauf</span>
                  <span className="font-mono text-white font-bold ml-1 tabular-nums">
                    {formattedTime} Uhr
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  {onToggleRealTimeClock && (
                    <button
                      type="button"
                      onClick={onToggleRealTimeClock}
                      title="Synchronisiert den 3D-Sonnenstand automatisch mit der aktuellen Echtzeit-Uhr"
                      className={`px-2 py-0.5 rounded text-[10.5px] font-bold transition-colors whitespace-nowrap ${
                        isRealTimeClock
                          ? 'bg-emerald-400 text-slate-950 shadow-sm'
                          : 'bg-slate-800 text-slate-300 hover:bg-slate-700 border border-white/10'
                      }`}
                    >
                      {isRealTimeClock ? '● Echtzeit' : 'Echtzeit'}
                    </button>
                  )}
                  {onChangeNorthAngle && (
                    <button
                      type="button"
                      onClick={() => onChangeNorthAngle((northAngle + 45) % 360)}
                      onContextMenu={(e) => {
                        e.preventDefault();
                        onChangeNorthAngle(0);
                      }}
                      title="Nord-Ausrichtung für Sonnenverlauf (+45° drehen, Rechtsklick = 0°)"
                      className="flex items-center gap-1 px-2 py-0.5 rounded bg-slate-900 hover:bg-slate-800 border border-amber-400/35 text-[10.5px] font-mono text-amber-300"
                    >
                      <Compass
                        className="w-3 h-3 text-amber-400 transition-transform"
                        style={{ transform: `rotate(${northAngle}deg)` }}
                      />
                      <span>N {Math.round(northAngle)}°</span>
                    </button>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2">
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
                <div className="flex items-center gap-1 shrink-0">
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
                      className={`px-1.5 py-0.5 rounded text-[10px] font-mono tabular-nums transition-colors ${
                        !isRealTimeClock && Math.abs(sunHour - preset.val) < 0.6
                          ? 'bg-amber-500 text-slate-950 font-semibold'
                          : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                      }`}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Kamera-Blickwinkel & Auto-Idle */}
            <div className="rounded-xl bg-slate-950/90 border border-white/10 p-2.5 flex flex-col justify-between gap-2">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 text-sky-300 font-semibold">
                  <Camera className="w-3.5 h-3.5" />
                  <span>Kamera-Perspektiven</span>
                </div>
                {onToggleAutoIdleAfterInactivity && (
                  <button
                    type="button"
                    onClick={onToggleAutoIdleAfterInactivity}
                    title="Auto-Idle: Startet die Kamerafahrt automatisch nach 25 Sek. Inaktivität"
                    className={`px-2 py-0.5 rounded text-[10.5px] font-semibold transition-colors whitespace-nowrap ${
                      autoIdleAfterInactivity
                        ? 'bg-emerald-400 text-slate-950'
                        : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-white/10'
                    }`}
                  >
                    Auto-Idle {autoIdleAfterInactivity ? 'AN' : 'AUS'}
                  </button>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-1">
                {PRESET_LABELS.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      onSelectFocusedZone(null);
                      onChangeCameraPreset(item.id);
                    }}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors whitespace-nowrap ${
                      cameraPreset === item.id && focusedZoneId === null && !cameraIdleMode
                        ? 'bg-sky-500 text-slate-950 font-semibold'
                        : 'bg-slate-900 text-slate-300 hover:text-white hover:bg-slate-800 border border-white/5'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Section 2: 3D-Stil, Live-Wetter, Feiertags-Themes & Performance */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-white/10">
            <div className="flex flex-wrap items-center gap-2">
              {/* GPU / Performance Mode Selector */}
              <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-white/10">
                <Gauge className="w-3.5 h-3.5 text-emerald-400 ml-1" />
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
                <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-white/10">
                  <Palette className="w-3.5 h-3.5 text-fuchsia-400 ml-1" />
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

              {/* Live 3D Weather Switcher + Weather Entity Selector */}
              {onChangeWeatherMode && (
                <div className="relative flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-white/10">
                  <CloudRain className="w-3.5 h-3.5 text-sky-400 ml-1" />
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
                  {onChangeWeatherEntityId && (
                    <button
                      type="button"
                      onClick={() => setShowWeatherPopover((prev) => !prev)}
                      title={
                        weatherEntityId
                          ? `Live-Wetter Entität: ${weatherEntityId}`
                          : 'Home Assistant Live-Wetter Entität (weather.*) auswählen'
                      }
                      className={`px-1.5 py-0.5 rounded text-[10.5px] font-semibold transition-colors flex items-center gap-1 ${
                        weatherEntityId
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/40'
                          : 'bg-slate-800 text-slate-300 hover:text-white border border-white/10'
                      }`}
                    >
                      <SlidersHorizontal className="w-3 h-3" />
                      <span>
                        {weatherEntityId ? weatherEntityId.replace(/^weather\./, '') : 'Wetter-ID'}
                      </span>
                    </button>
                  )}

                  {showWeatherPopover && onChangeWeatherEntityId && (
                    <div className="absolute bottom-full left-0 mb-2 w-72 rounded-xl bg-slate-950 border border-sky-400/40 shadow-2xl p-3 z-50 text-xs text-slate-200">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="font-bold text-sky-300 flex items-center gap-1.5">
                          <CloudRain className="w-3.5 h-3.5" />
                          Live-Wetter Entität (weather.*)
                        </span>
                        <button
                          type="button"
                          onClick={() => setShowWeatherPopover(false)}
                          className="text-slate-400 hover:text-white text-[11px] px-1"
                        >
                          ✕
                        </button>
                      </div>
                      <p className="text-[11px] text-slate-400 mb-2 leading-snug">
                        Steuert im Modus <b>Sonne/Auto</b> automatisch 3D-Regen, Schnee oder Sonnenschein anhand deiner Home Assistant Wetter-Entität.
                      </p>
                      {weatherEntities.length > 0 && (
                        <select
                          value={weatherEntityId}
                          onChange={(e) => onChangeWeatherEntityId(e.target.value)}
                          className="w-full rounded-lg bg-slate-900 border border-white/15 px-2 py-1.5 text-xs text-white mb-2"
                        >
                          <option value="">— Automatisch erste weather.* Entität —</option>
                          {weatherEntities.map((we) => {
                            const id = typeof we === 'string' ? we : we.id;
                            const label =
                              typeof we === 'object' && we.label && we.label.trim().length > 0
                                ? we.label.trim()
                                : id;
                            const state =
                              typeof we === 'object' && we.state && we.state.trim().length > 0
                                ? we.state.trim()
                                : '';
                            const mainText = label !== id ? `${label} (${id})` : id;
                            return (
                              <option key={id} value={id}>
                                {state ? `${mainText} · ${state}` : mainText}
                              </option>
                            );
                          })}
                        </select>
                      )}
                      <input
                        type="text"
                        value={weatherEntityId}
                        onChange={(e) => onChangeWeatherEntityId(e.target.value.trim())}
                        placeholder="z.B. weather.forecast_home"
                        className="w-full rounded-lg bg-slate-900 border border-white/15 px-2.5 py-1.5 text-xs font-mono text-sky-200 placeholder:text-slate-500"
                      />
                    </div>
                  )}
                </div>
              )}

              {/* Saisonales Feiertags-Theme */}
              {onChangeHolidayThemeMode && (() => {
                const autoDetected = resolveActiveHolidayTheme('auto');
                const autoBadge =
                  autoDetected === 'halloween'
                    ? '🎃'
                    : autoDetected === 'christmas'
                    ? '🎄'
                    : autoDetected === 'easter'
                    ? '🐣'
                    : '📅';
                return (
                  <div className="flex items-center gap-0.5 bg-slate-950 p-1 rounded-lg border border-white/10">
                    {(
                      [
                        { id: 'auto', label: `${autoBadge} Auto`, hint: 'Automatisch nach Datum' },
                        { id: 'halloween', label: '🎃 Halloween', hint: 'Halloween-Theme' },
                        { id: 'christmas', label: '🎄 Weihnachten', hint: 'Weihnachts-Theme & Schneedecke' },
                        { id: 'easter', label: '🐣 Ostern', hint: 'Oster-Theme' },
                        { id: 'off', label: 'Aus', hint: 'Feiertags-Dekoration aus' },
                      ] as { id: HolidayThemeMode; label: string; hint: string }[]
                    ).map((ht) => {
                      const active = holidayThemeMode === ht.id;
                      return (
                        <button
                          key={ht.id}
                          type="button"
                          onClick={() => onChangeHolidayThemeMode(ht.id)}
                          title={ht.hint}
                          className={`px-2 py-0.5 rounded text-[10.5px] font-semibold transition-colors whitespace-nowrap ${
                            active
                              ? ht.id === 'halloween' || (ht.id === 'auto' && autoDetected === 'halloween')
                                ? 'bg-orange-400 text-slate-950 font-bold'
                                : ht.id === 'christmas' || (ht.id === 'auto' && autoDetected === 'christmas')
                                ? 'bg-red-500 text-white font-bold'
                                : ht.id === 'easter' || (ht.id === 'auto' && autoDetected === 'easter')
                                ? 'bg-emerald-400 text-slate-950 font-bold'
                                : 'bg-amber-400 text-slate-950 font-bold'
                              : 'text-slate-300 hover:text-white hover:bg-slate-800'
                          }`}
                        >
                          {ht.label}
                        </button>
                      );
                    })}
                  </div>
                );
              })()}
            </div>

            {/* Smart-Overlays */}
            <div className="flex flex-wrap items-center gap-1.5">
              {onToggleSmartCockpitCards && (
                <button
                  type="button"
                  onClick={onToggleSmartCockpitCards}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-colors whitespace-nowrap ${
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
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium border transition-colors whitespace-nowrap ${
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
                onClick={onToggleSensorRadii}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium border transition-colors whitespace-nowrap ${
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
                className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium border transition-colors whitespace-nowrap ${
                  showEnergyFlow
                    ? 'bg-emerald-500/20 border-emerald-400/50 text-emerald-200'
                    : 'bg-slate-900 border-white/10 text-slate-300 hover:text-white'
                }`}
              >
                <Zap className="w-3.5 h-3.5" />
                <span>⚡ Leitungen & Energie</span>
              </button>

              <button
                type="button"
                onClick={onToggleClimateHeatmap}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium border transition-colors whitespace-nowrap ${
                  showClimateHeatmap
                    ? 'bg-orange-500/20 border-orange-400/50 text-orange-200'
                    : 'bg-slate-900 border-white/10 text-slate-300 hover:text-white'
                }`}
              >
                <Flame className="w-3.5 h-3.5" />
                <span>Klima-Heatmap</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Collapsed Zen Handle */}
      {collapsed ? (
        <div className="pointer-events-auto flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#0f172a] border border-white/15 shadow-xl max-w-full overflow-x-auto no-scrollbar">
          <div className="flex items-center gap-1 pr-2 border-r border-white/10 shrink-0">
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
          <button
            type="button"
            onClick={handleToggleCollapsed}
            className="flex items-center gap-1.5 text-xs font-medium text-slate-200 hover:text-white transition-colors whitespace-nowrap shrink-0"
          >
            <ChevronUp className="w-3.5 h-3.5 text-amber-400" />
            <span>Raum-Navigation & 3D-Leiste</span>
          </button>
        </div>
      ) : (
        /* Sleek 1-Row NeonPlan3D-Style Control Bar */
        <div className="pointer-events-auto w-full rounded-2xl bg-[#0f172a] border border-white/15 shadow-2xl px-2.5 sm:px-3.5 py-1.5 flex items-center justify-between gap-2">
          {/* 1. Stockwerk Switcher */}
          <div className="flex items-center gap-0.5 bg-slate-950 p-1 rounded-xl border border-white/10 shrink-0">
            <Building2 className="w-3.5 h-3.5 text-amber-400 mx-1 hidden sm:inline" />
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
                  className={`px-2 sm:px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors whitespace-nowrap ${
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

          {/* 2. Scrollable Direct Room Quick-Select + Prev/Next Room Cycling */}
          <div className="flex items-center gap-1 overflow-x-auto flex-1 min-w-0 py-0.5 no-scrollbar">
            <button
              type="button"
              onClick={() => onSelectFocusedZone(null)}
              title="Zurück zur Gesamtübersicht (oder im 3D-Modell in den Außenbereich klicken)"
              className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors whitespace-nowrap shrink-0 flex items-center gap-1 ${
                focusedZoneId === null
                  ? 'bg-sky-400 text-slate-950 shadow-sm'
                  : 'bg-slate-900 text-slate-300 hover:text-white hover:bg-slate-800 border border-white/10'
              }`}
            >
              <Focus className="w-3 h-3" />
              <span>Alle Räume</span>
            </button>

            {visibleFloorZones.length > 1 && (
              <div className="flex items-center gap-0.5 shrink-0">
                <button
                  type="button"
                  onClick={() => handleCycleRoom(-1)}
                  title="Vorheriger Raum"
                  className="p-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-white/10 transition-colors"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => handleCycleRoom(1)}
                  title="Nächster Raum"
                  className="p-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-white/10 transition-colors"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {visibleFloorZones.map((zone) => {
              const isFocused = focusedZoneId === zone.id;
              const lvlTag =
                activeFloor === 'all_stacked'
                  ? zone.level === -1
                    ? ' · KG'
                    : zone.level === 1
                    ? ' · OG'
                    : zone.level === 2
                    ? ' · DG'
                    : ' · EG'
                  : '';
              return (
                <button
                  key={zone.id}
                  type="button"
                  onClick={() => onSelectFocusedZone(isFocused ? null : zone.id)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5 ${
                    isFocused
                      ? 'bg-sky-400 text-slate-950 font-semibold shadow-sm'
                      : 'bg-slate-900/90 text-slate-300 hover:text-white hover:bg-slate-800 border border-white/5'
                  }`}
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      isFocused ? 'bg-slate-950' : 'bg-amber-400'
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

          {/* 3. Direct Quick Actions (Tour, Wände, 3D-Cards, Labels, Ansicht & Atmosphäre Popover, Zen Collapse) */}
          <div className="flex items-center gap-1 shrink-0">
            {onToggleCameraIdleMode && (
              <div className="flex items-center shrink-0">
                <button
                  type="button"
                  onClick={onToggleCameraIdleMode}
                  title="3D-Kamerafahrt starten/pausieren"
                  className={`flex items-center gap-1 px-2.5 py-1 ${
                    onOpenTourConfig ? 'rounded-l-lg' : 'rounded-lg'
                  } text-[11px] font-semibold transition-colors whitespace-nowrap ${
                    cameraIdleMode
                      ? 'bg-amber-400 text-slate-950 shadow-sm'
                      : 'bg-slate-900 text-amber-300 hover:bg-slate-800 border border-amber-400/30'
                  }`}
                >
                  {cameraIdleMode ? (
                    <Pause className="w-3 h-3" />
                  ) : (
                    <Play className="w-3 h-3" />
                  )}
                  <span className="hidden md:inline">Tour</span>
                </button>
                {onOpenTourConfig && (
                  <button
                    type="button"
                    onClick={onOpenTourConfig}
                    title="Tour-Routenplaner öffnen"
                    className="px-1.5 py-1 rounded-r-lg bg-slate-900 hover:bg-slate-800 text-amber-300 border border-l-0 border-amber-400/30 text-[11px] transition-colors"
                  >
                    <Settings2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            )}

            <button
              type="button"
              onClick={onToggleWallCutaway}
              title="Vordere Wände automatisch absenken (Cutaway)"
              className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-medium border transition-colors whitespace-nowrap ${
                wallCutaway
                  ? 'bg-amber-500/20 border-amber-400/50 text-amber-200'
                  : 'bg-slate-900 border-white/10 text-slate-300 hover:text-white'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span className="hidden xl:inline">Wände</span>
            </button>

            {onToggle3DCards && (
              <button
                type="button"
                onClick={onToggle3DCards}
                title="Schwebende 3D-Raum-Cards & Callouts ein-/ausblenden"
                className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-semibold border transition-colors whitespace-nowrap ${
                  show3DCards
                    ? 'bg-indigo-500/25 border-indigo-400/60 text-indigo-200'
                    : 'bg-slate-900 border-white/10 text-slate-300 hover:text-white'
                }`}
              >
                <LayoutGrid className="w-3.5 h-3.5 text-indigo-300" />
                <span className="hidden xl:inline">3D-Cards</span>
              </button>
            )}

            <button
              type="button"
              onClick={onToggleFloatingBadges}
              title="Geräte-Textschilder (Labels) im 3D-Modell ein-/ausblenden"
              className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-medium border transition-colors whitespace-nowrap ${
                showFloatingBadges
                  ? 'bg-sky-500/20 border-sky-400/50 text-sky-200'
                  : 'bg-slate-900 border-white/10 text-slate-300 hover:text-white'
              }`}
            >
              <Eye className="w-3.5 h-3.5" />
              <span className="hidden xl:inline">Labels</span>
            </button>

            {/* Popover Toggle for Sun, Weather, Style, Camera Presets & Overlays */}
            <button
              type="button"
              onClick={() => setShowDetailsMenu((prev) => !prev)}
              title="Sonnenstand, Kamera-Perspektiven, Wetter, Design-Modus & Overlays"
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-colors whitespace-nowrap ${
                showDetailsMenu
                  ? 'bg-amber-400 text-slate-950 border-amber-300 shadow-sm'
                  : 'bg-slate-900 hover:bg-slate-800 border-white/15 text-slate-200'
              }`}
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Ansicht</span>
              <span className="font-mono text-[10px] opacity-80 hidden lg:inline">
                {formattedTime}
              </span>
              {activeOverlaysCount > 0 && !showDetailsMenu && (
                <span className="px-1.5 py-0.2 rounded-full bg-amber-400 text-slate-950 text-[9.5px] font-bold">
                  {activeOverlaysCount}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={handleToggleCollapsed}
              title="Steuerleiste minimieren (Zen-Modus)"
              className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white border border-white/10 transition-colors"
            >
              <ChevronDown className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
