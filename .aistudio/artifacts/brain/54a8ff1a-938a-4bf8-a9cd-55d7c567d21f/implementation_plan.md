# Implementierungsplan: Tour-Routenplaner, Haustiere, Audio-Geräte, Saugroboter, Gauben-/Treppen-/Wetter-Entitäten, Dach-LED-Begrenzung & Inspektor-Aufräumaktion

## 1. Übersicht aller Erweiterungen & Optimierungen

Dieses Update erweitert **RealPlan 3D Studio** (inkl. Home Assistant HACS-Integration) um 13 präzise abgestimmte Funktionen:

1. **Kamerafahrt-Routenplaner (`Haus- & Raum-Tour`):** Eigenes Konfigurations-Popover zum Auswählen einzelner Räume per Checkbox, Ändern der Reihenfolge per Sortier-Pfeilen (`↑` / `↓`), Ein-/Ausschalten des Außen-Rundflugs und Einstellen der Verweildauer pro Raum.
2. **Steuerdock-Trennung (`Labels` vs. `3D-Cards`):** Unabhängige Steuerung von kleinen Raum-/Geräte-Textschildern (`showLabels`) und schwebenden 3D-Raum-/Callout-Cards im unteren Steuerdock (`BottomControlDock`).
3. **Ruckelfreie Kamerafahrt (Performance-Optimierung):** Entkopplung schwerer Geometrie-Rebuilds beim Wechsel zwischen Außen-Rundflug und Raum-Stationen, sanftes Casing-Crossfade und weiches Quintic-Easing mit gecachten Bounding-Boxen.
4. **3D-Haustiere & Tierzubehör:**
   - Animierte Haustiere (**Hund**, **Katze**, **Hase**) mit Posen-Auswahl (`Sitzend`, `Schlafend`, `Stehend / Wachsam`, `Spielend / Hoppelnd`), wählbarer Fellfarbe und optionalem Home Assistant Entity-Link.
   - Passende 3D-Assets: **Hundehütte (Holz)**, **Hasenstall / Kleintiergehege** und **Katzenkratzbaum**.
5. **Keller-Mauern außerhalb eines Gebäudes (`Mit / Ohne Decke`):** Option sowohl pro freistehendem Wand-Segment (`CustomWallSegment`) als auch für umschlossene Mauer-Bereiche im Kellergeschoss (`KG`), ob der Bereich nach oben offen (mit automatischem Terrain-/Gras-Ausschnitt wie bei der Außentreppe) oder mit geschlossener Kellerdecke dargestellt wird.
6. **Inspektor-Aufräumaktion (`Gebäude` vs. `Raum`):**
   - **Raum (`room`):** Entfernen von eigenem Dach-Konfigurator und Gebäude-Kellersockelhöhe (wird zentral über das Gebäude gesteuert).
   - **Gebäude (`wohnraum_building` / `outbuilding`):** Entfernen von Raum-Wand-Designer, Decken-LED-Lichtvoute und Innenraum-Bodenmaterial (wird gezielt in den einzelnen Räumen konfiguriert).
7. **Neue 3D-Audio-Geräte (`media_player.*`):**
   - **HiFi-Stereoanlage & Standlautsprecher (`audio_hifi_stereo_system`)**, **Smart Speaker / Echo Device (`audio_echo_smart_speaker`)** mit 360°-Status-LED-Ring und **Heimkino-Soundbar & Subwoofer (`audio_soundbar_sub`)**.
8. **Fernseher ohne Bild ohne aktive Entität:**
   - Alle 3D-Fernseher (`smart_tv_wall`, `wall_tv_oled_77` sowie Wandplaner mit TV-Screen) bleiben **schwarz/ausgeschaltet** (ohne Fake-Bild und ohne Ambilight), solange keine Home Assistant Entität verknüpft ist oder die Entität `off` / `unavailable` / `standby` ist.
9. **Animierter Staubsauger-Roboter (`robot_vacuum_dock`) mit Raum-Entität:**
   - Sobald der Saugroboter aktiv ist, fährt er animiert in S-Bahnen durch den Raum. Über die neue **Raum-Entität (`roomSensorEntityId`)** erkennt er automatisch den angesagten Raum im 3D-Grundriss, fährt dort seine Reinigungsbahnen ab und kehrt bei `docked` / `off` in seine Ladestation zurück.
10. **Gaubenelemente (Gaubenfenster & Gauben-Rollos) mit Entitäten verknüpfen:**
    - Sowohl für **Dachgauben im Gebäude-Dachkonfigurator** als auch für **frei platzierte Gauben- & Dachfenster-Assets** (`roof_dormer_*`, `roof_skylight_*`) können im Inspektor für jedes Fenster und jedes Rollo direkt Home Assistant Entitäten (`binary_sensor.*`, `sensor.*`, `cover.*`) ausgewählt werden.
11. **Sichtbare 3D-Treppenbeleuchtung bei verknüpfter Licht-Entität:**
    - Alle Treppen-Arten (inkl. Spindeltreppe, Podesttreppe und Keller-Außentreppe) erhalten sichtbare 3D-Stufen-LED-Leisten + Lichtschein, die sofort aufleuchten, sobald eine Licht-Entität verknüpft und eingeschaltet ist.
12. **[NEU] Live-Wetter Entität (`weather.*`) direkt einstellbar machen:**
    - Direkt im **Steuerdock (`BottomControlDock`) neben der Wetter-Auswahl (`Sonne/Auto | Regen | Schnee`)** sowie im **Cockpit-/3D-Cards-Menü** wird ein Auswahl-Popover **„🌦️ Live-Wetter Entität (`weather.*`)“** ergänzt.
    - Dort kann jede Home Assistant Wetter-Entität (z. B. `weather.forecast_home`, `weather.openweathermap` oder ein Außensensor) ausgewählt werden, inklusive Live-Anzeige des aktuellen Zustands (Sonnig, Regen, Schnee, Bewölkt & Außentemperatur).
13. **[NEU] Decken-LED-Streifen (`1. OG` / `DG`) strikt innerhalb von Mauern, Dachschrägen & Giebeln halten + Höhere Farbintensität:**
    - **Kein Durchscheinen durch Mauern, Dach oder Giebel:** Umlaufende Decken-Lichtvouten (`ceilingLedConfig`) und platzierte LED-Streifen (`led_strip_*`) werden im `1. OG` und `DG` automatisch an die reale **Dachunterseite (`clipCeilingRectangleToRoof` & `evaluateRoofUndersideHeight`)** sowie die **Innenkanten der Raum- und Giebelwände** geclippt. Der Wandabstand (`insetFromWall`) wird nach außen hin sicher begrenzt (mindestens innerhalb der Wandstärke + Sicherheitspuffer), sodass LED-Leisten und Lichtpunkte niemals durch Dachziegel, Dachschrägen oder Giebelmauern nach außen ragen oder durchleuchten.
    - **Kräftigere Farben & höhere Leuchtintensität:** Die Sättigung (Chroma-Boost), die Emissive-Leuchtkraft (`emissiveIntensity`) der LED-Leisten sowie die Raum-Farbausleuchtung (`PointLight`-Intensität & Wand-/Boden-Farbtönung) werden deutlich verstärkt, sodass RGB- und Warmweiß-Farben satt und leuchtstark wirken.

---

## 2. Detaillierte Architektur & Umsetzung

### A. Kamerafahrt-Routenplaner (`Haus- & Raum-Tour`)
- **Datenmodell (`/src/types/floorplan.ts`):**
  - Neues Interface `HouseTourConfig`:
    ```ts
    export interface HouseTourConfig {
      includeOverviewOrbit?: boolean; // Standard: true
      roomStopIds?: string[];         // Geordnete Liste der aktiven Raum-IDs (FloorplanZone.id)
      stopDurationSec?: number;       // Verweildauer pro Raum in Sekunden (Standard: 6.5)
      orbitDurationSec?: number;      // Dauer des Außen-Rundflugs (Standard: 11)
    }
    ```
  - Erweiterung von `FloorplanProjectConfig` um `houseTourConfig?: HouseTourConfig`.
- **UI & Tour-Menü (`/src/components/ThreeFloorplanViewport.tsx`):**
  - Neben dem `Haus- & Raum-Tour`-Button oben rechts (und im Steuerdock) öffnet ein Zahnrad-Button (`⚙ Tour-Route`) das Routen-Menü mit Checkboxen pro Raum, Sortier-Pfeilen (`↑` / `↓`), Schalter für den Außen-Rundflug und Slider für die Verweildauer pro Zimmer.

### B. Steuerdock-Trennung (`Labels` vs. `3D-Cards`)
- **Steuerdock (`/src/components/BottomControlDock.tsx` & `/src/components/ThreeFloorplanViewport.tsx`):**
  - **`Labels`**: Schaltet ausschließlich die kompakten Raum- und Geräte-Textschilder (`showLabels`) ein/aus.
  - **`3D-Cards`**: Eigener Schnellschalter im unteren Steuerdock, mit dem schwebende 3D-Raum-Cards und Geräte-Callout-Cards unabhängig von `showLabels` im **Smart-Zoom**, **Immer an** oder **Ausgeblendet** betrieben werden können.

### C. Kamerafahrt-Optimierung (Ruckler eliminieren)
- **Ursachenbehebung in `/src/components/ThreeFloorplanViewport.tsx`:**
  - Während `isHouseTourActive` aktiv ist, triggert der Wechsel auf einen Raum-Stopp keinen synchronen Geometrie-Rebuild (`rebuildThreeScene`) mehr.
  - Der Render-Loop (`tick`) blendet Gebäudehülle und Dach bei Raum-Stopps weich aus und nutzt gecachte Raum-Zentren mit Quintic-InOut-Kameraführung.

### D. 3D-Haustiere & Tierzubehör
- **Datenmodell (`/src/types/floorplan.ts` & `/src/data/catalogAndInitialState.ts`):**
  - Neue Asset-Typen (`PlacedAssetType`): `'pet_dog'`, `'pet_cat'`, `'pet_rabbit'`, `'pet_dog_house'`, `'pet_rabbit_hutch'`, `'pet_cat_tree'`.
  - Neues Konfigurations-Objekt `petConfig` (`pose`, `coatColor`, `secondaryColor`, `collarColor`, `animated`, `petName`).
- **3D-Geometrie & Live-Animation (`/src/three/assetBuilder.ts`):**
  - Detaillierte 3D-Modelle für Hund, Katze und Hase mit gelenkigen Gruppen (`headGroup`, `tailGroup`, `earsGroup`, `bodyGroup`) sowie Hundehütte, zweistöckigem Hasenstall mit Freilauf und Katzenkratzbaum.
  - Sanfte Echtzeit-Animation im Render-Loop + optionaler Posenwechsel über Home Assistant Entität.

### E. Freistehende Keller-Mauern außerhalb eines Gebäudes (`Mit / Ohne Decke`)
- **Datenmodell (`/src/types/floorplan.ts`):**
  - `CustomWallSegment`: Neues Feld `openCeiling?: boolean`.
  - `FloorplanZone`: Neues Feld `openCeiling?: boolean`.
- **3D-Engine (`/src/components/ThreeFloorplanViewport.tsx`):**
  - Für freistehende Keller-Mauern (`customWalls`) und umschlossene Mauer-Polygone im `KG` außerhalb eines Hauptgebäudes wird bei **Ohne Decke (`openCeiling: true`)** automatisch ein passgenauer Geländeausschnitt (Terrain Cutout) im Rasen/Boden erzeugt; bei **Mit Decke (`openCeiling: false`)** wird eine geschlossene Kellerdecke gebaut.

### F. Inspektor-Aufräumaktion (`Gebäude` vs. `Raum`)
- **In `/src/components/EditorWorkspacePanel.tsx`:**
  - **Raum (`zone.kind === 'room'`):** Entfernen von eigenem Dach-Konfigurator und Gebäude-Kellersockelhöhe; stattdessen Direkt-Button **„Zugehöriges Gebäude auswählen“**.
  - **Gebäude (`zone.kind === 'wohnraum_building' || zone.kind === 'outbuilding'`):** Entfernen von Raum-Wand-Designer, Decken-LED-Lichtvoute und Innenraum-Bodenmaterial.

### G. Neue 3D-Audio-Geräte (`audio_hifi_stereo_system`, `audio_echo_smart_speaker`, `audio_soundbar_sub`)
- **Katalog & 3D-Geometrie (`/src/types/floorplan.ts`, `/src/data/catalogAndInitialState.ts`, `/src/three/assetBuilder.ts`):**
  - **`audio_hifi_stereo_system`**: HiFi-Verstärker mit beleuchtetem Spektrum-/VU-Display und zwei 3-Wege-Standlautsprechern.
  - **`audio_echo_smart_speaker`**: Smart Speaker (Echo-Stil) mit 360°-Status-LED-Leuchtring, der bei `playing`/`on` leuchtend Cyan/Blau pulsiert.
  - **`audio_soundbar_sub`**: Dolby-Atmos-Soundbar mit Status-LED und Subwoofer.

### H. Fernseher ohne Bild ohne aktive Entität
- **Anpassung in `/src/three/assetBuilder.ts` (`smart_tv_wall`, `wall_tv_oled_77`, `wall_planner_module`):**
  - Standardmäßig ist das TV-Panel **komplett ausgeschaltet** (dunkles Anthrazit/Schwarz ohne Textur, `emissiveIntensity: 0`, `ambilightPlane.visible = false`).
  - Erst wenn in `updateAssetVisualState` eine verknüpfte Home Assistant Entität aktiv ist (`playing`, `on`, `paused`, `buffering`), schaltet sich das Display (mit echtem `media_title` / `friendly_name`) samt Ambilight ein.

### I. Animierter Staubsauger-Roboter (`robot_vacuum_dock`) mit Raum-Entität
- **Datenmodell & 3D-Pfad-Animation (`/src/types/floorplan.ts`, `/src/three/assetBuilder.ts`, `/src/components/ThreeFloorplanViewport.tsx`):**
  - Neues `vacuumConfig?: { roomSensorEntityId?: string; animateCleaning?: boolean; cleaningSpeed?: number }` auf `PlacedAsset`.
  - Wenn der Saugroboter reinigt (`cleaning`, `on`, `moving`), fährt `botMover` in S-Bahnen durch den Raum.
  - Ist `roomSensorEntityId` gesetzt (z. B. `sensor.roborock_aktueller_raum` = `"Küche"`), wird das passende Zimmer (`FloorplanZone`) im 3D-Grundriss ermittelt und der Saugroboter fährt live in diesem Raum seine Reinigungsbahnen ab. Bei `docked` / `off` kehrt er auf die Ladestation zurück.

### J. Gaubenelemente (Gaubenfenster & Gauben-Rollos) mit Entitäten verknüpfen
- **3D-Engine & Inspektor (`/src/three/assetBuilder.ts`, `/src/components/ThreeFloorplanViewport.tsx`, `/src/components/EditorWorkspacePanel.tsx`):**
  - Übergabe von `entityId` und `shutterEntityId` an `buildDormerWindowAssembly` in `buildZoneRoofGroup` und Live-Update über `updateDormerDynamicUnits` im Render-Loop.
  - Vollständige Home Assistant Entitäts-Auswahl (mit Suchfeld für `binary_sensor.*`, `sensor.*`, `cover.*`) für jedes Gaubenfenster und jedes Gauben-Rollo sowohl im Gebäude-Dachkonfigurator als auch bei frei platzierten Gauben- und Dachfenster-Assets (`roof_dormer_*`, `roof_skylight_*`).

### K. Sichtbare 3D-Treppenbeleuchtung bei verknüpfter Licht-Entität
- **3D-Geometrie & Inspektor (`/src/three/assetBuilder.ts`, `/src/components/ThreeFloorplanViewport.tsx`, `/src/components/EditorWorkspacePanel.tsx`):**
  - Alle Treppenformen (inkl. Spindeltreppe, Podesttreppe und Keller-Außentreppe) erhalten 3D-Stufen-LED-Leisten (`stairLedMat`) unter den Stufen, die automatisch aktiv sind und live mit Farbe/Helligkeit leuchten, sobald eine Licht-Entität (`entityId` oder `stairConfig.ledEntityId`) verknüpft und eingeschaltet ist.

### L. Live-Wetter Entität (`weatherEntityId`) einstellbar machen
- **Steuerdock & Cockpit-Menü (`/src/components/BottomControlDock.tsx`, `/src/components/ThreeFloorplanViewport.tsx`, `/src/components/EditorWorkspacePanel.tsx`):**
  - Direkt beim Live-Wetter-Umschalter (`Sonne/Auto | Regen | Schnee`) im unteren Steuerdock sowie im `🎛️ 3D-Cards`-Menü oben rechts wird ein Einstell-Button (`⚙ Wetter-Entität`) integriert.
  - Darüber kann der Nutzer seine Home Assistant Wetter-Entität (`weather.*` oder Außentemperatur-/Regensensor) direkt mit Suchfilter auswählen. Im Modus `Sonne/Auto` steuert diese Entität automatisch Regen, Schneefall (inkl. Schneedecke auf Dach & Rasen) und Bewölkung in Echtzeit.

### M. Decken-LED-Streifen (`1. OG` / `DG`) strikt innerhalb von Mauern, Dach & Giebel halten + Kräftigere Farbintensität
- **Geometrie- & Dach-Clipping (`/src/components/ThreeFloorplanViewport.tsx` & `/src/components/EditorWorkspacePanel.tsx`):**
  - **Wand- & Giebel-Sicherheitsabstand:** Der Wandabstand (`insetFromWall`) für Decken-Lichtvouten (`ceilingLedConfig`) wird im Slider und im 3D-Builder auf mindestens `0.18 m` (innerhalb der 14 cm starken Mauer + 4 cm Sicherheitsabstand zur Innenwand) bis `0.60 m` begrenzt, damit niemand den Streifen versehentlich in oder durch eine Außenmauer oder Giebelwand schieben kann.
  - **Exaktes Clipping an Dachschrägen (`1. OG` & `DG`):**
    - Statt die Höhe der Decken-LEDs nur in der Raummitte (`effBounds.x, effBounds.z`) zu prüfen, wird das Decken-LED-Rechteck im `1. OG` und `DG` über `clipCeilingRectangleToRoof` und punktgenaue Abfragen von `getRoofMaxWallHeightAt(x, z, zoneLevel, h)` an den tatsächlichen Verlauf der Dachschräge und des Giebels angepasst.
    - Zusätzlich wird jede der 4 LED-Leisten (Nord, Süd, West, Ost) mindestens `14 cm` unterhalb der jeweiligen Dachunterseite an genau dieser Wandposition platziert und seitlich eingerückt, sodass kein LED-Streifen und kein Lichtpunkt jemals durch das Dach oder den Giebel nach außen ragt.
    - Auch frei platzierte `led_strip_*`-Assets werden automatisch innerhalb der Raum-Innenmaße und unterhalb der Dachschräge geclippt.
  - **Deutlich höhere Farb- & Leuchtintensität:**
    - Für alle Decken-Lichtvouten (`ceilingCoveMeshes`) und LED-Streifen (`led_strip_*`) wird ein automatischer **Chroma-/Sättigungs-Boost** angewandt, die `emissiveIntensity` auf bis zu `3.2` erhöht, die `PointLight`-Reichweite/Intensität im Raum verstärkt (mit Strikt-Clipping innerhalb des Raums, damit kein Licht durch die Decke/Dachhaut nach außen blutet) und die Farb-Reflektion auf den Zimmerwänden und dem Boden um ~60 % kräftiger dargestellt.

---

## 3. Dokumentation & Home Assistant HACS-Paket
- **Erweiterung der `/README.md`** um alle neuen Funktionen und Konfigurations-Anleitungen.
- **HACS-Build & Synchronisation:** Ausführen von `npm run build` und Kopieren nach `custom_components/realplan3d/frontend/app/`.
