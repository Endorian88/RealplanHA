# Implementierungsplan: RealPlan 3D – Architektur-, Steuerungs- & Dach/Treppen-Update

## 1. Zielsetzung & Überblick

Basierend auf deinem Feedback, dem Screenshot und deinen Antworten erweitern und präzisieren wir **RealPlan 3D** um sieben zentrale Architektur- und Bedienfunktionen:

1. **Standard-Tastenkürzel & intuitive Maussteuerung (2D & 3D)**: Kopieren (`Strg+C`), Einfügen (`Strg+V`), Duplizieren (`Strg+D`), Löschen (`Entf` / `Backspace`), Drehen (`R`) und Abbrechen/Abwählen (`Esc`) für Räume, Wände, Wandöffnungen und 3D-Objekte sowie präzise Maustasten-Steuerung (Links: Auswählen/Verschieben, Rechts/Mittelklick: Kamera schwenken/Pan, Mausrad: Zoom zum Mauszeiger).
2. **Elektrisches Einfahrts-Schiebetor (`sliding_gate`) & Straßenlaternen (`street_lamp_*`)**: Direkt im Katalog unter *Türen, Fenster & Tore* sowie *Straße, Einfahrt & Zaun* platzierbares elektrisches Einfahrts-Schiebetor mit Führungsschiene, Antriebssäule, Warnleuchte und echter 3D-Schiebe-Kinematik (`cover.*`) sowie moderne und klassische Straßenlaternen mit warmem 3D-Lichtkegel.
3. **Glasbausteine (`Glasbausteine`) für Nebengebäude & Haus**:
   - **Als einsetzbares Wand-Element (wie Fenster)**: Neues Öffnungselement `glass_block_window` (*Glasbaustein-Wandfeld / Retro-Glasbausteine*) mit charakteristischem Raster, Fugenkreuz und transluzenter Lichtbrechung in 2D und 3D.
   - **Als Wand-Material im Wand-Designer**: Neues Wandmaterial `glass_block` (*Glasbausteine*), mit dem ganze Wandseiten oder Einzelwände als lichtdurchlässige Glasbausteinwand gestaltet werden können.
4. **Exakter 1. OG Wand-Zuschnitt unter Schrägdächern (Kein Dach-Clipping mehr)**: Behebung der im Screenshot sichtbaren treppenförmigen Wand-Ecken, die im 1. OG durch das Schrägdach ragen. Statt grober rechteckiger Stufenblöcke werden Wände unter dem Dach entlang ihrer Schräge und über ihre gesamte Wandstärke exakt unterhalb der Dachhaut (`ExtrudeGeometry`-Trapezprofil mit Sicherheitsabstand zur Dachunterseite) abgeschrägt.
5. **Geschossübergreifende Treppenhäuser (3D-Treppenauge & 2D-Vorschau)**:
   - **Automatische 3D-Deckenöffnung (Treppenauge)**: Innentreppen im darunterliegenden Geschoss (z. B. EG) schneiden automatisch eine passende Öffnung in die Geschossdecke/Bodenplatte des darüberliegenden Geschosses (z. B. 1. OG) inklusive absturzsicherer 3D-Brüstung am Deckenrand.
   - **2D-Vorschau im Geschoss darüber**: Im 2D-Planer des oberen Geschosses wird der Grundriss der von unten kommenden Treppe als gestrichelte 2D-Projektion („Treppe aus EG ↓“) angezeigt, damit Flure, Türen und Wände im OG passgenau geplant werden können.
6. **Kamera-Idle-Modus (Langsame 3D-Kamerafahrt)**: Sanfte, kontinuierliche 360°-Kamerafahrt um das Gebäude im 3D-Modus – direkt per Play/Pause-Button im unteren Dock startbar sowie optional automatisch nach kurzer Inaktivität (stoppt sofort bei Mausklick, Mausrad oder Tastatureingabe).
7. **Interaktiver Nordstern (`Nordstern` / Kompassrose)**: Sichtbarer und einstellbarer Nordstern (`0°–360°`) in der 2D-Planung und 3D-Ansicht zur Ausrichtung des Hauses nach Norden, gekoppelt an die 3D-Sonnenbahn (`sun.sun` / Ost → Süd → West).

---

## 2. Geplante Umsetzung im Detail

### A. Tastenkürzel (`Strg+C`, `Strg+V`, `Strg+D`, `R`, `Entf`) & Maussteuerung
- **Zwischenablage (Clipboard) für alle Elementtypen**:
  - Unterstützung für ausgewählte **3D-Objekte/Möbel/Tore/Treppen**, **Räume/Zonen**, **Einzelwände (`customWalls`)** und **Wandöffnungen (`openings`)**.
  - `Strg+C` / `Cmd+C`: Speichert das aktuell markierte Element im internen Clipboard.
  - `Strg+V` / `Cmd+V` & `Strg+D` / `Cmd+D`: Fügt eine Kopie mit leichtem Versatz (`+0.40 m`) auf der aktiven Etage (bzw. auf derselben Wand bei Wandöffnungen) ein und wählt das neue Element sofort aus.
  - `R`: Dreht das ausgewählte Objekt oder den Raum um `45°` (mit `Shift+R` um `90°`).
  - `Entf` / `Backspace`: Löscht das ausgewählte Element (sofern kein Texteingabefeld fokussiert ist).
  - `Esc`: Hebt die aktuelle Auswahl auf bzw. beendet das aktive Zeichenwerkzeug.
- **Maussteuerung in 2D & 3D**:
  - **2D-Canvas**: Linksklick zum Auswählen/Verschieben/Zeichnen, Rechtsklick-Ziehen oder Mittelklick-Ziehen (sowie `Leertaste + Linksklick`) zum flüssigen Schwenken der 2D-Arbeitsfläche, Mausrad zum Zoomen direkt auf die Mausposition.
  - **3D-Viewport**: Linksklick auf Objekt/Tür/Tor zum Auswählen oder Schalten, Linksklick-Ziehen auf freier Fläche für Kamera-Orbit, Rechtsklick-/Mittelklick-Ziehen für Kamera-Pan, Mausrad für sanften Zoom.

### B. Elektrisches Einfahrts-Schiebetor, Straßenlaternen & Glasbausteine
- **Elektrisches Einfahrts-Schiebetor**:
  - Sowohl als frei platzierbares 3D-Tor (`gate_driveway_sliding` – *Elektrisches Einfahrts-Schiebetor 4,5 m*) im Katalog *Straße, Einfahrt & Zaun* als auch als direkt in Zäune/Hofmauern einsetzbares Tor (`sliding_gate`) verfügbar.
  - Detailliertes 3D-Modell mit anthrazitfarbenem Stahlrahmen, Laufschiene am Boden, Motor-/Antriebssäule, gelber LED-Warnblink-Kappe und sanfter horizontaler Auf-/Zu-Animation per Klick oder Home Assistant `cover.*`-Entität.
- **Straßenlaternen**:
  - `street_lamp_modern` (*Straßenlaterne Modern LED, 4,5 m Mast mit gebogenem Ausleger*) und `street_lamp_classic` (*Klassische Gusseisen-Straßenlaterne mit Laternenkopf*) prominent in den Kategorien *Straße, Einfahrt & Zaun* sowie *Beleuchtung* platziert.
  - Inklusive volumetrischem Warmweiß-Lichtkegel am Boden bei Dämmerung/Nacht und 2D-CAD-Symbol.
- **Glasbausteine (Doppelfunktion)**:
  - **Wand-Öffnung (`glass_block_window`)**: Im Bereich *Türen, Fenster & Tore* als einsetzbares Wand-Element wählbar. Erzeugt in der Wand ein mehrreihiges Glasbaustein-Raster mit weißen Mörtelfugen und lichtdurchlässigen, leicht gewellten Glasblöcken (`MeshPhysicalMaterial` mit Transmission/Brechung).
  - **Wand-Material (`glass_block`)**: Im Wand-Designer als Oberflächen-/Wandmaterial wählbar, inklusive prozeduraler Glasbaustein-Textur und Bump-Map für Nebengebäude, Werkstätten oder Treppenhäuser.

### C. Fix: 1. OG Wände ohne Dach-Clipping (`ThreeFloorplanViewport.tsx`)
- **Ursache des bisherigen Clippings**: Bisher wurden Wände unter einem mehrgeschossigen Schrägdach in 14 rechteckige `BoxGeometry`-Stufen unterteilt und die Dachhöhe nur in der Segmentmitte mit `0.02 m` Abstand abgefragt. Dadurch ragten die oberen Außenecken jeder Stufe sowie die äußere Wandkante (`± Wandstärke/2`) durch die geneigte Dachfläche.
- **Neue Geometrie-Lösung**:
  - Abfrage der exakten Dachunterkante (`getRoofMaxWallHeightAt`) an **beiden Endpunkten** jedes Wandabschnitts (`s0`, `s1`) sowie über **beide Wandseiten** (`± wallThick / 2`) unter Verwendung des tatsächlichen Minimalwerts plus `0.08 m` Sicherheitsabstand unter die Dachziegelschicht.
  - Statt treppenförmiger Rechteck-Blöcke wird jedes Wandsegment unter einer Dachschräge als präzises **schräg angeschnittenes Trapez-/Polygon-Prisma (`THREE.ExtrudeGeometry`)** konstruiert, dessen Oberkante exakt parallel unterhalb der Dachneigung verläuft.
  - Auch Fenster-, Tür- und Glasbaustein-Stürze sowie Seitenwangen im 1. OG werden an diese schräge Dachkontur geklippt.

### D. Geschossübergreifende Treppenhäuser (3D-Deckenöffnung & 2D-Vorschau)
- **Automatische 3D-Deckenöffnung (Treppenauge)**:
  - Beim Erzeugen der Raum-Bodenplatten auf Etage `L` (z. B. 1. OG, `level > 0`) werden alle Innentreppen (`staircase_straight_wood`, `staircase_quarter_turn_wood`, `staircase_spiral_steel`, `staircase_concrete_modern`) auf Etage `L - 1` (z. B. EG) ermittelt.
  - Deren orientierte 2D-Grundfläche (`width × depth` inkl. Rotation) wird – genau wie Pools im Außenbereich – per `subtractRect2D` und `shape.holes` aus der Bodenplatte und der darunterliegenden Deckenunterseite des oberen Geschosses ausgeschnitten.
  - Zusätzlich wird am Rand des Treppenauges auf der oberen Etage automatisch ein dezenter 3D-Deckenrahmen mit absturzsicherem Geländer an den offenen Seiten erzeugt.
- **2D-Vorschau im Geschoss darüber (`TwoDFloorplanCanvas.tsx`)**:
  - Wenn der Nutzer im 2D-Planer z. B. das `1. OG` bearbeitet, werden Innentreppen aus dem darunterliegenden Geschoss (`EG`) als halbtransparente, gestrichelte CAD-Vorschau mit Laufrichtungspfeil und Beschriftung `Treppe aus EG (Treppenauge)` eingezeichnet.

### E. Kamera-Idle-Modus & Nordstern (`Nordstern`)
- **Kamera-Idle-Modus**:
  - Neuer Button **„Kamerafahrt (Idle)“** im unteren Steuerungs-Dock (`BottomControlDock.tsx`) sowie ein optionaler Auto-Start-Schalter (startet nach 30 s ohne Eingabe).
  - Im aktiven Idle-Modus rotiert die 3D-Kamera butterweich (`0.12 rad/s`) in leicht erhöhtem Winkel um das Grundstückszentrum und pausiert sofort bei jeder Maus- oder Tastaturinteraktion.
- **Nordstern & Sonnenbahn-Kopplung**:
  - Neues Feld `northAngle: number` (`0°–360°`) in `FloorplanState`.
  - Interaktive **Nordstern-Kompassrose** oben rechts im 2D- und 3D-Viewport: Klick auf den Nordstern dreht in `45°`-Schritten (oder stufenlos per Regler im Header/Wetter-Pop-over), sodass das Haus exakt nach Norden ausgerichtet werden kann.
  - Die 3D-Sonnenberechnung (`sunHour`) rotiert ihren Azimut (Ost = Sonnenaufgang, Süd = Mittagssonne, West = Sonnenuntergang) entsprechend dem eingestellten `northAngle`.

---

## 3. Betroffene Dateien

- `/src/types/floorplan.ts`: Erweiterung um `glass_block_window` (`OpeningType`), `glass_block` (`WallMaterialType`), `northAngle` (`FloorplanState`) und Idle-Kamera-Optionen.
- `/src/data/catalogAndInitialState.ts`: Katalog-Einträge und Metadaten für das elektrische Einfahrts-Schiebetor, Straßenlaternen und Glasbausteine.
- `/src/three/proceduralTextures.ts`: Prozedurale Textur und Bump-Map für `glass_block` (Glasbausteine mit Fugenraster).
- `/src/three/assetBuilder.ts`: Aufgewertete 3D-Modelle für Straßenlaternen, elektrisches Einfahrts-Schiebetor und Treppen-Metadaten.
- `/src/components/ThreeFloorplanViewport.tsx`:
  - Schräger Wand-Zuschnitt (`ExtrudeGeometry`) unter Schrägdächern ohne Dach-Clipping,
  - 3D-Glasbaustein-Wandelemente & Wandmaterial,
  - Automatische 3D-Deckenöffnung (Treppenauge) über Innentreppen,
  - Langsame 3D-Kamerafahrt (Idle-Modus) & Nordstern-gekoppelte Sonnenbahn,
  - Verbesserte 3D-Maus- und Tastatursteuerung.
- `/src/components/TwoDFloorplanCanvas.tsx`:
  - 2D-Vorschau für Treppenhäuser aus dem darunterliegenden Geschoss (`Treppenauge`),
  - 2D-Darstellung für Glasbaustein-Fenster & elektrisches Schiebetor,
  - Interaktiver Nordstern-Kompass im 2D-Planer,
  - Rechte/mittlere Maustaste zum Schwenken & Mausrad-Zoom.
- `/src/components/EditorWorkspacePanel.tsx` & `/src/components/BottomControlDock.tsx` & `/src/App.tsx`:
  - Globale Tastenkürzel (`Strg+C`, `Strg+V`, `Strg+D`, `R`, `Entf`, `Esc`),
  - Auswahl von Glasbausteinen im Wand-Designer & Öffnungs-Menü,
  - Idle-Kamerafahrt-Toggle & Nordstern-Steuerung im Dock.
