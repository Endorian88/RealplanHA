# Umsetzungsplan: Wand-Kollision & Snapping, Freiform-Treppen, 2D-CAD-Symbole, Isolierter Einzelwand-Designer & UI-Bereinigung

## 1. Harter Wand-Stopp für Möbel & Wand-Snapping für Heizkörper / Paneele
- **Ursachenbehebung im 2D-Grundriss (`TwoDFloorplanCanvas.tsx`) & beim Platzieren (`App.tsx`)**:
  - Korrektur des Tupel-Zugriffs von `getAssetEffectiveFootprint(asset, catalogItem)` (`[widthM, depthM, heightM]`), sodass im 2D-Grundriss sowohl die echten Objektmaße in Metern als auch die Parameter für `snapAssetToNearestRoomWall` und `clampAssetPositionInsideRoomWalls` exakt übergeben werden.
  - **Wand-Snapping für Heizkörper & Wandpaneele**: Heizkörper, Akustikpaneele und Wandschränke snappen bereits beim Einsetzen aus dem Katalog sowie beim Ziehen im 2D- und 3D-Plan automatisch bündig an die nächstgelegene Raum-Innenwand und richten ihre Rotation automatisch parallel zur Wand aus.
  - **Harter Wand-Stopp für Möbel**: Tische, Sofas, Betten, Schränke und sonstige Raummöbel werden beim Ziehen in 2D und 3D durch `clampAssetPositionInsideRoomWalls` hart an den Innenwänden ihres Raums gestoppt und können nicht mehr in oder durch Wände geschoben werden.

## 2. Treppe im 2D-Plan frei aufziehen + 1-Klick Raum-Einpassung (ohne 3D-Wandüberstand)
- **Zieh-Griffe (Corner/Edge Handles) im 2D-Plan**:
  - Ausgewählte Treppen (sowie skalierbare Möbel) erhalten im 2D-Grundriss interaktive Eck- und Kanten-Ziehgriffe, mit denen man die Treppe direkt auf die exakte Form bzw. Wand-zu-Wand-Breite und Tiefe des Raums oder Treppenhauses aufziehen kann (inkl. automatischem Stopp an den Raumwänden).
- **1-Klick „An Raum anpassen" + Treppentyp-Wahl**:
  - Im Treppen-Inspektor (`EditorWorkspacePanel.tsx`) gibt es neben der direkten Form-Auswahl (Gerade, L-Treppe links/rechts, U-Podesttreppe, Viertelgewendelt, Spindeltreppe) einen **„An Raum / Wände einpassen"**-Button, der die Treppe automatisch passgenau von Wand zu Wand in den aktuellen Raum setzt.
- **Kein Herausschauen aus 3D-Wänden (`assetBuilder.ts` & `ThreeFloorplanViewport.tsx`)**:
  - Die 3D-Treppengeometrie (Stufen, Podeste, Wangen und Geländer) wird exakt auf den `[customWidth, customLength]`-Grundriss begrenzt und an die Innenwände des Raums angepasst, sodass in der 3D-Ansicht keinerlei Bauteile mehr durch Außen- oder Innenwände ragen.

## 3. Detaillierte 2D-Architektur-Symbole statt einfacher Kästchen (`TwoDFloorplanCanvas.tsx`)
- **Maßstabsgetreue 2D-Draufsichten**:
  - Durch die Behebung der Footprint-Umrechnung werden alle Objekte im 2D-Plan in ihren exakten realen Meter-Abmessungen gezeichnet.
  - **Erweiterte 2D-CAD-Grafiken für alle Kategorien**:
    - **Wohnen & Schlafen**: Sofas (Einzel, L-Form, U-Wohnlandschaft, Ottomane mit Rücken-/Armlehnen und Polstersegmenten), Betten (Kopfteil, Kissen, Decken-Faltung), Esstische mit angedeuteten Stühlen, Schreibtische mit Stuhl/Monitor-Kontur, TV-/Lowboards.
    - **Küche & Schränke**: Küchenzeilen und Kochinseln mit Kochfeld-Ringen und Spülbecken, Kleiderschränke/Garderoben mit Türflügel-Schraffur bzw. Bügel-Symbolik.
    - **Bad & Sanitär**: Badewanne mit Innenwanne und Ablauf, Dusche mit Glasabtrennung und Gefälle-Linien, WC mit Spülkasten und Keramikform, Waschtisch mit Becken und Armatur.
    - **Technik, Licht & Außenbereich**: Heizkörper mit Rippen-/Plattenprofil an der Wand, Treppen mit Stufenlinien, Lauflinie und Richtungspfeil (auch für L- und U-Form), Lampen/Leuchten mit Strahlen-Symbolik, Bäume/Pflanzen mit Blattkrone, PKW-Silhouette, Wärmepumpe und Unterverteiler.

## 4. Isolierter Einzelwand-Designer (2D-Wand-Klick -> Freie Frontalansicht der Wand)
- **Direkter Einstieg über Raum & Wand-Klick**:
  - Wenn ein Raum ausgewählt ist und man auf **„Wand-Designer"** klickt (oder im 2D-Plan direkt eine der vier Raumwände Nord/Ost/Süd/West anklickt), öffnet sich die **isolierte Frontalansicht genau dieser einen Wand**.
- **Freie Platzierung mit Höhenposition & Fenster-/Tür-Sperrflächen (`WallModulePlannerModal.tsx`)**:
  - Die ausgewählte Wand wird maßstabsgetreu als frontale Aufriss-Ansicht (Wandbreite × Raumhöhe) dargestellt.
  - Alle auf dieser Wand vorhandenen **Fenster und Türen** werden automatisch an ihrer echten Position als schraffierte **Sperrflächen** eingezeichnet, sodass man sofort sieht, wo Platz für Schränke ist.
  - Schränke, Hängeschränke, Küchenmodule, Regale, Lowboards, Fernseher, Spiegel, Akustikpaneele und Heizkörper lassen sich per Drag-and-Drop **frei entlang der Wand (X-Position) und in der Montagehöhe (Y-Position vom Boden)** verschieben sowie in Breite, Höhe, Tiefe und Farbe anpassen (inkl. Kollisionswarnung bei Fenstern/Türen und direkter Übernahme in den 2D/3D-Raum).

## 5. UI-Bereinigung: Doppelte Gebäude-Zuordnung & „Sensor"-Zusätze in Labels
- **Doppelte Gebäude-Zuordnung entfernen (`EditorWorkspacePanel.tsx`)**:
  - In der Raum-Karte wird der doppelte Abschnitt rund um „Baukörper synchronisieren" / zweite Gebäude-Auswahl entfernt, sodass es nur noch **eine einzige, klare Gebäude-Zuordnung** (Hauptgebäude / Nebengebäude + übergeordneter Wohnraum) gibt.
- **Vollständige Entfernung von „Sensor"-Zusätzen bei aktiven Labels**:
  - Sowohl in den schwebenden 3D-Badges als auch in der eingeblendeten Raum-/Elemente-Liste (`ThreeFloorplanViewport.tsx`), den Live-Ereignissen (`SmartCockpitCardsOverlay.tsx`) und bestehenden Projektdaten (`App.tsx`) werden Zusätze wie `Sensor`, `(2-Sensor...)`, `Raumluftsensor`, `Kontaktsensor` oder `Bewegungsmelder` automatisch bereinigt, sodass ausschließlich der saubere Name (z. B. `Wohnzimmer` oder `Haustür`) angezeigt wird.
