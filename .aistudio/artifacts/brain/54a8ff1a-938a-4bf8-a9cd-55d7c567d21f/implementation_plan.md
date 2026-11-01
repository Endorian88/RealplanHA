# Zentraler Dach-, Gauben- & PV-Planer, Aufgeräumte Seitenmenüs & Interaktiver Tour-Kameraplaner (Grundstück- & Raum-Circle)

Dieses Update bündelt die gesamte Dachplanung (**Dachgauben, PV-Anlage, Dachfenster & Schornsteine**) in einem eigenen visuellen **Dach-Planer (mit Draufsicht & Dachaufriss)**, räumt die rechte Seitenleiste sowie den Objektkatalog konsequent von doppelten und dreifachen Dach-Einstellungen frei, zieht Raum- und Kniestock-Wände im 1. OG automatisch bis in die Dachgauben hoch und erweitert die **Kamerafahrt** um einen interaktiven Kamera-Positions-Speicher sowie die Modi **Grundstück-Circle**, **Raum-Circle** und **Kombi-Tour**.

## User Review & Critical Decisions

> [!IMPORTANT]
> Alle Erweiterungen aus deinem Feedback sind vollständig in den Plan integriert:

- **Zentraler Dach-, Gauben-, Dachfenster- & PV-Planer (Draufsicht & Dachaufriss)**: Statt verstreuter Einzel-Einstellungen gibt es am Dach einen einzigen zentralen Planer-Dialog (**„🏠 Dach-, Gauben- & PV-Planer öffnen“**). Darin lassen sich in einer großen **Dach-Draufsicht & Seiten-Aufriss-Ansicht** sowohl **Dachgauben**, **Dachflächenfenster** als auch **PV-Module** (inkl. automatischer Aussparung von Gauben und Dachfenstern sowie Home Assistant Entitäten für Fenster, Rollläden und PV-Leistung) übersichtlich planen.
- **Konsequentes Aufräumen der Seitenmenüs & des Objektkatalogs (Keine Dopplungen mehr)**: Die langen Inline-Listen für Gauben, Dachfenster, Schornsteine und PV-Belegung in der rechten Seitenleiste werden entfernt und durch eine kompakte Status-Zusammenfassung plus den Start-Button für den Dach-Planer ersetzt. Lose Dachgauben und Dachfenster im allgemeinen 3D-Objektkatalog entfallen.
- **Kamerafahrt mit Grundstück-Circle, Raum-Circle & Live-Pos-Speichern**: Im Tour-Routenplaner kann man direkt den gewünschten Fahrt-Modus wählen (**🔄 Nur Grundstück-Circle**, **🏠 Raum-Circle / Raum-Tour** oder **🎬 Kombi-Tour**). Klickt man einen Raum in der Liste an, springt die 3D-Ansicht mit aktivem Wandschnitt und ausgeblendeten Nachbar-Assets dorthin, sodass man die Wunsch-Perspektive frei einstellen oder als sanften **Raum-Circle** nutzen und per **„📷 Pos speichern“** sichern kann.
- **Automatische Wand-Erweiterung in die Dachgaube**: Sowohl Raumwände als auch freie Wände (Kniestock / Drempel im 1. OG) werden im Bereich einer Dachgaube automatisch bis in die Gaube hinein erweitert.

---

## 1. Overview & Core Concept

- **Was umgesetzt wird**:
  1. **Zentraler Dach-, Gauben-, Dachfenster- & PV-Planer (`RoofPlannerModal`)**:
     - Über den Button **„🏠 Dach-, Gauben- & PV-Planer öffnen“** im Gebäude-Dach öffnet sich ein großes Planungs-Studio (analog zum Wandplaner) mit 3 klar gegliederten Bereichen:
       - **Tab 1: 🏠 Dachgauben**: Platzieren, Verschieben (per Maus im Aufriss/Draufsicht) und Konfigurieren von Dachgauben (Satteldach-, Schlepp-, Flachdach-, Trapez-, Rundbogengaube), Maßen, Kniestock/Brüstung sowie **Fensterkontakt- (`binary_sensor.*`) und Rollladen-Entitäten (`cover.*`)**.
       - **Tab 2: 🪟 Dachfenster & Schornstein**: Direktes Setzen und Verschieben von Dachflächenfenstern (inkl. Öffnungsstatus, Rollladen & HA-Entitäten) sowie Kaminen/Schornsteinen in der Dach-Draufsicht.
       - **Tab 3: ☀️ PV-Anlage (Draufsicht)**: Visuelle Planung der PV-Module direkt in der Dach-Draufsicht pro Dachseite (Süd/Nord/Ost/West) mit Modulanzahl, Belegungsgrad, automatischer Aussparung rund um geplante Dachgauben/Dachfenster sowie Zuweisung der PV-Entität (`sensor.*`) und Peak-Leistung (`kWp`).
  2. **Seitenmenüs & Katalog entschlacken (Null Dopplungen)**:
     - Im rechten Inspektor unter *„3D-Dach“* bleiben nur die Grundform (Satteldach, Walmdach, Pultdach, Flachdach, Dachneigung, Kniestockhöhe, Sichtbarkeit) und der prominente Button **„🏠 Dach-, Gauben- & PV-Planer öffnen“** mit einer 1-zeiligen Kurzinfo (z. B. *„2 Gauben · 1 Dachfenster · 18 PV-Module“*). Alle mehrfach vorhandenen Unterformulare in der Seitenleiste und lose Gauben-Assets im Katalog werden entfernt.
  3. **Automatische 3D-Wand-Erweiterung in die Dachgaube**:
     - Liegt im 1. OG / DG eine Raumwand oder eine freie Wand (Kniestock / Trennwand) unterhalb einer Dachgaube, wird die Wandhöhe im Gaubenbereich automatisch an das Gaubenprofil angepasst (Wangen und Trennwände wachsen bis zur Gaubendecke, Kniestock unter der Gaubenfront schließt sauber an die Gaubenbrüstung an).
  4. **Interaktiver Tour-Routen-Kameraplaner mit Grundstück-Circle & Raum-Circle**:
     - Auswahl des Kamerafahrt-Modus oben im Tour-Planer:
       - **🔄 Grundstück-Circle**: Ruhiger 360°-Rundflug um das gesamte Haus und Grundstück.
       - **🏠 Raum-Tour / Raum-Circle**: Fahrt durch die ausgewählten Räume (wahlweise mit der fest gespeicherten Wunsch-Kameraansicht oder einem sanften **Raum-Circle-Schwenk** im jeweiligen Raum).
       - **🎬 Kombi-Tour**: Erst Grundstück-Circle, danach Raum-Tour durch die aktiven Zimmer.
     - Klickt man im Tour-Planer auf einen Raum, dockt der Planer kompakt an die Seite an, die 3D-Szene springt in den Raum, blendet verdeckende Wände und fremde Assets exakt wie bei der Autofahrt aus, und man speichert per **„📷 Pos speichern“** seine perfekte Kamera-Perspektive.

---

## 2. User Experience & Visual Design

- **Key User Flows**:
  1. **Dachgauben, Dachfenster & PV-Module in der Draufsicht planen**:
     - Gebäude auswählen $\rightarrow$ Klick auf **„🏠 Dach-, Gauben- & PV-Planer öffnen“**.
     - Im großen interaktiven **2D-Dachplan (umschaltbar zwischen Draufsicht von oben und Seiten-Aufriss)** sieht man alle Dachflächen (Süd/Vorderseite, Nord/Rückseite, Ost/West-Walm), die Kniestock-Linie und darunterliegende 1.-OG-Wände.
     - Gauben, Dachfenster und PV-Modulfelder lassen sich direkt visuell anlegen, per Drag & Drop positionieren und mit Home Assistant Entitäten verknüpfen.
  2. **Tour-Route & Kamera-Positionen einrichten**:
     - Klick auf **„🗺️ Tour-Route“** $\rightarrow$ Wahl zwischen *Grundstück-Circle*, *Raum-Circle / Raum-Tour* oder *Kombi-Tour*.
     - Klick auf einen Raum in der Liste $\rightarrow$ Live-Sprung in den Raum mit aktivem Wandschnitt $\rightarrow$ Kamera mit der Maus ausrichten $\rightarrow$ Klick auf **„📷 Pos speichern“** $\rightarrow$ Weiter zum nächsten Raum.
- **Visual Identity & Theme**:
  - Einheitliches Glassmorphism-Design (`bg-slate-900/80 backdrop-blur-2xl border-white/20`), aufgeräumte Seitenleiste ohne endlose Scroll-Wüsten und technischer 2D-Dachplan mit klarer Farbcodierung (`amber-400` für Gauben, `sky-400` für Dachfenster, `indigo-400/emerald-400` für PV-Solarmodule).

---

## 3. Key Product Decisions & Trade-Offs

- **Entscheidung 1: Ein einziger Dach-Planer statt 4 verteilter Menüs**
  - *Gewählter Ansatz*: Zusammenführung von Dachgauben, Dachfenstern, Schornsteinen und PV-Anlage in `RoofPlannerModal.tsx` mit kombinierter Draufsicht & Frontal-Aufriss.
  - *Warum*: Auf einer Dachfläche beeinflussen sich Gauben, Dachfenster und PV-Module gegenseitig räumlich. In einer gemeinsamen Draufsicht sieht man sofort, wo Gauben und Dachfenster sitzen und wie viele PV-Module daneben Platz finden, während die rechte Seitenleiste schlank und übersichtlich bleibt.
- **Entscheidung 2: Drei klare Kamerafahrt-Modi (Grundstück-Circle, Raum-Circle, Kombi-Tour)**
  - *Gewählter Ansatz*: Erweiterung von `HouseTourConfig` um `tourMode: 'property_circle' | 'room_tour' | 'combined'` sowie `roomCameraBehavior: 'saved_or_circle' | 'circle_only'`, kombiniert mit dem angedockten Live-Kameraplaner zum direkten Speichern von `savedCameraView` pro Raum.
  - *Warum*: Damit kann der Nutzer jederzeit zwischen einem repräsentativen 360°-Grundstücks-Rundflug, einer gezielten Raum-Führung mit selbst gespeicherten Kamerawinkeln oder einem sanften Raum-Circle wählen.

---

## 4. Technical Architecture & Data Strategy

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                         RealPlan 3D Studio Viewport                          │
├──────────────────────────────────────┬───────────────────────────────────────┤
│   🗺️ Tour-Routen & Kamera-Studio     │   🏠 Zentraler Dach- & PV-Planer      │
│  ┌────────────────────────────────┐  │  ┌─────────────────────────────────┐  │
│  │ • Modus-Wahl:                  │  │  │ • Interaktive 2D-Draufsicht &   │  │
│  │   - 🔄 Grundstück-Circle       │  │  │   Seiten-Aufriss des Daches     │  │
│  │   - 🏠 Raum-Circle / Raum-Tour │  │  │ • Tab 1: 🏠 Dachgauben          │  │
│  │   - 🎬 Kombi-Tour              │  │  │   (Form, Maße, Fenster, Rollo & │  │
│  │ • Klick auf Raum -> Dock-Modus │  │  │    HA-Entitäten)                │  │
│  │   mit Auto-Wandschnitt &       │  │  │ • Tab 2: ☀️ PV-Anlage           │  │
│  │   Asset-Isolation              │  │  │   (Module in Draufsicht, kWp,   │  │
│  │ • [📷 Pos speichern] speichert │  │  │    Auto-Aussparung um Gauben)   │  │
│  │   savedCameraView am Raum      │  │  │ • Tab 3: 🪟 Dachfenster & Kamin │  │
│  └────────────────────────────────┘  │  └───────────────┬─────────────────┘  │
│                                      │                  ▼                    │
│                                      │  ┌─────────────────────────────────┐  │
│                                      │  │ 3D-Dach & Wand-Geometrie-Engine │  │
│                                      │  │ - Raumwände & freie Kniestock-  │  │
│                                      │  │   Wände wachsen automatisch     │  │
│                                      │  │   bis in die Dachgaube hoch     │  │
│                                      │  │ - Seitenmenü entschlackt (keine │  │
│                                      │  │   doppelten Gauben/PV-Listen)   │  │
│                                      │  └─────────────────────────────────┘  │
└──────────────────────────────────────┴───────────────────────────────────────┘
```

- **Datenmodell & State**:
  - `HouseTourConfig`: Erweiterung um `tourMode?: 'combined' | 'property_circle' | 'room_tour'` und `roomViewMode?: 'saved_angle' | 'room_circle'`, zusätzlich zu `roomOrderIds`, `disabledRoomIds` und `stopDurationSec`.
  - `FloorplanZone.savedCameraView`: Speichert `{ position: [x, y, z], target: [tx, ty, tz] }` pro Raum.
  - `ZoneRoofConfig`: Nutzt `dormers`, `skylights`, `chimneys` und `pvConfig` direkt aus dem neuen zentralen `RoofPlannerModal`.
- **Interaktive Abläufe & Bereinigung**:
  - **Seitenmenü-Bereinigung**: In `EditorWorkspacePanel.tsx` werden die bisherigen langen Inline-Sektionen für Dachgauben, Dachfenster, Schornstein und Dach-PV entfernt und durch die kompakte Dach-Zusammenfassung mit dem Button **„🏠 Dach-, Gauben- & PV-Planer öffnen“** ersetzt. Ebenso werden lose Dachgauben-/Dachfenster-Einträge aus dem 3D-Objektkatalog entfernt.
  - **Wand-Erweiterung in Gauben**: In `ThreeFloorplanViewport.tsx` berücksichtigt `getRoofMaxWallHeightAt` alle `roofConfig.dormers`, und auch freie Wände (`project.customWalls`) im 1. OG / DG werden segmentweise an das Dach- und Gaubenprofil angepasst, sodass jede Wand unter einer Gaube nahtlos bis in die Gaube erweitert wird.
