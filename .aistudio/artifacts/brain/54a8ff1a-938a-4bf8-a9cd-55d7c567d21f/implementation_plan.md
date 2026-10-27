# RealPlan 3D — HACS Seitenleisten-Integration, Multi-Stockwerke, Zwei-Sensor-Kipplogik & Erweiterter 3D-Möbelkatalog

Dieses Update baut **RealPlan 3D** zu einer vollständigen **Home Assistant HACS-Integration mit eigenem Seitenleisten-Panel (`custom_components/realplan3d`)** analog zu *NeonPlan 3D* aus – kombiniert mit einem **Multi-Stockwerk-System (KG, EG, 1. OG, DG)**, einem **visuellen Zwei-Sensor-Regel-Editor für Fenster & Türen (Geschlossen / Gekippt / Geöffnet)**, **raumfüllender 3D-Beleuchtung** und über **55 detaillierten 3D-Möbeln, Küchen-, Bad- und Treppen-Assets**.

## User Review & Critical Decisions

> [!IMPORTANT]
> Alle vier Kernentscheidungen aus deinen Antworten sind direkt in der Architektur verankert:

- **Confirmed Decision 1 — HACS Custom-Component Paket (`custom_components/realplan3d`) mit Seitenleisten-Eintrag**: Der HACS-Generator erstellt ein komplettes, GitHub-fertiges Integrations-Paket (`hacs.json`, `manifest.json`, `__init__.py`, `config_flow.py`, `strings.json`, `translations/de.json` und `realplan3d-card.js`). Nach der Installation über HACS wird *RealPlan 3D* unter **Einstellungen → Geräte & Dienste → Integration hinzufügen** eingerichtet und erscheint automatisch als **Vollbild-App in der Home Assistant Seitenleiste** sowie als Lovelace-Card (`custom:realplan3d-card`).
- **Confirmed Decision 2 — Multi-Stockwerk-System (KG, EG, 1. OG, DG & Gestapelte 3D-Ansicht)**: Jedes Stockwerk kann im 2D-Planer und in der 3D-Ansicht einzeln ausgewählt werden (mit optionaler transparenter Pause der darunterliegenden Etage im 2D-CAD für exakte Treppen- und Wandfluchten) oder als **gestapelte 3D-Gesamtansicht aller Etagen** betrachtet werden.
- **Confirmed Decision 3 — Visueller Zwei-Sensor-Regel-Editor (Geschlossen / Gekippt / Geöffnet)**: Jedes Fenster und jede Tür kann mit **einem oder zwei `binary_sensor`-Entitäten** verknüpft werden (z. B. *Sensor A aktiv = Gekippt* mit echter **14°-Kipp-Animation** des Fensterflügels nach innen; *Sensor A + Sensor B aktiv = Komplett Geöffnet* mit **65°-Drehöffnung**).
- **Confirmed Decision 4 — Raumfüllende Lichtberechnung & 55+ Möbel-/Küchen-/Treppen-Assets**: Eingeschaltete Lichtquellen leuchten den gesamten zugehörigen Raum (Boden, Wände und Möbel im Raum) gleichmäßig und warm aus. Der Katalog wird um modulare Küchen (L-Küche, Kochinsel, Side-by-Side-Kühlschrank, Hochschränke), Schlaf-/Wohnzimmermöbel (Kleiderschrank, Sideboard, Bücherregal, Kaminofen), Komplett-Bad (Walk-In-Dusche, Wand-WC, Waschtisch, Wasch-Turm) und Geschosstreppen (Wangentreppe, Wendeltreppe) erweitert.

---

## 1. Overview & Core Concept

- **Was es leistet**: Eine fotorealistische 3D- & 2D-CAD-Smart-Home-Plattform im Stil von *inZOI / Unreal Engine 5 ArchViz*, die wie *NeonPlan 3D* über ein eigenes GitHub-Repository in HACS eingebunden, per Config-Flow als Home Assistant Integration aktiviert und direkt über die **Home Assistant Seitenleiste** bedient wird.
- **Zielgruppe**: Smart-Home-Enthusiasten mit mehrstöckigen Häusern, Außenanlagen und komplexen Sensor-Kombinationen (z. B. Doppelsensor-Fensterüberwachung für *Gekippt* vs. *Offen*).
- **Kernmehrwert**: Einfache 2D-CAD-Grundrissplanung pro Etage, realistische raumfüllende Lichtstimmung in 3D, sichtbare Kipp- und Dreh-Animationen für Fenster/Türen und ein sofort einsatzbereites GitHub-/HACS-Integrationspaket.

---

## 2. User Experience & Visual Design

### A. Etagen-Navigation & Raum-Fokus
- **Stockwerk-Umschalter (Floating Level Switcher)**:
  - Schnelle Auswahl zwischen **`KG (Keller)`**, **`EG (Erdgeschoss & Garten)`**, **`1. OG (Schlaf- & Kinderzimmer)`**, **`DG (Studio)`** und **`Alle Etagen (3D-Stapel)`**.
  - Im **2D-CAD-Planer** wird die gewählte Etage bearbeitet; auf Wunsch werden die tragenden Wände und Treppen des darunterliegenden Geschosses als dezente Blaupausen-Linien eingeblendet.
- **Raumfüllende 3D-Beleuchtung**:
  - Sobald eine Leuchte (`light.*`) in einem Raum eingeschaltet wird, berechnet die 3D-Engine neben dem lokalen Lichtkegel eine **raumfüllende indirekte Ausleuchtung (Room Fill Light)** exakt für die Grundfläche dieses Raums. Räume mit ausgeschaltetem Licht bleiben sichtbar dunkler, während beleuchtete Räume samt Parkett, Wänden und Einrichtung warm erstrahlen.

### B. Visueller Zwei-Sensor-Regel-Editor (Gekippt / Geöffnet)
- Im Inspektor jedes Fensters und jeder Tür kann zwischen **Einzel-Sensor** und **Zwei-Sensor-Logik (Kipp- & Öffnungserkennung)** gewählt werden:
  - **Sensor 1 (Kipp-/Oberkanten-Sensor)**: z. B. `binary_sensor.fenster_wohnzimmer_oben`
  - **Sensor 2 (Öffnungs-/Unterkanten-Sensor)**: z. B. `binary_sensor.fenster_wohnzimmer_unten`
  - **Auswertungs-Matrix & 3D-Kinematik**:
    - Beide `off`/`clear` → **Geschlossen** (Fensterflügel bündig im Rahmen, Status-Label *Geschlossen*)
    - Nur Sensor 1 `on`/`open` → **Gekippt** (Fensterflügel kippt in 3D oben um `14°` nach innen in den Raum, Status-Label *Gekippt* in Amber)
    - Sensor 1 + Sensor 2 `on`/`open` (oder konfigurierbar nur Sensor 2) → **Geöffnet** (Fensterflügel schwenkt in 3D um `65°` seitlich auf, Status-Label *Geöffnet* in Cyan)
  - Direkt im Live-Popover und im Geräte-Menü lassen sich alle 3 Zustände (*Geschlossen*, *Gekippt*, *Geöffnet*) per Klick live in 3D testen.

### C. Erweiterter 3D-Katalog (55+ Assets)
- **Küche & Essen**:
  - *L-Form Einbauküche mit Eckspüle & Oberschränken*, *Naturstein-Kochinsel mit BORA-Kochfeld & 3 Barhockern*, *Hochschrank-Gerätewand (Backofen & Espresso)*, *Side-by-Side French-Door Kühlschrank mit Eisspender*, *Massiver Eichen-Esstisch (6 Stühle)*.
- **Wohnen, Schlafen & Deko**:
  - *Architektur-Ecksofa*, *3-türiger Kleiderschrank mit Spiegelfront*, *Nussbaum-Sideboard / Kommode*, *Offenes Bücherregal / Raumteiler*, *Panorama-Kaminofen mit leuchtender 3D-Flamme*, *Boxspring-Doppelbett*, *Einzel-/Jugendbett (für 1. OG)*, *Skandi-Webteppich*, *Große Zimmerpflanze (Monstera / Olivenbaum im Keramiktopf)*.
- **Bad & Hauswirtschaft**:
  - *Walk-In-Regendusche mit Glasabtrennung*, *Wandhängendes Design-WC mit Betätigungsplatte*, *Doppelwaschtisch mit LED-Spiegel*, *Freistehende Mineralguss-Badewanne*, *Waschmaschinen- & Trockner-Säule*.
- **Treppen & Etagen-Architektur**:
  - *Freitragende Eichen-Wangentreppe mit Glasgeländer*, *Moderne Stahl-Wendeltreppe*.

---

## 3. Key Product Decisions & Trade-Offs

- **Decision 1 — Echte HACS Custom Integration (`custom_components/realplan3d`) statt reiner Lovelace-JS-Datei**:
  - *Chosen Approach*: Bereitstellung aller Python- und Metadaten-Dateien (`manifest.json`, `__init__.py`, `config_flow.py`, `hacs.json`, `realplan3d-card.js`) inklusive Kopier- und Ein-Klick-Download-Funktion für ein eigenes GitHub-Repository.
  - *Why*: Nur eine echte `custom_components`-Integration kann sich automatisch per `frontend.async_register_built_in_panel` in die **Home Assistant Seitenleiste** eintragen und über **Geräte & Dienste → Integration hinzufügen** genau wie *NeonPlan 3D* eingerichtet werden.
- **Decision 2 — Kombinierte Direkt- & Raum-Füllbeleuchtung pro Raum**:
  - *Chosen Approach*: Jede eingeschaltete Lampe erzeugt sowohl ihr lokales Punktlicht mit Lichtkranz als auch einen raumbezogenen Helligkeits-Boost für den jeweiligen Raum (`FloorplanZone`).
  - *Why*: Verhindert einerseits grelle Überbelichtung einzelner Wandpunkte und sorgt andererseits dafür, dass ein Raum beim Einschalten des Decken- oder Stehlichts vollständig und realistisch ausgeleuchtet wird.

---

## 4. Technical Architecture & Data Strategy

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                        RealPlan 3D Studio & HA Panel                         │
├───────────────────────┬──────────────────────────┬───────────────────────────┤
│ 2D-CAD Etagen-Planer  │  3D UE5/inZOI Renderer   │ HACS Integration Exporter │
│ (KG / EG / 1.OG / DG) │  • Multi-Floor Stacking  │ • hacs.json & manifest    │
│ • Wand-Magnet         │  • Room-Filling Lights   │ • __init__.py (Sidebar)   │
│ • Ghost-Floor Pause   │  • 3D Tilt/Swing Windows │ • config_flow.py (UI)     │
│ • 55+ Möbel & Küchen  │  • Room Focus Dimming    │ • realplan3d-card.js      │
└───────────┬───────────┴─────────────┬────────────┴─────────────┬─────────────┘
            │                         │                          │
            ▼                         ▼                          ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│            Zentrales Projekt- & Multi-Sensor-Zustandsmodell (v4)             │
│  • FloorplanZone (level: -1..2, roomFillLight, surfaceMaterial)              │
│  • WallOpening (compositeSensorRule: sensorA + sensorB -> closed/tilted/open)│
│  • PlacedAsset (level: -1..2, 55+ Procedural PBR Groups, Light Bounce)       │
└──────────────────────────────────────────────────────────────────────────────┘
```

### Datenmodell-Erweiterungen
1. **Etagen-Zuordnung (`FloorLevelId = -1 | 0 | 1 | 2`)**:
   - `FloorplanZone.level`, `WallOpening.level`, `PlacedAsset.level` (Standard `0` = Erdgeschoss, `1` = 1. Obergeschoss mit vordefinierten Räumen wie Elternschlafzimmer, Kinderzimmer, Galerie-Flur, oberes Bad und Verbindungs-Wangentreppe).
2. **Zwei-Sensor-Logik (`CompositeSensorRule`)**:
   - `WallOpening.tiltEntityId?: string` (z. B. Kipp-Kontakt oben) + `WallOpening.entityId?: string` (Haupt-/Öffnungskontakt) + `WallOpening.sensorLogicMode?: 'single' | 'dual_tilt_open'`.
   - Automatische Berechnung von `resolvedOpeningState: 'closed' | 'tilted' | 'open'`, die in `ThreeFloorplanViewport` den Fensterflügel entweder um die untere Kante (`rotation.x = 0.24` rad für *Gekippt*) oder um die seitliche Angel (`rotation.y = -1.1` rad für *Geöffnet*) animiert.
