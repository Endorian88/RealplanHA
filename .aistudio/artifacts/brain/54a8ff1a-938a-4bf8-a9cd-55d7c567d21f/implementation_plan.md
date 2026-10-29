# RealPlan 3D — Wand-Planer, Möbel-Raster, Wand-Kollisionsschutz & Konfigurierbare Einrichtung

Dieses Upgrade erweitert den 2D- und 3D-Raumplaner um einen universellen **Wand- & Einbau-Planer** (für Küchen, Wohnwände, Garderoben und Schranksysteme pro ausgewählter Wand), ein umschaltbares **Möbel-Raster mit hartem Wand-Kollisionsschutz**, wand-snappende **Heizkörper** und **Akustikpaneele** mit frei einstellbaren Maßen und Ausführungen, vielseitige **Sofa-Formen und Stoff-Farben** sowie **wand-bündige Treppen** ohne 3D-Wandüberstand.

---

## User Review & Critical Decisions

> [!IMPORTANT]
> Alle Ihre Vorgaben aus den Rückfragen sind direkt im Konzept verankert:

- **Universeller Wand-Planer als Modul-Baukasten pro Wand**: Bei Auswahl einer beliebigen Raumwand (im 2D-Grundriss oder im Wand-Inspektor) öffnet ein Klick auf **„Diese Wand planen“** den interaktiven Wand-Planer für **Küche**, **Wohnwand**, **Garderobe** oder **Schranksystem** – sowohl mit fertigen Komplett-Vorlagen als auch mit frei kombinierbaren Einzelmodulen entlang der exakten Wandbreite.
- **Einstellbares Möbel-Raster (`5 cm / 10 cm / 25 cm / Aus`) & harter Wand-Stopp**: Möbel rasten beim Verschieben im gewählten Raster ein und stoppen beim Ziehen exakt bündig an der Innenkante von Raum- und Gebäudewänden, sodass kein Möbelstück versehentlich in oder durch eine Wand geschoben werden kann.
- **Heizkörper mit Wand-Snap, Wunschmaßen & 4 Bauformen**: Heizkörper rasten beim Bewegen automatisch flach an der nächstgelegenen Wand ein und lassen sich in **Breite**, **Höhe** sowie als **Flachheizkörper**, **Rippenheizkörper**, **Bad-Handtuchheizkörper** oder **Vertikal-Heizkörper** konfigurieren.
- **Akustikpaneele mit Wand-Snap, Holzton-Auswahl & freien Maßen**: Akustikpaneele snappen bündig an jede Wand und bieten frei einstellbare **Breite**, **Höhe** sowie wählbare **Holztöne** (Natur-Eiche, Dunkel-Nussbaum, Hell-Esche, Teak Warm, Anthrazit-Eiche).
- **Sofa-Konfigurator mit Formen, Ottomane & freier Stoff-Farbe**: Sofas unterstützen **Einzelsofa**, **L-Form links**, **L-Form rechts** und **U-Wohnlandschaft**, optional einen **Hocker / Ottomane** sowie eine **frei wählbare Stoff-Farbe** (Farbwähler + kuratierte Polster-Farben).
- **Treppen bündig von Wand zu Wand ohne 3D-Überstand**: Treppen lassen sich in 2D per Klick oder Drag exakt zwischen gegenüberliegende oder angrenzende Raumwände einpassen und werden in 3D präzise an der Wandinnenseite begrenzt, damit keine Stufen oder Wangen außen aus der Wand ragen.

---

## 1. Overview & Core Concept

- **Was umgesetzt wird**:
  1. **Universeller Wand-Planer (Küche, Wohnwand, Garderobe, Kleiderschrank)**:
     - Jede Raumwand (`Nord`, `Ost`, `Süd`, `West` sowie Freiform-Wandsegmente) erhält die Aktion **„Wand planen (Küche / Wohnwand / Garderobe / Schrank)“**.
     - Der Wand-Planer zeigt die ausgewählte Wand in einer frontalen **Wand-Ansicht (Aufriss)** inklusive vorhandener Türen und Fenster auf dieser Wand (als Sperrbereiche markiert).
     - Nutzer können entweder eine **Komplett-Vorlage** (z. B. *Küchenzeile mit Kochfeld & Spüle*, *Wohnzimmer-Medienwand mit Akustikpaneel & Lowboard*, *Flur-Garderobe mit Sitzbank & Spiegel*, *Einbau-Kleiderschrankwand*) auf die freie Wandlänge anwenden oder **Einzelmodule** (z. B. `60 cm Spülenschrank`, `60 cm Herd/Backofen`, `60 cm Hochschrank/Kühlschrank`, `80/90 cm Auszugsschrank`, `Hängeschrank`, `TV-Lowboard`, `Vitrine`, `Garderobenbank`, `Kleiderschrank-Element`) aneinanderreihen, Front-/Arbeitsplattenfarben wählen und direkt an der Wand platzieren.
  2. **Möbel-Raster (`5 / 10 / 25 cm`) & Harter Wand-Kollisionsschutz**:
     - In der 2D-Werkzeugleiste lässt sich das **Möbel-Raster** direkt zwischen `Aus`, `5 cm`, `10 cm` und `25 cm` umschalten.
     - Beim Ziehen von Möbeln und Einrichtungsgegenständen prüft die Kollisionslogik die gedrehte 2D-Bounding-Box des Objekts gegen die Innenwände des aktuellen Raums bzw. Gebäudes und begrenzt die Bewegung hart an der Wandoberfläche (`Hard Wall Clamp`).
  3. **Wand-snappende Heizkörper mit Typ- & Größenwahl**:
     - Heizkörper snappen beim Ziehen automatisch im korrekten Winkel an die nächste Wandkante (mit realistischem Wandabstand).
     - Im Inspektor sind **Typ** (`Flachheizkörper`, `Rippenheizkörper`, `Bad-Handtuchheizkörper`, `Vertikal-Heizkörper`), **Breite** (`30 cm – 240 cm`), **Höhe** (`30 cm – 220 cm`) und **Farbe** (Klassik-Weiß, Anthrazit, Mattschwarz, Chrom) frei einstellbar und werden in 2D wie 3D maßstabsgetreu dargestellt.
  4. **Wand-snappende Akustikpaneele mit Holzton, Breite & Höhe**:
     - Akustikpaneele rasten flach an der Wand ein und erlauben die freie Eingabe von **Breite** (`40 cm – 400 cm`), **Höhe** (`60 cm – 300 cm`), **Holzton** (`Eiche Natur`, `Nussbaum Dunkel`, `Esche Hell`, `Teak Warm`, ` Räuchereiche Schwarz`) sowie der Filz-Hintergrundfarbe.
  5. **Konfigurierbare Sofas (Formen, Hocker/Ottomane & Stoff-Farbe)**:
     - Direkt am Sofa lassen sich die **Bauform** (`Einzelsofa`, `L-Form links`, `L-Form rechts`, `U-Wohnlandschaft`), ein zusätzlicher **Hocker / Ottomane** (`Ein / Aus`), die **Gesamtbreite & Sitztiefe** sowie die **Stoff-Farbe** und **Kissen-Akzentfarbe** frei einstellen – mit exakter 2D-Grundrissform (L-/U-Kontur) und detailliertem 3D-Polstermodell.
  6. **Wand-zu-Wand-Treppen & 3D-Wand-Clippingschutz**:
     - Treppen erhalten im Inspektor und beim Ziehen einen **„Bündig an Raumwände einpassen“-Modus** (bzw. automatischen Wand-Stopp), sodass sie in 2D exakt von Wand zu Wand oder bündig in einer Raumecke sitzen und in 3D weder Wangen noch Podeste durch die Wand nach außen ragen.

---

## 2. User Experience & Visual Design

- **Key User Flows**:
  - **Wand-Planer öffnen & bestücken**:
    1. Der Nutzer klickt in 2D auf einen Raum oder direkt auf eine Wandkante (`Nord`, `Ost`, `Süd`, `West`) und wählt **„Wand planen“**.
    2. Im sich öffnenden **Wand-Baukasten-Dialog** wählt er die Kategorie (**Küche**, **Wohnwand**, **Garderobe**, **Schranksystem**), sieht die reale Wandlänge (z. B. `4,20 m`) samt eingezeichneter Türen/Fenster und klickt entweder auf eine **Schnell-Vorlage** oder fügt **Einzelmodule** hinzu (inkl. Button *„Restbreite automatisch füllen“*).
    3. Mit **„Auf Wand übernehmen“** werden die Module millimetergenau, im richtigen Drehwinkel und bündig an dieser Wand im 2D- und 3D-Plan platziert.
  - **Möbel mit Raster & Wand-Stopp verschieben**:
    1. Oben im 2D-Planer wählt der Nutzer das gewünschte Raster (`5 cm`, `10 cm`, `25 cm`).
    2. Zieht er ein Sofa, einen Schrank oder eine Treppe Richtung Wand, stoppt das Objekt exakt bündig an der Innenwand, ohne in das Mauerwerk einzudringen; wand-gebundene Objekte (Heizkörper, Akustikpaneele, Wandmodule) richten sich automatisch parallel zur Wand aus.
  - **Heizkörper, Akustikpaneele & Sofas anpassen**:
    1. Klickt der Nutzer auf einen Heizkörper, ein Akustikpaneel oder ein Sofa, erscheint im rechten Inspektor der jeweilige **Spezial-Konfigurator** (Heizkörper-Typ & Maße, Akustikpaneel-Holzton & Maße, Sofa-Form L/U + Ottomane + Stoff-Farbwähler), und 2D-Grundriss sowie 3D-Modell aktualisieren sich sofort live.

---

## 3. Key Product Decisions & Trade-Offs

- **Decision 1: Rotationsbewusste 2D-Wand-Kollision (`Oriented Bounding Box Clamp`) statt einfachem Mittelpunkt-Stopp**
  - *Chosen Approach*: Beim Verschieben eines Möbelstücks wird dessen tatsächliche Ausdehnung (`Breite × Tiefe` unter Berücksichtigung der Drehung `rotation` sowie der L-/U-Form) gegen die Innenkanten des umschließenden Raums geprüft und die Position hart begrenzt.
  - *Why*: Dadurch stoppt jedes Möbelstück – egal ob um 0°, 90° oder 45° gedreht – exakt mit seiner Außenkante an der Wandinnenseite und ragt niemals in Nachbarräume oder durch Außenwände.
- **Decision 2: Modul-Baukasten erzeugt echte, einzeln nachbearbeitbare 3D/2D-Wandmodule**
  - *Chosen Approach*: Der Wand-Planer reiht die gewählten Küchen-, Wohnwand-, Garderoben- oder Schrankmodule entlang des Wandvektors auf und speichert sie mit einer gemeinsamen Wand-Gruppen-Zuordnung (`wallGroupId` & `attachedWallSide`), sodass man die gesamte Wandzeile jederzeit erneut im Wand-Planer öffnen oder einzelne Module im Inspektor anpassen kann.
  - *Why*: Verbindet den Komfort eines geführten Küchen-/Schrankplaners mit voller Flexibilität im 2D/3D-Editor.
- **Decision 3: Treppen-Geometrie innerhalb der Netto-Raumgrenzen**
  - *Chosen Approach*: Treppen berücksichtigen beim Einpassen an eine Wand die halbe Wandstärke (`wallThickness / 2`) des Raums und begrenzen Wangen sowie Trittstufen in 3D exakt auf das Netto-Innenmaß des Raums.
  - *Why*: Verhindert zuverlässig, dass Treppenstufen oder Geländer in 3D außen aus der Hausfassade oder in den Nachbarraum herausschauen.

---

## 4. Technical Architecture & Data Strategy

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                     RealPlan 3D Floorplan Project State                      │
│   PlacedAsset (radiatorConfig, sofaConfig, acousticConfig, wallModuleConfig) │
└───────────────┬──────────────────────────────┬───────────────────────────────┘
                │                              │
                ▼                              ▼
┌────────────────────────────────────┐  ┌──────────────────────────────────────┐
│    2D-Canvas & Wand-Baukasten      │  │     Prozeduraler 3D-Asset-Builder    │
│ ────────────────────────────────── │  │ ──────────────────────────────────── │
│ • Einstellbares Raster (5/10/25cm) │  │ • 4 Heizkörper-Geometrien:           │
│ • Harter Wand-Kollisionsstopp      │  │   Flach, Rippen, Handtuch, Vertikal  │
│   (Oriented Bounding Box in Raum)  │  │ • 4 Sofa-Formen (Einzel, L-L, L-R, U)│
│ • Magnetischer Wand-Snap für       │  │   + Hocker/Ottomane & Stoff-Farbe    │
│   Heizkörper, Akustik & Wandmodule │  │ • Akustikpaneele mit Holzton-Shader  │
│ • Universeller Wand-Planer-Modal:  │  │   & exakter Breite × Höhe            │
│   Küche / Wohnwand / Garderobe /   │  │ • Küchen-, Wohnwand-, Garderoben-    │
│   Schrank (Vorlagen & Einzelmodule)│  │   & Schrankmodule entlang der Wand   │
│ • Treppen Wand-zu-Wand-Einpassung  │  │ • Wand-bündiges 3D-Treppen-Clipping  │
└────────────────────────────────────┘  └──────────────────────────────────────┘
```

- **Erweiterungen im Datenmodell (`PlacedAsset`)**:
  - `radiatorConfig`: `{ radiatorType: 'flat_panel' | 'ribbed_classic' | 'towel_bathroom' | 'vertical_designer'; finishColor?: string; snapToWall?: boolean }` (kombiniert mit `customWidth`, `customHeight`, `customDepth`).
  - `sofaConfig`: `{ shape: 'single' | 'l_left' | 'l_right' | 'u_shape'; chaiseDepth?: number; hasOttoman?: boolean; fabricColor: string; cushionColor?: string }`.
  - `acousticPanelConfig`: `{ woodTone: 'oak_natural' | 'walnut_dark' | 'ash_light' | 'teak_warm' | 'charcoal_black'; feltColor?: string; slatSpacingCm?: number }` (kombiniert mit `customWidth`, `customHeight`).
  - `wallModuleConfig`: `{ category: 'kitchen' | 'living_wall' | 'wardrobe' | 'closet'; moduleType: string; frontColor: string; countertopColor?: string; hasUpperCabinet?: boolean; attachedZoneId: string; attachedWallSide: WallSideId; offsetAlongWall: number; wallGroupId?: string }`.
