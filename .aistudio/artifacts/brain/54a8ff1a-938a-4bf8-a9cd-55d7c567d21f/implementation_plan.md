# RealPlan 3D — Fix für Weiße Seite nach Update, Separate Nebengebäude & Live-3D-Performance

Dieser Plan behebt die Ursache für die **weiße Seite nach dem Update** in Home Assistant / RealPlan 3D, sorgt dafür, dass eine **zweite Garage bzw. weitere Nebengebäude** als eigenständige Baukörper mit eigenem Dach erkannt werden, und optimiert die **Performance der Live-3D-Ansicht**.

## User Review & Critical Decisions

> [!IMPORTANT]
> **Warum wird nach dem Update nur eine weiße Seite angezeigt?**
> Im HACS-Verzeichnis `custom_components/realplan3d/frontend/app/` gab es einen **Dateinamen-Hash-Konflikt**: Die `index.html` verweist aktuell auf `./assets/index-CZ9IRLc2.js` und `./assets/index-BOleREaD.css`, während im Ordner `assets/` die Dateien `index-za-pDFAG.js` und `index-B6bHwqZQ.css` liegen. Dadurch schlagen beim Laden in Home Assistant sowohl das JavaScript als auch das CSS mit `404 Not Found` fehl – ohne geladenes Tailwind-CSS bleibt der Standard-Hintergrund des Browsers **weiß (`#ffffff`)** und React startet nicht.

- **Entscheidung 1 (Deterministische Bundle-Dateinamen ohne Hash-Konflikte)**: Der Build wird so konfiguriert, dass immer feste, konsistente Dateinamen (`assets/realplan3d.js` und `assets/realplan3d.css`) erzeugt und synchron in das HACS-Frontend-Verzeichnis geschrieben werden. Zusätzlich erhält die `index.html` einen dunklen Inline-Hintergrund (`#090d16`) und `realplan3d-panel.js` prüft vor dem Laden, ob das JS-Bundle erreichbar ist (inkl. automatischem Fallback und Cache-Busting).
- **Entscheidung 2 (Räumliche Trennung mehrerer Garagen & Nebengebäude)**: Zwei Garagen oder Nebengebäude werden nur noch dann zu einem gemeinsamen Gebäude-Grundriss zusammengefasst, wenn sie sich räumlich berühren oder überlappen. Freistehende zweite Garagen erhalten automatisch ein eigenes Dach und eigene Außenwände.
- **Entscheidung 3 (Live-3D-Ansicht ohne Szenen-Rebuilds bei Statuswechseln)**: Das Schalten von Lichtern, Toren, Schaltern oder Sensoren in der Live-3D-Ansicht aktualisiert nur noch die betroffenen 3D-Lichter und Objekt-Animationen im Render-Loop, ohne die gesamte Hausgeometrie neu aufzubauen.

---

## 1. Overview & Core Concept

- **What It Does**:
  1. **Behebung der weißen Seite (HACS & Web-App)**: Synchronisiert das gebaute Frontend-Bundle im Home-Assistant-Ordner mit deterministischen Asset-Pfaden, verhindert Browser-Cache-Konflikte nach Updates und ergänzt eine automatische Bundle-Prüfung mit Selbstheilungs-Fallback.
  2. **Unabhängige zweite Garage / Nebengebäude**: Erkennt räumlich getrennte Garagen und Nebengebäude als separate Gebäude-Cluster, sodass jede Garage ihr eigenes Dach und eigene Wände erhält.
  3. **Flüssige Live-3D-Performance**: Entkoppelt Live-Entitäts-Updates vom 3D-Architektur-Rebuild, beschleunigt schwebende Raum-Pills beim Kamera-Schwenken per direktem DOM-Transform und bündelt Glasbaustein-Fenster über GPU-Instancing (`InstancedMesh`).
- **Target Audience / Persona**: Smart-Home-Nutzer, die RealPlan 3D in Home Assistant (über HACS) und im Browser mit mehreren Nebengebäuden und Live-Geräten flüssig nutzen möchten.
- **Key Value**: Sofort wieder funktionierende Anzeige ohne weiße Seite nach Updates, korrekte Darstellung mehrerer Garagen und spürbar höhere Bildrate (FPS) in der Live-3D-Ansicht.

---

## 2. User Experience & Visual Design

- **Key User Flows**:
  1. **Start nach HACS-/App-Update**: Beim Öffnen von RealPlan 3D lädt sofort das dunkle Studio-Layout (`#090d16`) mit dem synchronisierten Bundle `assets/realplan3d.js` und `assets/realplan3d.css`. Sollte ein lokaler Browser-Cache veraltet sein, erzwingt ein Versions-Parameter das frische Laden; falls eine lokale Asset-Datei fehlt, greift automatisch der Live-Studio-Fallback.
  2. **Zweite Garage hinzufügen & verschieben**: Beim Klick auf `+ Nebengebäude / Garage` wird automatisch eine eigene Gebäude-ID (`outbuilding_garage_2` etc.) und eine versetzte Startposition vergeben. Auch wenn zwei Garagen dieselbe Gebäude-Kategorie teilen, bleiben ihre Dächer getrennt, solange sie sich nicht direkt berühren.
  3. **Live-3D-Bedienung & Kamera-Schwenk**: Beim Drehen der 3D-Kamera oder im Kamera-Idle-Modus gleiten alle Raum-Header ohne React-Re-Render-Ruckler mit 60 FPS mit; Klicks auf Lichter, Rolltore oder Fenster schalten verzögerungsfrei.
- **Visual Identity & Theme**:
  - *Aesthetic Direction*: Architektonisches Smart-Home-CAD- & 3D-Studio im dunklen Slate-Design (`#090d16` Hintergrund, `#f59e0b` Amber-Fokus, `#38bdf8` Sky-Akzente).
  - *Typography & Hierarchy*: `Plus Jakarta Sans` für UI-Bedienung und Raum-Header, `JetBrains Mono` (`tabular-nums`) für Bemaßung, Leistungswerte (Watt) und Sensordaten.
- **Interactive Feedback & Motion**:
  - Direkte `translate3d(x, y, 0)`-Positionierung der 3D-Raum-Pills im Animations-Loop ohne Layout-Thrashing.
  - Sanft gedämpfte Tür-, Fenster-, Schiebetor- und Lichtübergänge (`THREE.MathUtils.damp`).

---

## 3. Key Product Decisions & Trade-Offs

- **Decision 1: Feste Bundle-Dateinamen (`realplan3d.js` / `realplan3d.css`) statt zufälliger Vite-Hashes**
  - *Chosen Approach*: Konfiguration von `rollupOptions.output` für konsistente Asset-Dateinamen im Build plus automatische Synchronisation nach `custom_components/realplan3d/frontend/app` und Vorab-Prüfung der JS-Asset-Erreichbarkeit im Home-Assistant-Panel.
  - *Why*: Verhindert dauerhaft, dass `index.html` nach einem Update auf einen nicht mehr existierenden Hash verweist und eine weiße Seite erzeugt.
  - *Alternatives Considered*: Beibehaltung zufälliger Hashes – verworfen, da HACS-/Git-Updates und Browser-Caches von `index.html` bei Hash-Wechseln zu 404-Fehlern führen.

- **Decision 2: Nachbarschafts-Clustering (`getBuildingClusterKey`) für Dächer und Sockel**
  - *Chosen Approach*: Zwei Innenräume/Garagen gehören für die Dachberechnung nur dann zum selben Baukörper, wenn sie eine kompatible `buildingId` besitzen **und** sich auf der X- und Z-Achse berühren oder überlappen (oder über angrenzende Räume desselben Gebäudes verbunden sind).
  - *Why*: Verhindert, dass zwei räumlich getrennte Garagen zu einem riesigen Dach über den gesamten Hof zusammengespannt werden.

- **Decision 3: Entkopplung von `entities` aus dem 3D-Geometrie-Rebuild**
  - *Chosen Approach*: Entfernung von `entities`, `showClimateHeatmap` und `showPresenceAvatars` aus den Abhängigkeiten des großen Architektur-`useEffect`s; stattdessen eigene leichtgewichtige Effekte für Klima-Bodenfarben und Personen-Avatare sowie direkte Aktualisierung im Render-Tick.
  - *Why*: Spart bei jedem Schalten eines Lichts oder Sensors in der Live-3D-Ansicht den kompletten Neuaufbau aller Wände, Dächer, Pools und Möbel-Meshes.

---

## 4. Technical Architecture & Data Strategy *(Technical Reference)*

- **Architecture & Component Diagram**:

```
┌─────────────────────────────────────────────────────────────────────────┐
│             Home Assistant Panel & HACS Bundle Loader                   │
│  • Deterministische Assets: assets/realplan3d.js & realplan3d.css       │
│  • Vorab-Check + Cache-Busting + Dunkler Inline-Body (#090d16)          │
└───────────────────────────────────┬─────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                  Räumliches Gebäude-Clustering (2D & 3D)                │
│  • areZonesHorizontallyAdjacent(a, b) + BFS-Cluster-Erkennung           │
│  • Separate Garagen = separate Dächer & eigene Gebäude-Snapping-Box     │
└───────────────────────────────────┬─────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│               Hochperformante Live-3D-Engine (Three.js)                 │
│  ┌─────────────────────────┐  ┌───────────────────┐  ┌───────────────┐  │
│  │ Statischer Architektur- │  │ 60-FPS Render-Tick│  │ InstancedMesh │  │
│  │ Build (nur bei Projekt- │  │ • Lichter & Tore  │  │ • Glasbaustein│  │
│  │ oder Etagen-Änderung)   │  │ • DOM Pill-Coords │  │ • max 6 Segm. │  │
│  └─────────────────────────┘  └───────────────────┘  └───────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘
```

- **Data Model & State**:
  - `BUILDING_PRESETS` wird um zusätzliche Nebengebäude-Einträge (`outbuilding_garage_2`, `outbuilding_workshop`) erweitert.
  - `getConnectedBuildingCluster(zone, allZones)` und `getBuildingClusterKey(zone, allZones)` berechnen zusammenhängende Teilgebäude mittels Breitensuche (BFS) über horizontal angrenzende Räume.
  - Vorberechnete Maps (`zoneByIdMap`, `zoneAssetsMap`, `zoneOpeningsMap`) im 3D-Viewport ersetzen lineare Suchschleifen pro Frame durch `O(1)`-Zugriffe.
- **Interactive Component & State Mapping**:
  - **2D-Editor (`TwoDFloorplanCanvas`)**: Beim Verschieben einer Garage rastet diese nur dann an einem anderen Gebäude ein und übernimmt dessen `buildingId`, wenn sich die Kanten auf **beiden** Achsen (X und Z) tatsächlich innerhalb der Fangdistanz befinden.
  - **3D-Live-Viewport (`ThreeFloorplanViewport`)**: Aktualisiert die Bildschirmkoordinaten (`sx`, `sy`) der Raum- und Element-Badges direkt über DOM-Refs (`translate3d`), während React-State-Updates nur noch bei echten Wertänderungen (z. B. Temperatur, Wattzahl, Licht-Status) ausgelöst werden.
