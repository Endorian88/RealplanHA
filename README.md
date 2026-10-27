# RealPlan 3D — Home Assistant 3D Studio, Sidebar Panel & Lovelace Card

Photorealistischer 3D-Grundriss- & Außenanlagen-Editor für **Home Assistant** mit:
- **Mehrstöckigem 3D-Haus & Außenanlagen** (Keller, Erdgeschoss, 1. OG, Dachgeschoss & gestapelte 3D-Ansicht)
- **Frei konfigurierbarem 3D-Pool-Baukasten** (Maße, Tiefe, Wasserstand, Folienfarbe, Einstiegstreppe, Leiter, Schwalldusche & Solar-Rollladen)
- **3D-Kinematik & Animationen** für Türen, Fenster (inkl. 2-Sensor-Logik für *Geschlossen / Gekippt / Geöffnet*), Hebe-Schiebe-Terrassentüren, 4-teilige Sektional-Garagentore und Hof-Schiebetore
- **Eigenem Eintrag in der Home Assistant Seitenleiste** (`custom_components/realplan3d`) + Lovelace-Card (`custom:realplan3d-card`)

---

## Installation in Home Assistant via HACS

### Option A: 1-Klick My Home Assistant Link
Ersetze in der URL `DEIN_GITHUB_USER` und `DEIN_REPO_NAME` durch deinen GitHub-Benutzernamen und Repository-Namen:

```
https://my.home-assistant.io/redirect/hacs_repository/?owner=DEIN_GITHUB_USER&repository=DEIN_REPO_NAME&category=integration
```

### Option B: Manuell in HACS als Benutzerdefiniertes Repository hinzufügen
1. Öffne **Home Assistant → HACS → Integrationen**.
2. Klicke oben rechts auf das **Drei-Punkte-Menü (`⋮`) → Benutzerdefinierte Repositories**.
3. Trage deine GitHub-Repository-URL ein:
   `https://github.com/DEIN_GITHUB_USER/DEIN_REPO_NAME`
4. Wähle als Kategorie **Integration** (bzw. *Integrationen*) und klicke auf **Hinzufügen**.
5. Klicke bei **RealPlan 3D** auf **Herunterladen** und starte **Home Assistant einmal neu**.
6. Gehe zu **Einstellungen → Geräte & Dienste → + Integration hinzufügen**, suche nach **RealPlan 3D** und schließe den Dialog ab – das 3D-Panel erscheint sofort in deiner **Home Assistant Seitenleiste**!
