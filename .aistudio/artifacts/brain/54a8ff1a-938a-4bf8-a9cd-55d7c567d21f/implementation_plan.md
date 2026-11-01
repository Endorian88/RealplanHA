# Flüssige 3D-Kamerafahrt & Winter-Schneedecke

### User Review & Critical Decisions
* **3D-Raum-Cards & Badges während der Fahrt:** *Subpixel-Gleitflug in Fahrt, Scharf-Rastung im Stand* — Während sich die Kamera bewegt, gleiten alle schwebenden 3D-Cards und Badges mit präzisen Subpixel-Koordinaten (`translate3d`) ohne 1-Pixel-Treppeneffekt über das Bild; sobald die Kamera zur Ruhe kommt, rasten sie auf ganzzahlige Pixelkoordinaten (`translate`) ein, damit die Typografie im Stand gestochen scharf dargestellt wird.
* **Bewegungsstil & Performance der Kamerafahrt:** *Kontinuierliche Kurvenfahrt mit gedrosseltem Schatten-Update* — Die Kamerafahrt nutzt eine weiche, kontinuierliche Kurveninterpolation ohne Richtungsbrüche, entkoppelt `OrbitControls` während aktiver Kamerafahrten und drosselt teure Shadow-Map-Neuberechnungen während des Absenkens der Wände, um konstante 60 FPS zu sichern.
* **Umfang der 3D-Schneedecke im Außenbereich:** *Rasen, Wege, Beete, Dächer und Hecken weiß bedecken* — Bei aktivem Schneewetter oder Weihnachts-Theme werden Außenflächen (Rasen, Kies-/Mulchbeete, Wege, Einfahrten), Dachflächen sowie Hecken, Büsche und Bäume sichtbar mit einer winterlichen Schneeschicht überzogen.

---

### 1. Overview & Core Concept
Die 3D-Kamerafahrt (`Kamerafahrt`) und die winterliche Schneedecke (`Schneedecke`) werden gezielt auf flüssige 60-FPS-Darstellung und unmittelbare visuelle Rückmeldung optimiert:

1. **Ruckelfreie 60-FPS-Kamerafahrt:** Bisher kam es während der Kamerafahrt zu Mikrorucklern durch vier zusammenspielende Ursachen:
   - `OrbitControls.update()` überschrieb in jedem Frame die berechnete Kameraposition und Blickrichtung der Tour mit eigener Dämpfungslogik.
   - Das sanfte Absenken und Anheben der Innenwände beim Raumwechsel löste in jedem einzelnen Frame (`60x pro Sekunde`) ein komplettes Re-Rendering der hochauflösenden 3D-Shadow-Map aus.
   - Offscreen-Pins lösten während der Drehung alle 160 ms React-State-Updates der gesamten 3D-Hauptkomponente aus.
   - Das Runden der Card-Positionen auf ganze Pixel während der Bewegung erzeugte ein sichtbares 1-Pixel-Stottern im Vergleich zum weich gleitenden WebGL-Hintergrund.
2. **Sichtbare 3D-Schneedecke auf allen Außenflächen:** Da Three.js die Materialfarbe (`color`) multiplikativ mit der Textur (`map`) verrechnet, blieb die dunkelgrüne Rasentextur (`lush_lawn`) trotz weißer Farbmultiplikation dunkelgrün. Zudem wurde intern nach der Oberflächen-ID `'grass'` statt `'lush_lawn'` geprüft. Durch das gezielte Umschalten der Albedo-Textur unter Beibehaltung der Bump-Map-Struktur sowie das Einschneien von Wegen, Beeten, Dächern und Hecken entsteht eine geschlossene, plastische Winterlandschaft.

---

### 2. User Experience & Visual Design
* **Seidenweiche Kamerafahrt durch Räume & Custom-Wegpunkte:**
  * Die Kamera gleitet auf einer harmonischen, geschlossenen Spline-/Kurvenbahn (`Catmull-Rom` bzw. weiche Cosinus-Interpolation mit sanfter Verweilphase an Raumpunkten) ohne abrupte Geschwindigkeits- oder Blickrichtungswechsel.
  * Sobald der Benutzer per Maus oder Touch eingreift, übernimmt `OrbitControls` nahtlos; während der automatischen Fahrt oder eines Etagen-/Raum-Flugs pausiert das Dämpfungs-Update von `OrbitControls`, sodass kein Gegensteuern mehr auftritt.
* **Ruckelfreie 3D-Cards in Bewegung & gestochen scharfe Schrift im Stand:**
  * Während die Kamera schwenkt oder fliegt, folgen Raum-Cards und Sensor-Badges der 3D-Szene im Subpixel-Gleitflug ohne visuelles Zittern.
  * Sobald die Kamera anhält, rasten alle Cards unmerklich auf exakte Ganzzahl-Pixel ein, sodass Schrift und Icons ohne Subpixel-Unschärfe lesbar sind.
* **Plastische Winter-Schneedecke:**
  * Bei Auswahl von **Wetter: Schnee** oder dem **Weihnachts-Theme** (sowie bei schneebedingtem Home-Assistant-Wetterstatus) färben sich Rasenflächen (`lush_lawn`) und Beete (`gravel_bed`) in ein dichtes, leicht glitzerndes Schneedecken-Weiß (`#f1f5f9`), während die feine Oberflächenstruktur über die Bump-Map erhalten bleibt.
  * Gehwege, Pflastersteine und Terrassen erhalten eine dünnere, leicht abgetaute Schneeschicht (`#e2e8f0`), während Wasserflächen (Pool) vom Schnee ausgenommen bleiben.
  * Dachflächen (`roofGroups`) sowie Hecken, Sträucher und Bäume im Außenbereich erhalten eine sichtbare weiße Schneehaube bzw. Frostschicht.
  * Beim Wechsel zurück auf klares Wetter, Regen oder Herbst kehren die ursprünglichen Rasen-, Stein- und Laubtexturen nahtlos zurück.

---

### 3. Key Product Decisions & Trade-Offs
* **Gedrosseltes Shadow-Map-Update statt Schatten-Deaktivierung:** Anstatt Schatten während der Kamerafahrt komplett auszuschalten (was den räumlichen Eindruck schwächen würde), werden Shadow-Map-Updates während laufender Wand-Animationen auf ein festes Intervall (ca. alle 200 ms sowie einmal final nach Abschluss der Wandbewegung) gedrosselt. Dadurch bleibt die volle Licht- und Schattenqualität bei minimaler GPU-Last erhalten.
* **Referenz-basierte Offscreen-Indikatoren & Re-Render-Sperre im Flug:** Während einer aktiven Kamerafahrt oder Kameratransition werden unnötige React-State-Synchronisationen durch sich ändernde Bildschirm-Randkoordinaten unterbunden, damit der Hauptthread zu 100 % für die 60-FPS-WebGL-Schleife frei bleibt.
* **Erhalt der Oberflächen-Reliefs (Bump-Map) unter der Schneedecke:** Statt ein flaches weißes Standardmaterial zu verwenden, wird bei aktivem Schnee lediglich die dunkle Farbtextur (`map`) temporär ausgeblendet und beim Deaktivieren aus dem Material-Cache wiederhergestellt, während die Relief-Textur (`bumpMap`) aktiv bleibt. So behält der Schnee eine natürliche, feinkörnige Struktur.

---

### 4. Technical Architecture & Data Strategy

```
┌────────────────────────────────────────────────────────────────────────────┐
│                        60-FPS Render- & Animations-Loop                    │
└─────────────────────────────────────┬──────────────────────────────────────┘
                                      │
        ┌─────────────────────────────┼─────────────────────────────┐
        ▼                             ▼                             ▼
┌──────────────────────┐   ┌──────────────────────┐   ┌──────────────────────┐
│  Kamera-Controller   │   │  Shadow- & React-    │   │  Winter- & Schnee-   │
│  (Tour & Flugbahn)   │   │  Performance-Guard   │   │  Material-Engine     │
├──────────────────────┤   ├──────────────────────┤   ├──────────────────────┤
│ • Kontinuierliche    │   │ • ShadowMap-Drossel  │   │ • Aktiv bei 'snow'   │
│   Spline-/Kurvenbahn │   │   (max. ~5 Hz bei    │   │   & 'christmas'      │
│ • OrbitControls nur  │   │   Wand-Damping statt │   │ • Temporäres Ablösen │
│   bei manuellem      │   │   60 Hz Dauer-Render)│   │   dunkler Albedo-Maps│
│   Nutzer-Input aktiv │   │ • Kein React-State-  │   │   (origMap-Cache)    │
│ • isCameraMoving-    │   │   Churn durch Rand-  │   │ • Weiß-Färbung für   │
│   Detektor pro Frame │   │   Pins im Kameraflug │   │   Rasen, Wege, Beete,│
└──────────┬───────────┘   └──────────────────────┘   │   Dächer & Hecken    │
           │                                          └──────────────────────┘
           ▼
┌────────────────────────────────────────────────────────────────────────────┐
│               Hybride HTML-Overlay-Projektion (Cards & Badges)             │
├────────────────────────────────────────────────────────────────────────────┤
│  • In Bewegung (isCameraMoving = true):                                    │
│    Subpixel-Gleitflug via translate3d(x.xxpx, y.yypx, 0) (0.15px Schwelle) │
│  • Im Stand (isCameraMoving = false):                                      │
│    Scharf-Rastung via Math.round() + translate(rx, ry) für scharfe Schrift │
└────────────────────────────────────────────────────────────────────────────┘
```

* **Kamera- & OrbitControls-Entkopplung:**
  * Während `isIdleOrbit` (Kamerafahrt) oder `cameraTransitionActive` (Kameraflug zu Raum/Wegpunkt) aktiv ist, steuert ausschließlich die Kurveninterpolation `camera.position` und `controls.target` mit anschließendem `camera.lookAt(controls.target)`. Der Aufruf von `controls.update()` wird in diesen Frames übersprungen, damit das interne Spherical-Damping von `OrbitControls` keine gegenläufigen Mikrosprünge verursacht.
* **Subpixel-zu-Integer-Umschaltung für 3D-Cards:**
  * Pro Frame wird anhand der Kamera- und Target-Distanz zum Vorframe (`delta > 0.0004`) ermittelt, ob sich die Kamera bewegt (`isCameraMoving`).
  * Im `ProjectionThrottleCache` wird während der Bewegung `translate3d(x.toFixed(2)px, y.toFixed(2)px, 0)` gesetzt. Sobald `isCameraMoving` von `true` auf `false` wechselt, erfolgt ein einmaliger Snap-Pass auf ganzzahlige Pixelwerte (`Math.round`) mit `translate(rx, ry)`.
* **Material-Cache für die Schneedecke:**
  * Jeder Eintrag im Zonen-Material-Cache speichert neben der Basisfarbe auch die ursprüngliche Albedo-Textur (`origMap`) und Rauheit (`origRoughness`).
  * Ist Schnee aktiv (`weatherMode === 'snow'` oder `activeHoliday === 'christmas'` oder Home-Assistant-Schneewetter), wird auf Außenflächen (`lush_lawn`, `gravel_bed`, `pathway_*`, `sidewalk_pavers`, `driveway_pavers`) die dunkle Textur abgekoppelt (`mat.map = null; mat.needsUpdate = true`), die Zielfarbe auf Schneeweiß interpoliert und Dächer sowie Hecken/Bäume im Außenbereich mit einer winterlichen Schneefärbung versehen.
