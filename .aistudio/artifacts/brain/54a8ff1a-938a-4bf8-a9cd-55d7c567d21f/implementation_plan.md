# Implementierungsplan: 3D-Steuerdock-Persistenz, Architektur-Refactoring, 3D/Smart-Home-Erweiterungen & Bugfixes

## 1. Zielsetzung & Funktionsumfang

Dieser Plan vereint das Architektur- und Performance-Refactoring mit allen neuen 3D-, Smart-Home- und Planer-Erweiterungen sowie den gemeldeten Fehlerbehebungen:

1. **Steuerdock-Persistenz (Lokal & Home Assistant Sync)**: Alle Einstellungen aus dem unteren 3D-Steuerdock (Ansichtsmodus, aktive Etage, Kamera-Preset, Darstellungsstil, Wetter, Saison-Theme, Licht-/Tageszeit-Simulation, sämtliche Overlays sowie der Performance-Modus) werden verzögerungsfrei lokal im Browser und im Projekt-Datenmodell (`liveCockpitConfig.dockPreferences`) für den Home-Assistant-Sync gespeichert.
2. **Code-Refactoring & Modularisierung**: Entkopplung der Hauptanwendung und des 3D-Viewports durch eigene State-Hooks für das Steuerdock, eine gekapselte Projekt-Normalisierungs- und Undo/Redo-History-Schicht sowie modulare 3D-Hilfsmodule (Geometrie-/Material-Pool, Wetter-/Umgebungs-Builder, Kamera-Tour-Controller).
3. **3D- & React-Performance-Optimierungen**:
   - **Smart Idle Loop**: Automatische Drosselung der WebGL-Render-Schleife im Ruhezustand (von 60 FPS auf 10–15 FPS bzw. On-Demand bei Kamera-, Licht- oder Partikel-Ruhe).
   - **HUD- & Badge-Projektions-Throttling**: Schwellwert-Prüfung (`> 0.5 px` / `> 0.01`) vor React-State-Updates von 3D-Overlays.
   - **Geometrie-/Material-Pooling & WebGL-Disposal**: Wiederverwendung von Standard-Geometrien/Materialien und strikte Freigabe beim Etagen- oder Modellwechsel.
   - **Raycasting-Filterung**: Beschränkung von Pointer-Raycasts auf tatsächlich sichtbare und interaktive Etagen-Layer.
4. **Dachgauben-Wände & Geschossdecke (1. OG ↔ Dachgeschoss)**:
   - **Korrektur der Dachgauben-Wände**: Richtige Positionierung und Normalen-/Rotationsausrichtung der Gauben-Seiten- und Frontwände innerhalb des Gaubenkörpers statt außen auf der Dachhaut.
   - **Sichtbare Geschossdecke zwischen 1. OG und DG**: Zweischichtige Decken-/Bodenplatte zwischen 1. Obergeschoss und Dachgeschoss, die sowohl von unten (aus dem 1. OG als Zimmerdecke) als auch von oben (im DG als Fußboden) sichtbar ist und den Treppenausschnitt (`stairOpening`) präzise ausspart.
5. **Gestochen scharfe 3D-Raumkarten & Multi-Sensorik / 2-Sensor-Fenster**:
   - **Scharfe Typografie auf 3D-Cards**: Eliminierung von Subpixel-Unschärfe durch ganzzahlige Pixel-Rundung (`Math.round`) bei der 2D-Bildschirmprojektion, Verzicht auf kontinuierliche CSS-3D-Skalierung der Textcontainer, `backface-visibility: hidden` und hochauflösendes Font-Rendering.
   - **Multi-Sensor-Zeilen & 2-Sensor-Fensterstatus**: Raumkarten unterstützen beliebig viele frei hinzufügbare Sensor-Zeilen pro Raum/Entität sowie eine dedizierte 2-Sensor-Fenster-Konfiguration (Kombination aus Offen-Kontakt und Kipp-Sensor zu einem intelligenten Status-Badge: *Geschlossen*, *Gekippt*, *Offen*).
6. **Winter-Schneedecke auf Wiese & Außenflächen**: Automatische Darstellung einer geschlossenen, sanft konturierten Schneedecke auf dem gesamten Grundstücksrasen und den Außenflächen bei aktivem Wetter `Schnee` sowie automatisch beim `Weihnachts-Theme`.
7. **Benutzerdefinierte Kamera-Tour (Custom Waypoints)**: Freies Positionieren der 3D-Kamera im Viewport mit direktem Speichern als Wegpunkt (*Position speichern*) inklusive Kameraposition, Blickziel, aktiver Etage, individuellem Namen und Verweildauer sowie Sortier-, Lösch- und Abspielfunktion.
8. **Konsolidierter Dach- & PV-Planer mit Magnet-Snapping**:
   - **Menü-Konsolidierung**: Entfernung des separaten PV-Planer-Reiters aus dem rechten Seitenmenü; vollständige Bündelung der PV-Planung im integrierten Dach- & Gauben-Planer.
   - **Magnetisches Raster- & Kanten-Snapping**: 5/10-cm-Raster-Snapping kombiniert mit magnetischem Kanten- und Flucht-Snapping an bestehenden Dachfenstern, Gauben, Dachrändern und benachbarten PV-Modulen inklusive visueller Snap-Hilfslinien.
9. **2D-Schrankansicht-Fix, Punkt-für-Punkt Leitungsverlegung & Smart-Home-Licht-Entitäten**:
   - **Absturz-Fix in der 2D-Schrankansicht**: Defensive Null-/Array-Prüfung (`Array.isArray(...)` bzw. Fallback `[]` vor `.filter()`) für Schranksegmente, Böden, Türen und Innenelemente beim Bearbeiten im Schrank-Konfigurator.
   - **Freies Verlegen von Leitungen (2D & 3D)**: Interaktives Punkt-für-Punkt-Zeichnen von Elektro-, Wasser- und Heizungsleitungen auf Wänden und Böden mit umschaltbarem 90-Grad-Winkel-Snapping, Knotenpunkt-Bearbeitung und sauberer 3D-Rohr-/Kabel-Geometrie.
   - **Schaltbare Licht-Entitäten für Waschbecken mit LED-Spiegel & TV-Ambient-Light**: Freischaltung der Smart-Home-Entitätszuweisung (`entityId` / `lightEntityId`) im Eigenschaften-Inspektor für Waschbecken mit LED-Spiegel und TV-Einheiten mit Ambient-Backlight inklusive schaltbarer 3D-Lichtquelle, Helligkeits- und RGB-Farbübernahme aus Home Assistant.
   - **Sichtbares Treppenlicht ohne Wand-Leuchten (Light Bleeding)**: Korrigierte Positionierung und gerichtete Abschirmung (begrenzter Cutoff-Radius, korrekte Normalen-Distanz zur Stufen-/Wandfläche und Shadow-Bias) der Treppenbeleuchtung, sodass die Stufen klar ausgeleuchtet werden, das Licht aber nicht durch angrenzende Wände blutet.

---

## 2. Systemarchitektur & Datenfluss

```
┌────────────────────────────────────────────────────────────────────────────┐
│                        Applikations- & State-Schicht                       │
│                                                                            │
│  ┌──────────────────────────┐    ┌──────────────────────────────────────┐  │
│  │   useDockPreferences     │◄──►│   Projekt-Normalisierung & History   │  │
│  │ (Steuerdock & LocalSync) │    │  (liveCockpitConfig, Custom Tour,    │  │
│  └────────────┬─────────────┘    │   Multi-Sensor Cards, Leitungsnetz)  │  │
│               │                  └──────────────────┬───────────────────┘  │
└───────────────┼─────────────────────────────────────┼──────────────────────┘
                ▼                                     ▼
┌────────────────────────────────────────────────────────────────────────────┐
│                   2D/3D Planer- & Konfigurator-Module                      │
│                                                                            │
│  ┌──────────────────────────┐    ┌──────────────────────────────────────┐  │
│  │ Dach-, Gauben- & PV-Plan │    │ 2D-Schrank-Editor & Leitungs-Router  │  │
│  │ - Gauben-Innenwände      │    │ - Safe Array Filtering (Crash-Fix)   │  │
│  │ - 5/10cm & Kanten-Snap   │    │ - Punkt-für-Punkt + 90°-Snap Pfad    │  │
│  └────────────┬─────────────┘    └──────────────────┬───────────────────┘  │
└───────────────┼─────────────────────────────────────┼──────────────────────┘
                ▼                                     ▼
┌────────────────────────────────────────────────────────────────────────────┐
│                        Modulare 3D-Rendering-Engine                        │
│                                                                            │
│  ┌──────────────────────┐  ┌──────────────────────┐  ┌──────────────────┐  │
│  │  Smart Idle & Pool   │  │ Architektur & Natur  │  │ Smart-Home & HUD │  │
│  │ - Adaptive FPS       │  │ - 1.OG/DG Decke+Loch │  │ - Scharfe Cards  │  │
│  │ - Geo/Mat-Pooling    │  │ - Winter-Schneedecke │  │ - 2-Sensor-Fenst.│  │
│  │ - Etagen-Raycasting  │  │ - Custom Kamera-Tour │  │ - LED/TV/Treppen │  │
│  └──────────────────────┘  └──────────────────────┘  └──────────────────┘  │
└────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Detaillierte Umsetzungsschritte

### A. Steuerdock-Speicherung, Refactoring & Performance
- **Steuerdock-Persistenz**:
  - Einführung eines zentralen `DockPreferences`-Schemas innerhalb von `liveCockpitConfig`, das sämtliche Schalter des 3D-Steuerdocks umfasst.
  - Beim Start werden lokale Geräteeinstellungen mit den im Projekt gespeicherten Einstellungen zusammengeführt; Änderungen synchronisieren automatisch mit dem lokalen Speicher und dem Home-Assistant-Projektstand.
- **Modularisierung & Performance**:
  - Auslagerung der Steuerdock-State-Verwaltung und der Projekt-Normalisierung/Undo-Redo-Historie in eigenständige Hooks/Module.
  - Integration eines `IdleRenderController`: Reduziert die Render-Frequenz im 3D-Viewport automatisch, sobald keine Kamerabewegung, Animation, Niederschlagspartikel oder Benutzereingabe stattfindet, und weckt den Loop bei Interaktion sofort auf 60 FPS auf.
  - Einführung eines Geometrie-/Material-Pools und strikter `.dispose()`-Aufrufe für verworfene Meshes sowie Filterung der Raycast-Ziele auf sichtbare Etagen.

### B. Dachgauben-Wände, 1. OG/DG-Decke & Winter-Schneedecke
- **Gauben-Wände korrigieren**:
  - Neuberechnung der lokalen Transformationsmatrix für linke/rechte Gaubenwangen und die Gauben-Frontwand anhand der Dachflächen-Neigung und Gaubenbreite, sodass die Wände exakt die Gaubenöffnung umschließen und nach innen in den Dachraum laufen statt nach außen auf den Ziegeln zu sitzen.
- **Geschossdecke zwischen 1. OG und Dachgeschoss**:
  - Generierung einer beidseitig gerenderten Deckenplatte (`DoubleSide` bzw. separate Unterseiten-Decke für 1. OG und Oberseiten-Boden für DG) auf Höhe der Geschossgrenze 1. OG / DG.
  - Boolesches Ausstanzen bzw. Polygon-Ausschnitt (`Shape.holes`) für alle Treppenöffnungen, damit der Blick und Durchgang durch das Treppenauge frei bleibt.
- **Schneedecke im Winter & Weihnachts-Theme**:
  - Wenn `weatherMode === 'snow'` oder `seasonalTheme === 'christmas'` aktiv ist, erhält die Grundstückswiese sowie umliegende Bodenflächen ein realistisches, leicht glitzerndes Schnee-Material (`roughness: 0.78`, kühler Subsurface-Schimmer) inklusive sanfter Schneeränder an Wegen und Hauskanten.

### C. Scharfe 3D-Raumkarten & Multi-Sensorik / 2-Sensor-Fenster
- **Scharfe Schrift auf 3D-Cards**:
  - Umstellung der CSS-Positionierung aller projizierten 3D-Karten und Raum-Badges auf ganzzahlige Bildschirmkoordinaten (`translate3d(Math.round(x)px, Math.round(y)px, 0)`).
  - Entfernung unscharfer gebrochener `scale(...)`-Transformationen zugunsten diskreter Zoom-Stufen und `will-change: auto` im Ruhezustand.
- **Frei hinzufügbare Sensor-Zeilen & 2-Sensor-Fenster**:
  - Erweiterung der Raumkarten-Konfiguration um eine dynamische Liste zusätzlicher Sensor-Einträge (`customSensorRows`: Label, Icon, `entityId`, Einheit/Formatierung), sodass mehrere Sensoren derselben Entität oder desselben Raums frei ergänzt werden können.
  - Unterstützung für **2-Sensor-Fenster** (`primaryContactEntityId` für Offen/Geschlossen + `tiltSensorEntityId` für Gekippt): Die Raumkarte und das 3D-Fenster-Overlay werten beide Sensoren kombiniert aus und zeigen den präzisen Status (*Geschlossen*, *Gekippt*, *Offen*) farbcodiert an.

### D. Custom Kamera-Tour & Konsolidierter Dach-/PV-Planer mit Snapping
- **Benutzerdefinierte Kamera-Tour-Wegpunkte**:
  - Erweiterung der Kamera-Tour um eine eigene Wegpunkt-Verwaltung direkt im 3D-Steuerdock / Tour-Menü.
  - per Klick auf **„Aktuelle Position speichern“** werden aktuelle Kameraposition `(x, y, z)`, Blickziel `(targetX, targetY, targetZ)`, aktive Etage (`activeLevelId`) und eine einstellbare Verweildauer (Standard z. B. 4 Sek.) als benutzerdefinierter Wegpunkt gespeichert.
  - Wegpunkte lassen sich benennen, in der Reihenfolge verschieben, einzeln anspringen, löschen und als flüssige Kamera-Fahrt abspielen.
- **PV-Planer-Konsolidierung & Magnet-Snapping**:
  - Entfernung des redundanten PV-Planer-Eintrags aus der rechten Seitenleiste; direkter Zugriff auf alle PV-Werkzeuge innerhalb des Dach- & Gauben-Planers.
  - Implementierung einer zweistufigen Snap-Engine beim Platzieren und Verschieben von Dachfenstern, Gauben und PV-Modulen:
    1. **Magnetisches Grundraster** (umschaltbar 5 cm / 10 cm).
    2. **Kanten- & Flucht-Snapping** an benachbarten PV-Modulen (bündige Modulreihen mit definiertem Rahmenabstand), Dachfenstern und Dachkanten mit farbigen Snap-Indikatorlinien im Planer.

### E. 2D-Schrankansicht-Fix, Freie Leitungsverlegung & Smart-Home-Lichter
- **Crash-Fix 2D-Schrankansicht (`reading 'filter'`)**:
  - Vollständige Absicherung aller Array-Zugriffe im Schrank-Editor und bei der 2D-Schrank-Vorschau (`(cabinet.compartments ?? []).filter(...)`, `(cabinet.shelves ?? []).filter(...)`, `(cabinet.doors ?? []).filter(...)`), inklusive Normalisierung unvollständiger Bestands-Schrankobjekte beim Öffnen.
- **Punkt-für-Punkt Leitungsverlegung mit 90°-Snapping**:
  - Überarbeitung des Leitungs-Werkzeugs im 2D- und 3D-Planer: Klick-für-Klick-Pfadzeichnung für Strom-, Wasser- und Datenleitungen auf Böden und Wänden.
  - Automatisches 90-Grad-Winkel-Snapping relativ zum vorherigen Segment und zu Wandachsen (mit gedrückter Umschalttaste frei übersteuerbar), Beenden per Doppelklick oder Enter-Taste sowie nachträgliches Verschieben einzelner Stützpunkte.
- **Licht-Entitäten für Waschbecken mit LED-Spiegel, TV-Ambient-Light & Treppenlicht**:
  - Freischaltung der Licht-Entitäts-Auswahl im Eigenschaften-Panel für Waschbecken mit LED-Spiegel sowie TV-Möbel mit Ambient-Light.
  - Im 3D-Viewport reagieren der LED-Spiegel-Rahmen und das TV-Backlight live auf den Home-Assistant-Status (`on`/`off`), die Helligkeit (`brightness`) und die RGB-Farbe (`rgb_color`) mit passender Emissive-Ausleuchtung und sanftem Wand-Glow.
  - **Treppenlicht-Korrektur**: Positionierung der Stufen-Punktlichter mit leichtem Versatz vor die Setzstufen-/Wandfläche, reduziertem Lichtkegel-Radius (`distance` & `decay`) und sauberer Wand-Abschirmung, damit die Treppenstufen im Dunkeln deutlich sichtbar leuchten, ohne durch die Rückwand in Nachbarräume zu scheinen.
