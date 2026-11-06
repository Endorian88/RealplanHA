# NeonPlan3D-Steuerung: 3D-Raum-Direktklick & Kompaktes 1-Zeilen-Steuerdock

### User Review & Critical Decisions
* **Direkte Raum-Navigation (NeonPlan3D-Workflow):** *Direktklick auf Raum im 3D-Modell oder Raum-Card* — In der Live-3D-Ansicht genügt ein Klick direkt auf einen Raum im 3D-Grundriss oder auf den Header seiner schwebenden 3D-Raum-Card, um sofort in diesen Raum zu fliegen.
* **Neues Layout des unteren Steuerdocks:** *Kompakte 1-Zeilen-Bar plus Aufklapp-Menü für Details* — Das bisherige große 3-zeilige Dock wird zu einer schlanken, übersichtlichen **1-Zeilen-Steuerleiste** umgebaut (Etagen, echte Raum-Pills, Tour-Start & wichtigste Ansichts-Buttons); detaillierte Einstellungen für Sonnenstand/Uhrzeit, Wetter, 3D-Stil, Feiertags-Themes, Kamera-Presets und Grafik-Performance wandern in ein aufgeräumtes **Aufklapp-Menü (`Ansicht & Atmosphäre`)**.
* **Raum-Fokus-Verhalten & Rückkehr:** *Beides kombinierbar mit schnellem Zurück-Klick in den Außenbereich* — Beim Anwählen eines Raums fliegt die Kamera sanft in den Raum, senkt verdeckende Vorderwände automatisch ab, hebt den Raum durch Abdunkelung der übrigen Bereiche hervor und blendet Schnellschalter (Licht, Rollläden, Geräte, Vor/Zurück-Raumwechsel) ein. Ein einfacher Klick in den freien Außenbereich / Hintergrund (oder die `ESC`-Taste) fliegt sofort zurück in die Gesamtübersicht.

---

### 1. Overview & Core Concept
Die 3D-Steuerung und Raum-Navigation wird nach dem Vorbild von **NeonPlan3D** grundlegend verschlankt und direkt in die 3D-Szene integriert:

1. **Intuitiver 3D-Raum-Direktklick & Außen-Zurückklick:** Bisher reagierte ein Klick auf einen Raumboden nur im Editor-Modus, während in der Live-Ansicht über verschachtelte Listen oder das große untere Dock navigiert werden musste. Zudem tauchten im Raum-Fokus auch übergeordnete Gebäudehüllen (*„Wohnraum“*, *„Haus“*, *„Nebengebäude“*) als auswählbare Buttons auf. Neu ist jeder echte Innenraum direkt im 3D-Modell (sowie über seine 3D-Raum-Card) anklickbar, und ein Klick daneben in den Außenbereich oder auf `ESC` bringt die Kamera nahtlos zurück in die Hausübersicht.
2. **Schlanke 1-Zeilen-Steuerleiste statt 3-Zeilen-Block:** Das untere Steuerdock verdeckt im Live-Betrieb keinen großen Teil des 3D-Modells mehr, sondern bietet alle primären Navigationsfunktionen (Etagen, Raum-Schnellwahl, Übersicht, Tour, Wandschnitt, Cards & Einstellungs-Drawer) in einer einzigen kompakten Zeile.

---

### 2. User Experience & Visual Design
* **Direktklick im 3D-Grundriss & auf 3D-Raum-Cards:**
  * Klickt der Nutzer in der Live-Ansicht auf ein konkretes 3D-Gerät (Lampe, Fenster, Tür, Schalter), wird wie gewohnt dieses Gerät bedient bzw. ausgewählt.
  * Klickt der Nutzer hingegen direkt auf den Boden oder Bereich eines Raums im 3D-Modell – oder auf den Titelbereich einer schwebenden **3D-Raum-Card** –, fliegt die Kamera sanft in diesen Raum (`Raum-Fokus`).
  * Ist bereits ein Raum fokussiert, genügt ein **Klick in den Außenbereich / Hintergrund** (außerhalb des fokussierten Raums), ein Klick auf **`← Übersicht`** oder das Drücken der **`ESC`-Taste**, um sanft in die Gesamtansicht zurückzukehren.
* **Kombinierter Raum-Fokus mit Schnellschaltern & Vor/Zurück-Zyklus:**
  * Im Raum-Fokus senken sich die zur Kamera zeigenden Wände automatisch ab, während umliegende Räume abgedunkelt werden (auf Wunsch im Fokus-Panel per 1-Klick zwischen *„Isoliert / Abgedunkelt“* und *„Volle Hausumgebung“* umschaltbar).
  * Über kompakte **`‹ Vorheriger Raum`** / **`Nächster Raum ›`** Buttons (oder Pfeiltasten) sowie die Raum-Pills kann man ohne Umweg über die Gesamtübersicht direkt von Zimmer zu Zimmer gleiten.
  * Direkt im Raum-Fokus-HUD lassen sich alle Lichter und Rollläden des Raums per 1-Klick-Gruppenschalter sowie einzelne Geräte sofort schalten.
* **Kompakte 1-Zeilen-Steuerleiste (`BottomControlDock`) mit Aufklapp-Menü:**
  * **Hauptzeile (1 Zeile):**
    1. **Etagen-Wahl:** `KG` · `EG` · `1. OG` · `DG` · `Alle 3D`
    2. **Raum-Direktwahl:** Horizontal scrollbare Raum-Chips (strikt gefiltert auf echte Räume ohne Gebäudehüllen) + `Alle Räume` Reset-Chip
    3. **Kamera & Tour:** `Haus-Tour` (Play/Pause + `⚙ Route`)
    4. **Schnell-Toggles:** `Wände` (Schnitt), `3D-Cards`, `Labels`, `Raumliste`
    5. **Aufklapp-Button (`⚙ Ansicht & Atmosphäre`):** Öffnet/schließt das übersichtliche Detail-Popover über der Leiste.
  * **Aufklapp-Menü (`Ansicht & Atmosphäre`):**
    * **Tageszeit & Sonne:** Sonnenstand-Schieberegler, `● Echtzeit`-Sync, Uhrzeit-Presets (`08:00`, `14:30`, `19:45`, `22:30`) und Nord-Kompass (`N 0°`).
    * **Kamera-Blickwinkel:** `Gesamtanwesen`, `Wohnbereich`, `Garten & Pool`, `Einfahrt & Solar`, `2D-Draufsicht`.
    * **3D-Stil, Wetter & Feiertage:** `ArchViz` / `Neon` / `CAD`, Wetter-Auswahl (`Live-Sonne`, `Klar`, `Wolken`, `Regen`, `Schnee`, `Herbst` + `⚙ Wetter-ID`), Feiertags-Themes (`Auto`, `🎃`, `🎄`, `🐣`, `Aus`).
    * **Zusatz-Overlays & Grafik-Performance:** `Heatmap`, `⚡ Kabel`, `Radien`, `Cockpit`, `Personen` sowie Performance-Stufe (`Eco`, `Performant`, `Ultra`).

---

### 3. Key Product Decisions & Trade-Offs
* **Strikte Trennung von Gebäudehüllen und echten Räumen in der Navigation:** Übergeordnete Gebäudehüllen (`wohnraum_building`, `outbuilding`, *„Wohnraum“*, *„Haus“*, *„Nebengebäude“*) werden in der Raum-Schnellwahl des Steuerdocks ausgeblendet (sofern echte Innenräume vorhanden sind), damit nur tatsächliche Zimmer (*Wohnzimmer, Küche, Bad, Schlafzimmer* etc.) in der Raumleiste erscheinen.
* **Unterscheidung zwischen Klick und Kamera-Drehung (Orbit-Drag):** Damit beim freien Drehen oder Schwenken der 3D-Kamera mit der Maus nicht versehentlich ein Raum-Zoom ausgelöst wird, prüft der 3D-Viewport die Mausbewegung zwischen `pointerdown` und `pointerup` (`< 6 px` Distanz = gezielter Klick). Nur ein echter Klick löst den Raum-Fokus bzw. den Zurück-Flug in den Außenbereich aus.
* **Unabhängige Raumliste:** Die linke Raum- & Elemente-Übersicht ist nicht mehr an den Schalter `Labels` (schwebende 3D-Textschilder) gekoppelt, sondern lässt sich eigenständig ein- und ausklappen.

---

### 4. Technical Architecture & Data Strategy

```
┌────────────────────────────────────────────────────────────────────────────┐
│                   NeonPlan3D Interaktions- & Steuerungs-Flow               │
└─────────────────────────────────────┬──────────────────────────────────────┘
                                      │
        ┌─────────────────────────────┼─────────────────────────────┐
        ▼                             ▼                             ▼
┌──────────────────────┐   ┌──────────────────────┐   ┌──────────────────────┐
│  3D-Szene & Cards    │   │  1-Zeilen-Steuerdock │   │  Raum-Fokus-Engine   │
│  (Direkt-Interaktion)│   │  + Detail-Popover    │   │  (Kamera & HUD)      │
├──────────────────────┤   ├──────────────────────┤   ├──────────────────────┤
│ • Klick auf Gerät:   │   │ • Zeile 1 (kompakt): │   │ • Sanfter Kameraflug │
│   Schaltet/Wählt     │   │   Etagen | Raum-Pills│   │   in Raum oder auf   │
│   Aktor/Öffnung      │   │   | Tour | Wände |   │   │   savedCameraView    │
│ • Klick auf Raum-    │   │   Cards | ⚙ Details  │   │ • Auto-Wandschnitt + │
│   boden oder 3D-Card:│   │ • Popover-Menü:      │   │   Umgebungs-Dimming  │
│   Startet Raum-Fokus │   │   Sonne/Uhr, Wetter, │   │ • ‹ Vor / Zurück ›   │
│ • Klick in Außen-    │   │   Kamera-Presets,    │   │   Raum-Zyklus +      │
│   bereich oder ESC:  │   │   Stil, Themes,      │   │   Licht/Rollo-Master │
│   Zurück zur Übersicht│   │   Overlays & Grafik  │   │   Schnellschalter    │
└──────────────────────┘   └──────────────────────┘   └──────────────────────┘
```

* **3D-Raycasting für Live-Raumklick & Außenbereich-Reset:**
  * Bei einem kurzen Klick (`pointerdown` → `pointerup` Distanz `< 6 px`) im Live-Modus prüft der Raycaster zuerst interaktive 3D-Assets und Tür-/Fenster-Öffnungen.
  * Wird kein Gerät getroffen, prüft der Raycaster die Raumböden (`architectureGroup`):
    * Trifft der Klick einen echten Innenraum (`isInteriorRoom`), wird `onFocusZone(hitZoneId)` aktiviert (bzw. bei Klick auf einen anderen Raum direkt dorthin gewechselt).
    * Ist aktuell ein Raum fokussiert (`focusedZoneId !== null`) und der Nutzer klickt in den freien Außenbereich, auf das Grundstück (`estateTerrain`) oder drückt `Escape`, wird `onFocusZone(null)` aufgerufen und die Kamera gleitet zurück in die Gebäudeübersicht.
* **1-Zeilen-Architektur des Steuerdocks:**
  * Die Hauptleiste bleibt permanent einzeilig (`flex-nowrap` mit horizontal scrollbarer Raum-Pill-Sektion in der Mitte), während ein aufklappbares Einstellungs-Panel (`showDetailsMenu`) alle sekundären Regler (Sonnenstand, Kamera-Presets, Wetter, Stil, Overlays, Performance) strukturiert in Sektionen bereitstellt und sich bei Klick außerhalb oder per `ESC` wieder schließt.
