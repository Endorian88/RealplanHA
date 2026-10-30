import React, { useState } from 'react';
import {
  Activity,
  AlertTriangle,
  BatteryCharging,
  Blinds,
  Camera,
  Car,
  ChevronDown,
  ChevronUp,
  Cpu,
  DoorOpen,
  Droplets,
  Eye,
  Flame,
  Home,
  Lightbulb,
  Lock,
  Maximize2,
  Plus,
  Settings2,
  Sun,
  Thermometer,
  Trash2,
  Tv,
  Users,
  Wind,
  Zap,
  Building2,
} from 'lucide-react';
import {
  ActiveFloorView,
  CustomLiveCardItem,
  FloorplanProject,
  FloorplanZone,
  getBuildingHierarchyGroups,
  HAEntityState,
  isBuildingTechAsset,
  isOpeningActuatorControllable,
  LiveCardIconId,
  LiveCockpitConfig,
  PresencePersonConfig,
  resolveOpeningSensorState,
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
  onSelectOpening?: (openingId: string) => void;
  onUpdateLiveCockpitConfig?: (cfg: LiveCockpitConfig) => void;
  onUpdateZone?: (zoneId: string, patch: Partial<FloorplanZone>) => void;
  onFlyToWorldPos?: (
    wx: number,
    wy: number,
    wz: number,
    meta?: { openingId?: string; assetId?: string }
  ) => void;
}

type CockpitTabId = 'custom' | 'rooms' | 'tech' | 'energy' | 'cameras' | 'devices';

const LIVE_CARD_ICON_OPTIONS: { id: LiveCardIconId; label: string }[] = [
  { id: 'garage', label: 'Garagentor / Einfahrt' },
  { id: 'door', label: 'Tür / Eingang' },
  { id: 'window', label: 'Fenster / Gaube' },
  { id: 'shutter', label: 'Rollladen / Beschattung' },
  { id: 'light', label: 'Licht / Beleuchtung' },
  { id: 'power', label: 'Strom / Schalter / PV' },
  { id: 'climate', label: 'Klima / Temperatur' },
  { id: 'presence', label: 'Anwesenheit / Bewegung' },
  { id: 'water', label: 'Wasser / Bewässerung' },
  { id: 'smoke', label: 'Rauch / Brandmelder' },
  { id: 'lock', label: 'Schloss / Sicherheit' },
  { id: 'alert', label: 'Warnung / Status-Pin' },
];

function renderCardIcon(iconId: LiveCardIconId, className = 'w-4 h-4') {
  switch (iconId) {
    case 'garage':
      return <Car className={className} />;
    case 'door':
      return <DoorOpen className={className} />;
    case 'window':
      return <Home className={className} />;
    case 'shutter':
      return <Blinds className={className} />;
    case 'light':
      return <Lightbulb className={className} />;
    case 'power':
      return <Zap className={className} />;
    case 'climate':
      return <Thermometer className={className} />;
    case 'presence':
      return <Users className={className} />;
    case 'water':
      return <Droplets className={className} />;
    case 'smoke':
      return <Flame className={className} />;
    case 'lock':
      return <Lock className={className} />;
    case 'alert':
    default:
      return <AlertTriangle className={className} />;
  }
}

function isEntityActiveState(ent?: HAEntityState): boolean {
  if (!ent) return false;
  const st = String(ent.state).toLowerCase();
  if (ent.domain === 'cover') {
    const pos = ent.attributes.current_position;
    if (typeof pos === 'number') return pos > 5;
    return st === 'open' || st === 'opening';
  }
  return (
    st === 'on' ||
    st === 'open' ||
    st === 'tilted' ||
    st === 'home' ||
    st === 'playing' ||
    st === 'cleaning' ||
    st === 'mowing' ||
    st === 'heat' ||
    st === 'unlocked' ||
    st === 'problem' ||
    st === 'triggered'
  );
}

function formatEntityReadableState(ent?: HAEntityState): string {
  if (!ent) return 'Nicht verbunden';
  const st = String(ent.state).toLowerCase();
  const unit = ent.attributes.unit_of_measurement || '';
  if (ent.domain === 'cover') {
    const pos = ent.attributes.current_position;
    if (typeof pos === 'number') {
      return pos <= 5 ? 'Geschlossen (0%)' : pos >= 95 ? 'Offen (100%)' : `${pos}% geöffnet`;
    }
    return st === 'open' ? 'OFFEN' : 'GESCHLOSSEN';
  }
  if (ent.domain === 'binary_sensor') {
    if (st === 'on' || st === 'open') return 'OFFEN / AKTIV';
    if (st === 'tilted') return 'GEKIPPT';
    return 'GESCHLOSSEN / RUHE';
  }
  if (ent.domain === 'person' || ent.domain === 'device_tracker') {
    return st === 'home' ? 'Zuhause' : st === 'not_home' ? 'Abwesend' : ent.state;
  }
  return unit ? `${ent.state} ${unit}` : ent.state.toUpperCase();
}

function isEntityControllableDomain(ent?: HAEntityState): boolean {
  if (!ent) return false;
  return (
    ent.domain === 'light' ||
    ent.domain === 'switch' ||
    ent.domain === 'cover' ||
    ent.domain === 'fan' ||
    ent.domain === 'lock' ||
    ent.domain === 'media_player' ||
    ent.domain === 'vacuum' ||
    ent.domain === 'lawn_mower' ||
    ent.domain === 'climate' ||
    ent.domain === 'input_boolean' ||
    ent.domain === 'button' ||
    ent.domain === 'script'
  );
}

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
  onSelectOpening,
  onUpdateLiveCockpitConfig,
  onUpdateZone,
  onFlyToWorldPos,
}) => {
  const [activeTab, setActiveTab] = useState<CockpitTabId>('custom');
  const [collapsed, setCollapsed] = useState(false);
  const [showConfigEditor, setShowConfigEditor] = useState(false);

  // New Custom Card Draft State
  const [newCardLabel, setNewCardLabel] = useState('');
  const [newCardEntityId, setNewCardEntityId] = useState('');
  const [newCardActuatorEntityId, setNewCardActuatorEntityId] = useState('');
  const [newCardControlMode, setNewCardControlMode] = useState<
    'auto' | 'sensor_only' | 'actuator' | 'sensor_and_actuator'
  >('auto');
  const [newCardIcon, setNewCardIcon] = useState<LiveCardIconId>('garage');
  const [newCardVisibility, setNewCardVisibility] = useState<'always' | 'when_active'>('always');
  const [newCardPinAlert, setNewCardPinAlert] = useState(true);
  const [newCardQuickBar, setNewCardQuickBar] = useState(true);
  const [newCardFloating3DIcon, setNewCardFloating3DIcon] = useState(true);
  const [newCardZoneId, setNewCardZoneId] = useState('');

  // New Person Draft State
  const [newPersonName, setNewPersonName] = useState('');
  const [newPersonEntityId, setNewPersonEntityId] = useState('');
  const [newPersonRoomEntityId, setNewPersonRoomEntityId] = useState('');
  const [newPersonDefaultRoom, setNewPersonDefaultRoom] = useState('');
  const [newPersonColor, setNewPersonColor] = useState('#38bdf8');

  const cockpitCfg: LiveCockpitConfig = project.liveCockpitConfig || {
    customCards: [],
    persons: [],
    showActiveStatusHeader: true,
    showOffscreenArrows: true,
    showQuickAccessBar: true,
  };

  const updateCockpitCfg = (patch: Partial<LiveCockpitConfig>) => {
    if (!onUpdateLiveCockpitConfig) return;
    onUpdateLiveCockpitConfig({
      ...cockpitCfg,
      ...patch,
    });
  };

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

  // Persons / Presence Avatars (configured persons + auto-discovered person.* entities)
  const configuredPersons = cockpitCfg.persons || [];
  const personEntities = Object.values(entities).filter(
    (e) => e.domain === 'person' || e.domain === 'device_tracker'
  );

  // Automatic Detection of Open Garage Doors, Open Windows/Doors, and Active Dormer Shutters/Contacts
  const openGarageOpenings = project.openings.filter(
    (op) => op.type === 'garage_door' && resolveOpeningSensorState(op, entities, false) !== 'closed'
  );
  const openDoorOrWindowOpenings = project.openings.filter(
    (op) => op.type !== 'garage_door' && resolveOpeningSensorState(op, entities, false) !== 'closed'
  );

  // Unified Live Events List (for Auto-Camera-Jump & Multi-Event Summary Card)
  const activeLiveEvents = React.useMemo(() => {
    const list: {
      id: string;
      label: string;
      stateText: string;
      severity: 'alarm' | 'warning' | 'info';
      wx: number;
      wy: number;
      wz: number;
      openingId?: string;
      assetId?: string;
      toggleEntityId?: string;
      isControllable: boolean;
    }[] = [];

    for (const op of project.openings) {
      const st = resolveOpeningSensorState(op, entities, false);
      if (st === 'open' || st === 'tilted') {
        const yOff = (op.level ?? 0) * 2.75;
        const canCtrl = isOpeningActuatorControllable(op, entities);
        list.push({
          id: `ev_op_${op.id}`,
          label: op.name,
          stateText:
            st === 'tilted' ? 'GEKIPPT' : op.type === 'garage_door' ? 'TOR OFFEN' : 'OFFEN',
          severity: op.type === 'garage_door' ? 'warning' : 'info',
          wx: op.x,
          wy: yOff + op.sillHeight + op.height * 0.5,
          wz: op.z,
          openingId: op.id,
          toggleEntityId: canCtrl
            ? op.actuatorEntityId || op.entityId || op.shutterEntityId
            : undefined,
          isControllable: canCtrl,
        });
      }
    }

    for (const asset of project.assets) {
      const entId = asset.entityId || asset.actuatorEntityId;
      const ent = entId ? entities[entId] : undefined;
      if (!ent) continue;
      const isAlarm =
        (ent.attributes.device_class === 'smoke' ||
          ent.attributes.device_class === 'moisture') &&
        (ent.state === 'detected' || ent.attributes.alarm_test_active);
      const isGateOpen =
        (asset.catalogId === 'electric_roller_gate' ||
          asset.catalogId === 'sliding_driveway_gate' ||
          asset.catalogId === 'garage_door_opener') &&
        isEntityActiveState(ent);
      if (isAlarm || isGateOpen) {
        const yOff = (asset.level ?? 0) * 2.75;
        const canCtrl =
          asset.controlMode !== 'sensor_only' &&
          (asset.controlMode === 'actuator' ||
            asset.controlMode === 'sensor_and_actuator' ||
            isEntityControllableDomain(ent));
        list.push({
          id: `ev_asset_${asset.id}`,
          label: asset.name,
          stateText: isAlarm ? 'ALARM!' : 'OFFEN',
          severity: isAlarm ? 'alarm' : 'warning',
          wx: asset.position[0],
          wy: yOff + asset.position[1] + 0.8,
          wz: asset.position[2],
          assetId: asset.id,
          toggleEntityId: canCtrl ? asset.actuatorEntityId || asset.entityId : undefined,
          isControllable: canCtrl,
        });
      }
    }
    return list;
  }, [project.openings, project.assets, entities]);

  // Roof PV summary if any building has roofConfig.pvConfig.enabled
  const roofPvZones = project.zones.filter((z) => z.roofConfig?.pvConfig?.enabled);
  const totalRoofPvKwp = roofPvZones.reduce(
    (acc, z) => acc + (z.roofConfig?.pvConfig?.kwPeak ?? 8.4),
    0
  );

  // Custom Cards Filtering
  const allCustomCards = cockpitCfg.customCards || [];
  const visibleCustomCards = allCustomCards.filter((card) => {
    if (card.visibilityRule === 'when_active') {
      return isEntityActiveState(entities[card.entityId]);
    }
    return true;
  });

  const activePinnedCustomCards = allCustomCards.filter(
    (card) => card.pinAsAlertWhenActive && isEntityActiveState(entities[card.entityId])
  );

  const quickBarCards = allCustomCards.filter((card) => card.showInQuickBar);

  const handleAddCustomCard = () => {
    if (!newCardEntityId.trim()) return;
    const ent = entities[newCardEntityId.trim()];
    const label =
      newCardLabel.trim() ||
      (ent?.attributes?.friendly_name as string) ||
      newCardEntityId.trim();
    const nextCard: CustomLiveCardItem = {
      id: `live_card_${Date.now()}`,
      label,
      entityId: newCardEntityId.trim(),
      actuatorEntityId: newCardActuatorEntityId.trim() || undefined,
      controlMode: newCardControlMode,
      icon: newCardIcon,
      visibilityRule: newCardVisibility,
      pinAsAlertWhenActive: newCardPinAlert,
      showInQuickBar: newCardQuickBar,
      showFloating3DIcon: newCardFloating3DIcon,
      zoneId: newCardZoneId || undefined,
    };
    updateCockpitCfg({
      customCards: [...allCustomCards, nextCard],
    });
    setNewCardLabel('');
    setNewCardEntityId('');
    setNewCardActuatorEntityId('');
  };

  const handleRemoveCustomCard = (id: string) => {
    updateCockpitCfg({
      customCards: allCustomCards.filter((c) => c.id !== id),
    });
  };

  const handleAddPersonConfig = () => {
    if (!newPersonEntityId.trim()) return;
    const ent = entities[newPersonEntityId.trim()];
    const name =
      newPersonName.trim() ||
      (ent?.attributes?.friendly_name as string) ||
      newPersonEntityId.trim();
    const nextPerson: PresencePersonConfig = {
      id: `person_cfg_${Date.now()}`,
      name,
      entityId: newPersonEntityId.trim(),
      roomEntityId: newPersonRoomEntityId.trim() || undefined,
      defaultRoomName:
        newPersonDefaultRoom ||
        project.zones.find((z) => z.zoneType === 'indoor')?.name ||
        'Wohnbereich',
      avatarColor: newPersonColor || '#38bdf8',
    };
    updateCockpitCfg({
      persons: [...configuredPersons, nextPerson],
    });
    setNewPersonName('');
    setNewPersonEntityId('');
    setNewPersonRoomEntityId('');
  };

  const handleRemovePersonConfig = (id: string) => {
    updateCockpitCfg({
      persons: configuredPersons.filter((p) => p.id !== id),
    });
  };

  return (
    <div className="pointer-events-auto w-[330px] sm:w-[370px] max-h-[calc(100vh-185px)] flex flex-col rounded-xl bg-slate-950/92 backdrop-blur-xl border border-slate-800/90 shadow-2xl overflow-hidden text-slate-100">
      {/* Header Bar */}
      <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-slate-800/80 bg-slate-900/80">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse shrink-0" />
          <span className="text-xs font-bold uppercase tracking-wider text-slate-100 truncate">
            Live-Cockpit & Status-Cards
          </span>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => {
              setCollapsed(false);
              setActiveTab('custom');
              setShowConfigEditor((p) => !p);
            }}
            title="Live-Cards, Status-Icons & Anwesenheiten konfigurieren"
            className={`px-2 py-1 rounded text-[10px] font-semibold flex items-center gap-1 transition-colors ${
              showConfigEditor
                ? 'bg-amber-500 text-slate-950'
                : 'bg-slate-800/80 text-amber-300 hover:bg-slate-700 border border-amber-500/30'
            }`}
          >
            <Settings2 className="w-3 h-3" />
            <span>Anpassen</span>
          </button>
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

      {/* ===================================================================== */}
      {/* PROMINENT MULTI-EVENT SUMMARY CARD & AUTO-CAMERA-JUMP CONTROL         */}
      {/* (Shows 1-click camera jump & control when 1 or more events are active)*/}
      {/* ===================================================================== */}
      {(activeLiveEvents.length > 0 ||
        activePinnedCustomCards.length > 0 ||
        quickBarCards.length > 0) && (
        <div className="px-2.5 py-2 bg-slate-900/95 border-b border-slate-800/80 space-y-2">
          {activeLiveEvents.length > 0 && (
            <div
              className={`p-2 rounded-xl border space-y-1.5 ${
                activeLiveEvents.some((e) => e.severity === 'alarm')
                  ? 'bg-red-950/80 border-red-400/70'
                  : activeLiveEvents.length >= 2
                  ? 'bg-amber-950/60 border-amber-400/70 shadow-lg'
                  : 'bg-slate-950/90 border-amber-500/45'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 text-[10.5px] font-bold text-amber-300">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <span>
                    {activeLiveEvents.length === 1
                      ? '1 Aktives Ereignis im Haus'
                      : `${activeLiveEvents.length} Aktive Ereignisse (Ereignis-Card)`}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    updateCockpitCfg({
                      autoJumpToActiveEvents:
                        cockpitCfg.autoJumpToActiveEvents === false ? true : false,
                    })
                  }
                  title="Bei einzelnem Ereignis (z.B. Garagentor öffnet) Kamera automatisch dorthin bewegen"
                  className={`px-1.5 py-0.5 rounded text-[9px] font-mono font-semibold border transition-colors ${
                    cockpitCfg.autoJumpToActiveEvents !== false
                      ? 'bg-emerald-500/20 border-emerald-400/50 text-emerald-300'
                      : 'bg-slate-800 border-slate-700 text-slate-400'
                  }`}
                >
                  Auto-Fokus: {cockpitCfg.autoJumpToActiveEvents !== false ? 'EIN' : 'AUS'}
                </button>
              </div>

              <div className="space-y-1 max-h-32 overflow-y-auto pr-0.5">
                {activeLiveEvents.map((ev) => (
                  <div
                    key={ev.id}
                    className="flex items-center justify-between gap-1.5 px-2 py-1 rounded-lg bg-slate-900/95 border border-white/10 text-[10.5px]"
                  >
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span
                        className={`w-2 h-2 rounded-full shrink-0 ${
                          ev.severity === 'alarm'
                            ? 'bg-red-400 animate-ping'
                            : ev.severity === 'warning'
                            ? 'bg-amber-400 animate-pulse'
                            : 'bg-sky-400'
                        }`}
                      />
                      <span className="font-semibold text-white truncate">{ev.label}</span>
                      <span className="px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 font-mono text-[9px] font-bold shrink-0">
                        {ev.stateText}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {onFlyToWorldPos && (
                        <button
                          type="button"
                          onClick={() => {
                            onFlyToWorldPos(ev.wx, ev.wy, ev.wz, {
                              openingId: ev.openingId,
                              assetId: ev.assetId,
                            });
                          }}
                          className="px-1.5 py-0.5 rounded bg-sky-500/20 hover:bg-sky-500/35 border border-sky-400/40 text-sky-200 text-[9.5px] font-semibold"
                          title="3D-Kamera direkt zu diesem Ereignis schwenken"
                        >
                          Kamera hin
                        </button>
                      )}
                      {ev.isControllable && ev.toggleEntityId && (
                        <button
                          type="button"
                          onClick={() => onToggleEntity(ev.toggleEntityId!)}
                          className="px-1.5 py-0.5 rounded bg-amber-500 hover:bg-amber-400 text-slate-950 text-[9.5px] font-bold"
                        >
                          Schalten
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Compact Quick-Access Bar */}
          {cockpitCfg.showQuickAccessBar !== false && quickBarCards.length > 0 && (
            <div className="flex items-center gap-1 overflow-x-auto pb-0.5 custom-scrollbar">
              {quickBarCards.map((card) => {
                const ent = entities[card.entityId];
                const active = isEntityActiveState(ent);
                const actEntId = card.actuatorEntityId || card.entityId;
                const canToggle =
                  card.controlMode !== 'sensor_only' &&
                  (card.controlMode === 'actuator' ||
                    card.controlMode === 'sensor_and_actuator' ||
                    isEntityControllableDomain(entities[actEntId]));
                return (
                  <button
                    key={`qb_${card.id}`}
                    type="button"
                    onClick={() => {
                      if (canToggle) onToggleEntity(actEntId);
                      else if (card.zoneId) onFocusZone(card.zoneId);
                    }}
                    title={`${card.label} (${card.entityId}) — ${formatEntityReadableState(ent)}${
                      canToggle ? ' · Klicken zum Schalten' : ' · Nur Sensor-Anzeige'
                    }`}
                    className={`shrink-0 flex items-center gap-1.5 px-2 py-1 rounded-md border text-[10px] font-medium transition-colors ${
                      active
                        ? 'bg-cyan-500/20 border-cyan-400/50 text-cyan-200'
                        : 'bg-slate-950/80 border-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {renderCardIcon(card.icon, 'w-3 h-3 shrink-0')}
                    <span className="truncate max-w-[95px]">{card.label}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {!collapsed && (
        <>
          {/* Category Tabs */}
          <div className="grid grid-cols-6 gap-1 p-1.5 bg-slate-900/50 border-b border-slate-800/70">
            <button
              onClick={() => setActiveTab('custom')}
              className={`flex flex-col items-center justify-center py-1.5 rounded-lg text-[9.5px] font-semibold transition-all ${
                activeTab === 'custom'
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <Settings2 className="w-3.5 h-3.5 mb-0.5" />
              <span>Cards</span>
            </button>
            <button
              onClick={() => setActiveTab('rooms')}
              className={`flex flex-col items-center justify-center py-1.5 rounded-lg text-[9.5px] font-semibold transition-all ${
                activeTab === 'rooms'
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <Home className="w-3.5 h-3.5 mb-0.5" />
              <span>Räume</span>
            </button>
            <button
              onClick={() => setActiveTab('tech')}
              className={`flex flex-col items-center justify-center py-1.5 rounded-lg text-[9.5px] font-semibold transition-all ${
                activeTab === 'tech'
                  ? 'bg-teal-500/20 text-teal-300 border border-teal-500/40'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <Flame className="w-3.5 h-3.5 mb-0.5" />
              <span>Technik</span>
            </button>
            <button
              onClick={() => setActiveTab('energy')}
              className={`flex flex-col items-center justify-center py-1.5 rounded-lg text-[9.5px] font-semibold transition-all ${
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
              className={`flex flex-col items-center justify-center py-1.5 rounded-lg text-[9.5px] font-semibold transition-all ${
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
              className={`flex flex-col items-center justify-center py-1.5 rounded-lg text-[9.5px] font-semibold transition-all ${
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
          <div className="p-2.5 overflow-y-auto space-y-2.5 max-h-[430px] custom-scrollbar">
            {/* ================================================================= */}
            {/* TAB 0: FREI KONFIGURIERBARE LIVE-CARDS & ANWESENHEITS-SETUP       */}
            {/* ================================================================= */}
            {activeTab === 'custom' && (
              <div className="space-y-2.5">
                {/* Inline Configurator Toggle Banner */}
                <div className="flex items-center justify-between p-2 rounded-lg bg-slate-900/90 border border-slate-800">
                  <div>
                    <div className="text-xs font-bold text-emerald-300">
                      Variable Live-Cards & Status-Pins
                    </div>
                    <div className="text-[10px] text-slate-400">
                      Eigene Sensoren, Garagentor-Warnung & Anwesenheiten festlegen
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowConfigEditor((p) => !p)}
                    className="px-2.5 py-1 rounded-md bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-emerald-300 text-[10px] font-bold"
                  >
                    {showConfigEditor ? 'Fertig' : '+ Card / Person'}
                  </button>
                </div>

                {/* Configurator Form for Custom Cards & Presence */}
                {showConfigEditor && (
                  <div className="p-2.5 rounded-xl bg-slate-900/95 border border-amber-500/40 space-y-3">
                    <div className="text-[11px] font-bold text-amber-300 uppercase tracking-wider">
                      1. Neue Live-Card / Status-Icon anlegen
                    </div>
                    <div className="space-y-1.5">
                      <input
                        type="text"
                        value={newCardLabel}
                        onChange={(e) => setNewCardLabel(e.target.value)}
                        placeholder="Bezeichnung (z.B. Garagentor, Dachgaube Rollo)"
                        className="w-full px-2 py-1.5 rounded bg-slate-950 border border-slate-700 text-xs text-white"
                      />
                      <input
                        type="text"
                        list="cockpit-all-ha-entities"
                        value={newCardEntityId}
                        onChange={(e) => setNewCardEntityId(e.target.value)}
                        placeholder="Home Assistant Entität (z.B. binary_sensor.garagentor)"
                        className="w-full px-2 py-1.5 rounded bg-slate-950 border border-slate-700 text-xs font-mono text-cyan-300"
                      />
                      <datalist id="cockpit-all-ha-entities">
                        {Object.keys(entities).map((id) => (
                          <option
                            key={id}
                            value={id}
                            label={String(entities[id]?.attributes?.friendly_name || id)}
                          />
                        ))}
                      </datalist>

                      <div className="grid grid-cols-2 gap-1.5">
                        <select
                          value={newCardControlMode}
                          onChange={(e) =>
                            setNewCardControlMode(
                              e.target.value as
                                | 'auto'
                                | 'sensor_only'
                                | 'actuator'
                                | 'sensor_and_actuator'
                            )
                          }
                          className="px-2 py-1.5 rounded bg-slate-950 border border-slate-700 text-[11px] text-amber-200"
                        >
                          <option value="auto">Modus: Automatisch</option>
                          <option value="sensor_only">Nur Sensor (Anzeige)</option>
                          <option value="actuator">Aktor (Steuerbar)</option>
                          <option value="sensor_and_actuator">Sensor + Aktor</option>
                        </select>

                        <select
                          value={newCardVisibility}
                          onChange={(e) =>
                            setNewCardVisibility(e.target.value as 'always' | 'when_active')
                          }
                          className="px-2 py-1.5 rounded bg-slate-950 border border-slate-700 text-[11px] text-slate-200"
                        >
                          <option value="always">Immer sichtbar</option>
                          <option value="when_active">Nur wenn aktiv / offen</option>
                        </select>
                      </div>

                      {newCardControlMode === 'sensor_and_actuator' && (
                        <input
                          type="text"
                          list="cockpit-all-ha-entities"
                          value={newCardActuatorEntityId}
                          onChange={(e) => setNewCardActuatorEntityId(e.target.value)}
                          placeholder="Separate Aktor-Entität zum Schalten (z.B. cover.garagentor)"
                          className="w-full px-2 py-1.5 rounded bg-slate-950 border border-amber-500/40 text-xs font-mono text-amber-300"
                        />
                      )}

                      <div className="grid grid-cols-2 gap-1.5">
                        <select
                          value={newCardIcon}
                          onChange={(e) => setNewCardIcon(e.target.value as LiveCardIconId)}
                          className="px-2 py-1.5 rounded bg-slate-950 border border-slate-700 text-[11px] text-slate-200"
                        >
                          {LIVE_CARD_ICON_OPTIONS.map((opt) => (
                            <option key={opt.id} value={opt.id}>
                              Icon: {opt.label}
                            </option>
                          ))}
                        </select>

                        <select
                          value={newCardZoneId}
                          onChange={(e) => setNewCardZoneId(e.target.value)}
                          className="px-2 py-1.5 rounded bg-slate-950 border border-slate-700 text-[11px] text-slate-300"
                        >
                          <option value="">Kein Raum-Fokus</option>
                          {project.zones
                            .filter((z) => z.zoneType === 'indoor')
                            .map((z) => (
                              <option key={z.id} value={z.id}>
                                Raum: {z.name}
                              </option>
                            ))}
                        </select>
                      </div>

                      <div className="flex flex-col gap-1 pt-0.5 text-[10.5px] text-slate-300">
                        <label className="flex items-center gap-1.5 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={newCardFloating3DIcon}
                            onChange={(e) => setNewCardFloating3DIcon(e.target.checked)}
                            className="rounded border-slate-700"
                          />
                          <span>
                            Auch als 3D-Status-Icon direkt am Objekt im 3D-Haus anzeigen
                          </span>
                        </label>
                        <label className="flex items-center gap-1.5 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={newCardPinAlert}
                            onChange={(e) => setNewCardPinAlert(e.target.checked)}
                            className="rounded border-slate-700"
                          />
                          <span>
                            Als Warn-Icon oben anpinnen, sobald aktiv/offen (z.B. Garagentor)
                          </span>
                        </label>
                        <label className="flex items-center gap-1.5 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={newCardQuickBar}
                            onChange={(e) => setNewCardQuickBar(e.target.checked)}
                            className="rounded border-slate-700"
                          />
                          <span>In kompakter Schnellzugriffs-Leiste anzeigen</span>
                        </label>
                      </div>

                      <button
                        type="button"
                        onClick={handleAddCustomCard}
                        className="w-full py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs flex items-center justify-center gap-1.5"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Eigene Live-Card hinzufügen</span>
                      </button>
                    </div>

                    {/* Section 2: Household Persons & Presence Configuration */}
                    <div className="pt-2.5 border-t border-slate-800 space-y-2">
                      <div className="text-[11px] font-bold text-cyan-300 uppercase tracking-wider">
                        2. Personen & Anwesenheiten festlegen
                      </div>
                      <p className="text-[10px] text-slate-400 leading-relaxed">
                        Verknüpfe <code className="text-cyan-300">person.*</code> oder{' '}
                        <code className="text-cyan-300">device_tracker.*</code> für Zuhause-Status
                        sowie optional einen Raum-Tracker (z.B. ESPresense / Bermuda).
                      </p>

                      {configuredPersons.length > 0 && (
                        <div className="space-y-1">
                          {configuredPersons.map((p) => (
                            <div
                              key={p.id}
                              className="flex items-center justify-between px-2 py-1 rounded bg-slate-950 border border-slate-800 text-[11px]"
                            >
                              <div className="flex items-center gap-1.5 min-w-0">
                                <span
                                  className="w-2.5 h-2.5 rounded-full shrink-0"
                                  style={{ backgroundColor: p.avatarColor || '#38bdf8' }}
                                />
                                <div className="truncate">
                                  <span className="font-semibold text-white">{p.name}</span>{' '}
                                  <span className="font-mono text-[9.5px] text-slate-400">
                                    ({p.entityId})
                                  </span>
                                </div>
                              </div>
                              <button
                                type="button"
                                onClick={() => handleRemovePersonConfig(p.id)}
                                className="p-1 text-slate-400 hover:text-rose-400"
                                title="Person entfernen"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}

                      <div className="grid grid-cols-3 gap-1.5">
                        <input
                          type="text"
                          value={newPersonName}
                          onChange={(e) => setNewPersonName(e.target.value)}
                          placeholder="Name (z.B. Max)"
                          className="col-span-2 px-2 py-1 rounded bg-slate-950 border border-slate-700 text-xs text-white"
                        />
                        <input
                          type="color"
                          value={newPersonColor}
                          onChange={(e) => setNewPersonColor(e.target.value)}
                          title="Avatar-Farbe"
                          className="w-full h-7 rounded bg-slate-950 border border-slate-700 cursor-pointer"
                        />
                      </div>

                      <input
                        type="text"
                        list="cockpit-all-ha-entities"
                        value={newPersonEntityId}
                        onChange={(e) => setNewPersonEntityId(e.target.value)}
                        placeholder="Person/Tracker Entität (z.B. person.max)"
                        className="w-full px-2 py-1 rounded bg-slate-950 border border-slate-700 text-xs font-mono text-cyan-300"
                      />

                      <input
                        type="text"
                        list="cockpit-all-ha-entities"
                        value={newPersonRoomEntityId}
                        onChange={(e) => setNewPersonRoomEntityId(e.target.value)}
                        placeholder="Optional: Raum-Sensor (z.B. sensor.max_ble_room)"
                        className="w-full px-2 py-1 rounded bg-slate-950 border border-slate-700 text-xs font-mono text-slate-300"
                      />

                      <select
                        value={newPersonDefaultRoom}
                        onChange={(e) => setNewPersonDefaultRoom(e.target.value)}
                        className="w-full px-2 py-1 rounded bg-slate-950 border border-slate-700 text-[11px] text-slate-200"
                      >
                        <option value="">Standard-Raum wenn Zuhause…</option>
                        {project.zones
                          .filter((z) => z.zoneType === 'indoor')
                          .map((z) => (
                            <option key={z.id} value={z.name}>
                              Standard-Raum: {z.name}
                            </option>
                          ))}
                      </select>

                      <button
                        type="button"
                        onClick={handleAddPersonConfig}
                        className="w-full py-1.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs flex items-center justify-center gap-1.5"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Person / Anwesenheit speichern</span>
                      </button>
                    </div>

                    {/* Section 3: Per-Room Presence Sensor Quick Mapping */}
                    {onUpdateZone && indoorZones.length > 0 && (
                      <div className="pt-2.5 border-t border-slate-800 space-y-1.5">
                        <div className="text-[11px] font-bold text-purple-300 uppercase tracking-wider">
                          3. Raum-Präsenzmelder (Bewegung / mmWave)
                        </div>
                        <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                          {indoorZones.map((z) => (
                            <div key={z.id} className="space-y-0.5">
                              <div className="text-[10px] text-slate-300 font-medium">{z.name}</div>
                              <input
                                type="text"
                                list="cockpit-all-ha-entities"
                                value={z.presenceEntityId || ''}
                                onChange={(e) =>
                                  onUpdateZone(z.id, {
                                    presenceEntityId: e.target.value || undefined,
                                  })
                                }
                                placeholder="z.B. binary_sensor.praesenz_wohnzimmer"
                                className="w-full px-2 py-1 rounded bg-slate-950 border border-slate-800 text-[10.5px] font-mono text-purple-300"
                              />
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Automatic Built-in Smart Cards (Garage Doors, Roof PV & House Overview) so Live 3D always has rich cards out of the box! */}
                <div className="space-y-1.5">
                  {project.openings
                    .filter((op) => op.type === 'garage_door')
                    .map((op) => {
                      const st = resolveOpeningSensorState(op, entities, false);
                      const isOpen = st !== 'closed';
                      const canCtrl = isOpeningActuatorControllable(op, entities);
                      const targetEntId = op.actuatorEntityId || op.entityId || op.shutterEntityId;
                      const yOff = (op.level ?? 0) * 2.75;
                      return (
                        <div
                          key={`auto_garage_${op.id}`}
                          className={`p-2.5 rounded-lg border transition-all flex items-center justify-between gap-2 ${
                            isOpen
                              ? 'bg-amber-950/45 border-amber-400/70 shadow-md'
                              : 'bg-slate-900/80 border-slate-800'
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div
                              className={`p-2 rounded-lg shrink-0 ${
                                isOpen
                                  ? 'bg-amber-500/20 text-amber-300 border border-amber-400/40'
                                  : 'bg-slate-800 text-emerald-400'
                              }`}
                            >
                              <Car className="w-4 h-4" />
                            </div>
                            <div className="min-w-0">
                              <div className="text-xs font-bold text-slate-100 truncate flex items-center gap-1.5">
                                <span className="truncate">{op.name.replace(/\s*\(2-Sensor[^)]*\)/gi, '').replace(/\s*[-–]?\s*Sensor\b/gi, '').trim()}</span>
                              </div>
                              <div className="text-[10px] font-mono text-slate-400">
                                Status:{' '}
                                <span
                                  className={
                                    isOpen ? 'text-amber-300 font-bold' : 'text-emerald-300'
                                  }
                                >
                                  {isOpen ? 'OFFEN' : 'GESCHLOSSEN'}
                                </span>
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            {onFlyToWorldPos && (
                              <button
                                type="button"
                                onClick={() =>
                                  onFlyToWorldPos(op.x, yOff + op.sillHeight + op.height * 0.5, op.z)
                                }
                                className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-sky-300 text-[10px] font-semibold border border-white/10"
                                title="Kamera zum Garagentor bewegen"
                              >
                                Fokus
                              </button>
                            )}
                            {canCtrl && targetEntId && (
                              <button
                                type="button"
                                onClick={() => onToggleEntity(targetEntId)}
                                className={`px-2.5 py-1 rounded-md text-[10px] font-bold transition-colors ${
                                  isOpen
                                    ? 'bg-amber-500 text-slate-950 hover:bg-amber-400'
                                    : 'bg-slate-800 text-slate-200 hover:bg-slate-700 border border-slate-700'
                                }`}
                              >
                                {isOpen ? 'Schließen' : 'Öffnen'}
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}

                  {/* Roof PV & Battery Live Card */}
                  <div className="p-2.5 rounded-lg bg-slate-900/80 border border-slate-800 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="p-2 rounded-lg bg-amber-500/20 text-amber-300 border border-amber-400/40 shrink-0">
                        <Sun className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-slate-100 truncate">
                          PV-Dachanlage & Hausspeicher
                        </div>
                        <div className="text-[10px] font-mono text-emerald-300">
                          PV: {(pvW / 1000).toFixed(2)} kW
                          {totalRoofPvKwp > 0 ? ` (${totalRoofPvKwp.toFixed(1)} kWp Dach)` : ''} ·
                          Akku: {batSoc}%
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setActiveTab('energy')}
                      className="px-2 py-1 rounded bg-amber-500/20 hover:bg-amber-500/30 border border-amber-400/40 text-amber-300 text-[10px] font-semibold shrink-0"
                    >
                      Details
                    </button>
                  </div>
                </div>

                {/* Rendered Custom Live Cards */}
                {visibleCustomCards.length === 0 ? (
                  <div className="p-2.5 rounded-lg bg-slate-900/60 border border-slate-800/80 space-y-2">
                    <div className="text-[11px] font-semibold text-slate-300">
                      {allCustomCards.length === 0
                        ? 'Schnell-Vorlagen für eigene Live-Cards:'
                        : 'Alle bedingten Cards sind aktuell im Ruhezustand.'}
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          setShowConfigEditor(true);
                          setNewCardLabel('Garagentor Überwachung');
                          setNewCardIcon('garage');
                          setNewCardControlMode('sensor_and_actuator');
                        }}
                        className="px-2 py-1 rounded-md bg-slate-800 hover:bg-slate-700 border border-white/10 text-[10px] text-amber-300 font-semibold"
                      >
                        + Garagentor-Card
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setShowConfigEditor(true);
                          setNewCardLabel('Wärmepumpe / Heizung');
                          setNewCardIcon('climate');
                          setNewCardControlMode('sensor_only');
                        }}
                        className="px-2 py-1 rounded-md bg-slate-800 hover:bg-slate-700 border border-white/10 text-[10px] text-cyan-300 font-semibold"
                      >
                        + Wärmepumpen-Card
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowConfigEditor(true)}
                        className="px-2 py-1 rounded-md bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-400/40 text-[10px] text-emerald-300 font-semibold"
                      >
                        + Eigene Entität…
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    {visibleCustomCards.map((card) => {
                      const ent = entities[card.entityId];
                      const active = isEntityActiveState(ent);
                      const actEntId = card.actuatorEntityId || card.entityId;
                      const controllable =
                        card.controlMode !== 'sensor_only' &&
                        (card.controlMode === 'actuator' ||
                          card.controlMode === 'sensor_and_actuator' ||
                          isEntityControllableDomain(entities[actEntId]));
                      const isShutter = entities[actEntId]?.domain === 'cover' || ent?.domain === 'cover';
                      const coverPos =
                        typeof ent?.attributes?.current_position === 'number'
                          ? ent.attributes.current_position
                          : active
                          ? 100
                          : 0;

                      return (
                        <div
                          key={card.id}
                          className={`p-2.5 rounded-lg border transition-all flex items-center justify-between gap-2 ${
                            active
                              ? 'bg-slate-900/95 border-amber-500/50 shadow-md'
                              : 'bg-slate-900/75 border-slate-800/80'
                          }`}
                        >
                          <div
                            onClick={() => {
                              if (card.zoneId) onFocusZone(card.zoneId);
                            }}
                            className={`flex items-center gap-2.5 min-w-0 ${
                              card.zoneId ? 'cursor-pointer' : ''
                            }`}
                          >
                            <div
                              className={`p-2 rounded-lg shrink-0 ${
                                active
                                  ? 'bg-amber-500/20 text-amber-300 border border-amber-400/40'
                                  : 'bg-slate-800 text-slate-400'
                              }`}
                            >
                              {renderCardIcon(card.icon, 'w-4 h-4')}
                            </div>
                            <div className="min-w-0">
                              <div className="text-xs font-bold text-slate-100 truncate flex items-center gap-1.5">
                                <span className="truncate">{card.label.replace(/\s*\(2-Sensor[^)]*\)/gi, '').replace(/\s*[-–]?\s*Sensor\b/gi, '').trim()}</span>
                              </div>
                              <div className="text-[10px] font-mono text-slate-400 truncate">
                                {formatEntityReadableState(ent)}
                                {isShutter ? ` · ${coverPos}%` : ''}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-1 shrink-0">
                            {controllable ? (
                              <button
                                type="button"
                                onClick={() => onToggleEntity(actEntId)}
                                className={`px-2.5 py-1 rounded-md text-[10px] font-bold transition-colors ${
                                  active
                                    ? 'bg-amber-500 text-slate-950 hover:bg-amber-400'
                                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700 border border-slate-700'
                                }`}
                              >
                                {isShutter
                                  ? active
                                    ? 'Schließen'
                                    : 'Öffnen'
                                  : active
                                  ? 'Aktiv'
                                  : 'Schalten'}
                              </button>
                            ) : (
                              <span
                                title="Reiner Status-Sensor (schreibgeschützt in der Live-Ansicht)"
                                className={`px-2 py-0.5 rounded text-[9.5px] font-mono font-semibold ${
                                  active
                                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                                    : 'bg-slate-800/80 text-slate-400'
                                }`}
                              >
                                {active ? 'AKTIV / OFFEN' : 'RUHE / ZU'}
                              </span>
                            )}

                            {showConfigEditor && (
                              <button
                                type="button"
                                onClick={() => handleRemoveCustomCard(card.id)}
                                className="p-1 text-slate-400 hover:text-rose-400"
                                title="Card löschen"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Quick Summary of Dormer Window Shutters & Contacts if configured */}
                {project.zones.some(
                  (z) =>
                    (z.roofDormers &&
                      z.roofDormers.some((d) =>
                        (d.windows || []).some((w) => w.entityId || w.shutterEntityId)
                      )) ||
                    (z.roofSkylights &&
                      z.roofSkylights.some((s) => s.entityId || s.shutterEntityId))
                ) && (
                  <div className="p-2.5 rounded-lg bg-slate-900/85 border border-slate-800 space-y-1.5">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-amber-300 flex items-center gap-1.5">
                      <Blinds className="w-3.5 h-3.5" />
                      <span>Dachgauben & Dachfenster (Rollos / Kontakte)</span>
                    </div>
                    <div className="space-y-1">
                      {project.zones.map((z) =>
                        (z.roofDormers || []).map((d) =>
                          (d.windows || []).map((w, wIdx) => {
                            if (!w.entityId && !w.shutterEntityId) return null;
                            const winEnt = w.entityId ? entities[w.entityId] : undefined;
                            const shutEnt = w.shutterEntityId
                              ? entities[w.shutterEntityId]
                              : undefined;
                            return (
                              <div
                                key={`${d.id}_${w.id || wIdx}`}
                                className="flex items-center justify-between gap-2 px-2 py-1 rounded bg-slate-950/80 border border-slate-800/80 text-[11px]"
                              >
                                <div className="min-w-0">
                                  <div className="font-medium text-slate-200 truncate">
                                    {z.name} · {d.name || 'Gaube'} #{wIdx + 1}
                                  </div>
                                  <div className="text-[9.5px] font-mono text-slate-400">
                                    {winEnt ? `Fenster: ${formatEntityReadableState(winEnt)}` : ''}
                                    {winEnt && shutEnt ? ' · ' : ''}
                                    {shutEnt ? `Rollo: ${formatEntityReadableState(shutEnt)}` : ''}
                                  </div>
                                </div>
                                {w.shutterEntityId && (
                                  <button
                                    type="button"
                                    onClick={() => onToggleEntity(w.shutterEntityId!)}
                                    className="px-2 py-0.5 rounded bg-amber-500/20 hover:bg-amber-500/30 border border-amber-400/40 text-amber-300 text-[10px] font-semibold shrink-0"
                                  >
                                    Rollo
                                  </button>
                                )}
                              </div>
                            );
                          })
                        )
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* TAB 1: RAUM-STATUS-CARDS */}
            {activeTab === 'rooms' && (
              <>
                {(configuredPersons.length > 0 || personEntities.length > 0) && (
                  <div className="p-2.5 rounded-lg bg-slate-900/90 border border-slate-800/90 space-y-1.5">
                    <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-emerald-400">
                      <span className="flex items-center gap-1.5">
                        <Users className="w-3.5 h-3.5" />
                        Live Raum-Präsenz (3D-Avatare)
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setActiveTab('custom');
                          setShowConfigEditor(true);
                        }}
                        className="text-[9.5px] text-cyan-300 hover:underline"
                      >
                        Konfigurieren
                      </button>
                    </div>
                    <div className="grid grid-cols-1 gap-1.5">
                      {(configuredPersons.length > 0
                        ? configuredPersons.map((cfg) => ({
                            id: cfg.entityId,
                            name: cfg.name,
                            color: cfg.avatarColor || '#38bdf8',
                            room:
                              (cfg.roomEntityId && entities[cfg.roomEntityId]?.state) ||
                              (entities[cfg.entityId]?.attributes?.room as string) ||
                              cfg.defaultRoomName ||
                              'Wohnbereich',
                            state: entities[cfg.entityId]?.state || 'home',
                          }))
                        : personEntities.map((person) => ({
                            id: person.entity_id,
                            name: String(person.attributes.friendly_name || person.entity_id),
                            color: (person.attributes.avatar_color as string) || '#38bdf8',
                            room: (person.attributes.room as string) || 'Wohn- & Essbereich',
                            state: person.state,
                          }))
                      ).map((pItem) => (
                        <div
                          key={pItem.id}
                          className="flex items-center justify-between gap-2 px-2 py-1 rounded bg-slate-950/70 border border-slate-800/70 text-xs"
                        >
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span
                              className="w-2.5 h-2.5 rounded-full shrink-0"
                              style={{ backgroundColor: pItem.color }}
                            />
                            <span className="font-medium truncate">{pItem.name}</span>
                            <span
                              className={`text-[9.5px] px-1.5 py-0.2 rounded font-mono ${
                                pItem.state === 'home' || pItem.state === 'on'
                                  ? 'bg-emerald-500/20 text-emerald-300'
                                  : 'bg-slate-800 text-slate-400'
                              }`}
                            >
                              {pItem.state === 'home' || pItem.state === 'on'
                                ? 'Zuhause'
                                : 'Abwesend'}
                            </span>
                          </div>
                          <select
                            value={pItem.room}
                            onChange={(e) => onUpdatePersonRoom?.(pItem.id, e.target.value)}
                            className="bg-slate-900 border border-slate-700/80 rounded px-1.5 py-0.5 text-[11px] text-cyan-300 focus:outline-none max-w-[135px]"
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
                      ))}
                    </div>
                  </div>
                )}

                {(() => {
                  const bldgGroups = getBuildingHierarchyGroups(project.zones);
                  return bldgGroups.map((grp) => {
                    const visibleRooms = grp.zones.filter((gz) =>
                      indoorZones.some((iz) => iz.id === gz.id)
                    );
                    if (visibleRooms.length === 0) return null;
                    return (
                      <div key={grp.buildingKey} className="space-y-1.5">
                        <div className="flex items-center justify-between px-1.5 pt-1 text-[10px] font-bold uppercase tracking-wider text-amber-300">
                          <span className="flex items-center gap-1.5">
                            <Building2 className="w-3.5 h-3.5 text-amber-400" />
                            <span>{grp.label}</span>
                          </span>
                          <span className="text-[9.5px] font-mono text-slate-400">
                            {visibleRooms.length} Räume
                          </span>
                        </div>
                        {visibleRooms.map((zone) => {
                          const zLevel = zone.level ?? 0;
                          const floorLabel =
                            zLevel === -1
                              ? 'KG'
                              : zLevel === 0
                              ? 'EG'
                              : zLevel === 1
                              ? '1.OG'
                              : 'DG';

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

                          const zoneOpenings = project.openings.filter((o) => {
                            if ((o.level ?? 0) !== zLevel) return false;
                            return (
                              Math.abs(o.x - zone.x) <= zone.width / 2 + 0.45 &&
                              Math.abs(o.z - zone.z) <= zone.depth / 2 + 0.45
                            );
                          });

                          const openWindows = zoneOpenings.filter(
                            (o) => resolveOpeningSensorState(o, entities, false) !== 'closed'
                          );

                          const roomPresenceActive =
                            zone.presenceEntityId &&
                            isEntityActiveState(entities[zone.presenceEntityId]);

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
                                    {roomPresenceActive && (
                                      <span className="text-[9.5px] px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-semibold">
                                        Präsenz
                                      </span>
                                    )}
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
                      </div>
                    );
                  });
                })()}
              </>
            )}

            {/* ================================================================= */}
            {/* TAB 1B: HAUSTECHNIK & ZENTRALE (Wärmepumpe, Speicher, PV, Zähler) */}
            {/* ================================================================= */}
            {activeTab === 'tech' &&
              (() => {
                const placedTechAssets = project.assets.filter((a) =>
                  isBuildingTechAsset(a.catalogId)
                );
                const hpAsset = placedTechAssets.find(
                  (a) =>
                    a.catalogId === 'heat_pump_outdoor_monoblock' ||
                    a.catalogId === 'heat_pump_indoor_unit'
                );
                const tankAsset = placedTechAssets.find(
                  (a) => a.catalogId === 'hot_water_buffer_tank'
                );
                const pvInvAsset = placedTechAssets.find(
                  (a) =>
                    a.catalogId === 'pv_inverter_system' ||
                    a.catalogId === 'home_battery_inverter'
                );
                const meterAsset = placedTechAssets.find(
                  (a) => a.catalogId === 'electrical_meter_cabinet'
                );
                const hubAsset = placedTechAssets.find(
                  (a) => a.catalogId === 'smart_home_server_hub'
                );

                // Resolve Heat Pump Telemetry
                const hpTc = hpAsset?.techConfig || {};
                const vorlaufVal = Number(
                  entities[hpTc.supplyTempEntityId || 'sensor.wp_vorlauf_temp']?.state ?? 36.4
                );
                const ruecklaufVal = Number(
                  entities[hpTc.returnTempEntityId || 'sensor.wp_ruecklauf_temp']?.state ?? 29.8
                );
                const copVal = Number(
                  entities[hpTc.copEntityId || 'sensor.wp_cop']?.state ?? 4.6
                );
                const hpPowerW = Number(
                  entities[hpTc.powerEntityId || 'sensor.wp_aufnahmeleistung']?.state ?? 890
                );
                const deltaT = +(vorlaufVal - ruecklaufVal).toFixed(1);

                // Resolve Hot Water Buffer Tank Telemetry
                const tankTc = tankAsset?.techConfig || {};
                const tankTempId =
                  tankTc.storageTempEntityId ||
                  tankAsset?.entityId ||
                  'sensor.warmwasser_speicher_temp';
                const tankTempVal = Number(entities[tankTempId]?.state ?? 53.5);
                const tankPct = Math.max(
                  10,
                  Math.min(100, Math.round(((tankTempVal - 20) / 45) * 100))
                );

                // Resolve PV & Hybrid Inverter Telemetry
                const pvTc = pvInvAsset?.techConfig || {};
                const pvPowId =
                  pvTc.powerEntityId || pvInvAsset?.entityId || 'sensor.pv_dach_leistung';
                const pvPowVal = Number(
                  entities[pvPowId]?.state ?? entities['sensor.pv_roof_power']?.state ?? 4280
                );
                const pvYieldVal = Number(
                  entities[pvTc.dailyYieldEntityId || 'sensor.pv_tagesertrag']?.state ?? 26.8
                );
                const pvSocVal = Number(
                  entities[pvTc.batterySocEntityId || 'sensor.hausakku_soc']?.state ??
                    entities['sensor.home_battery_soc']?.state ??
                    84
                );

                // Resolve Electrical Meter Cabinet Telemetry
                const meterTc = meterAsset?.techConfig || {};
                const meterGridId =
                  meterTc.gridPowerEntityId ||
                  meterAsset?.entityId ||
                  'sensor.zaehlerschrank_leistung';
                const meterGridW = Number(entities[meterGridId]?.state ?? -1420);

                // Resolve Smart Home Central Hub Telemetry
                const hubTc = hubAsset?.techConfig || {};
                const hubCpuId =
                  hubTc.cpuLoadEntityId || hubAsset?.entityId || 'sensor.smarthome_hub_cpu';
                const hubCpuPct = Number(entities[hubCpuId]?.state ?? 14);

                const focusAssetZone = (asset?: typeof hpAsset) => {
                  if (!asset) return;
                  const z = project.zones.find(
                    (zn) =>
                      zn.zoneType === 'indoor' &&
                      (zn.level ?? 0) === (asset.level ?? 0) &&
                      Math.abs(asset.position[0] - zn.x) <= zn.width / 2 + 0.6 &&
                      Math.abs(asset.position[2] - zn.z) <= zn.depth / 2 + 0.6
                  );
                  if (z) onFocusZone(z.id);
                };

                return (
                  <div className="space-y-2.5">
                    <div className="p-2 rounded-lg bg-slate-900/90 border border-teal-500/30 flex items-center justify-between">
                      <div>
                        <div className="text-xs font-bold text-teal-300">
                          Haustechnik & Zentrale (Live-Telemetrie)
                        </div>
                        <div className="text-[10px] text-slate-400">
                          {placedTechAssets.length > 0
                            ? `${placedTechAssets.length} 3D-Haustechnik-Geräte im Plan verknüpft`
                            : 'Automatische Live-Cards für WP, Speicher, PV, Zähler & Hub'}
                        </div>
                      </div>
                      <span className="px-2 py-0.5 rounded bg-teal-500/20 text-teal-300 text-[9.5px] font-mono font-bold">
                        LIVE
                      </span>
                    </div>

                    {/* 1. WÄRMEPUMPE (AUSSEN-/INNENEINHEIT) CARD */}
                    <div className="p-2.5 rounded-xl bg-slate-900/90 border border-amber-500/35 space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="p-1.5 rounded-lg bg-amber-500/20 text-amber-300">
                            <Flame className="w-4 h-4" />
                          </div>
                          <div className="min-w-0">
                            <div className="text-xs font-bold text-white truncate">
                              {hpAsset?.name || 'Luft-Wasser-Wärmepumpe'}
                            </div>
                            <div className="text-[9.5px] text-slate-400 font-mono">
                              Heizbetrieb · ΔT {deltaT} K ·{' '}
                              {hpAsset ? '3D-Modell aktiv' : 'Standard-Sensoren'}
                            </div>
                          </div>
                        </div>
                        {hpAsset && (
                          <button
                            type="button"
                            onClick={() => focusAssetZone(hpAsset)}
                            className="p-1.5 rounded-md bg-slate-800 hover:bg-slate-700 text-amber-300"
                            title="Zum Aufstellraum der Wärmepumpe zoomen"
                          >
                            <Maximize2 className="w-3 h-3" />
                          </button>
                        )}
                      </div>

                      <div className="grid grid-cols-4 gap-1.5 pt-1">
                        <div className="p-1.5 rounded-lg bg-slate-950/85 border border-slate-800 text-center">
                          <div className="text-[9px] text-slate-400">Vorlauf</div>
                          <div className="text-xs font-bold font-mono text-amber-300">
                            {vorlaufVal.toFixed(1)}°C
                          </div>
                        </div>
                        <div className="p-1.5 rounded-lg bg-slate-950/85 border border-slate-800 text-center">
                          <div className="text-[9px] text-slate-400">Rücklauf</div>
                          <div className="text-xs font-bold font-mono text-sky-300">
                            {ruecklaufVal.toFixed(1)}°C
                          </div>
                        </div>
                        <div className="p-1.5 rounded-lg bg-slate-950/85 border border-slate-800 text-center">
                          <div className="text-[9px] text-slate-400">COP</div>
                          <div className="text-xs font-bold font-mono text-emerald-300">
                            {copVal.toFixed(2)}
                          </div>
                        </div>
                        <div className="p-1.5 rounded-lg bg-slate-950/85 border border-slate-800 text-center">
                          <div className="text-[9px] text-slate-400">Aufnahme</div>
                          <div className="text-xs font-bold font-mono text-white">
                            {hpPowerW} W
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* 2. WARMWASSERSPEICHER / PUFFERSPEICHER CARD */}
                    <div className="p-2.5 rounded-xl bg-slate-900/90 border border-sky-500/35 space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="p-1.5 rounded-lg bg-sky-500/20 text-sky-300">
                            <Droplets className="w-4 h-4" />
                          </div>
                          <div className="min-w-0">
                            <div className="text-xs font-bold text-white truncate">
                              {tankAsset?.name || 'Warmwasser- & Pufferspeicher (300L)'}
                            </div>
                            <div className="text-[9.5px] text-slate-400 font-mono">
                              Soll 55.0°C · Hygiene-Schutz aktiv
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <span className="text-sm font-bold font-mono text-amber-300">
                            {tankTempVal.toFixed(1)}°C
                          </span>
                        </div>
                      </div>
                      <div className="w-full h-2 rounded-full bg-slate-950 overflow-hidden border border-slate-800">
                        <div
                          className="h-full bg-gradient-to-r from-sky-500 via-amber-400 to-rose-500 transition-all"
                          style={{ width: `${tankPct}%` }}
                        />
                      </div>
                    </div>

                    {/* 3. PV-WECHSELRICHTER & HAUSSPEICHER CARD */}
                    <div className="p-2.5 rounded-xl bg-slate-900/90 border border-emerald-500/35 space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-300">
                            <Sun className="w-4 h-4" />
                          </div>
                          <div className="min-w-0">
                            <div className="text-xs font-bold text-white truncate">
                              {pvInvAsset?.name || 'PV-Hybrid-Wechselrichter & Speicher'}
                            </div>
                            <div className="text-[9.5px] text-slate-400 font-mono">
                              MPPT 1+2 aktiv · Überschussladung bereit
                            </div>
                          </div>
                        </div>
                        {pvInvAsset && (
                          <button
                            type="button"
                            onClick={() => focusAssetZone(pvInvAsset)}
                            className="p-1.5 rounded-md bg-slate-800 hover:bg-slate-700 text-emerald-300"
                            title="Zum Wechselrichter zoomen"
                          >
                            <Maximize2 className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                      <div className="grid grid-cols-3 gap-1.5">
                        <div className="p-1.5 rounded-lg bg-slate-950/85 border border-slate-800 text-center">
                          <div className="text-[9px] text-slate-400">PV-Erzeugung</div>
                          <div className="text-xs font-bold font-mono text-amber-300">
                            {(pvPowVal / 1000).toFixed(2)} kW
                          </div>
                        </div>
                        <div className="p-1.5 rounded-lg bg-slate-950/85 border border-slate-800 text-center">
                          <div className="text-[9px] text-slate-400">Tagesertrag</div>
                          <div className="text-xs font-bold font-mono text-emerald-300">
                            {pvYieldVal.toFixed(1)} kWh
                          </div>
                        </div>
                        <div className="p-1.5 rounded-lg bg-slate-950/85 border border-slate-800 text-center">
                          <div className="text-[9px] text-slate-400">Hausakku SoC</div>
                          <div className="text-xs font-bold font-mono text-cyan-300">
                            {pvSocVal}%
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* 4. ZÄHLERSCHRANK & SMART-HOME-ZENTRALE CARD */}
                    <div className="grid grid-cols-2 gap-2">
                      <div className="p-2.5 rounded-xl bg-slate-900/90 border border-slate-700/80 space-y-1.5">
                        <div className="flex items-center gap-1.5 text-xs font-bold text-slate-100">
                          <Zap className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                          <span className="truncate">
                            {meterAsset?.name || 'Zählerschrank'}
                          </span>
                        </div>
                        <div className="text-sm font-bold font-mono text-white">
                          {meterGridW < 0
                            ? `${Math.abs(meterGridW)} W Einsp.`
                            : `${meterGridW} W Bezug`}
                        </div>
                        <div className="text-[9.5px] font-mono text-emerald-400">
                          3~ L1/L2/L3 · Smart Meter OK
                        </div>
                      </div>

                      <div className="p-2.5 rounded-xl bg-slate-900/90 border border-cyan-500/35 space-y-1.5">
                        <div className="flex items-center gap-1.5 text-xs font-bold text-slate-100">
                          <Cpu className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                          <span className="truncate">
                            {hubAsset?.name || 'Smart-Home-Zentrale'}
                          </span>
                        </div>
                        <div className="text-sm font-bold font-mono text-cyan-300">
                          CPU {hubCpuPct}% · Online
                        </div>
                        <div className="text-[9.5px] font-mono text-slate-400">
                          HA Core · Zigbee / Matter
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })()}

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

