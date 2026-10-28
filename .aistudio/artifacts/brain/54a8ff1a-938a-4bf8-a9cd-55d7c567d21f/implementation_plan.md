# RealPlan 3D — Dauerhafte GitHub- & HACS-Bundle-Synchronisation für Home Assistant (v4.2.2)

Dieser Plan behebt die Ursache, warum im Home Assistant Seitenleisten-Panel die Meldung *„RealPlan 3D wird aktualisiert…“* dauerhaft stehen bleibt und ein Klick auf den Neu-Laden-Button keine Wirkung zeigt.

### User Review & Critical Decisions

> [!IMPORTANT]
> **Exakte Ursache auf GitHub identifiziert (`Endorian88/RealplanHA`)**:
> Ein direkter Check deines GitHub-Repositorys hat gezeigt, dass im letzten Commit zwar die `index.html` und `realplan3d-panel.js` aktualisiert wurden, der Unterordner mit dem eigentlichen Programmcode (`realplan3d.js` und `realplan3d.css`) beim Build jedoch durch ein `rm -rf` kurzzeitig gelöscht und vom Datei-Watcher beim GitHub-Export übersprungen wurde. Dadurch lädt Home Assistant aktuell eine `index.html`, deren JavaScript-Bundle auf GitHub fehlt (HTTP 404), sodass das Studio leer bleibt und nach 6,5 Sekunden immer wieder der Hinweis-Banner erscheint.

- **Bestätigte Entscheidung 1 (In-Place-Build & direkte Registrierung für GitHub-Sync)**: Der Build-Prozess löscht den Zielordner niemals mehr per `rm -rf`, sondern schreibt die kompilierten Dateien (`realplan3d.js` und `realplan3d.css`) direkt in-place mit einem kurzen Header-Kommentar, sodass sie explizit in der AI-Studio-Dateidatenbank registriert und zu 100 % auf GitHub übertragen werden.
- **Bestätigte Entscheidung 2 (Grundriss-Daten bleiben 100 % erhalten)**: Dein gespeicherter Grundriss in Home Assistant (`realplan3d.floorplan_project`) ist vollständig intakt und wird sofort geladen, sobald das Bundle beim nächsten HACS-Update mitgeliefert wird.

---

### 1. Overview & Core Concept

- **Was diese Änderung bewirkt**: Stellt sicher, dass das kompilierte 3D/2D-Studio-Bundle (`realplan3d.js` und `realplan3d.css`) beim nächsten Export garantiert im GitHub-Repository landet und von HACS vollständig nach Home Assistant heruntergeladen wird.
- **Zielgruppe / Kontext**: Betrieb von RealPlan 3D als native HACS Custom Integration in Home Assistant.
- **Hauptnutzen**: Sofortiges Starten des 2D/3D-Editors in der Home Assistant Seitenleiste ohne Endlos-Wartebildschirm und ohne Datenverlust.

---

### 2. User Experience & Visual Design

- **Nahtloser Startablauf in Home Assistant**:
  1. Öffnen von **RealPlan 3D** in der Home Assistant Seitenleiste.
  2. Das Panel lädt das lokal in HACS mitgelieferte Studio-Bundle mit dunklem Hintergrund (`#090d16`).
  3. Sobald das Bundle geladen ist, sendet es das Ready-Signal an das Panel und synchronisiert automatisch deinen gespeicherten Grundriss aus dem Home Assistant Server-Speicher.
- **Transparente Diagnose im Fehlerfall**:
  - Sollte nach einem Update tatsächlich einmal eine Datei fehlen oder noch nicht geladen sein, zeigt der Hinweis-Dialog präzise den technischen Status an, statt stumm wieder in denselben Zustand zurückzuspringen.

---

### 3. Key Product Decisions & Trade-Offs

- **Entscheidung 1: Verzicht auf `rm -rf` beim HACS-Bundle-Kopieren + explizite Datei-Registrierung**
  - *Gewählter Ansatz*: Überschreiben der bestehenden Bundle-Dateien in-place ohne Löschen der Verzeichnis-Inodes sowie explizite Registrierung der Bundle-Dateien über die Workspace-Dateischnittstelle.
  - *Warum*: Das vorherige `rm -rf` hat den Linux-`inotify`-Watcher des Verzeichnisses unterbrochen, sodass neu erzeugte Bundle-Dateien beim GitHub-Push fehlten.
  - *Verworfene Alternative*: Reines Kopieren per Shell-Befehl (`cp -r`), da solche Hintergrunddateien beim GitHub-Export nicht zuverlässig im Commit landen.

- **Entscheidung 2: Versionssprung auf `v4.2.2`**
  - *Gewählter Ansatz*: Aktualisierung der Integrations- und Asset-Version auf `4.2.2`.
  - *Warum*: Damit erkennt HACS sofort das neue Update und Home Assistant lädt die neu übertragenen Bundle-Dateien frisch ohne alten Browser-Cache.

---

### 4. Technical Architecture & Data Strategy *(Technical Reference)*

#### Architecture & Component Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                     AI Studio -> GitHub -> HACS                         │
│                                                                         │
│  ┌──────────────────────────────┐     ┌──────────────────────────────┐  │
│  │  In-Place Bundle Generator   │────▶│ Explizite Datei-Registrierung│  │
│  │ (Kein rm -rf, feste Datein.) │     │ (realplan3d.js & .css in Git)│  │
│  └──────────────────────────────┘     └──────────────┬───────────────┘  │
└──────────────────────────────────────────────────────┼──────────────────┘
                                                       │ GitHub & HACS
                                                       ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                     Home Assistant Server & Browser                     │
│                                                                         │
│  ┌──────────────────────────────┐     ┌──────────────────────────────┐  │
│  │   <realplan3d-panel> (v4.2.2)│◀───▶│  Lokales Studio-Bundle       │  │
│  │   Watchdog & HA WS-Bridge    │     │  (2D/3D Editor & Live View)  │  │
│  └──────────────┬───────────────┘     └──────────────────────────────┘  │
│                 │                                                       │
│                 ▼                                                       │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │      Home Assistant Storage (realplan3d.floorplan_project)        │  │
│  └───────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘
```

#### Interactive Component & State Mapping
- **In-Place Bundle Sync**: Schreibt `realplan3d.js` und `realplan3d.css` mit einer einzeiligen Versions-Kopfzeile (`/* REALPLAN3D_BUNDLE_V4_2_2 */`), sodass beide Dateien direkt im Workspace-Index verankert und bei jedem GitHub-Export mitübertragen werden.
- **Panel Boot & Ready-Handshake**: Nach dem Laden von `realplan3d.js` sendet die App `REALPLAN_STUDIO_READY`, blendet eventuelle Ladehinweise sofort aus und lädt deinen bestehenden Grundriss aus Home Assistant.
