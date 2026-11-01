# Einzelne Deckenspots, Objekt-Gruppierung, Wandplaner (Schalter/Steckdosen/FRITZ!) & 3D-Elektroleitungen mit Energiefluss

Dieser Plan beschreibt die Erweiterung von **RealPlan 3D** um frei gruppierbare einzelne Deckenspots, ein komplettes Elektro- und Netzwerk-Sortiment (Schalter, Steckdosen, Kombirahmen, FRITZ!Box & FRITZ!Repeater) inklusive Integration in den **2D/3D-Wandplaner** sowie **3D-Elektroleitungen mit automatischem Wand-/Erd-Routing und animiertem Live-Energiefluss** zwischen Nebengebäude (PV), Unterverteilung (UV) und Zählerschrank.

---

## User Review & Bestätigte Entscheidungen

> [!IMPORTANT]
> Alle vier Kernentscheidungen wurden im vorangegangenen Schritt abgestimmt und fließen vollständig in die Umsetzung ein:

- **Freie Objekt- & Licht-Gruppierung**: Einzelne Deckenspots (und beliebige andere Lampen/Assets) können freien Gruppen zugewiesen werden, um sie **gemeinsam zu verschieben**, **synchron in Home Assistant zu schalten/dimmen** und **Lichtparameter (Helligkeit, Radius, Lichtfarbe) mit 1 Klick auf die gesamte Gruppe zu übertragen**.
- **Elektro- & Netzwerk-Assets im Wandplaner & Katalog**:
  - *Schalter & Taster*: Lichtschalter (1-fach), Serienschalter (2-fach), Taster und Jalousie-/Rollladentaster (Auf/Ab).
  - *Steckdosen & Datendosen*: Schuko-Einzelsteckdose, Doppelsteckdose, Dreifach-Steckdosenleiste (Unterputz) sowie RJ45-LAN-Netzwerkdose.
  - *Kombinationsrahmen*: Schalter + Steckdose vertikal (untereinander) sowie horizontal (nebeneinander) im Mehrfachrahmen.
  - *Netzwerk & FRITZ!*: AVM FRITZ!Box (Wandhalterung mit Status-LEDs & Antennenrippen), FRITZ!Repeater (direkt in Wandsteckdose gesteckt mit Feldstärke-LEDs) sowie Wand-Netzwerk-Patchpanel / Switch.
- **3D-Elektroleitungen (Auto-Routing + freie Stützpunkte)**: Intelligentes orthogonales Routing zwischen Start-Gerät (z. B. PV-Wechselrichter / Dach-PV am Nebengebäude) und Ziel-Gerät (z. B. Unterverteilung `UV` oder Zählerschrank im Wohngebäude) entlang der Wände und als Erdkabel im Außenbereich – ergänzt um frei verschiebbare Zwischen-Stützpunkte (Waypoints).
- **Umschaltbare Kabel-Ansicht mit Live-Energiefluss**: Über das untere 3D-Steuerdock und den Editor jederzeit ein-/ausblendbarer Layer (`⚡ Leitungen & Energiefluss`) mit animierten, richtungsabhängigen Lichtimpulsen und Live-Watt-Anzeige aus Home Assistant.

---

## 1. Überblick & Kernfunktionen

### A. Einzelne Deckenspots & Freie Objekt-Gruppierung
- **Neue Deckenspot-Modelle im Katalog**:
  - **Einzel-Deckenspot (Einbauspot Rund / Tiefstrahler)**: Kompaktes, flaches Alu-Downlight (`Ø 9 cm`) mit eigenem 3D-Lichtkegel, Boden-Lichtpool und einstellbarer Helligkeit/Lichtfarbe.
  - **Doppel-Deckenspot (Kardanischer 2-fach Einbaurahmen)**: Rechteckiger Designer-Deckenrahmen mit zwei schwenkbaren Spot-Einsätzen.
- **Freier Gruppen-Manager im Inspektor**:
  - Jedes platzierte Objekt kann einer bestehenden Gruppe zugeordnet werden oder per 1-Klick eine neue Gruppe gründen (z. B. *„Spots Küche Decke“*, *„Spots Wohnzimmer“*, *„Steckdosen Arbeitsfläche“*).
  - **Synchrones Verschieben**: Ist der Schalter *„Gruppe gemeinsam bewegen“* aktiv, verschieben sich beim Ziehen eines Gruppenmitglieds im 2D-Planer oder 3D-Editor alle Objekte der Gruppe relativ im selben Abstand mit.
  - **Gemeinsames Schalten & Synchronisieren**:
    - Klick auf einen gruppierten Spot in **Live 3D** schaltet auf Wunsch alle verknüpften Spots der Gruppe gleichzeitig.
    - Im Inspektor überträgt der Button *„Einstellungen auf alle X Gruppen-Objekte anwenden“* sofort Helligkeit (`brightnessPct`), Leuchtweite (`distance`), Lichtfarbe (`color`), Einbauhöhe (`position[1]`) oder die Home-Assistant-Entität auf alle Mitglieder.

### B. Schalter, Steckdosen, Kombirahmen & FRITZ!-Netzwerk im Wandplaner
- **Neuer Modus „⚡ Elektro, Schalter & Netzwerk“ im Wand-Planer (`WallModulePlannerModal`)**:
  - Direkt in der frontalen 2D-Wandansicht lassen sich Schalter, Steckdosen, Kombirahmen, LAN-Dosen, FRITZ!Box und FRITZ!Repeater millimetergenau entlang der Wand platzieren.
  - **DIN-Montagehöhen-Schnellwahl**:
    - `30 cm` (Standard-Steckdosenhöhe über Fußboden)
    - `105 cm` (Standard-Lichtschalter- & Rollladentaster-Höhe)
    - `115 cm` (Arbeitsplatten-Steckdosen in der Küche)
    - `160 cm` (FRITZ!Box / Router / Wand-Patchpanel in optimaler Funkhöhe)
    - Plus stufenloser Höhenregler (`0,15 m – 2,40 m`) und Rahmenfarben (*Reinweiß glänzend*, *Anthrazit matt*, *Schwarz matt*, *Edelstahl gebürstet*).
- **Detaillierte 3D-Geometrie & Live-Status**:
  - Steckdosen mit sichtbaren Schutzkontakt-Vertiefungen und optionalem leuchtenden Smart-Plug-Statusring (`switch.*`).
  - Rollladentaster mit geteilter Auf-/Ab-Wippe (verknüpfbar mit `cover.*`).
  - **FRITZ!Box** im typischen rot-weißen/anthrazitfarbenen Gehäuse mit Kühlrippen und 5 grünen/rot blinkenden Status-LEDs (*Power/DSL*, *WLAN*, *Fon*, *DECT*, *Info*).
  - **FRITZ!Repeater** kompakt auf der Steckdose sitzend mit grüner WLAN-Empfangsbalken-Anzeige.

### C. 3D-Elektroleitungen & Animierter Live-Energiefluss (PV / Nebengebäude ➔ UV ➔ Zählerschrank)
- **Kombinierter Leitungs-Planer (Auto-Routing + Stützpunkte)**:
  - Im Inspektor (z. B. beim Klick auf einen Zählerschrank, eine Unterverteilung, einen PV-Wechselrichter, eine Wallbox oder einen Batteriespeicher) sowie im neuen Tab **„⚡ Elektroleitungen“** kann eine neue Leitung angelegt werden:
    1. **Start-Quelle wählen**: z. B. *PV-Wechselrichter Nebengebäude*, *Solar-Dachanlage Garage* oder *Haupt-Zählerschrank*.
    2. **Ziel-Knoten wählen**: z. B. *Unterverteilung (UV) Nebengebäude*, *Haupt-Zählerschrank Wohnhaus*, *Heimspeicher* oder *Wallbox*.
    3. **Verlegeart & Auto-Routing**:
       - *Wand- & Erdkabel (Auto-Trasse)*: Führt vom Startgerät senkrecht an der Wand hinab, läuft entlang der Gebäudewand bzw. als Erdkabel (`NYJ-J` in Schutzrohr-Optik knapp über/unter Geländeniveau) vom Nebengebäude zum Wohngebäude und steigt an der Zielwand exakt bis zur Unterverteilung oder zum Zählerschrank auf.
       - *Freie Zwischen-Stützpunkte (Waypoints)*: Im 2D-Planer lassen sich per Klick Stützpunkte auf der Leitung hinzufügen und frei auf bestimmte Wandecken oder Gräben ziehen.
- **Animierter Energiefluss & Live-Watt-Badge**:
  - Verknüpfung mit einer Home-Assistant-Leistungsentität (`sensor.*_power`, z. B. `sensor.pv_nebengebaeude_leistung` oder `sensor.unterverteilung_leistung`).
  - Fließt Strom (`|Watt| > 5 W`), wandern leuchtende 3D-Energie-Impulse durch die Leitung in Flussrichtung:
    - **Grün / Gold**: Solar-Überschuss / PV-Einspeisung vom Nebengebäude zum Wohnhaus.
    - **Cyan / Blau**: Hausverbrauch / Einspeisung von Zählerschrank zu Unterverteilung oder Wallbox.
    - **Bernstein / Rot**: Hohe Last (> 3.500 W / > 11 kW).
  - Ein kompaktes 3D-Watt-Label an der Leitung zeigt live den aktuellen Leistungswert (z. B. `⚡ 3.840 W ➔ Zählerschrank`).

---

## 2. User Experience & Visuelles Design

- **Ästhetik & Farbsemantik**:
  - Passend zum dunklen Studio-Interface (`slate-950` / `slate-900`) erhalten Elektro-Installationen und Energietrassen klare Akzentfarben:
    - **Solar- / PV-Leitung**: Smaragdgrün (`#10b981`) bis Sonnengold (`#f59e0b`).
    - **Hauptzuleitung (Zählerschrank ➔ UV)**: Elektroblau (`#38bdf8`).
    - **Hochvolt / Wallbox / Speicher**: Violett-Pink (`#c084fc`) bzw. Bernstein (`#fbbf24`).
- **Umschaltbare Sichtbarkeit im 3D-Steuerdock**:
  - Im unteren 3D-Steuerdock (`BottomControlDock`) kommt ein direkter Toggle-Button **„⚡ Leitungen“** hinzu:
    - *Aktiv*: Alle 3D-Kabeltrassen, Wandkanäle, Erdkabel und wandernden Energie-Impulse inklusive Watt-Schildern sind sichtbar.
    - *Inaktiv*: Die Leitungen werden für eine reine Wohnraum-Ansicht ausgeblendet.

---

## 3. Wichtige Produkt- & Architekturentscheidungen

1. **Einheitliches Datenmodell für Wandplaner- und Einzel-Assets**:
   - *Entscheidung*: Schalter, Steckdosen, Kombirahmen und FRITZ!-Geräte können sowohl einzeln per Drag & Drop aus dem Katalog an jede Wand gesetzt als auch im visuellen 2D-Wandplaner in Reihe geplant werden.
   - *Warum*: So kann man im Wandplaner z. B. eine Küchenzeile oder Wohnwand planen und auf derselben Wand direkt die passenden Arbeitsplatten-Steckdosen, Lichtschalter und den FRITZ!Repeater auf exakter Höhe (`115 cm` bzw. `30 cm`) positionieren.
2. **Orthogonales 3D-Auto-Routing mit editierbaren Stützpunkten**:
   - *Entscheidung*: Ein Berechnungs-Helper (`computePowerLine3DPoints`) erzeugt aus `sourceAssetId`, `targetAssetId` und optionalen `waypoints: [number, number][]` automatisch saubere 90°-Wand- und Erdkabel-Segmente inklusive vertikaler Steigleitungen an Start und Ziel.
   - *Warum*: Direkte schräge Luftlinien quer durch Räume wirken unrealistisch; ein automatischer 90°-Wand-/Erdverlauf sieht sofort wie eine echte Elektroinstallation aus und bleibt trotzdem durch eigene Stützpunkte flexibel anpassbar.

---

## 4. Technische Architektur & Datenfluss

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                         FloorplanProject (State Store)                       │
│  • assets: PlacedAsset[]  (neu: groupId, groupName, switchSocketConfig)      │
│  • powerLines: PowerLineRoute[] (Start/Ziel-Asset, Waypoints, Power-Sensor) │
└───────────────────┬──────────────────────────────────────┬───────────────────┘
                    │                                      │
                    ▼                                      ▼
┌───────────────────────────────────────┐  ┌───────────────────────────────────┐
│   EditorWorkspacePanel & Wandplaner   │  │     ThreeFloorplanViewport 3D     │
│ • Gruppen-Manager (Move / Sync All)   │  │ • Einzel- & Doppel-Deckenspots    │
│ • Wandplaner Tab: Elektro & FRITZ!    │  │ • 3D Schalter/Steckdosen/FRITZ!   │
│ • Elektroleitungs-Editor (Start/Ziel, │  │ • 3D TubeGeometry Kabeltrassen    │
│   Auto-Route & 2D-Stützpunkte)        │  │ • Animierte Energie-Impulse + W   │
└───────────────────────────────────────┘  └───────────────────────────────────┘
```

### Datenmodell-Erweiterungen
- **`PlacedAsset`**:
  - `groupId?: string` & `groupName?: string` für die freie Gruppierung von Deckenspots, Lampen, Schaltern und sonstigen Objekten.
  - `electricalConfig?: { frameColor?: 'white' | 'anthracite' | 'black' | 'steel'; gangCount?: 1 | 2 | 3; orientation?: 'horizontal' | 'vertical'; showStatusLed?: boolean }`.
- **`PowerLineRoute` (`project.powerLines`)**:
  - `id: string`, `name: string`
  - `sourceAssetId: string` (z. B. PV-Anlage / Wechselrichter / Zählerschrank)
  - `targetAssetId: string` (z. B. Unterverteilung `UV` / Zählerschrank / Wallbox)
  - `cableType: 'underground_earth' | 'wall_conduit' | 'pv_dc_string' | 'main_feeder'`
  - `powerEntityId?: string` (Home Assistant Sensor für Watt / kW; falls leer, automatische Übernahme vom Start-/Ziel-Gerät)
  - `invertDirection?: boolean` (kehrt die Flussrichtung bei Bedarf um)
  - `waypoints?: [number, number][]` (optionale 2D-Zwischenpunkte `[x, z]` für individuelle Führung entlang bestimmter Wände/Grundstücksgrenzen)
  - `color?: string`
