# Implementierungsplan: Einheitliches HUD- & Etagen-Design, Frei verschiebbare Cards, Solar-Card-Verankerung, Optionale Explosion bei Kamerafahrt, Wand/Boden-Präzision & 3D-Asset-Upgrade

## 1. Einheitlicher dunkler App-Glass-Stil für Etagenauswahl & 3D-HUD-Cards
- **Linksseitige Geschossauswahl (`Alle`, `DG`, `1.OG`, `EG`, `UG`)**:
  - Umgestaltung des schwebenden Containers und der linksseitigen Etagen-Badges auf das native dunkle App-Design (`bg-slate-950/90 backdrop-blur-xl border border-white/10 shadow-2xl rounded-2xl`).
  - Ersatz der bisherigen grellen Cyan-/Hellblau-Flächen durch einen edlen, dunklen Aktiv-Zustand (`bg-white/[0.12] text-white border border-white/20 shadow-inner` mit dezentem Status-Indikatorpunkt `bg-cyan-400`) sowie ruhige inaktive Buttons (`text-slate-400 hover:text-slate-200 hover:bg-white/[0.05]`).
- **3D-HUD-Cards am Gebäude (Solar- & Energie-Card, Klima-/Raum-Cards, Media-Popovers, Kamera- & Wetter-Cards)**:
  - Vereinheitlichung aller schwebenden 3D-Cards auf denselben dunklen App-Glass-Look (`bg-slate-950/90 backdrop-blur-xl border border-white/10 text-slate-100 shadow-2xl`) ohne grelle Neon-Rahmen.
  - Konsistente Typografie, dezente Status-Badges (`bg-white/[0.06] border-white/10`) und dezente Verbindungslinien (`leaderLine`) zum jeweiligen 3D-Ankerpunkt.

## 2. Frei verschiebbare Cards & Panels (Raumübersicht, 3D-HUD-Cards & Editor-Cards) in Live-3D & Editor
- **Verschiebbare Raum- & Elemente-Übersicht sowie Raum-Fokus-Card (Live-3D & Editor)**:
  - Integration einer Drag-&-Drop-Kopfleiste (mit Grip-Indikator und Doppelklick/Button zum Zurücksetzen der Position) für die „Raum- & Elemente-Liste“, die „Raum-Fokus“-Card sowie schwebende Werkzeug-/Inspektor-Cards im Live-3D- und Editor-Modus.
  - Flüssiges Verschieben per Maus und Touch (`PointerEvents`) innerhalb des Viewports, ohne dass dabei versehentlich die 3D-Kamera gedreht wird (`e.stopPropagation()`).
- **Individuell verschiebbare 3D-HUD-Callout-Cards & Raumstatus-Cards**:
  - Auch die schwebenden 3D-HUD-Cards (Solar & Energie Card, Raumstatus-Mini-Cards, Klima- und Media-Cards) lassen sich per Drag-&-Drop relativ zu ihrem 3D-Ankerpunkt frei verschieben; die Verbindungslinie (`leaderLine`) passt sich dabei dynamisch an den neuen Card-Offset an.

## 3. Verankerung der Solar- & Energie-Card direkt auf den 3D-PV-Modulen
- **Direkte 3D-PV-Modul-Erkennung**:
  - Ermittlung aller platzierten PV-Assets (`catalogId === 'solar_panel_array'`, `'solar_panel'` oder `'balcony_solar'`) im aktuellen Grundriss.
  - Berechnung des exakten 3D-Schwerpunkts `(anchorX, anchorY, anchorZ)` direkt auf der Oberfläche der platzierten PV-Module auf dem Dach (inklusive Dachneigungs-, Etagen- und Explosions-Offset `getAssetWorldElevY`).
  - Falls mehrere PV-Module vorhanden sind, wird die Card mittig auf dem primären PV-Modulfeld verankert; falls noch kein PV-Modul platziert wurde, greift ein sauberer Fallback auf den Dachfirst.

## 4. Optionale automatische Explosionsansicht bei Kamerafahrt & Kamera-Flügen
- **Optionaler Schalter „Auto-Explosion bei Kamerafahrt“**:
  - Direkt an der Explosions-/Kamerafahrt-Steuerung (sowie in `liveCockpitConfig.autoExplodeOnTour`) kann optional aktiviert werden, dass sich das Haus bei Bedarf während einer Kamerafahrt automatisch in die Explosionsansicht auffächert.
- **Dynamisches Auffächern nach Zielgeschoss & Sichtlinie**:
  - Sobald die Kamerafahrt (`cameraTourActive` / Auto-Idle-Tour) oder ein gezielter Kamera-Flug (`flyCameraFrontallyToTarget`) einen Innenraum im Erdgeschoss (`EG`), Keller (`KG`) oder `1. OG` ansteuert, über dem weitere Geschosse oder das Dach liegen, gleiten die darüberliegenden Stockwerke und das Dach sanft auseinander.
  - Die Kamera-Zielhöhe (`yOff`) folgt dabei präzise der jeweiligen Etagenhöhe inklusive Explosions-Offset (`getRuntimeExplodedOff`), und beim Wechsel zurück in die Außen-Übersicht (oder beim Beenden der Kamerafahrt) fahren die Geschosse wieder sanft zusammen.

## 5. Vollständige Beseitigung von durch Wände scheinenden Böden & Sockeln
- **Entfernung des WebGL-Depth-Bias (`polygonOffset`) bei Innenraumböden**:
  - Abschaltung von negativem `polygonOffsetFactor` / `polygonOffsetUnits` auf allen `indoor`-Bodenmaterialien (`floorMat`), da dieser im Z-Buffer bei flachen Kamerawinkeln die Bodenpixel rechnerisch vor die vertikalen Wände und Fußleisten zieht.
- **Exakter 2D-Wandabzug (`subtractRect2D`) & Deduplizierungs-Clipping**:
  - Jeder stehende Wandabschnitt (sowohl eigene Raumwände als auch deduplizierte Nachbar- und Außenwände im Umkreis von `0.26m`) wird mit seiner realen Wandstärke (`wallT + 2cm` Sicherheitsabstand) per `subtractRect2D` aus den Bodenplatten (`slabRects`) ausgeschnitten und falsche Überbrückungsstreifen (`bridge partial gap`) durch stehende Wände werden entfernt.
  - Wenn eine Raumwand zugunsten einer leicht versetzten Nachbar- oder Gebäudehüllenwand (`otherWins`) ausgeblendet/dedupliziert wurde, wird die Bodenplatte exakt an der Innenkante der tatsächlich stehenden Wand abgeschnitten, sodass kein Bodenstreifen hinter oder durch die Wand ragt.
- **Polygon-Böden, Dachschrägen (`1. OG` / `DG`) & Sockel (`plinthBlock`)**:
  - Polygonale Innenräume erhalten einen echten Kanten-Normalen-Inset (`0.08m` senkrecht zu jeder Wandkante) statt einer bloßen radialen Skalierung zum Mittelpunkt.
  - `clipRectToRoofEnvelope` prüft die Dachfreiheit über die gesamte Breite und Tiefe (`0%` bis `100%` inkl. Traufkante) mit innerem Wandabstand, damit Geschossdecken im `1. OG` und `DG` niemals durch Dachschrägen oder Kniestöcke ragen.
  - Der Gebäudesockel (`plinthBlock`) im EG wird hinter die Außenwandflucht eingezogen (`plinthExpand = 0.045`), sodass auch am Fußpunkt keine Boden- oder Sockelkante durchscheint.

## 6. ArchViz-Detail- & Realismus-Upgrade aller 3D-Assets
- **Haustechnik, PV-Module, Wallbox, Wärmepumpe & Sensoren**:
  - *PV-Module & Balkonkraftwerk*: Eloxierter Aluminium-Doppelrahmen, monokristalline Solarzellen-Matrix mit feinen Silber-Busbars, Unterkonstruktions-Montageschienen und Anschlussdose.
  - *Wallbox*: Gehärtete Glasfront, leuchtender Status-LED-Ring, Steckerhalterung, gewickeltes Typ-2-Ladekabel und Ladestecker.
  - *Wärmepumpe*: Lamellenschutzgitter, mehrflügeliger Axial-Lüfterrotor im Gehäuse, isolierte Kupfer-Kältemittelleitungen, Schwingungsdämpfer-Füße und Kondensatwanne.
  - *Heizkörper, Router & Smart-Sensoren*: Profilierte Konvektorlamellen, Thermostatkopf, Vor-/Rücklauf-Eckventile sowie fein detaillierte Gehäuse für Präsenzmelder, Rauchmelder und KNX-Taster.
- **Wohnmöbel (Sofas, Betten, Esstische, Stühle, TV-Wände)**:
  - *Sofas & Sessel*: Abgesteppte Sitz- und Rückenkissen mit Keder-Nähten, dekorative Wurfkissen, gefaltetes Plaid und konische Eichen-/Metallfüße.
  - *Betten*: Gepolstertes Kopfteil mit Kassettensteppung, Mehrschicht-Matratze, umgeschlagene Bettdecke, Schlaf- und Dekokissen sowie Nachttische mit warm leuchtenden Nachttischlampen.
  - *Esstische & Stühle*: Abgeschrägte Massivholz-/Keramik-Tischplatte mit Zargen-Untergestell, Tischdekoration/Gedeck und ergonomisch geformte Polsterstühle.
  - *TV-Wände & Lowboards*: Akustik-Holzlamellen-Rückwand, indirekte LED-Hintergrundbeleuchtung, schwebendes Lowboard mit Schattenfugen, Soundbar, Subwoofer und rahmenloses OLED-Display.
- **Küche, Badkeramik, Haushaltsgeräte & Treppen**:
  - *Küchenzeile & Kochinsel*: Naturstein-Arbeitsplatte, Unterbau-Edelstahlspüle mit Auszugsarmatur, Induktionskochfeld mit Glaskeramik-Zonen, integrierter Backofen mit Griffleiste & Display sowie Barhocker.
  - *Badkeramik & Wellness*: Walk-In-Regendusche mit Kopf- und Handbrause, Thermostatarmatur, Glas-Klemmbeschlägen und Edelstahl-Duschrinne; freistehende Badewanne mit Standarmatur; spülrandloses Wand-WC mit Drückerplatte; Waschtisch mit Keramikbecken und beleuchtetem Spiegelschrank.
  - *Haushaltsgeräte & Treppen*: Waschmaschine/Trockner mit Bullauge, Edelstahl-Trommel, Waschmittelschublade und Drehwähler; Treppen mit massiven Eichenstufen, Setzstufen/Wangen und Glas-/Edelstahlgeländer.
- **Garten, Pflanzen, Sträucher, Fahrzeuge & Außenanlagen**:
  - *Pflanzen & Bäume*: Mehrschichtige, organisch gestaffelte Blattkronen, strukturierte Baumstämme, Pflanzkübel mit Substratbett, geschnittene Buchsbaumhecken und Ziergräser.
  - *Fahrzeuge*: Ausmodellierte Karosserieform mit Radläufen, Mehrspeichen-Alufelgen, Bremsscheiben, LED-Scheinwerfern/Rückleuchten, Außenspiegeln, getönter Verglasung und Kennzeichen.
  - *Außenanlagen*: Detaillierte Gartenlounge, Sonnenliegen mit verstellbarem Rückenteil, Ampelschirm, Mähroboter mit Ladestation, Outdoor-BBQ-Grillstation und Gartengerätehaus.
