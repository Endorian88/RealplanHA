# Implementierungsplan: Startfehler-Behebung, Kamera-Live-Bilder & Saugroboter-Raumnavigation

## 1. Behebung des App-Startfehlers & Stabilitäts-Härtung
Damit die Anwendung sowohl in der Vorschau als auch im Home Assistant / HACS-Panel sofort wieder zuverlässig startet, werden folgende Fehlerquellen behoben:
- **Referenz-Fixes in `EditorWorkspacePanel.tsx` & `ThreeFloorplanViewport.tsx`**:
  - Fehlenden Import von `computePowerLine3DPoints` in `src/components/EditorWorkspacePanel.tsx` ergänzen.
  - Fehlerhafte Referenz `sceneRefs.current` im Tour-Routen-Planer (`src/components/ThreeFloorplanViewport.tsx`) auf `sceneObjectsRef.current` sowie `_targetCamPos` / `_targetLookAt` korrigieren.
- **Robuste Projekt-Migration & Null-Safety beim Start (`src/App.tsx`)**:
  - Absicherung von `deduplicateProjectOpeningsAndGates` beim Laden aus `localStorage` bzw. Home Assistant `.storage`, sodass ältere oder unvollständige Einträge in `roofConfig.dormers`, `roomStatusCardConfig`, `customWalls` oder entfernten Katalog-Gauben abgefangen und sauber migriert werden.
  - Einbau eines schützenden React Error-Boundary-Wrappers in `src/main.tsx`, der bei korrupten lokalen Browser-Daten niemals einen leeren Bildschirm zeigt, sondern das Projekt automatisch repariert.
- **Dev-Server & HACS-Bundle-Synchronisierung**:
  - Kompilierung prüfen, HACS-Bundle (`custom_components/realplan3d/frontend/app/`) aktualisieren und den Entwicklungsserver sauber neu starten.

---

## 2. Reparatur der Kamera-Live-Bilder (Kamera-Popup & Live-Cockpit)
Aktuell zeigt das Kamera-Steuerungs-Popup (`EntityControlPopover.tsx`) sowie die Kamera-Ansicht im Live-Cockpit (`SmartCockpitCardsOverlay.tsx`) nur einen Platzhalter ohne Bild:
- **Echte Home Assistant Kamera-Streams & Snapshots (`entity_picture` / `/api/camera_proxy_stream/`)**:
  - Auslesen von `entity.attributes.entity_picture` und `entity.attributes.access_token`.
  - Automatische Auflösung relativer Home-Assistant-URLs (z. B. `/api/camera_proxy/camera.einfahrt?token=...`) über die verbundene Home Assistant Basis-URL bzw. im HACS-Iframe über `window.location.origin`.
  - Optionaler umschaltbarer Modus zwischen **MJPEG-Live-Stream** (`/api/camera_proxy_stream/...`) und **intervallbasiertem Live-Snapshot** (automatisches Nachladen alle 2 Sekunden ohne Flackern).
- **Visuelle Live-Kamera-Vorschau im Simulationsmodus / Fallback**:
  - Wenn noch kein echter Home Assistant Kamera-Proxy erreichbar ist (oder im Demo-/Simulationsmodus getestet wird), rendert das Kamera-Viewport eine realistische, animierte Live-Überwachungsansicht passend zur Kameraposition (Außenbereich/Einfahrt/Garten bzw. Innenraum) mit Live-Zeitstempel, Fadenkreuz-HUD, Bewegungs-Indikator und Vollbild-/Snapshot-Schaltfläche.

---

## 3. Saugroboter-Raumzuweisung & 3D-Hindernis-Umfahrung (`robot_vacuum_dock`)

### 3.1 Raum-Erkennung & Zuordnung (Home Assistant ➔ 3D-Raum)
- **Erweiterung von `PlacedAsset.vacuumConfig` (`src/types/floorplan.ts`)**:
  - `roomMappings?: Record<string, string>` (Zuordnung von HA-Raumnamen/Segment-IDs zu 3D-Raum-`zoneId`s)
  - `testTargetZoneId?: string` (Direkte Raum-Auswahl im Editor/Live-Modus zum sofortigen Testen der Fahrt im gewünschten Raum)
  - `avoidObstacles?: boolean` (Standard: `true`)
- **Intelligente Raum-Auflösung auf derselben Etage**:
  1. Wenn `testTargetZoneId` gesetzt ist, fährt der Saugroboter direkt in diesem 3D-Raum.
  2. Andernfalls wird der aktuelle Raumwert aus `vacuumRoomEntityId` (oder aus den Attributen `current_room`, `room`, `fan_speed` / Segment der Haupt-Entität `vacuum.*`) ausgelesen.
  3. Zuerst wird `roomMappings` geprüft; danach erfolgt ein **automatischer Namensabgleich** (Groß-/Kleinschreibung, Umlaute `ä/ö/ü/ß` und Teilworte wie `"Wohnzimmer"` ↔ `"Wohn- & Essbereich"`) über alle Innenräume (`zoneType === 'indoor'`) auf der Etage des Saugroboters.

### 3.2 Hindernis-Erkennung & Automatische Umfahrung im 3D-Raum
- **Sperrzonen (No-Go-Areas) innerhalb des Zielraums**:
  - **Möbel & Boden-Assets**: Alle im Raum platzierten Boden-Objekte (`mountType === 'floor'`, außer Teppichen und der eigenen Ladestation) inklusive Sicherheitsabstand (`0.26 m`).
  - **Treppen & Bodendurchbrüche**: Alle Innentreppen (`isStairAsset`) auf derselben Etage sowie alle Decken-/Bodendurchbrüche (`stairHolesByUpperLevel`) von Treppen aus dem darunterliegenden Geschoss.
  - **Freie Wände & Kniestock**: Alle freien Wandsegmente (`project.customWalls`) auf derselben Etage.
- **Kollisionsfreie Serpentine- & Wegpunkt-Navigation**:
  - Der Zielraum wird in ein 2D-Begehbarkeits-Raster (`0.25 m` Auflösung) unterteilt.
  - Der Saugroboter fährt nur über freie Bodenkacheln in gleichmäßigen Reinigungsbahnen und umfährt Möbel, Treppen und Durchbrüche geschmeidig ohne durch Objekte oder Löcher zu schweben.
