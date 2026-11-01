import React, { useEffect, useRef, useState } from 'react';
import {
  ActiveFloorView,
  CameraPresetId,
  ControlDockPreferences,
  FloorLevelId,
  FloorplanProject,
  PerformanceMode,
  VisualStyleMode,
  WeatherSimulationMode,
  WorkspaceTab,
} from '../types/floorplan';

const DOCK_STORAGE_KEY = 'realplan3d_dock_preferences_v1';

export const getCurrentLocalHour = (): number => {
  const now = new Date();
  return Number((now.getHours() + now.getMinutes() / 60).toFixed(2));
};

function loadLocalDockPreferences(): ControlDockPreferences | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(DOCK_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') {
      return parsed as ControlDockPreferences;
    }
  } catch {
    // Ignore storage read errors
  }
  return null;
}

function saveLocalDockPreferences(prefs: ControlDockPreferences): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(DOCK_STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    // Ignore storage quota errors
  }
}

export function useControlDockSettings(
  project: FloorplanProject,
  setProject: React.Dispatch<React.SetStateAction<FloorplanProject>>,
  activeTab: WorkspaceTab,
  initialUrlParams: URLSearchParams | null
) {
  const initialLocalPrefs = useRef<ControlDockPreferences | null>(loadLocalDockPreferences()).current;
  const hasLocalDevicePrefsRef = useRef<boolean>(initialLocalPrefs !== null);
  const initialProjectPrefs = project.liveCockpitConfig?.dockPreferences;

  // Priority: 1. URL Params -> 2. Device LocalStorage -> 3. Project (HA Sync) -> 4. Defaults
  const [activeFloor, setActiveFloor] = useState<ActiveFloorView>(() => {
    const fl = initialUrlParams?.get('floor');
    if (fl === 'all_stacked') return 'all_stacked';
    if (fl === '-1' || fl === '0' || fl === '1' || fl === '2') return Number(fl) as FloorLevelId;
    const candidate = initialLocalPrefs?.activeFloor ?? initialProjectPrefs?.activeFloor;
    if (
      candidate === 'all_stacked' ||
      candidate === -1 ||
      candidate === 0 ||
      candidate === 1 ||
      candidate === 2
    ) {
      return candidate;
    }
    return 0;
  });

  const activeSingleFloor: FloorLevelId = activeFloor === 'all_stacked' ? 0 : activeFloor;

  const [performanceMode, setPerformanceMode] = useState<PerformanceMode>(() => {
    const perfParam = initialUrlParams?.get('perf');
    if (perfParam === 'eco' || perfParam === 'balanced' || perfParam === 'ultra') {
      return perfParam;
    }
    const candidate = initialLocalPrefs?.performanceMode ?? initialProjectPrefs?.performanceMode;
    if (candidate === 'eco' || candidate === 'balanced' || candidate === 'ultra') {
      return candidate;
    }
    return 'balanced';
  });

  const [isRealTimeClock, setIsRealTimeClock] = useState<boolean>(() => {
    const candidate = initialLocalPrefs?.isRealTimeClock ?? initialProjectPrefs?.isRealTimeClock;
    return typeof candidate === 'boolean' ? candidate : true;
  });

  const [sunHour, setSunHour] = useState<number>(() => {
    const useRealTime =
      typeof (initialLocalPrefs?.isRealTimeClock ?? initialProjectPrefs?.isRealTimeClock) ===
      'boolean'
        ? (initialLocalPrefs?.isRealTimeClock ?? initialProjectPrefs?.isRealTimeClock)!
        : true;
    if (useRealTime) return getCurrentLocalHour();
    const savedHour = initialLocalPrefs?.sunHour ?? initialProjectPrefs?.sunHour;
    if (typeof savedHour === 'number' && Number.isFinite(savedHour) && savedHour >= 0 && savedHour <= 24) {
      return savedHour;
    }
    return getCurrentLocalHour();
  });

  const [visualStyle, setVisualStyle] = useState<VisualStyleMode>(() => {
    const st = initialUrlParams?.get('style');
    if (st === 'neon' || st === 'blueprint' || st === 'archviz') return st;
    const candidate = initialLocalPrefs?.visualStyle ?? initialProjectPrefs?.visualStyle;
    if (candidate === 'neon' || candidate === 'blueprint' || candidate === 'archviz') {
      return candidate;
    }
    return 'archviz';
  });

  const [weatherMode, setWeatherMode] = useState<WeatherSimulationMode>(() => {
    const candidate = initialLocalPrefs?.weatherMode ?? initialProjectPrefs?.weatherMode;
    if (
      candidate === 'auto_sun' ||
      candidate === 'clear' ||
      candidate === 'cloudy' ||
      candidate === 'rain' ||
      candidate === 'snow'
    ) {
      return candidate;
    }
    return 'auto_sun';
  });

  const [showPresenceAvatars, setShowPresenceAvatars] = useState<boolean>(() => {
    const candidate =
      initialLocalPrefs?.showPresenceAvatars ?? initialProjectPrefs?.showPresenceAvatars;
    return typeof candidate === 'boolean' ? candidate : true;
  });

  const [showSmartCockpitCards, setShowSmartCockpitCards] = useState<boolean>(() => {
    const candidate =
      initialLocalPrefs?.showSmartCockpitCards ?? initialProjectPrefs?.showSmartCockpitCards;
    return typeof candidate === 'boolean' ? candidate : true;
  });

  const [cameraPreset, setCameraPreset] = useState<CameraPresetId>(() => {
    const candidate = initialLocalPrefs?.cameraPreset ?? initialProjectPrefs?.cameraPreset;
    if (
      candidate === 'overview' ||
      candidate === 'living_kitchen' ||
      candidate === 'garden_pool' ||
      candidate === 'driveway_solar' ||
      candidate === 'top_blueprint'
    ) {
      return candidate;
    }
    return 'overview';
  });

  const [focusedZoneId, setFocusedZoneId] = useState<string | null>(() => {
    const roomParam = initialUrlParams?.get('room');
    return roomParam ? roomParam : null;
  });

  const [wallCutaway, setWallCutaway] = useState<boolean>(() => {
    const candidate = initialLocalPrefs?.wallCutaway ?? initialProjectPrefs?.wallCutaway;
    return typeof candidate === 'boolean' ? candidate : false;
  });

  const [showClimateHeatmap, setShowClimateHeatmap] = useState<boolean>(() => {
    const candidate =
      initialLocalPrefs?.showClimateHeatmap ?? initialProjectPrefs?.showClimateHeatmap;
    return typeof candidate === 'boolean' ? candidate : false;
  });

  const [showEnergyFlow, setShowEnergyFlow] = useState<boolean>(() => {
    const candidate = initialLocalPrefs?.showEnergyFlow ?? initialProjectPrefs?.showEnergyFlow;
    return typeof candidate === 'boolean' ? candidate : true;
  });

  const [showSensorRadii, setShowSensorRadii] = useState<boolean>(() => {
    if (initialUrlParams?.get('cardType') === 'camera_cockpit') return true;
    const candidate = initialLocalPrefs?.showSensorRadii ?? initialProjectPrefs?.showSensorRadii;
    return typeof candidate === 'boolean' ? candidate : false;
  });

  const [showFloatingBadges, setShowFloatingBadges] = useState<boolean>(() => {
    const candidate =
      initialLocalPrefs?.showFloatingBadges ?? initialProjectPrefs?.showFloatingBadges;
    return typeof candidate === 'boolean' ? candidate : true;
  });

  const [show3DCards, setShow3DCards] = useState<boolean>(() => {
    const candidate = initialLocalPrefs?.show3DCards ?? initialProjectPrefs?.show3DCards;
    return typeof candidate === 'boolean' ? candidate : true;
  });

  const [autoIdleAfterInactivity, setAutoIdleAfterInactivity] = useState<boolean>(() => {
    const candidate =
      initialLocalPrefs?.autoIdleAfterInactivity ?? initialProjectPrefs?.autoIdleAfterInactivity;
    return typeof candidate === 'boolean' ? candidate : false;
  });

  const [dockCollapsed, setDockCollapsed] = useState<boolean>(() => {
    const candidate = initialLocalPrefs?.dockCollapsed ?? initialProjectPrefs?.dockCollapsed;
    if (typeof candidate === 'boolean') return candidate;
    return typeof window !== 'undefined' ? window.innerWidth < 768 : false;
  });

  // When a remote project is loaded from Home Assistant or JSON import and no local device overrides exist yet,
  // adopt the project's dockPreferences.
  const prevRemotePrefsJsonRef = useRef<string>(
    JSON.stringify(project.liveCockpitConfig?.dockPreferences || {})
  );
  useEffect(() => {
    const remotePrefs = project.liveCockpitConfig?.dockPreferences;
    if (!remotePrefs) return;
    const nextJson = JSON.stringify(remotePrefs);
    if (nextJson === prevRemotePrefsJsonRef.current) return;
    prevRemotePrefsJsonRef.current = nextJson;

    if (!hasLocalDevicePrefsRef.current) {
      if (remotePrefs.activeFloor !== undefined && !initialUrlParams?.get('floor')) {
        setActiveFloor(remotePrefs.activeFloor);
      }
      if (remotePrefs.performanceMode !== undefined && !initialUrlParams?.get('perf')) {
        setPerformanceMode(remotePrefs.performanceMode);
      }
      if (remotePrefs.isRealTimeClock !== undefined) {
        setIsRealTimeClock(remotePrefs.isRealTimeClock);
      }
      if (remotePrefs.sunHour !== undefined && remotePrefs.isRealTimeClock === false) {
        setSunHour(remotePrefs.sunHour);
      }
      if (remotePrefs.visualStyle !== undefined && !initialUrlParams?.get('style')) {
        setVisualStyle(remotePrefs.visualStyle);
      }
      if (remotePrefs.weatherMode !== undefined) {
        setWeatherMode(remotePrefs.weatherMode);
      }
      if (remotePrefs.showPresenceAvatars !== undefined) {
        setShowPresenceAvatars(remotePrefs.showPresenceAvatars);
      }
      if (remotePrefs.showSmartCockpitCards !== undefined) {
        setShowSmartCockpitCards(remotePrefs.showSmartCockpitCards);
      }
      if (remotePrefs.cameraPreset !== undefined) {
        setCameraPreset(remotePrefs.cameraPreset);
      }
      if (remotePrefs.wallCutaway !== undefined) {
        setWallCutaway(remotePrefs.wallCutaway);
      }
      if (remotePrefs.showClimateHeatmap !== undefined) {
        setShowClimateHeatmap(remotePrefs.showClimateHeatmap);
      }
      if (remotePrefs.showEnergyFlow !== undefined) {
        setShowEnergyFlow(remotePrefs.showEnergyFlow);
      }
      if (remotePrefs.showSensorRadii !== undefined && !initialUrlParams?.get('cardType')) {
        setShowSensorRadii(remotePrefs.showSensorRadii);
      }
      if (remotePrefs.showFloatingBadges !== undefined) {
        setShowFloatingBadges(remotePrefs.showFloatingBadges);
      }
      if (remotePrefs.show3DCards !== undefined) {
        setShow3DCards(remotePrefs.show3DCards);
      }
      if (remotePrefs.autoIdleAfterInactivity !== undefined) {
        setAutoIdleAfterInactivity(remotePrefs.autoIdleAfterInactivity);
      }
      if (remotePrefs.dockCollapsed !== undefined) {
        setDockCollapsed(remotePrefs.dockCollapsed);
      }
    }
  }, [project.liveCockpitConfig?.dockPreferences]);

  // Keep sunHour synchronized with real local system time when isRealTimeClock is active
  useEffect(() => {
    if (!isRealTimeClock) return;
    setSunHour(getCurrentLocalHour());
    const timer = window.setInterval(() => {
      setSunHour(getCurrentLocalHour());
    }, 30000);
    return () => window.clearInterval(timer);
  }, [isRealTimeClock, activeTab]);

  // Hybrid Persistence:
  // 1) Immediately save all Control Dock settings to device localStorage (`realplan3d_dock_preferences_v1`).
  // 2) Debounce-sync into `project.liveCockpitConfig.dockPreferences` so Home Assistant `.storage` stays in sync.
  useEffect(() => {
    const currentPrefs: ControlDockPreferences = {
      activeFloor,
      performanceMode,
      sunHour: isRealTimeClock ? undefined : Number(sunHour.toFixed(2)),
      isRealTimeClock,
      visualStyle,
      weatherMode,
      showPresenceAvatars,
      showSmartCockpitCards,
      cameraPreset,
      wallCutaway,
      showClimateHeatmap,
      showEnergyFlow,
      showSensorRadii,
      showFloatingBadges,
      show3DCards,
      autoIdleAfterInactivity,
      dockCollapsed,
    };

    hasLocalDevicePrefsRef.current = true;
    saveLocalDockPreferences(currentPrefs);

    const syncTimer = window.setTimeout(() => {
      setProject((prev) => {
        const existingPrefs = prev.liveCockpitConfig?.dockPreferences;
        const nextJson = JSON.stringify(currentPrefs);
        if (existingPrefs && JSON.stringify(existingPrefs) === nextJson) {
          return prev;
        }
        prevRemotePrefsJsonRef.current = nextJson;
        return {
          ...prev,
          liveCockpitConfig: {
            ...(prev.liveCockpitConfig || {}),
            dockPreferences: currentPrefs,
          },
        };
      });
    }, 450);

    return () => window.clearTimeout(syncTimer);
  }, [
    activeFloor,
    performanceMode,
    sunHour,
    isRealTimeClock,
    visualStyle,
    weatherMode,
    showPresenceAvatars,
    showSmartCockpitCards,
    cameraPreset,
    wallCutaway,
    showClimateHeatmap,
    showEnergyFlow,
    showSensorRadii,
    showFloatingBadges,
    show3DCards,
    autoIdleAfterInactivity,
    dockCollapsed,
  ]);

  return {
    activeFloor,
    setActiveFloor,
    activeSingleFloor,
    performanceMode,
    setPerformanceMode,
    sunHour,
    setSunHour,
    isRealTimeClock,
    setIsRealTimeClock,
    visualStyle,
    setVisualStyle,
    weatherMode,
    setWeatherMode,
    showPresenceAvatars,
    setShowPresenceAvatars,
    showSmartCockpitCards,
    setShowSmartCockpitCards,
    cameraPreset,
    setCameraPreset,
    focusedZoneId,
    setFocusedZoneId,
    wallCutaway,
    setWallCutaway,
    showClimateHeatmap,
    setShowClimateHeatmap,
    showEnergyFlow,
    setShowEnergyFlow,
    showSensorRadii,
    setShowSensorRadii,
    showFloatingBadges,
    setShowFloatingBadges,
    show3DCards,
    setShow3DCards,
    autoIdleAfterInactivity,
    setAutoIdleAfterInactivity,
    dockCollapsed,
    setDockCollapsed,
  };
}
