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
  onClose,
}) => {
  const [activeCodeTab, setActiveCodeTab] = useState<
    | 'init_py'
    | 'config_flow_py'
    | 'panel_js'
    | 'manifest'
    | 'hacs_json'
    | 'de_json'
    | 'yaml'
  >('init_py');
  const [githubRepoInput, setGithubRepoInput] = useState<string>(() => {
    try {
      return localStorage.getItem('realplan3d_github_repo') || 'thimobannuscher/realplan3d';
    } catch {
      return 'thimobannuscher/realplan3d';
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
      repoPath: 'Dashboard Karte (Optional)',
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
              ✓ Die Ordnerstruktur <code className=" font-mono">hacs.json</code> und{' '}
              <code className="font-mono">custom_components/realplan3d/</code> liegt bereits fix und fertig im Projekt-Hauptverzeichnis. Sobald du das Projekt nach <code className="font-mono">{owner}/{repo}</code> auf GitHub hochlädst, erkennt HACS das Repository sofort!
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

        {/* Right Column: Complete HACS Custom-Component File Inspector & Downloader */}
        <div className="lg:col-span-7 flex flex-col rounded-xl bg-slate-900 border border-white/10 overflow-hidden">
          <div className="px-4 py-2.5 border-b border-white/10 flex flex-col gap-2">
            <div className="flex flex-wrap items-center gap-1">
              {[
                { id: 'init_py', label: '__init__.py (Sidebar Panel)' },
                { id: 'config_flow_py', label: 'config_flow.py (Integration UI)' },
                { id: 'panel_js', label: 'realplan3d-panel.js (3D Engine)' },
                { id: 'manifest', label: 'manifest.json' },
                { id: 'de_json', label: 'translations/de.json' },
                { id: 'hacs_json', label: 'hacs.json' },
                { id: 'yaml', label: 'Lovelace YAML' },
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

            <div className="flex items-center justify-between gap-2 pt-1 border-t border-white/5">
              <div className="text-[11px] font-mono text-sky-300 truncate">
                 Zielpfad im GitHub-Repo: <span className="text-amber-300">{currentItem.repoPath}</span>
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
