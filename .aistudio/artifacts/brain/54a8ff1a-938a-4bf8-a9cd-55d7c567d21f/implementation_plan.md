# RealPlan 3D — Architektur-, Planer- & Live-3D-Dashboard-Upgrade

Dieses Update beseitigt alle verbleibenden Lücken zwischen Raumwänden in 2D und 3D, ergänzt die zweifach gewendelten Innentreppen (S- und C-Verlauf), integriert ein direkt sichtbares Live-3D-Card-Dashboard mit eigenen Cards, automatischem Kamera-Fokus bei Einzel-Ereignissen (z. B. Garagentor offen) und Sammel-Card bei mehreren Ereignissen, erweitert die Autokamerafahrt zu einer flüssigen Tour durch die Gebäude und Räume, bringt PV-Module direkt auf die Dachschrägen, ermöglicht feste Dach-Sichtbarkeiten pro Gebäude, gleicht die Giebelfarbe exakt an die Fassade an und erweitert den Katalog um gemütliche Wohn- und Badezimmer-Einrichtung.

---

## User Review & Critical Decisions

> [!IMPORTANT]
> Alle abgestimmten Entscheidungen sowie Ihre neuen Ergänzungen sind fest im Plan verankert:

- **Intelligente 3D-Autokamerafahrt durch Gebäude & Räume**: Statt nur im Kreis um das Grundstück zu drehen, führt die Autokamerafahrt eine flüssige **Haus- & Raum-Tour** durch: Sie gleitet vom Gesamtanblick nacheinander durch die einzelnen Gebäude und eingerichteten Innenräume (mit sanfter Wand-Absenkung für freien Einblick) und wieder hinaus.
- **Automatischer Ereignis-Fokus & Mehrere-Ereignisse-Card in Live 3D**:
  - **1 aktives Ereignis** (z. B. Garagentor öffnet sich): Die 3D-Kamera fährt automatisch zum offenen Garagentor bzw. ausgelösten Sensor und hebt den Status hervor.
  - **Mehrere gleichzeitige Ereignisse** (z. B. Garagentor offen + Fenster offen + Alarm): Es öffnet sich automatisch eine übersichtliche **Aktive-Ereignisse-Card**, die alle laufenden Ereignisse auflistet; per Klick auf einen Eintrag fliegt die Kamera gezielt dorthin.
- **Direkt sichtbares Live-3D-Dashboard & eigene Cards**: Die Live-Cards (Eigene Cards, Aktive Ereignisse, PV/Wärmepumpe/Speicher/Zählerschrank) sind in der Live-3D-Ansicht auch auf Smartphones und Tablets sofort sichtbar (nicht mehr standardmäßig versteckt) und lassen sich frei erweitern.
- **PV-Module direkt auf dem Dach**: Im Dach-Konfigurator lassen sich PV-Solarfelder direkt auf den Dachflächen (Vorder-/Rückseite, Reihen/Spalten, mit Aussparung um Dachgauben und Dachfenster) aktivieren; zusätzlich richten sich auch platzierte PV-Assets automatisch an der Dachneigung aus.
- **Zweifach gewendelte Innentreppen (S- & C-Verlauf)**, **Sensor/Aktor/Status-Icon-Zuweisung beim Objekt im Planer**, **feste Dach-Sichtbarkeit je Gebäude**, **identische Giebel-/Fassadenfarbe**, **Echtzeit-Uhr mit Nacht-Straßenlaternen**, **reiner Innenraum-Fokus** sowie das **Möbel- & Bad-Ausstattungspaket**.

---

## 1. Overview & Core Concept

- **Was umgesetzt wird**:
  1. **Sichtbares Live-3D-Card-Dashboard, Auto-Ereignis-Kamera & Ereignis-Sammel-Card**:
     - Direkt sichtbare Dashboard-Leiste in Live 3D für **Aktive Ereignisse**, **Eigene Cards** (`+ Card erstellen`), **Schnellzugriffe** und **Haustechnik** (PV, Wärmepumpe, Warmwasserspeicher, Zählerschrank, Smart-Home-Zentrale).
     - **Auto-Sprung bei Ereignis**: Öffnet sich z. B. das Garagentor, schwenkt die Kamera automatisch dorthin. Treten mehrere Ereignisse gleichzeitig auf, erscheint automatisch eine **Ereignis-Übersichts-Card** mit Direkt-Sprung-Buttons zu jedem betroffenen Ort.
  2. **Dynamische 3D-Kamerafahrt durch die Gebäude**:
     - Die Kamerafahrt (`Kamerafahrt` / `Auto-Idle`) berechnet automatisch Wegpunkte durch alle vorhandenen Gebäude und Innenräume (EG, 1. OG, Nebengebäude) und gleitet weich von Raum zu Raum statt nur monoton im Kreis zu rotieren.
  3. **PV-Module direkt auf dem Dach**:
     - Direkt im Dach-Konfigurator aktivierbare Dach-PV-Anlage (`roofConfig.pvConfig`: Dachseite Süd/Nord/Beide, Modulanzahl, Leistung & Home-Assistant-Entität `sensor.pv_power`), die sich exakt auf die Dachschräge legt und Dachgauben/Dachfenster automatisch ausspart.
  4. **Lückenlose 3D-Wandverschmelzung & nachträgliches 2D-Freiform-Snapping**:
     - Zentrierung aller 3D-Wände auf den 2D-Raumkanten (`wallInset = 0`), bündige Eck- und T-Stöße sowie kollineare Wandverschmelzung zwischen Rechteck- und Freiform-Räumen.
     - Magnetisches Einrasten beim nachträglichen Verschieben von Freiform-Räumen (`zone_move`), Ziehen von Polygon-Eckpunkten (`zone_vertex`) und Skalieren (`zone_resize`).
  5. **Identische Wandfarbe für Giebelseiten & Fassaden + feste Dach-Sichtbarkeit pro Gebäude**:
     - Giebeldreiecke und Kniestock-Wände nutzen exakt dieselbe tageszeitabhängige Farb-Pipeline wie die Raumfassaden.
     - Im Dach-Konfigurator jedes Gebäudes wird fest eingestellt, ob das Dach `Automatisch`, `Immer eingeblendet` (z. B. Garage) oder `Immer ausgeblendet` (z. B. Wohnhaus) ist.
  6. **2× ¼-gewendelte Innentreppen (S- & C-Verlauf), Echtzeit-Uhr mit Nacht-Straßenlaternen, reiner Innenraum-Fokus & Möbel-/Bad-Katalog**:
     - Neue S- und C-Innentreppe (unten und oben je 90° gewendelt), Kleiderschränke, Sideboards, Regale, Walk-In-Dusche, Waschtisch, Wand-WC und Wohn-Deko.

---

## 2. User Experience & Visual Design

- **Key User Flows**:
  - **Live-3D-Dashboard & Ereignis-Automatik**:
    - Sobald in Live 3D ein einzelnes wichtiges Ereignis eintritt (z. B. `Garagentor: OFFEN`), gleitet die Kamera automatisch zum Garagentor und zeigt das 3D-Status-Icon (je nach Planer-Einstellung als reine Anzeige oder klickbarer Aktor).
    - Sind gleichzeitig mehrere Ereignisse aktiv (z. B. Garagentor offen + Badfenster gekippt), erscheint oben rechts die **Ereignis-Sammel-Card („2 Aktive Ereignisse“)**, über die der Nutzer jedes Ereignis einzeln anspringen oder schalten kann.
    - Über das direkt sichtbare **Live-Cards-Panel** sieht der Nutzer seine **Eigenen Cards** sowie die **Haustechnik-Cards** (PV-Erzeugung, Wärmepumpe mit Vorlauf/Rücklauf/COP, Warmwasserspeicher, Zählerschrank) und kann jederzeit neue eigene Cards anlegen.
  - **Kamerafahrt durch das Haus**:
    - Klickt der Nutzer auf `Kamerafahrt` (oder greift `Auto-Idle`), startet eine sanfte Kamerareise vom Außenüberblick hinein in die einzelnen Wohnräume und Etagen und wieder weiter zum nächsten Gebäudeteil.
  - **PV-Anlage auf dem Dach konfigurieren**:
    - Im Dach-Konfigurator schaltet der Nutzer „PV-Module auf Dachfläche“ ein, wählt die belegten Dachseiten (`Vorderseite`, `Rückseite`, `Beide Seiten`), die Modul-Reihen und verknüpft optional seine PV-Entität.

---

## 3. Key Product Decisions & Trade-Offs

- **Decision 1: Ereignis-Kamera mit Einzel-Zoom vs. Multi-Event-Card**
  - *Chosen Approach*: Ein einzelnes neu auftretendes Ereignis löst einen sanften 3D-Kameraschwenk zum Objekt aus. Bei $\ge 2$ gleichzeitigen Ereignissen bleibt die Kamera ruhig und blendet stattdessen automatisch die **Aktive-Ereignisse-Card** ein, aus der heraus gezielt gesprungen werden kann.
  - *Why*: Verhindert unruhiges Hin-und-Her-Springen der Kamera, wenn mehrere Fenster oder Tore gleichzeitig offen stehen, und liefert sofort den kompletten Überblick als Card.
- **Decision 2: Wegpunkt-basierte 3D-Kamerafahrt durch Innenräume**
  - *Chosen Approach*: Die Idle-Kamera interpoliert mittels Catmull-Rom-/Lerp-Übergängen zwischen einer Außen-Übersicht und den realen Mittelpunkten der Innenräume (`zoneType === 'indoor'`) inklusive temporärer Wand-Absenkung für freie Sicht in den jeweiligen Raum.
  - *Why*: Macht die 3D-Ansicht auf Wand-Tablets und Dashboards zu einem echten Blickfang, der das gesamte Haus von innen und außen präsentiert.
- **Decision 3: Prozedurale Dach-PV-Belegung mit Gauben-/Dachfenster-Freihaltung**
  - *Chosen Approach*: PV-Module werden im Dach-Koordinatensystem exakt im Neigungswinkel der Dachfläche generiert und prüfen automatisch die Positionen vorhandener Dachgauben und Dachfenster, damit kein Solarmodul mit einem Fenster kollidiert.
  - *Why*: Spart mühsames Einzelplatzieren und garantiert eine architektonisch saubere Dach-Optik.

---

## 4. Technical Architecture & Data Strategy

```
┌────────────────────────────────────────────────────────────────────────────┐
│                        RealPlan 3D State & Storage                         │
│  FloorplanProject (Zones, Openings, Assets, CustomWalls, LiveCockpitConfig)│
└───────────────┬────────────────────────────────────────────┬───────────────┘
                │                                            │
                ▼                                            ▼
┌───────────────────────────────────────┐  ┌─────────────────────────────────┐
│     2D-Planer & Objekt-Inspektor      │  │       Live-3D-Dashboard         │
│ ───────────────────────────────────── │  │ ─────────────────────────────── │
│ • Lückenloses Freiform- & Raum-Snap   │  │ • Sichtbares Live-Cards-Board   │
│   (Erstellen + Nachbearbeiten)        │  │   (Eigene Cards & Haustechnik)  │
│ • Objekt-Inspektor:                   │  │ • Auto-Kamera-Sprung (1 Event)  │
│   - Sensor / Aktor / Beides           │  │   & Ereignis-Card (2+ Events)   │
│   - 3D-Status-Icon-Modus              │  │ • Haus- & Raum-Tour-Kamerafahrt │
│ • Dach-Konfigurator pro Gebäude:      │  │ • Zentrierte, lückenlose Wände  │
│   - Sichtbarkeit: Auto / Immer an/aus │  │   & identische Giebelfarbe      │
│   - Dach-PV-Generator (Süd/Nord)      │  │ • Echtzeit-Uhr & Nacht-Laternen │
│ • 2× ¼-Treppen (S & C) + Möbel/Bad    │  │ • Reiner Innenraum-Fokus        │
└───────────────────────────────────────┘  └─────────────────────────────────┘
```

- **Datenmodell-Erweiterungen**:
  - `ZoneRoofConfig`:
    - `visibilityMode?: 'auto' | 'always_visible' | 'always_hidden'`
    - `pvConfig?: { enabled: boolean; sides: 'front' | 'back' | 'both'; coveragePct?: number; entityId?: string; kwPeak?: number }`
  - `LiveCockpitConfig`:
    - `autoJumpToActiveEvents?: boolean` (Standard: `true`)
    - `customCards: CustomLiveCardItem[]` (mit `entityId`, `actuatorEntityId`, `controlMode`, `showFloating3DIcon`)
  - `WallOpening` & `PlacedAsset`:
    - `controlMode?: 'auto' | 'sensor_only' | 'actuator' | 'sensor_and_actuator'`
    - `statusBadgeMode?: 'auto' | 'always' | 'when_active' | 'hidden'`
