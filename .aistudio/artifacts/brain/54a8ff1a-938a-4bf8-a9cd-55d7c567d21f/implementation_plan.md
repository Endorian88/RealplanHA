# Intelligente Saugroboter-Raumzuweisung & 3D-Hindernis-Navigation

Dieses Update erweitert den 3D-Saugroboter um eine zuverlässige Raum-Erkennung (automatischer Namensabgleich plus manuelle Zuordnungstabelle und Direkt-Testfahrt) sowie eine echte 2D-Boden-Hinderniserkennung, sodass der Roboter exakt im gemeldeten Raum (z. B. *Wohnzimmer*) fährt und dabei Bodendurchbrüche, Treppen, freie Wände und Möbelstücke sauber umfährt.

## User Review & Critical Decisions

> [!IMPORTANT]
> Alle Rückfragen wurden vorab geklärt und sind im Plan berücksichtigt:

- **Bestätigte Entscheidung 1 (Raum-Zuweisung & Test-Auswahl)**: Kombination aus verbessertem automatischem Namensabgleich (inkl. Umlaut-Normalisierung und Attribut-Auswertung), einer optionalen manuellen Zuordnungstabelle (Sensorwert ➔ 3D-Raum) sowie einer Direkt-Auswahl für sofortige Testfahrten in jedem gewünschten Raum.
- **Bestätigte Entscheidung 2 (Automatische Hindernis-Umfahrung)**: Berechnung eines begehbaren 2D-Bodenrasters im Zielraum, das Treppen, Deckendurchbrüche von unten, freie Wände und stehende Möbelstücke automatisch ausspart, ohne dass eine externe Roboter-Karte mühsam kalibriert werden muss.

---

## 1. Overview & Core Concept

- **Was wird verbessert**:
  1. **Präzise Raum-Erkennung & Zuordnung**: Wenn die verknüpfte Home-Assistant-Entität (oder ein Attribut des Saugroboters) z. B. `Wohnzimmer` meldet, erkennt das System zuverlässig den zugehörigen 3D-Raum auf derselben Etage – unabhängig von Groß-/Kleinschreibung, Umlauten (`ä/ö/ü`) oder ob es sich um einen Haupt- oder Teilraum handelt. Zusätzlich lassen sich abweichende Sensor-Namen oder Raum-IDs (z. B. `16` oder `Living Room`) direkt einem 3D-Raum zuweisen.
  2. **Sofortige Testfahrt im Editor & Live-Cockpit**: Über ein Auswahlfeld kann jederzeit ein Zielraum direkt zum Testen ausgewählt werden, sodass man die Reinigungsfahrt und Hindernis-Umfahrung sofort im gewünschten Raum beobachten kann.
  3. **Kollisionsfreie Reinigungsbahnen**: Statt einer starren Sinus-Kurve über die gesamte Raumfläche berechnet der Saugroboter ein begehbares Bodenraster im Zielraum und umfährt Möbel, Kücheninseln, Treppen, Kniestock-/Trennwände sowie offene Treppen-Bodendurchbrüche.

---

## 2. User Experience & Visual Design

- **Ablauf im Seitenmenü (Saugroboter-Konfigurator)**:
  1. **Raum-Sensor frei wählbar**: Kombinierte Text- und Vorschlags-Suche (`sensor.*`, `select.*`, `vacuum.*`), die sofort den aktuell ausgelesenen Wert UND den daraus erkannten 3D-Zielraum grün hervorhebt.
  2. **Testfahrt- & Override-Auswahl**: Ein Dropdown *„Zielraum (Automatik / Testfahrt)“* erlaubt es, entweder dem Live-Sensor zu folgen oder den Saugroboter testweise sofort in einen bestimmten Raum (z. B. *Wohnzimmer*, *Küche*, *Flur*) zu schicken.
  3. **Manuelle Raum-Zuordnung (aufklappbar)**: Für jeden Raum auf der Etage des Saugroboters kann optional ein abweichender Sensorwert oder Alias hinterlegt werden (z. B. `Wohnzimmer` ➔ `living_room, 16`).
- **Visuelles Verhalten in 3D**:
  - Sobald ein Raum erkannt oder als Testfahrt aktiviert wird, fährt der Saugroboter von seiner Ladestation in die freien Bodenbereiche des Zielraums und fährt diese in geordneten S-Bahnen ab.
  - Stehen Sofa, Esstisch, Treppe oder ein Treppen-Deckendurchbruch im Weg, wendet der Roboter vor der Hinderniskante oder nutzt den freien Durchgang drumherum.

---

## 3. Key Product Decisions & Trade-Offs

- **Entscheidung 1: Dynamisches 2D-Boden-Navigationsraster statt starrer Sinus-Kurve**
  - *Gewählter Ansatz*: Aufteilung des Zielraums in ein feines 2D-Raster (~28 cm Zellen) mit Kollisionsprüfung gegen alle orientierten 2D-Bounding-Boxes von Möbeln, Treppen, Bodendurchbrüchen und freien Wänden sowie Verbindung der Punkte über kürzeste freie Pfade (BFS).
  - *Warum*: Verhindert zuverlässig, dass der Roboter durch Sofas, Schränke oder über offene Treppenlöcher schwebt, und funktioniert vollautomatisch bei jeder Möbel-Umstellung.
- **Entscheidung 2: Dreistufige Raum-Auflösung (Test-Override ➔ Manuelles Mapping ➔ Smart-Auto-Match)**
  - *Gewählter Ansatz*: Zuerst wird geprüft, ob eine manuelle Testfahrt aktiv ist, danach die benutzerdefinierte Zuordnungstabelle und anschließend der tolerante Namensabgleich über alle Innenräume der Etage.
  - *Warum*: Funktioniert im Standardfall sofort ohne Konfiguration, lässt sich aber bei kryptischen Roboter-Raum-IDs jederzeit exakt anpassen.

---

## 4. Technical Architecture & Data Strategy

```
┌─────────────────────────────────────────────────────────────────────────┐
│                Saugroboter-Konfigurator (Seitenmenü)                    │
│  • Raum-Sensor Entität (Freitext + Autocomplete + Live-Status-Anzeige)  │
│  • Zielraum-Modus: [Automatisch über Sensor] oder [Direkt-Test: Raum X] │
│  • Optionale Raum-Zuordnungstabelle (3D-Raum ⟷ Sensorwert / Alias)      │
└───────────────────────────────────┬─────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│             3D-Raum-Auflösung & Kollisionsfreies Pfad-Caching           │
│  1. Ermittle aktiven Zielraum (auf derselben Etage wie die Ladestation) │
│  2. Erzeuge begehbares 2D-Bodenraster innerhalb des Raumpolygons:       │
│     - Minus Wandabstand & freie Trennwände (customWalls)                │
│     - Minus Bodendurchbrüche (Treppen-Deckenöffnungen von unten)        │
│     - Minus Treppen & stehende Möbel-Assets (orientierte 2D-Box + Rand) │
│  3. Verbinde freie Reinigungs-Wegpunkte per Grid-Pfadsuche (BFS)        │
└───────────────────────────────────┬─────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                  Live 3D-Fahrtanimation (Viewport)                      │
│  • Sanftes Abfahren der hindernisfreien Wegpunkte mit Dreh-Ausrichtung  │
│  • Automatische Rückkehr zur Ladestation im Status "docked" / "idle"    │
└─────────────────────────────────────────────────────────────────────────┘
```

- **Datenmodell-Erweiterung (`VacuumAssetConfig`)**:
  - `roomSensorEntityId?: string`: Entität für den aktuellen Raumnamen.
  - `testTargetZoneId?: string`: Optionaler Raum für sofortige Testfahrt / manuellen Override.
  - `roomMappings?: Record<string, string>`: Zuordnung von `zoneId` zu kommagetrennten Sensor-Raumnamen oder IDs.
- **Hindernis-Klassifizierung**:
  - **Blockierend**: Möbel (`category === 'furniture'`), Küchengeräte, Einbauschränke, Sanitär-Objekte, Haustechnik-Geräte, Innen- und Außentreppen, freie Wände sowie Decken-/Bodendurchbrüche von unterhalb liegenden Treppen.
  - **Überfahrbar**: Deckenlampen (`mountType === 'ceiling'`), hoch hängende Wandlampen/Wandsensoren (`mountType === 'wall'`), die eigene Saugroboter-Ladestation sowie flache Bodenteppiche.
