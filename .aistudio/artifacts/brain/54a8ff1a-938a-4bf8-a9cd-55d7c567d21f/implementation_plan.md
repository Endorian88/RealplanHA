# Umsetzungsplan: 3D-Steuerdock-Persistenz, Architektur-Refactoring & 3D/React-Performance-Optimierung

## 1. Überblick & Zielsetzung
Dieses Update umfasst drei eng aufeinander abgestimmte Kernbereiche:
1. **Vollständige Persistenz aller Einstellungen im 3D-Steuerdock (`BottomControlDock`)**: Sowohl lokal pro Endgerät (`localStorage`) als auch synchronisiert im Home Assistant Projekt (`project.liveCockpitConfig`), inklusive URL-Parameter-Priorität für Lovelace-Karten-Overrides.
2. **Modulares Code-Refactoring**: Entschlackung und Strukturierung von `src/App.tsx` und `src/components/ThreeFloorplanViewport.tsx` durch Auslagerung von State-Hooks, Projekt-Normalisierung, Undo/Redo-History und 3D-Hilfsmodulen.
3. **Gezielte 3D-WebGL- & React-Performance-Optimierungen**: Smart Idle Rendering (FPS-Drosselung im Ruhezustand), HUD-/Badge-Projektions-Throttling gegen unnötige React Re-Renders, Geometrie-/Material-Management mit sauberem WebGL-Disposal sowie Raycasting-Filterung auf aktive/sichtbare Etagen-Objekte.

---

## 2. Persistente Speicherung des 3D-Steuerdocks (Hybrid: Lokal + HA-Projekt)

### 2.1 Erweiterung des Datenmodells (`src/types/floorplan.ts`)
Erweiterung von `LiveCockpitConfig` um ein strukturiertes `dockPreferences`-Objekt, damit alle Einstellungen des 3D-Steuerdocks im Projekt (und damit im Home Assistant `.storage` sowie beim JSON-Export) mitgespeichert werden:
- `activeFloor`: `'all' | number` (Aktive Etage / Alle Etagen)
- `cameraPreset`: `CameraPreset` (`isometric`, `top`, `south`, `east`, `west`, `north`, `drone`, `auto_orbit`, `walkthrough`)
- `visualStyle`: `VisualStyleMode` (`realistic`, `blueprint`, `maquette`, `cyberpunk`)
- `weatherMode`: `WeatherMode` (`auto`, `clear`, `rain`, `snow`, `thunderstorm`, `windy`)
- `performanceMode`: `PerformanceMode` (`auto`, `quality`, `eco`)
- `isRealTimeClock`: `boolean` (Echtzeit-Sonnenstand vs. manuelle Uhrzeit)
- `sunHour`: `number` (Manuell gewählte Tageszeit)
- `wallCutaway`: `boolean` (Wände-Schnittansicht)
- `showFloatingBadges`: `boolean` (Raum-Status-Pillen / Badges)
- `show3DCards`: `boolean` (Interaktive 3D-Gerätekarten)
- `showSmartCockpitCards`: `boolean` (Smart-Cockpit Raum-Schaltzentralen)
- `showClimateHeatmap`: `boolean` (Klima-Heatmap)
- `showEnergyFlow`: `boolean` (Animierter Energiefluss)
- `showSensorRadii`: `boolean` (Sensor- & Kamerakegel)
- `showPresenceAvatars`: `boolean` (3D-Personen-Avatare)
- `autoIdleAfterInactivity`: `boolean` (Auto-Ruhemodus nach 60s)
- `dockCollapsed`: `boolean` (Zen-Modus / eingeklapptes Steuerdock)

### 2.2 Neuer Hook `useControlDockSettings` (`src/hooks/useControlDockSettings.ts`)
- Verwaltet sämtliche Steuerdock-Zustände zentral an einer Stelle.
- **Lade-Kaskade (Priorität)**:
  1. **URL-Query-Parameter** (z. B. `?perf=eco`, `?room=...`, `?cardType=camera_cockpit` für eingebettete Lovelace-Karten)
  2. **Lokaler Geräte-Speicher (`localStorage`)** unter `ha_floorplan_dock_settings_v1` (damit z. B. ein Wand-Tablet im `eco`-Modus oder eingeklappten Zen-Modus bleiben kann, während der Desktop-PC `quality` nutzt)
  3. **Home Assistant Projekt-Konfiguration (`project.liveCockpitConfig.dockPreferences`)** als geräteübergreifender Standardwert
- **Synchronisation**:
  - Jede Änderung im Steuerdock wird verzögerungsfrei lokal gespeichert und debounced in `project.liveCockpitConfig.dockPreferences` zurückgeschrieben, sodass sie automatisch über die bestehende HA-WebSocket-Bridge auf dem Home Assistant Server gesichert wird.

---

## 3. Code-Refactoring & Modul-Architektur

### 3.1 Projekt-Normalisierung & Migration (`src/utils/projectNormalization.ts`)
- Auslagerung von `deduplicateProjectOpeningsAndGates`, `loadInitialProject` und der Projekt-Datenmigration aus `src/App.tsx` in ein eigenständiges, leicht testbares Utility-Modul.

### 3.2 Undo/Redo-History Hook (`src/hooks/useProjectHistory.ts`)
- Kapselung der gesamten Undo-/Redo-Stack-Logik (Snapshot-Klonen, Drag-Coalescing über Zeitfenster, History-Counter, Skip-Echo bei Remote-Updates) aus `src/App.tsx` in einen dedizierten Hook `useProjectHistory`.

### 3.3 Modularisierung des 3D-Viewports (`src/three/ viewport helpers`)
Aufteilung wiederkehrender Berechnungs- und Performance-Logik aus `src/components/ThreeFloorplanViewport.tsx` in fokussierte Module:
- `src/three/projectionThrottle.ts`: Kapselt die 3D-zu-2D-Bildschirmprojektion inkl. Kamera-Matrix-Vergleich und Pixel-Delta-Schwellenwert-Prüfung (`> 1.5 px`), um unnötige React-State-Updates für Badges, Raum-Karten und Callouts zu unterbinden.
- `src/three/idleRenderController.ts`: Verwaltet den Aktivitätsstatus der 3D-Szene (aktive Kamera-Interaktion, laufende Tür-/Tor-Animationen, Energiefluss-Partikel, Wetter-Partikel, Auto-Orbit/Walkthrough) und steuert dynamisch die Ziel-Bildrate (60 FPS bei Interaktion/Animation vs. gedrosselte Idle-FPS im statischen Zustand).
- `src/three/disposalUtils.ts`: Sichere, rekursive Freigabe (`.dispose()`) von nicht mehr benötigten Three.js-Geometrien, Materialien und Texturen beim Szenen-Umbau, unter Berücksichtigung wiederverwendeter/gepoolter Basis-Geometrien.

---

## 4. Konkrete Performance-Optimierungen im Detail

1. **Smart Idle Rendering & Adaptive FPS-Steuerung (`idleRenderController.ts`)**:
   - Erkennt automatisch, ob die Szene dynamische Elemente enthält (Kamera-Bewegung, aktive Übergänge, Wetter-Niederschlag, Energiefluss-Linien, offene Kameratour).
   - Im statischen Ruhezustand wird die Render-Frequenz intelligent abgesenkt (bzw. im Eco-Modus stark gedrosselt) und bei jedem `pointerdown`, `wheel`, `OrbitControls`-Change oder Home Assistant Entity-Event verzögerungsfrei wieder auf volle Bildrate geschaltet.
2. **HUD- & Badge-Projektions-Throttling (`projectionThrottle.ts`)**:
   - Berechnet 2D-Projektionen für schwebende Raum-Pillen und 3D-Gerätekarten nur, wenn sich die Kamera-Projektionsmatrix geändert hat oder sich die zugrundeliegenden Raumpunkte/Entities geändert haben.
   - Aktualisiert React-State nur dann, wenn die projizierten Bildschirmkoordinaten um mehr als `1.5 px` abweichen oder sich Sichtbarkeits-Flags ändern.
3. **Geometrie-/Material-Management & striktes WebGL-Disposal (`disposalUtils.ts`)**:
   - Beim Neuaufbau der 3D-Architektur- und Asset-Gruppen werden verwaiste Geometrien und Materialien sauber über einen zentralen Disposal-Helper bereinigt, während gemeinsam genutzte Pool-Ressourcen (`userData.sharedPool = true`) geschützt bleiben.
4. **Raycasting-Optimierung auf sichtbare Etagen**:
   - Vorfilterung der Raycast-Ziele im 3D-Viewport auf Objekte, die sichtbar sind (`visible === true`) und zur aktuell gewählten Etage (`activeFloor`) gehören, sowie Entkopplung von hochfrequenten `pointermove`-Events durch Frame-basiertes Throttling.

---

## 5. Geplante Datei-Änderungen
- **Neu**: `src/utils/projectNormalization.ts` (Projekt-Laden, Deduplizierung, Migration)
- **Neu**: `src/hooks/useProjectHistory.ts` (Undo/Redo-History-Management)
- **Neu**: `src/hooks/useControlDockSettings.ts` (Persistente Steuerdock-Einstellungen lokal + HA-Projekt)
- **Neu**: `src/three/projectionThrottle.ts` (2D-HUD-Projektions-Cache & Schwellenwert-Prüfung)
- **Neu**: `src/three/idleRenderController.ts` (Adaptive FPS- & Idle-Render-Steuerung)
- **Neu**: `src/three/disposalUtils.ts` (WebGL-Speicherbereinigung & Ressourcen-Pooling-Schutz)
- **Update**: `src/types/floorplan.ts` (Erweiterung `LiveCockpitConfig` um `dockPreferences`)
- **Update**: `src/components/BottomControlDock.tsx` (Persistenter `collapsed`-Zen-Modus über Props/Hook)
- **Update**: `src/App.tsx` (Integration der neuen Hooks & Bereinigung redundanter State-/Migrationsblöcke)
- **Update**: `src/components/ThreeFloorplanViewport.tsx` (Einbindung von Idle-Controller, Projektions-Throttling, WebGL-Disposal und Raycast-Optimierung)
