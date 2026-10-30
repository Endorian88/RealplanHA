# Implementierungsplan: 3D-Bodenplatten-Abschluss, Kellertreppe KG→EG, Freies Drehen, Outdoor-Küche & Pool-Technik, 3D-Raum-Mini-Cards, Blickrichtungs-Wandabsenkung & Bereinigtes Live-Cockpit

## 1. Bündiger 3D-Abschluss von Bodenplatte, Außenwand und Sockel (`ThreeFloorplanViewport.tsx`)
1. **Automatische Bereinigung überstehender Wohnraum-Hüllzonen**:
   - Existiert auf einer Etage eine übergeordnete Gebäude-/Wohnraum-Zone (`wohnraum_building` / `outbuilding`) zusätzlich zu den einzelnen Räumen, wird deren `0.14 m` dicke Bodenplatte auf die Innenkontur der tatsächlichen Raumwände begrenzt bzw. ausgeblendet, sodass vor den weißen Außenwänden (z.B. neben der Eingangstreppe und unter den Fenstern) kein brauner Holzboden-Rand mehr hervorschaut.
2. **Allseitiges Einrücken der Bodenplatte hinter Außenwand & Sockel**:
   - Alle Indoor-Bodenplatten (sowohl Rechteck- als auch Polygon-/gedrehte Räume auf KG, EG, 1. OG, DG) werden allseitig um die halbe Wandstärke (`0.06 m` pro Kante nach innen, `slabInset = 0.12 m`) eingerückt, damit sie vollständig innerhalb der `0.14 m` starken Außenwände liegen.
   - Die vertikale Dicke der Indoor-Bodenplatten wird auf `0.024 m` vereinheitlicht und der Keller-Sockel (`plinthBlock`) schließt bündig mit der Außenfläche der Außenwände (`+ wallT`) bis zur Wandunterkante (`yOffset`) ab.

---

## 2. Außentreppe vom Keller (KG) ins Erdgeschoss (EG) sichtbar machen (`ThreeFloorplanViewport.tsx` & `EditorWorkspacePanel.tsx`)
1. **Etagenübergreifende Sichtbarkeit in 2D und 3D (KG ↔ EG)**:
   - Wird eine Keller-Außentreppe (`outdoor_stairs_kellertreppe`) oder eine Treppe im Kellergeschoss (`level = -1`) platziert, bleibt sie auch beim Wechsel ins **Erdgeschoss (`EG`, `level = 0`)** sowie in der Gesamtansicht (`all_stacked`) sowohl im **2D-Grundriss** als auch in der **3D-Ansicht** vollständig sichtbar und auswählbar.
2. **Korrekte 3D-Höhenlage & Automatischer Boden-Ausschnitt im EG**:
   - Eine im KG (`level = -1`) oder EG (`level = 0`) platzierte `outdoor_stairs_kellertreppe` schließt mit ihrer oberen Treppenkante immer bündig auf Erdgeschoss-Terrain-Niveau (`Y = 0`) ab und führt von dort nach unten zum Kellerzugang (statt bei `level = -1` um eine zusätzliche Etagenhöhe im Boden zu versinken).
   - Gleichzeitig stanzt die Keller-Außentreppe automatisch eine passende Öffnung (Treppenschacht-Cutout) in darunter-/darüberliegende Outdoor-Zonen (Rasen, Terrasse, Pflaster), damit der Treppenabgang von oben frei einsehbar und begehbar ist.

---

## 3. Freies stufenloses Drehen (0°–360°) zusätzlich zu den 90°/45°-Buttons (`EditorWorkspacePanel.tsx`, `TwoDFloorplanCanvas.tsx`)
1. **Interaktiver 2D-Dreh-Griff (`↻`) direkt auf dem Canvas**:
   - Jedes ausgewählte Objekt/Möbelstück/Treppe sowie jeder ausgewählte Raum erhält im 2D-Editor oberhalb der Auswahlbox einen ziehbaren **Rotations-Anfasser (`↻`)**.
   - Beim Ziehen mit der Maus lässt sich das Element stufenlos (`1°`-genau) um seinen Mittelpunkt drehen (mit gedrückter `Shift`-Taste rastet es komfortabel in `15°`-Schritten ein).
2. **360°-Dreh-Slider & Grad-Direkteingabe im Inspektor**:
   - Zusätzlich zu den bisherigen `-90° / -45° / +45° / +90°`-Buttons erhalten sowohl **Objekte/Geräte/Treppen**, **Türen/Fenster** als auch **Räume/Zonen** einen stufenlosen **0°–360° Schieberegler** sowie ein direktes **Zahlenfeld (`°`)** zur millimetergenauen freien Ausrichtung.

---

## 4. Neue Katalog-Elemente: Outdoor-Küche & Pool-Technik (`catalogAndInitialState.ts`, `assetBuilder.ts`, `EditorWorkspacePanel.tsx`)

### A. Outdoor-Küchenelemente (mit detailliertem 2D-Architektursymbol & 3D-Modell)
1. **Outdoor-Gasgrill & BBQ-Station (`outdoor_kitchen_bbq_station`)**: Edelstahl-Einbaugrill mit Thermometer-Haube, LED-Drehreglern, Seitenbrenner und Anthrazit-Naturstein-Unterschrank.
2. **Outdoor-Spül- & Kühlschrank-Modul (`outdoor_kitchen_sink_fridge`)**: Wetterfeste Granit-Arbeitsplatte mit Edelstahl-Spülbecken, Designer-Armatur und beleuchtetem Getränke-Glaskühlschrank.
3. **Outdoor-Pizzaofen / Holzbackofen (`outdoor_kitchen_pizza_oven`)**: Kuppel-Steinbackofen auf Unterschrank mit Edelstahl-Rauchrohr, Glutöffnung und Brennholz-Lagerfach.
4. **Outdoor-Kücheninsel & Bar-Theke (`outdoor_kitchen_corner_island`)**: Komplette L-Outdoor-Küchenzeile mit Grillfläche, Spüle, Thekenüberstand und Barhockern.

### B. Pool-Technik (mit Home-Assistant-Entitätsanbindung & 3D-Modell)
1. **Pool-Sandfilteranlage & Umwälzpumpe (`pool_sand_filter_pump`)**: Filterkessel mit 6-Wege-Ventil, Manometer, Vorfilter-Umwälzpumpe und Verrohrung auf Technikplatte (anbindbar an Schalter/Leistungssensor).
2. **Pool-Wärmepumpe / Inverter-Heizung (`pool_heat_pump`)**: Kompakte Pool-Inverter-Wärmepumpe mit Lüfter, Titan-Wärmetauscher-Anschlüssen, Vor-/Rücklauf und Digital-Display (anbindbar an `climate.*` / `sensor.*`).
3. **Pool-Salzelektrolyse & Dosieranlage (`pool_dosing_control_unit`)**: Steuereinheit mit pH-/Redox-Dosierpumpen, Messzelle und Kanistern für automatische Wasserpflege.

---

## 5. Schwebende Raum-Status-Mini-Cards in der Live-3D-Ansicht (`ThreeFloorplanViewport.tsx`, `EditorWorkspacePanel.tsx`)
1. **Frei wählbare Konfiguration pro Raum (`roomStatusCardConfig`)**:
   - Anzeigemodus: `'tour_and_focus'` (Standard: erscheint automatisch bei Haus-&-Raum-Tour sowie beim Raum-Zoom/Fokus), `'always'` (immer im Raum schwebend) oder `'off'`.
   - Frei an-/abwählbare Werte pro Raum: **Temperatur (`°C`)**, **Luftfeuchte (`%`)**, **Lichter (`AN/Gesamt` mit Direkt-Toggle)**, **Fenster/Türen (`Offen/Zu`)**, **Stromverbrauch (`W`)** sowie **eigene Zusatz-Entitäten (`customEntityIds`)**.
2. **Konfigurations-UI & 3D-Einblendung**:
   - Konfigurierbar im Raum-Inspektor des Editors sowie direkt im Live-3D-Raum-Fokus-HUD über **„⚙️ Raum-Card Felder“**.
   - Schwebt während der **Haus- & Raum-Tour** und beim **Raum-Zoom** als kompaktes, interaktives Glassmorphism-Overlay direkt über dem jeweiligen Raum.

---

## 6. Blickrichtungsabhängige Wand-Absenkung & Intelligentes Ausblenden bei Kamerafahrt (`ThreeFloorplanViewport.tsx`)
1. **Dynamische Wand-Absenkung nur auf der Kamera-Vorderseite (Blickrichtung)**:
   - Statt bei der Kamerafahrt (Haus-&-Raum-Tour, Raum-Fokus oder Cutaway-Ansicht) pauschal alle Wände eines Raumes abzusenken, wird pro Wandsegment das Skalarprodukt zwischen dem **Wand-Außen-Normalenvektor `(nx, nz)`** und dem **Kamera-Blickvektor** berechnet.
   - **Nur Wände, die zwischen Kamera und Rauminnerem stehen** (dem Betrachter zugewandte Vorderwände, `dot > 0.15`), werden sanft auf Sockelhöhe (`0.12`) abgesenkt, damit man freien Blick in den Raum hat.
   - **Rückwände und abgewandte Seitenwände (`dot <= 0.15`) bleiben auf voller Raumhöhe (`1.0`) stehen**, sodass ein realistischer „Puppenstubeneffekt“ (Guckkasten-Blick) entsteht.
2. **Selektives Mit-Ausblenden von Decken- & Vorderwand-Objekten (Rückwand-Öffnungen bleiben sichtbar)**:
   - **An abgesenkten Vorderwänden (`wallScaleY < 0.55`) sowie an der Raumdecke** werden montierte Elemente während des Reinguckens automatisch ausgeblendet:
     - **Deckenobjekte (`mountType === 'ceiling'`)** im betrachteten Raum wie **Rauchmelder (`smoke_detector`)**, Deckenleuchten/Spots und Decken-Präsenzmelder schweben nicht mehr frei in der Luft, sondern blenden sanft aus.
     - **Wandobjekte & Wandmöbel an der abgesenkten Vorderwand** wie **Wandlampen (`wall_sconce_light`)**, **Garderoben (`coat_rack_wardrobe`)**, **Heizkörper**, **Hängeschränke/Wandmodule** sowie **Türen/Fenster in dieser abgesenkten Vorderwand** blenden zusammen mit ihrer Wand aus.
   - **Auf der nicht abgesenkten Rück- und Sichtseite (`wallScaleY >= 0.55`) bleiben alle Fenster, Türen, Garagentore, Wandlampen, Garderoben und Schränke zu 100 % sichtbar!**

---

## 7. Straßenlaternen strikt nur nachts einschalten (`ThreeFloorplanViewport.tsx`)
1. **Tageszeitabhängige Zwangsabschaltung bei Tag**:
   - Straßenlaternen (`isStreetLampAsset(asset.catalogId)`) und Außen-Pollerleuchten prüfen die aktuelle 3D-Sonnenzeit (`sunHour`).
   - Tagsüber (`sunHour >= 7.0 && sunHour <= 18.2`, also `!isDuskOrNight`) bleiben Straßenlaternen inkl. Leuchtkegel und Punktlicht **garantiert ausgeschaltet (`off`)** – selbst wenn eine Demo-Entität auf `'on'` steht.
   - Erst in der Dämmerung und nachts (`isDuskOrNight`) schalten sich die Straßenlaternen automatisch ein.

---

## 8. Keine automatischen Zwangs-Entitäten & Bereinigtes Live-Cockpit (`App.tsx`, `EditorWorkspacePanel.tsx`, `SmartCockpitCardsOverlay.tsx`)
1. **Keine ungefragte Entitäts-Generierung beim Platzieren von Objekten, Fenstern & Türen (`App.tsx`)**:
   - Beim Platzieren eines neuen Katalog-Objekts (`handlePlaceCatalogItemAt`) oder einer Tür/eines Fensters (`handleAddOpening`) werden **keine künstlichen Entitäts-IDs** (`binary_sensor.fenster_...`, `light.ceiling_led_panel_...`, `cover.rollladen_...`) mehr automatisch generiert und in die Entitätsliste eingetragen.
   - Neue Objekte/Öffnungen starten standardmäßig **ohne künstliche Zwangs-Entität (`entityId: undefined`)**.
   - Im Eigenschaften-Inspektor (`EditorWorkspacePanel.tsx`) kann der Nutzer bei Bedarf entweder eine **echte Home-Assistant-Entität** auswählen oder **optional per Button („+ Simulierte Test-Entität anlegen“)** gezielt eine Demo-Entität für Offline-Tests erzeugen.
2. **Live-Cockpit zeigt unter „Kameras“, „Geräte“ & „Technik“ nur tatsächlich eingebundene/platzierte Elemente (`SmartCockpitCardsOverlay.tsx`, `DevicesAndEnergyView.tsx`)**:
   - Im Live-Cockpit (`SmartCockpitCardsOverlay.tsx`) werden unter den Reitern **Kameras**, **Geräte**, **Technik** und **Energie** nur noch Entitäten aufgelistet, die **tatsächlich im aktuellen Grundriss (`project.assets`, `project.openings`, `project.zones`) platziert und verknüpft** oder vom Nutzer explizit als eigene Cockpit-Karte (`cockpitCfg.customCards`) hinzugefügt wurden.
   - Nicht platzierte Demo-Kameras (`camera.einfahrt_4k`, `camera.garten_pool_4k` etc.) oder nicht vorhandene Demo-Geräte (Saugroboter, Mähroboter, Wallbox etc.) tauchen nicht mehr ungefragt im Live-Cockpit auf.

---

## 9. HACS-Bundle & Versionierung (`v4.4.1`)
- Kompilieren und Synchronisieren der aktualisierten Bundles (`realplan3d.js`, `realplan3d.css`) sowie Versions-Bump auf `4.4.1` in `manifest.json`, `__init__.py`, `realplan3d-panel.js` und `index.html`.
