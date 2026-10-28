# Implementierungsplan: Gebäude-Hierarchie, Sockel-Anhebung, Treppen-Geometrie & Haustechnik-Cockpit

## 1. Übersicht & Zielsetzung

Dieses Update behebt die geometrischen Probleme bei Außentreppen, Dächern und Zäunen und erweitert RealPlan 3D um eine saubere **Gebäude-Hierarchie**, **zweifach gewendelte Innentreppen (C-Form & S-Form)** mit **automatischem Dachschrägen-Zuschnitt** sowie ein **Haustechnik-Komplettpaket** (3D-Assets + Live-Cockpit-Tab mit detaillierten Entitäts-Zuordnungen).

```
+-----------------------------------------------------------------------------------+
|                              GEBÄUDE- & RAUM-HIERARCHIE                           |
|                                                                                   |
|  [ Gebäude-Cluster (z.B. Haupthaus, Garage / Nebengebäude) ]                      |
|     │                                                                             |
|     ├── Einheitlicher Gebäude-Sockel (plinthHeight aus Außentreppe / Sockel)      |
|     │     └── Hebt ALLE zugehörigen Räume, Innenwände, Türen, Fenster & Etagen    |
|     │         (EG, 1. OG, DG) synchron an — Außentreppe bleibt bei Y = 0 am Boden |
|     │                                                                             |
|     ├── Etagen-Gliederung & Referenz-Umrisse                                      |
|     │     ├── KG (-1): Zeigt gestrichelte Referenz-Umrisse des EG (0) darüber     |
|     │     └── OG (1+): Zeigt Referenz-Umrisse der darunterliegenden Etage         |
|     │                                                                             |
|     └── Baumstruktur in Editor & Live-Ansicht                                     |
|           └── Gebäude -> Etage -> Untergeordnete Räume (Auto-Cluster + Manuell)   |
+-----------------------------------------------------------------------------------+
```

---

## 2. Geplante Erweiterungen im Detail

### 2.1 Gartenzaun- & Hecken-Snapping (Ende-an-Ende & 90°-Winkel)
* **Magnetische Endpunkte in 2D & 3D:** Jedes platzierte Zaun- oder Heckenelement besitzt zwei berechnete Endpunkte entlang seiner Ausrichtungsachse (abhängig von Position, Länge und Rotation).
* **Nahtloses Aneinanderreihen:** Beim Ziehen oder Platzieren eines Gartenzauns rastet dessen Start- oder Endpunkt magnetisch am Endpunkt eines benachbarten Zaunsegments ein:
  * **Gerade Fortsetzung (0° / 180°):** Übernimmt automatisch die Fluchtlinie des bestehenden Zauns.
  * **Eck-Snapping (±90°):** Ermöglicht exakte rechtwinklige Zaunecken ohne Überlappung oder Lücken.
* **Visuelles Feedback:** Eine leuchtende Fangpunkt-Markierung zeigt im 2D- und 3D-Editor an, sobald zwei Zaunenden einrasten.

### 2.2 Außentreppe & Synchrones Anheben aller Räume und Etagen
* **Ursachenbehebung:** Bisher wurde beim Platzieren einer Außentreppe (oder Aktivieren einer Eingangsstufe) teilweise nur die äußere Gebäudehülle angehoben, während innenliegende Räume auf `Y = 0` blieben und das `1. OG` durch eine fehlerhafte Höhenreferenz unter dem Dach abgeschnitten oder ausgeblendet wurde.
* **Einheitliche Sockel-Berechnung (`plinthHeight`) pro Gebäude:**
  * Sobald eine Außentreppe an einer Außenwand anliegt oder dem Gebäude ein Sockel zugewiesen ist, gilt dieser Sockelwert für das **gesamte zusammenhängende Gebäude** (über alle Etagen ab `EG` aufwärts).
  * **Alle untergeordneten Innenräume, Trennwände, Türen, Fenster, Decken, Dächer und Möbel** des Gebäudes im `EG`, `1. OG` und `DG` werden exakt um denselben Sockelbetrag angehoben.
  * **Außentreppen bleiben am Boden (`Y = 0`):** Die Außentreppe selbst startet auf dem Grundstücksniveau (`Y = 0`) und überbrückt exakt die Höhendifferenz bis zur angehobenen Erdgeschoss-Oberkante.
  * **Korrekte Darstellung des 1. OG:** Die Dach-Schnitthöhenberechnung berücksichtigt den Gebäude-Sockel konsistent, sodass Räume und Wände im `1. OG` vollständig erhalten bleiben und präzise an die Dachunterseite anschließen.

### 2.3 Gebäude-Hierarchie (Räume dem Gebäude untergeordnet)
* **Automatische Baukörper-Erkennung + Manuelle Zuweisung:**
  * Räume, die sich berühren, überlappen oder innerhalb einer gemeinsamen Außenhülle (auch über mehrere Etagen hinweg) liegen, werden automatisch demselben Gebäude-Baukörper (z. B. *Haupthaus*, *Nebengebäude / Garage*) zugeordnet.
  * Im Eigenschaften-Inspektor jedes Raumes kann das übergeordnete Gebäude jederzeit manuell geändert, neu angelegt oder umbenannt werden.
* **Strukturierte Übersicht in Editor & Live-Ansicht:**
  * Sowohl in der linken Raum- & Elementeliste des Editors als auch in der Raum-Navigation der Live-Ansicht werden Räume übersichtlich unter ihrem jeweiligen **Gebäude** gruppiert dargestellt.

### 2.4 Keller-Referenzumrisse (Umrisse des Erdgeschosses im Keller sichtbar)
* **2D-Grundriss im Kellergeschoss (`KG`):** Wenn das Kellergeschoss (`Etage -1`) aktiv ist, werden die Umrisse, Wände und Treppenpositionen des **darüberliegenden Erdgeschosses (`EG`, Etage 0)** als halbtransparente, gestrichelte Referenzlinien („Ghost-Layer" mit Beschriftung *„EG darüber"*) eingeblendet.
* **3D-Orientierungsrahmen im Keller:** Auch in der 3D-Ansicht wird bei aktivem Keller auf Wunsch ein dezenter Referenzumriss des darüberliegenden Erdgeschosses angezeigt, damit tragende Wände, Schächte und Kellerabgänge exakt ausgerichtet werden können.

### 2.5 Zweifach gewendelte Innentreppen (C-Form & S-Form) & Dachschrägen-Zuschnitt
* **Neue Treppenformen im Katalog & Konfigurator:**
  * **Zweifach gewendelte Treppe – C-Form (gleiche Drehrichtung unten & oben):** Viertelwendelung am Antritt (unten), gerader Mittellauf und Viertelwendelung am Austritt (oben) in derselben Richtung (180°-Gesamtdrehung mit verzogenen Stufen unten und oben).
  * **Zweifach gewendelte Treppe – S-Form (gegenläufig unten & oben):** Viertelwendelung am Antritt (unten) in die eine Richtung und Viertelwendelung am Austritt (oben) in die entgegengesetzte Richtung.
  * Für beide Varianten lässt sich die Laufrichtung (links-/rechtsdrehend) im Inspektor umschalten.
* **Automatisches Abschneiden von Geländern & Pfosten am Dach:**
  * Für jede Treppe wird in 3D die lokale Dachunterseite über die exakte Weltposition jedes Stufen-, Wangen-, Pfosten- und Handlauf-Segments ausgewertet.
  * Ragten Geländerpfosten oder Handläufe bisher durch eine Dachschräge nach außen, werden sie nun exakt an der Dachunterseite gekappt bzw. schräg entlang der Dachneigung geführt, sodass nichts mehr aus dem Dach herausragt.

```
+-----------------------------------------------------------------------------------+
|                     HAUSTECHNIK-KOMPLETTPAKET (3D + LIVE-COCKPIT)                 |
+-----------------------------------------------------------------------------------+
|                                                                                   |
|  3D-KATALOG-ASSETS                      SPEZIFISCHE HA-ENTITÄTSFELDER             |
|  ─────────────────                      ─────────────────────────────             |
|  1. PV-Anlage / Wechselrichter  ──────> Erzeugung (W/kW), Tagesertrag (kWh),      |
|     & Batteriespeicher                  Speicher-SOC (%), Netzbezug/Einspeisung   |
|                                                                                   |
|  2. Wärmepumpe (Innen & Außen)  ──────> Status/Modus, Vorlauftemp., Rücklauftemp.,|
|                                         Leistungsaufnahme (W), COP / Arbeitszahl  |
|                                                                                   |
|  3. Warmwasserspeicher / Puffer ──────> Speichertemp. Oben/Mitte, Soll-Temp.,     |
|                                         Aufheiz-Status / Zirkulationspumpe        |
|                                                                                   |
|  4. Zählerschrank / Smart Meter ──────> Aktuelle Gesamtleistung (W),              |
|                                         Netzbezug (kWh), Einspeisung (kWh),       |
|                                         Phasen-Auslastung / Sicherungs-Status     |
|                                                                                   |
|  5. Smart-Home-Zentrale / Rack  ──────> Systemstatus, CPU/RAM/Temp.,              |
|                                         Zigbee/Thread/KNX-Gateway-Status          |
|                                                                                   |
|  ═══════════════════════════════════════════════════════════════════════════════  |
|  AUTOMATISCHE LIVE-VERKNÜPFUNG:                                                   |
|  • Eigener Reiter „Haustechnik" im Live-Cockpit                                   |
|  • Jedes platzierte 3D-Haustechnik-Objekt erzeugt automatisch eine detaillierte   |
|    Live-Systemkarte mit allen hinterlegten Messwerten (Vorlauf, Rücklauf, COP,    |
|    PV-Fluss, Speicherstand) + Klick-Fokus direkt zum 3D-Gerät im Grundriss.       |
+-----------------------------------------------------------------------------------+
```

### 2.6 Haustechnik-Assets & Live-Cockpit („Haustechnik"-Tab)
* **Neue detaillierte 3D-Modelle im Objektkatalog (Kategorie „Haustechnik & Energie"):**
  1. **PV-Wechselrichter & Heimspeicher** (Wand-Wechselrichter mit Status-LEDs + modularer Batteriespeicher-Turm; ergänzt die PV-Dachmodule).
  2. **Wärmepumpe Außengerät & Inneneinheit** (Monoblock-/Split-Außengerät mit animierbarem Lüfterrad sowie moderne Hydraulik-Inneneinheit).
  3. **Warmwasserspeicher / Schichtenspeicher** (Stehender Zylinder-Speicher mit Temperatur-Anzeige, Isoliermantel und Vor-/Rücklauf-Anschlüssen).
  4. **Zählerschrank / Unterverteilung** (Elektro-Verteilerschrank mit Sichtfenster, Smart-Meter-Zählerfeld und Leistungsschaltern).
  5. **Smart-Home-Zentrale / Server-Wandgehäuse** (Zentrale mit Status-Leuchtleiste, Funk-Antennen und Patchfeld).
* **Detaillierte Entitäts-Zuordnung pro Haustechnik-Gerät im Inspektor:**
  * Statt nur einer einzigen Entität bietet der Inspektor für Haustechnik-Geräte strukturierte Spezialfelder (z. B. *Vorlauftemperatur*, *Rücklauftemperatur*, *COP / Effizienz*, *Speichertemperatur*, *PV-Leistung*, *Batterie-Ladestand*, *Netzbezug / Einspeisung*, *Betriebsstatus*) inklusive Autovervollständigung für alle Home-Assistant-Sensoren.
* **Eigenes „Haustechnik"-Tab im Live-Cockpit & 3D-Badges:**
  * Neuer Tab **„Haustechnik"** in der Live-Cockpit-Leiste.
  * Alle im 3D-Plan platzierten Haustechnik-Objekte erscheinen dort automatisch als übersichtliche System-Cards mit ihren Live-Kennzahlen (z. B. Wärmepumpe mit Vorlauf/Rücklauf-Spreizung & COP, PV-Anlage mit aktuellem Energiefluss, Warmwasserspeicher mit Temperaturbalken).
  * Ein Klick auf die Card im Cockpit schwenkt die 3D-Kamera direkt zum jeweiligen Gerät (und wechselt bei Bedarf automatisch in den Keller/Technikraum).
