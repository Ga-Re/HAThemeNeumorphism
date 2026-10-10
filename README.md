# Neumorphism-Theme für Home Assistant

Weiches „Soft UI“-Theme: Karten haben dieselbe Farbe wie der Hintergrund und heben sich nur über einen hellen und einen dunklen Schatten ab. Kopfzeile und Seitenleiste verschmelzen mit dem Hintergrund, Eingabefelder wirken eingelassen.

- **Hell- und Dunkelmodus** in jedem Theme. Umgeschaltet wird wie gewohnt im Profil (Automatisch / Hell / Dunkel).
- **Primärfarbe** frei wählbar: Buttons, ausgewählte Einträge, Symbole, Fortschrittsbalken.
- **Akzentfarbe** frei wählbar: Schalter, Checkboxen, Hervorhebungen.
- **Farbwähler-Karte** für das Dashboard: Farben live einstellen, ohne Dateien zu bearbeiten.

![Vorschau hell und dunkel](preview.png)

## Installation

1. In der `configuration.yaml` die Themes einbinden, falls noch nicht geschehen:
   ```yaml
   frontend:
     themes: !include_dir_merge_named themes
   ```
2. **Über HACS:** ⋮ → *Benutzerdefinierte Repositories* → `https://github.com/Ga-Re/HAThemeNeumorphism`, Typ „Theme“. Danach „Neumorphism“ herunterladen.

   **Oder von Hand:** `themes/neumorphism.yaml` nach `/config/themes/neumorphism.yaml` kopieren.
3. Home Assistant neu starten oder die Aktion `frontend.reload_themes` ausführen.
4. **Profil → Theme**: „Neumorphism“ oder eine der fertigen Kombinationen wählen und den Modus einstellen.

## Farben per Farbwähler einstellen

![Farbwähler-Karte](colorpicker.png)

Die Karte „Neumorphism Farben“ hat für Primär- und Akzentfarbe je einen Farbwähler, zehn Vorgaben zum Antippen und einen Knopf „Standard“, der zur Farbe des Themes zurückkehrt. Die Farbe ändert sich sofort, schon während du im Farbwähler ziehst.

Einrichtung:

1. `www/neumorphism-colors.js` nach `/config/www/neumorphism-colors.js` kopieren.
2. In der `configuration.yaml` einbinden:
   ```yaml
   frontend:
     themes: !include_dir_merge_named themes
     extra_module_url:
       - /local/neumorphism-colors.js?v=1
   ```
3. Die beiden Text-Helfer anlegen, in denen die Farben gespeichert werden. Entweder `packages/neumorphism_farben.yaml` nach `/config/packages/` kopieren (dafür muss `homeassistant: packages: !include_dir_named packages` gesetzt sein) oder unter *Einstellungen → Geräte & Dienste → Helfer → Text* von Hand anlegen, mit genau diesen Entitäts-IDs:
   - `input_text.neumorphism_primaerfarbe`
   - `input_text.neumorphism_akzentfarbe`
4. Home Assistant neu starten.
5. Auf einem Dashboard die Karte **„Neumorphism Farben“** hinzufügen, oder per YAML:
   ```yaml
   type: custom:neumorphism-color-card
   title: Farben   # optional, leer lassen für keine Überschrift
   ```

Gut zu wissen:
- Die Farben gelten für **alle Benutzer und Geräte** und bleiben nach einem Neustart erhalten.
- Sie wirken nur, solange ein Neumorphism-Theme aktiv ist. Bei anderen Themes ändert das Modul nichts.
- Ist ein Helfer leer, gilt die Farbe des gewählten Themes. Am einfachsten wählst du im Profil das Theme „Neumorphism“ und stellst die Farben nur noch über die Karte ein.
- Nach einem Update der JS-Datei die Zahl in `?v=1` erhöhen, sonst lädt der Browser oder die App die alte Version aus dem Cache.

## Fertige Farbkombinationen

Ohne Farbwähler kannst du im Profil auch eine fertige Kombination wählen. Die Themes heißen `Neumorphism <Primärfarbe> + <Akzentfarbe>`:

Blau + Orange, Indigo + Bernstein, Violett + Türkis, Rosa + Violett, Rot + Bernstein, Orange + Blau, Bernstein + Indigo, Grün + Rosa, Türkis + Orange, Graphit + Türkis.

| Name | Hex |
|---|---|
| Blau | `#3d7bfd` |
| Indigo | `#5c6bc0` |
| Violett | `#8e6cf0` |
| Rosa | `#e5609a` |
| Rot | `#e5534b` |
| Orange | `#ff8a3d` |
| Bernstein | `#f2a922` |
| Grün | `#2fb67c` |
| Türkis | `#14a7a0` |
| Graphit | `#5f7389` |

## Theme-Datei selbst erzeugen

Mit `generate.py` erzeugst du die Theme-Datei neu, z. B. mit anderen Farbkombinationen oder anderer Effektstärke. Du brauchst nur Python 3 (ohne Zusatzpakete), am einfachsten auf dem eigenen Rechner.

```bash
python3 generate.py --list                                  # Farbliste anzeigen
python3 generate.py --combo Grün:Orange                     # eine Kombination aus der Liste
python3 generate.py --combo "#0f9d58:#ffb300"               # eigene Hex-Farben
python3 generate.py --combo "Mein Theme=#0f9d58:Rosa"       # mit eigenem Namen
python3 generate.py --combo Blau:Orange --combo Rot:Graphit # mehrere auf einmal
python3 generate.py --all                                   # alle 100 Kombinationen der Farbliste
python3 generate.py --effekt normal                         # Schatteneffekt: dezent, normal oder stark
```

Der Schatteneffekt ist in den mitgelieferten Dateien auf **stark** gestellt. Mit `--effekt normal` oder `--effekt dezent` werden die Schatten kürzer und blasser.

Ohne `-o` landet das Ergebnis in `themes/neumorphism.yaml`. Danach die Datei wie oben kopieren und `frontend.reload_themes` ausführen.

Hintergrund, Schatten, Textfarben und Rundungen stehen oben in `generate.py` (`MODES`, `CARD_RADIUS`, `DIALOG_RADIUS`). Eigene Farben kommen in `COLORS`.

## Was das Theme anpasst

Aus der Primärfarbe berechnet der Generator die Farbstufen `ha-color-primary-05` bis `-95` genauso wie Home Assistant beim Standard-Theme. Dadurch passen auch die neueren Buttons, Links und Rahmen zur gewählten Farbe.

Für eigene Karten (z. B. mit card-mod) steht die Variable `--neumorphism-inset-shadow` bereit, ein eingedrückter Schatten passend zum aktiven Modus:

```yaml
card_mod:
  style: |
    ha-card { box-shadow: var(--neumorphism-inset-shadow); }
```

## Grenzen

- Den „gedrückt“-Effekt beim Antippen kann ein Theme allein nicht erzeugen, dafür braucht es card-mod.
- Neumorphism hat von Natur aus wenig Kontrast zwischen Karte und Hintergrund. Auf sehr hellen oder sehr dunklen Displays sind die Kartenränder schwächer zu sehen.
