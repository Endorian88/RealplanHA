import React, { useRef, useState } from 'react';
import {
  Check,
  CloudUpload,
  Copy,
  Database,
  Download,
  ExternalLink,
  FileCode,
  FolderGit2,
  Link2,
  PlugZap,
  RotateCcw,
  Upload,
  X,
} from 'lucide-react';
import { ConnectionStatus } from '../services/haWebSocketBridge';
import { FloorplanProject } from '../types/floorplan';
import {
  generateConfigFlowPy,
  generateCustomCardBundleJs,
  generateHacsJson,
  generateInitPy,
  generateLovelaceYaml,
  generateManifestJson,
  generateTranslationsDeJson,
  parseGitHubRepoSlug,
} from '../utils/hacsExporter';

interface HacsExportViewProps {
  project: FloorplanProject;
  connectionStatus: ConnectionStatus;
  connectionError: string | null;
  haServerSyncedAt?: string | null;
  onConnectHA: (url: string, token: string) => void;
  onDisconnectHA: () => void;
  onSaveProjectToHA?: () => Promise<boolean>;
  onLoadProjectFromHA?: () => Promise<boolean>;
  onResetDefaultProject: () => void;
  onImportProjectJson: (proj: FloorplanProject) => void;
  onActivatePureLivePreview?: (opts: {
    hideHeader: boolean;
    hideDock: boolean;
    hideRoomList: boolean;
  }) => void;
  onClose: () => void;
}

export const HacsExportView: React.FC<HacsExportViewProps> = ({
  project,
  connectionStatus,
  connectionError,
  haServerSyncedAt,
  onConnectHA,
  onDisconnectHA,
  onSaveProjectToHA,
  onLoadProjectFromHA,
  onResetDefaultProject,
  onImportProjectJson,
  onActivatePureLivePreview,
  onClose,
}) => {
  const [activeCodeTab, setActiveCodeTab] = useState<
    | 'card_configurator'
    | 'init_py'
    | 'config_flow_py'
    | 'panel_js'
    | 'manifest'
    | 'hacs_json'
    | 'de_json'
    | 'yaml'
  >('card_configurator');

  // Visual Lovelace Card Configurator states
  const [lovelaceCardType, setLovelaceCardType] = useState<
    'floorplan_3d' | 'room_status' | 'energy_pro' | 'camera_cockpit'
  >('floorplan_3d');
  const [lovelaceDisplayMode, setLovelaceDisplayMode] = useState<
    'pure_live' | 'live_minimal' | 'full_studio'
  >('pure_live');
  const [lovelaceShowTopHeader, setLovelaceShowTopHeader] = useState<boolean>(false);
  const [lovelaceShowBottomDock, setLovelaceShowBottomDock] = useState<boolean>(false);
  const [lovelaceShowRoomList, setLovelaceShowRoomList] = useState<boolean>(false);
  const [lovelaceAutoJumpEvents, setLovelaceAutoJumpEvents] = useState<boolean>(true);
  const [lovelaceCardHeight, setLovelaceCardHeight] = useState<string>('680px');
  const [lovelaceSelectedRoomId, setLovelaceSelectedRoomId] = useState<string>(() => {
    const firstIndoor = project.zones.find((z) => z.zoneType === 'indoor');
    return firstIndoor?.id || 'wohnzimmer';
  });
  const [lovelaceVisualStyle, setLovelaceVisualStyle] = useState<'archviz' | 'neon' | 'blueprint'>('archviz');
  const [lovelaceFloorView, setLovelaceFloorView] = useState<'0' | '1' | '2' | '-1' | 'all_stacked'>('0');
  const [lovelaceShowSky, setLovelaceShowSky] = useState<boolean>(true);
  const [lovelaceShowCockpit, setLovelaceShowCockpit] = useState<boolean>(true);

  const [githubRepoInput, setGithubRepoInput] = useState<string>(() => {
    try {
      return localStorage.getItem('realplan3d_github_repo') || 'Endorian88/RealplanHA';
    } catch {
      return 'Endorian88/RealplanHA';
    }
  });
  const [haUrl, setHaUrl] = useState('http://homeassistant.local:8123');
  const [haToken, setHaToken] = useState('');
  const [copied, setCopied] = useState(false);
  const [copiedLinkType, setCopiedLinkType] = useState<'repo' | 'myha' | null>(null);
  const [syncFeedback, setSyncFeedback] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleUpdateRepoInput = (val: string) => {
    setGithubRepoInput(val);
    try {
      localStorage.setItem('realplan3d_github_repo', val);
    } catch {
      // ignore storage errors
    }
  };

  const { owner, repo, cleanUrl, myHaHacsUrl } = parseGitHubRepoSlug(githubRepoInput);

  const selectedRoomZone =
    project.zones.find((z) => z.id === lovelaceSelectedRoomId) ||
    project.zones.find((z) => z.zoneType === 'indoor');

  const generateConfiguredCardYaml = (): string => {
    if (lovelaceCardType === 'room_status') {
      const roomName = selectedRoomZone?.name || 'Wohnbereich';
      return `# RealPlan 3D – Raum-Status-Card (${roomName})
type: custom:realplan3d-room-card
title: "${roomName}"
room_id: "${selectedRoomZone?.id || 'wohnzimmer'}"
floor_level: ${selectedRoomZone?.level ?? 0}
visual_style: "${lovelaceVisualStyle}"
entities:
  temperature: sensor.klima_wohnzimmer_temperatur
  humidity: sensor.klima_wohnzimmer_luftfeuchte
  co2: sensor.luftqualitaet_wohnzimmer_co2
  main_light: light.wohnzimmer_decke
  window_contact: binary_sensor.fenster_wz_west_griff
  presence_person: person.thimo
features:
  show_3d_mini_preview: true
  quick_light_toggle: true
  show_window_tilt_badge: true`;
    }

    if (lovelaceCardType === 'energy_pro') {
      return `# RealPlan 3D – Energie-Pro-Card & 3D-Stromfluss
type: custom:realplan3d-energy-card
title: "PV, Hausspeicher & Wallbox Live"
visual_style: "${lovelaceVisualStyle}"
show_3d_flow_lines: true
entities:
  pv_power: sensor.pv_dach_leistung
  house_load: sensor.hausverbrauch_aktuell
  battery_soc: sensor.hausspeicher_soc
  wallbox_power: sensor.wallbox_ladeleistung
  grid_power: sensor.netzbezug_aktuell
thresholds:
  high_load_watts: 3500
  battery_low_pct: 20`;
    }

    if (lovelaceCardType === 'camera_cockpit') {
      return `# RealPlan 3D – Kamera-Cockpit-Card mit 3D-Sichtkegel (FOV)
type: custom:realplan3d-camera-card
title: "Außenkameras & Einfahrt"
visual_style: "${lovelaceVisualStyle}"
show_3d_fov_cones: true
highlight_on_motion: true
cameras:
  - entity: binary_sensor.kamera_einfahrt_bewegung
    name: "Einfahrt & Hoftor"
    fov_angle_deg: 95
    range_meters: 8.5
  - entity: binary_sensor.kamera_garten_bewegung
    name: "Garten Süd / Pool"
    fov_angle_deg: 110
    range_meters: 10.0`;
    }

    return `# RealPlan 3D – Interaktive 3D-Grundriss-Card für Lovelace & Wandtablets
type: custom:realplan3d-card
title: "${project.title}"
display_mode: "${lovelaceDisplayMode}" # pure_live = Nur Live-3D ohne Leiste oben & ohne Kamerafahrt-Leiste
show_top_header: ${lovelaceShowTopHeader}
show_bottom_dock: ${lovelaceShowBottomDock}
show_room_directory: ${lovelaceShowRoomList}
auto_jump_events_frontal: ${lovelaceAutoJumpEvents}
card_height: "${lovelaceCardHeight}"
default_floor: "${lovelaceFloorView}"
visual_style: "${lovelaceVisualStyle}"
skybox_atmosphere: ${lovelaceShowSky}
smart_cockpit_cards: ${lovelaceShowCockpit}
presence_avatars_3d: true
weather_entity: weather.home
sun_entity: sun.sun
camera_preset: overview`;
  };

  const configuredCardYaml = generateConfiguredCardYaml();
  const initPyCode = generateInitPy(project);
  const configFlowCode = generateConfigFlowPy(project);
  const panelJsCode = generateCustomCardBundleJs(project);
  const manifestCode = generateManifestJson(githubRepoInput);
  const hacsJsonCode = generateHacsJson();
  const deJsonCode = generateTranslationsDeJson();
  const yamlCode = generateLovelaceYaml(project);

  const codeMap: Record<
    typeof activeCodeTab,
    { code: string; filename: string; repoPath: string }
  > = {
    card_configurator: {
      code: configuredCardYaml,
      filename: `lovelace-${lovelaceCardType}.yaml`,
      repoPath: 'Dashboard → Karte hinzufügen → Manuell (YAML)',
    },
    init_py: {
      code: initPyCode,
      filename: '__init__.py',
      repoPath: 'custom_components/realplan3d/__init__.py',
    },
    config_flow_py: {
      code: configFlowCode,
      filename: 'config_flow.py',
      repoPath: 'custom_components/realplan3d/config_flow.py',
    },
    panel_js: {
      code: panelJsCode,
      filename: 'realplan3d-panel.js',
      repoPath: 'custom_components/realplan3d/frontend/realplan3d-panel.js',
    },
    manifest: {
      code: manifestCode,
      filename: 'manifest.json',
      repoPath: 'custom_components/realplan3d/manifest.json',
    },
    de_json: {
      code: deJsonCode,
      filename: 'de.json',
      repoPath: 'custom_components/realplan3d/translations/de.json',
    },
    hacs_json: {
      code: hacsJsonCode,
      filename: 'hacs.json',
      repoPath: 'hacs.json',
    },
    yaml: {
      code: yamlCode,
      filename: 'lovelace-realplan3d.yaml',
      repoPath: 'Dashboard Karte (Komplett)',
    },
  };

  const currentItem = codeMap[activeCodeTab];

  const handleCopy = () => {
    navigator.clipboard.writeText(currentItem.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  const handleCopyLink = (text: string, type: 'repo' | 'myha') => {
    navigator.clipboard.writeText(text);
    setCopiedLinkType(type);
    setTimeout(() => setCopiedLinkType(null), 2000);
  };

  const handleDownloadFile = (filename: string, content: string) => {
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-x-2.5 sm:inset-x-6 top-16 sm:top-20 bottom-14 sm:bottom-28 z-30 max-w-6xl mx-auto rounded-2xl bg-[#0f172a] border border-white/15 shadow-2xl flex flex-col overflow-hidden">
      {/* Header */}
      <div className="px-3.5 sm:px-6 py-3 sm:py-4 border-b border-white/10 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-sm sm:text-lg font-bold text-white flex items-center gap-2">
            <FolderGit2 className="w-5 h-5 text-amber-400 shrink-0" />
            <span className="truncate">
              HACS Custom-Integration (`custom_components/realplan3d`) & Seitenleisten-Panel
            </span>
          </h2>
          <p className="text-[11px] sm:text-xs text-slate-400 mt-0.5">
            Direkt über GitHub & HACS installierbar → Integration hinzufügen → Eigener Eintrag in der Home Assistant Seitenleiste
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200 flex items-center gap-1.5 whitespace-nowrap shrink-0"
        >
          <X className="w-4 h-4" />
          <span>Schließen</span>
        </button>
      </div>

      {/* Main Split Grid */}
      <div className="flex-1 overflow-y-auto p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: GitHub & HACS Link Generator + Installation Guide + Live WebSocket */}
        <div className="lg:col-span-5 space-y-4">
          {/* 1. GitHub Repository & HACS Installation Link Box */}
          <div className="p-4 rounded-xl bg-slate-900 border border-amber-400/40 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-amber-300">
                1. GitHub-Repository & HACS Installations-Links
              </h3>
              <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 text-[10px] font-mono font-semibold">
                HACS Ready
              </span>
            </div>

            <div>
              <label className="block text-[11px] text-slate-300 mb-1">
                Dein GitHub-Repository (<code className="text-sky-300">Nutzername/Repository</code> oder volle URL):
              </label>
              <input
                type="text"
                value={githubRepoInput}
                onChange={(e) => handleUpdateRepoInput(e.target.value)}
                placeholder="z.B. thimobannuscher/realplan3d"
                className="w-full px-3 py-1.5 rounded-lg bg-[#090d16] border border-amber-400/40 text-xs font-mono text-white"
              />
            </div>

            {/* Link A: Custom Repository URL for HACS */}
            <div className="p-2.5 rounded-lg bg-[#090d16] border border-white/10 space-y-1.5">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-slate-300 font-semibold">
                  A) Repository-Link für HACS (Kategorie: <span className="text-amber-300">Integration</span>)
                </span>
                <button
                  type="button"
                  onClick={() => handleCopyLink(cleanUrl, 'repo')}
                  className="px-2 py-0.5 rounded bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-[10px] flex items-center gap-1"
                >
                  {copiedLinkType === 'repo' ? (
                    <>
                      <Check className="w-3 h-3" />
                      <span>Kopiert!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3" />
                      <span>URL kopieren</span>
                    </>
                  )}
                </button>
              </div>
              <div className="text-[11px] font-mono text-sky-300 break-all select-all">
                {cleanUrl}
              </div>
            </div>

            {/* Link B: 1-Click My Home Assistant HACS Redirect URL */}
            <div className="p-2.5 rounded-lg bg-[#090d16] border border-sky-500/30 space-y-1.5">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-sky-300 font-semibold">
                  B) 1-Klick „My Home Assistant“ HACS-Direktlink
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => handleCopyLink(myHaHacsUrl, 'myha')}
                    className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium text-[10px] flex items-center gap-1"
                  >
                    {copiedLinkType === 'myha' ? (
                      <>
                        <Check className="w-3 h-3 text-emerald-400" />
                        <span>Kopiert!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3" />
                        <span>Kopieren</span>
                      </>
                    )}
                  </button>
                  <a
                    href={myHaHacsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-2 py-0.5 rounded bg-sky-500 hover:bg-sky-400 text-slate-950 font-semibold text-[10px] flex items-center gap-1"
                  >
                    <ExternalLink className="w-3 h-3" />
                    <span>In HA öffnen</span>
                  </a>
                </div>
              </div>
              <div className="text-[10px] font-mono text-slate-300 break-all select-all">
                {myHaHacsUrl}
              </div>
            </div>

            <div className="text-[11px] text-emerald-300/95 bg-emerald-950/30 border border-emerald-500/30 rounded-lg px-2.5 py-2 leading-relaxed">
              ✓ Die Ordnerstruktur <code className="font-mono">hacs.json</code> und{' '}
              <code className="font-mono">custom_components/realplan3d/manifest.json</code> liegt bereits fix und fertig im Projekt-Hauptverzeichnis.
            </div>

            <div className="text-[11px] text-amber-200/95 bg-amber-950/40 border border-amber-500/40 rounded-lg px-2.5 py-2 leading-relaxed space-y-1">
              <div className="font-bold text-amber-300">
                💡 Fehlerbehebung: „No manifest.json file found &apos;custom_components/None/manifest.json&apos;“
              </div>
              <p className="text-slate-300">
                Dieser HACS-Fehler tritt auf, wenn HACS das Repository beim allerersten Hinzufügen (z. B. beim leeren Initial-Commit) mit <code className="text-amber-300">domain: None</code> im Cache gespeichert hat oder ohne GitHub-Release über einen Commit-Hash aktualisiert.
              </p>
              <ol className="list-decimal list-inside text-slate-200 space-y-0.5 pt-0.5">
                <li>
                  In Home Assistant unter <strong>HACS → ⋮ (oben rechts) → Benutzerdefinierte Repositories</strong> (oder beim Eintrag über <strong>⋮ → Entfernen</strong>) <code className="text-sky-300">{owner}/{repo}</code> einmal löschen.
                </li>
                <li>
                  Optional auf GitHub unter <strong>Releases → Create a new release</strong> einen Tag <code className="text-emerald-300">v4.1.0</code> anlegen (damit HACS Versionen statt Commit-Hashes nutzt).
                </li>
                <li>
                  Repository in HACS neu als <strong>Integration</strong> hinzufügen und auf <strong>Herunterladen</strong> klicken.
                </li>
              </ol>
            </div>
          </div>

          {/* 2. Step-by-Step HACS Custom Component + Sidebar Installation */}
          <div className="p-4 rounded-xl bg-slate-900 border border-white/10 space-y-2.5">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                2. Ablauf in Home Assistant (Schritt für Schritt)
              </h3>
              <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 text-[10px] font-mono font-semibold">
                config_flow: true
              </span>
            </div>
            <ol className="text-xs text-slate-300 space-y-1.5 list-decimal list-inside leading-relaxed">
              <li>
                <strong>Auf GitHub hochladen:</strong> Lade dieses Projekt in dein GitHub-Repository <code className="text-sky-300">{owner}/{repo}</code> hoch.
              </li>
              <li>
                <strong>In HACS einbinden:</strong> Öffne den <strong>1-Klick-Link (B)</strong> oben oder füge <code className="text-sky-300">{cleanUrl}</code> unter <strong>HACS → Integrationen → ⋮ → Benutzerdefinierte Repositories</strong> (Kategorie: <em>Integration</em>) ein und klicke auf <strong>Herunterladen</strong>.
              </li>
              <li>
                <strong>Home Assistant neu starten:</strong> Starte Home Assistant nach dem HACS-Download einmal neu.
              </li>
              <li>
                <strong>Integration aktivieren:</strong> Gehe zu{' '}
                <strong>Einstellungen → Geräte & Dienste → + Integration hinzufügen</strong>, suche nach{' '}
                <strong className="text-amber-300">RealPlan 3D</strong> – das 3D-Panel erscheint sofort in deiner <strong>Seitenleiste</strong>!
              </li>
            </ol>

            <div className="pt-2.5 border-t border-white/10 space-y-2">
              <div className="p-2.5 rounded-lg bg-emerald-950/35 border border-emerald-500/30 text-[11px] text-emerald-200 space-y-1">
                <div className="font-bold flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Database className="w-3.5 h-3.5 text-emerald-400" />
                    <span>3-fache Speicherung (Desktop, Tablet & Smartphone synchron)</span>
                  </span>
                  {haServerSyncedAt && (
                    <span className="text-[10px] font-mono text-emerald-300">
                      HA-Sync: {haServerSyncedAt}
                    </span>
                  )}
                </div>
                <p className="text-slate-300 leading-relaxed">
                  <strong>1. Zentral auf dem Home Assistant Server:</strong> Die Integration speichert deinen gesamten Grundriss automatisch in <code className="text-sky-300">/config/.storage/realplan3d.floorplan_project</code>. Alle Geräte (Smartphone, Tablet, PC) laden denselben Stand.
                  <br />
                  <strong>2. Im HACS-Bundle eingebettet:</strong> Beim Export von <code className="text-amber-300">realplan3d-panel.js</code> ist dein aktuelles 3D-Haus direkt im Code hinterlegt.
                  <br />
                  <strong>3. Lokaler Browser & .json Backup:</strong> Jede Änderung wird sofort lokal gesichert und kann jederzeit als <code className="text-sky-300">.json</code> exportiert/importiert werden.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() =>
                    handleDownloadFile(
                      'realplan3d-project.json',
                      JSON.stringify(project, null, 2)
                    )
                  }
                  className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-sky-300 font-medium flex items-center gap-1.5"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>3D-Projekt (.json) sichern</span>
                </button>

                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-amber-300 font-medium flex items-center gap-1.5"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>Projekt (.json) laden</span>
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".json,application/json"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    const reader = new FileReader();
                    reader.onload = () => {
                      try {
                        const parsed = JSON.parse(String(reader.result));
                        if (parsed && Array.isArray(parsed.zones) && Array.isArray(parsed.assets)) {
                          onImportProjectJson(parsed);
                          setSyncFeedback('Projektdatei (.json) erfolgreich geladen!');
                          setTimeout(() => setSyncFeedback(null), 3000);
                        }
                      } catch {
                        setSyncFeedback('Ungültige JSON-Projektdatei.');
                        setTimeout(() => setSyncFeedback(null), 3000);
                      }
                    };
                    reader.readAsText(file);
                    e.target.value = '';
                  }}
                />

                {connectionStatus === 'connected' && onSaveProjectToHA && (
                  <button
                    type="button"
                    onClick={async () => {
                      const ok = await onSaveProjectToHA();
                      setSyncFeedback(
                        ok
                          ? 'In Home Assistant (/config/.storage) gespeichert!'
                          : 'Speichern über HA WebSocket fehlgeschlagen.'
                      );
                      setTimeout(() => setSyncFeedback(null), 3000);
                    }}
                    className="px-2.5 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-semibold flex items-center gap-1.5"
                  >
                    <CloudUpload className="w-3.5 h-3.5" />
                    <span>Auf HA-Server speichern</span>
                  </button>
                )}

                {connectionStatus === 'connected' && onLoadProjectFromHA && (
                  <button
                    type="button"
                    onClick={async () => {
                      const ok = await onLoadProjectFromHA();
                      setSyncFeedback(
                        ok
                          ? 'Projekt vom HA-Server geladen!'
                          : 'Noch kein Projekt auf dem HA-Server gespeichert.'
                      );
                      setTimeout(() => setSyncFeedback(null), 3000);
                    }}
                    className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-slate-200 font-medium flex items-center gap-1.5"
                  >
                    <Database className="w-3.5 h-3.5" />
                    <span>Vom HA-Server laden</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={onResetDefaultProject}
                  className="ml-auto text-xs text-slate-400 hover:text-white flex items-center gap-1"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Musteranwesen laden</span>
                </button>
              </div>

              {syncFeedback && (
                <div className="px-2.5 py-1.5 rounded-lg bg-amber-500/20 border border-amber-400/40 text-amber-200 text-[11px] font-medium">
                  {syncFeedback}
                </div>
              )}
            </div>
          </div>

          {/* WebSocket Connection Box */}
          <div className="p-4 rounded-xl bg-slate-900 border border-white/10 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-semibold text-white">
                <PlugZap className="w-4 h-4 text-sky-400" />
                <span>Direkte Home Assistant WebSocket Bridge</span>
              </div>
              <span className="text-xs font-mono text-slate-300">
                {connectionStatus === 'connected'
                  ? 'LIVE VERBUNDEN'
                  : connectionStatus === 'connecting'
                  ? 'VERBINDE...'
                  : 'SIMULATIONS-MODUS'}
              </span>
            </div>

            <div className="grid grid-cols-1 gap-2.5">
              <div>
                <label className="block text-xs text-slate-300 mb-1">
                  Home Assistant URL
                </label>
                <input
                  type="text"
                  value={haUrl}
                  onChange={(e) => setHaUrl(e.target.value)}
                  placeholder="http://homeassistant.local:8123"
                  className="w-full px-3 py-1.5 rounded-lg bg-[#0f172a] border border-white/15 text-xs font-mono text-white"
                />
              </div>

              <div>
                <label className="block text-xs text-slate-300 mb-1">
                  Long-Lived Access Token (Profil → Sicherheit)
                </label>
                <input
                  type="password"
                  value={haToken}
                  onChange={(e) => setHaToken(e.target.value)}
                  placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                  className="w-full px-3 py-1.5 rounded-lg bg-[#0f172a] border border-white/15 text-xs font-mono text-white"
                />
              </div>
            </div>

            {connectionError && (
              <div className="p-2.5 rounded-lg bg-red-950/60 border border-red-500/40 text-xs text-red-200">
                {connectionError}
              </div>
            )}

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => onConnectHA(haUrl, haToken)}
                className="flex-1 py-2 px-4 rounded-lg bg-sky-500 hover:bg-sky-400 text-slate-950 text-xs font-semibold flex items-center justify-center gap-1.5 whitespace-nowrap"
              >
                <Link2 className="w-3.5 h-3.5" />
                <span>Mit Home Assistant verbinden</span>
              </button>
              {connectionStatus === 'connected' && (
                <button
                  type="button"
                  onClick={onDisconnectHA}
                  className="py-2 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-slate-200 whitespace-nowrap"
                >
                  Trennen
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Complete HACS Custom-Component File Inspector & Visual Lovelace Card Configurator */}
        <div className="lg:col-span-7 flex flex-col rounded-xl bg-slate-900 border border-white/10 overflow-hidden">
          <div className="px-4 py-2.5 border-b border-white/10 flex flex-col gap-2">
            <div className="flex flex-wrap items-center gap-1">
              {[
                { id: 'card_configurator', label: '✨ Lovelace Card-Konfigurator' },
                { id: 'init_py', label: '__init__.py (Sidebar Panel)' },
                { id: 'config_flow_py', label: 'config_flow.py (Integration UI)' },
                { id: 'panel_js', label: 'realplan3d-panel.js (3D Engine)' },
                { id: 'manifest', label: 'manifest.json' },
                { id: 'de_json', label: 'translations/de.json' },
                { id: 'hacs_json', label: 'hacs.json' },
                { id: 'yaml', label: 'Lovelace YAML (Komplett)' },
              ].map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setActiveCodeTab(t.id as typeof activeCodeTab)}
                  className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                    activeCodeTab === t.id
                      ? 'bg-amber-500 text-slate-950 font-semibold'
                      : 'text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {activeCodeTab === 'card_configurator' && (
              <div className="p-3 rounded-lg bg-[#090d16] border border-amber-400/30 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-amber-300">
                    Visueller Lovelace-Card-Konfigurator (für Dashboards & Wandtablets)
                  </span>
                  <span className="text-[10px] font-mono text-emerald-300">
                    100% integriert – ohne Zusatz-Packs
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                  {[
                    { id: 'floorplan_3d', label: '🏠 3D-Floorplan Card' },
                    { id: 'room_status', label: '🌡️ Raum-Status-Card' },
                    { id: 'energy_pro', label: '⚡ Energie-Pro-Card' },
                    { id: 'camera_cockpit', label: '📹 Kamera-FOV-Card' },
                  ].map((ct) => (
                    <button
                      key={ct.id}
                      type="button"
                      onClick={() =>
                        setLovelaceCardType(ct.id as typeof lovelaceCardType)
                      }
                      className={`px-2.5 py-1.5 rounded-lg text-[11px] font-semibold transition-colors ${
                        lovelaceCardType === ct.id
                          ? 'bg-sky-500 text-slate-950'
                          : 'bg-slate-800 text-slate-200 hover:bg-slate-700'
                      }`}
                    >
                      {ct.label}
                    </button>
                  ))}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
                  {lovelaceCardType === 'room_status' ? (
                    <div>
                      <label className="block text-[10px] text-slate-400 mb-0.5">
                        Raum auswählen
                      </label>
                      <select
                        value={lovelaceSelectedRoomId}
                        onChange={(e) => setLovelaceSelectedRoomId(e.target.value)}
                        className="w-full px-2 py-1 rounded bg-slate-900 border border-white/15 text-xs text-white"
                      >
                        {project.zones
                          .filter((z) => z.zoneType === 'indoor')
                          .map((z) => (
                            <option key={z.id} value={z.id}>
                              {z.name}
                            </option>
                          ))}
                      </select>
                    </div>
                  ) : (
                    <div>
                      <label className="block text-[10px] text-slate-400 mb-0.5">
                        Standard-Stockwerk
                      </label>
                      <select
                        value={lovelaceFloorView}
                        onChange={(e) =>
                          setLovelaceFloorView(
                            e.target.value as typeof lovelaceFloorView
                          )
                        }
                        className="w-full px-2 py-1 rounded bg-slate-900 border border-white/15 text-xs text-white"
                      >
                        <option value="0">EG (Erdgeschoss + Garten)</option>
                        <option value="1">1. OG (Obergeschoss)</option>
                        <option value="2">DG (Dachgeschoss)</option>
                        <option value="-1">KG (Kellergeschoss)</option>
                        <option value="all_stacked">Alle Etagen (3D Haus)</option>
                      </select>
                    </div>
                  )}

                  <div>
                    <label className="block text-[10px] text-slate-400 mb-0.5">
                      Design-Look (ArchViz / Neon / CAD)
                    </label>
                    <select
                      value={lovelaceVisualStyle}
                      onChange={(e) =>
                        setLovelaceVisualStyle(
                          e.target.value as typeof lovelaceVisualStyle
                        )
                      }
                      className="w-full px-2 py-1 rounded bg-slate-900 border border-white/15 text-xs text-white"
                    >
                      <option value="archviz">ArchViz Realistisch</option>
                      <option value="neon">Neon-Glow (Cyber-HUD)</option>
                      <option value="blueprint">CAD-Blueprint</option>
                    </select>
                  </div>

                  <div className="flex items-end gap-1.5">
                    <button
                      type="button"
                      onClick={() => setLovelaceShowSky((v) => !v)}
                      className={`flex-1 py-1 px-2 rounded text-[10px] font-semibold border ${
                        lovelaceShowSky
                          ? 'bg-emerald-500/20 border-emerald-400/50 text-emerald-300'
                          : 'bg-slate-800 border-white/10 text-slate-400'
                      }`}
                    >
                      Skybox: {lovelaceShowSky ? 'AN' : 'AUS'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setLovelaceShowCockpit((v) => !v)}
                      className={`flex-1 py-1 px-2 rounded text-[10px] font-semibold border ${
                        lovelaceShowCockpit
                          ? 'bg-amber-500/20 border-amber-400/50 text-amber-300'
                          : 'bg-slate-800 border-white/10 text-slate-400'
                      }`}
                    >
                      Cockpit: {lovelaceShowCockpit ? 'AN' : 'AUS'}
                    </button>
                  </div>
                </div>

                {/* Pure Live 3D Card Display Mode & Chrome Controls */}
                {lovelaceCardType === 'floorplan_3d' && (
                  <div className="pt-2 border-t border-white/10 space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-[11px] font-semibold text-sky-300">
                        Card-Darstellung (Nur Live-3D ohne obere Leiste / ohne Kamerafahrt-Leiste):
                      </span>
                      {onActivatePureLivePreview && (
                        <button
                          type="button"
                          onClick={() => {
                            onActivatePureLivePreview({
                              hideHeader: !lovelaceShowTopHeader,
                              hideDock: !lovelaceShowBottomDock,
                              hideRoomList: !lovelaceShowRoomList,
                            });
                          }}
                          className="px-2.5 py-1 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-[10.5px] font-bold transition-colors"
                        >
                          ▶ Jetzt als Live-Card-Ansicht öffnen
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5">
                      {[
                        {
                          id: 'pure_live',
                          label: '✨ Nur Live-3D (Pur ohne Leisten)',
                          sub: 'Keine Top-Leiste, kein Kamera-Dock',
                          h: false,
                          d: false,
                          r: false,
                        },
                        {
                          id: 'live_minimal',
                          label: '🎛️ Live + Untere Leiste',
                          sub: 'Ohne Top-Menü, mit Etagen/Kamera',
                          h: false,
                          d: true,
                          r: false,
                        },
                        {
                          id: 'full_studio',
                          label: '🛠️ Komplettes Studio',
                          sub: 'Mit Top-Menü, Planer & Leisten',
                          h: true,
                          d: true,
                          r: true,
                        },
                      ].map((mode) => (
                        <button
                          key={mode.id}
                          type="button"
                          onClick={() => {
                            setLovelaceDisplayMode(
                              mode.id as 'pure_live' | 'live_minimal' | 'full_studio'
                            );
                            setLovelaceShowTopHeader(mode.h);
                            setLovelaceShowBottomDock(mode.d);
                            setLovelaceShowRoomList(mode.r);
                          }}
                          className={`p-2 rounded-lg border text-left transition-colors ${
                            lovelaceDisplayMode === mode.id
                              ? 'bg-amber-500/20 border-amber-400 text-amber-200'
                              : 'bg-slate-900 border-white/10 text-slate-300 hover:bg-slate-800'
                          }`}
                        >
                          <div className="text-[11px] font-bold">{mode.label}</div>
                          <div className="text-[9.5px] text-slate-400 mt-0.5">{mode.sub}</div>
                        </button>
                      ))}
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5 pt-0.5">
                      <button
                        type="button"
                        onClick={() => setLovelaceShowTopHeader((v) => !v)}
                        className={`py-1 px-2 rounded text-[10px] font-semibold border ${
                          !lovelaceShowTopHeader
                            ? 'bg-emerald-500/20 border-emerald-400/50 text-emerald-300'
                            : 'bg-slate-800 border-white/10 text-slate-300'
                        }`}
                      >
                        Obere Leiste: {lovelaceShowTopHeader ? 'Sichtbar' : 'Ausgeblendet'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setLovelaceShowBottomDock((v) => !v)}
                        className={`py-1 px-2 rounded text-[10px] font-semibold border ${
                          !lovelaceShowBottomDock
                            ? 'bg-emerald-500/20 border-emerald-400/50 text-emerald-300'
                            : 'bg-slate-800 border-white/10 text-slate-300'
                        }`}
                      >
                        Kamera-/Unten-Leiste: {lovelaceShowBottomDock ? 'Sichtbar' : 'Ausgeblendet'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setLovelaceShowRoomList((v) => !v)}
                        className={`py-1 px-2 rounded text-[10px] font-semibold border ${
                          !lovelaceShowRoomList
                            ? 'bg-emerald-500/20 border-emerald-400/50 text-emerald-300'
                            : 'bg-slate-800 border-white/10 text-slate-300'
                        }`}
                      >
                        Raumliste links: {lovelaceShowRoomList ? 'Sichtbar' : 'Ausgeblendet'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setLovelaceAutoJumpEvents((v) => !v)}
                        className={`py-1 px-2 rounded text-[10px] font-semibold border ${
                          lovelaceAutoJumpEvents
                            ? 'bg-sky-500/20 border-sky-400/50 text-sky-300'
                            : 'bg-slate-800 border-white/10 text-slate-400'
                        }`}
                      >
                        Frontal-Event-Zoom: {lovelaceAutoJumpEvents ? 'AN' : 'AUS'}
                      </button>
                      <select
                        value={lovelaceCardHeight}
                        onChange={(e) => setLovelaceCardHeight(e.target.value)}
                        className="px-2 py-1 rounded bg-slate-900 border border-white/15 text-[10px] text-white font-mono"
                      >
                        <option value="520px">Höhe: 520px</option>
                        <option value="680px">Höhe: 680px</option>
                        <option value="820px">Höhe: 820px</option>
                        <option value="100dvh">Vollbild (100dvh)</option>
                      </select>
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="flex items-center justify-between gap-2 pt-1 border-t border-white/5">
              <div className="text-[11px] font-mono text-sky-300 truncate">
                 Ziel: <span className="text-amber-300">{currentItem.repoPath}</span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={handleCopy}
                  className="px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200 flex items-center gap-1.5 whitespace-nowrap"
                >
                  {copied ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Kopiert</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Kopieren</span>
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() =>
                    handleDownloadFile(currentItem.filename, currentItem.code)
                  }
                  className="px-3 py-1 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap"
                >
                  <FileCode className="w-3.5 h-3.5" />
                  <span>{currentItem.filename} laden</span>
                </button>
              </div>
            </div>
          </div>

          <pre className="flex-1 p-4 overflow-auto text-xs font-mono text-slate-200 leading-relaxed bg-[#090d16]">
            <code>{currentItem.code}</code>
          </pre>
        </div>
      </div>
    </div>
  );
};
