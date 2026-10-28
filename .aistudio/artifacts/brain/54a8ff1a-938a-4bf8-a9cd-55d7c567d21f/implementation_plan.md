# Behebung von „Error: Page not found“ im Home Assistant Panel (v4.2.1)

## 1. Ursache des Fehlers (Gefunden)
Dein Grundriss und alle Projektdaten in Home Assistant sind **vollständig intakt** — es muss nichts gelöscht oder neu gebaut werden.

Die Ursache für `Error: Page not found / The requested URL was not found on this server.` liegt in einer Dateinamen-Abweichung im HACS-Ordner:
1. Im Ordner `custom_components/realplan3d/frontend/app/assets/` liegen bereits die neuen, festen Dateien **`realplan3d.js`** und **`realplan3d.css`**.
2. In der Datei `custom_components/realplan3d/frontend/app/index.html` stand jedoch noch der Verweis auf den alten Hash-Dateinamen (`./assets/index-CZ9IRLc2.js` und `./assets/index-BOleREaD.css`), weil Vite die `index.html` erst nach dem `closeBundle`-Plugin-Lauf finalisiert hat.
3. Beim Öffnen des Panels in Home Assistant hat `realplan3d-panel.js` geprüft, ob `./assets/index-CZ9IRLc2.js` existiert, einen `404` erhalten und deshalb automatisch auf die externe Fallback-URL (`https://ais-pre-...run.app`) umgeschaltet — und genau dieser Google-Server antwortet mit `Error: Page not found / The requested URL was not found on this server.`.

---

## 2. Geplante Änderungen

### A. `custom_components/realplan3d/frontend/app/index.html` & `vite.config.ts`
- **Direkte Korrektur der HACS-`index.html`**: Aktualisierung der `<script>`- und `<link>`-Tags in `custom_components/realplan3d/frontend/app/index.html` auf `./assets/realplan3d.js` und `./assets/realplan3d.css`.
- **Garantierte Build-Synchronisation in `vite.config.ts`**:
  - `syncHacsFrontendPlugin` erhält `enforce: 'post'` und stellt beim Kopieren nach `custom_components/realplan3d/frontend/app/` explizit sicher, dass `index.html` immer auf `./assets/realplan3d.js` und `./assets/realplan3d.css` zeigt.
  - Bereinigung unnötiger Screenshot-Artefakte (`assets/aistudio/`) aus dem HACS-Frontend-Ordner.

### B. `custom_components/realplan3d/frontend/realplan3d-panel.js` (100 % Lokal in Home Assistant)
- **Entfernung der externen Fallback-URL (`LIVE_STUDIO_FALLBACK_URL`)**: Das Home Assistant Panel leitet **niemals** mehr auf eine externe Cloud-Run-URL um, die `Error: Page not found` ausgeben kann.
- **Direktes lokales Laden**: Das Panel lädt immer direkt das lokale Bundle `/realplan3d_static/app/index.html?v=4.2.1` aus deiner Home Assistant Installation.
- **Lokale Diagnose-Ansicht statt externer Weiterleitung**: Sollte nach einem HACS-Update jemals der Browser-Cache klemmen, zeigt das Panel lokal einen sauberen „Cache leeren & Neu laden“-Button auf dunklem Hintergrund statt einer externen Fehlerseite.

### C. `custom_components/realplan3d/__init__.py` & `custom_components/realplan3d/manifest.json`
- **Versionssprung auf `4.2.1`**: Erzwingt das sofortige Neuladen von `realplan3d-panel.js?v=4.2.1` und `index.html?v=4.2.1` in Home Assistant ohne Browser-Cache-Reste.
