# Neumorphism-Theme für Home Assistant

Weiches „Soft UI“-Theme: Karten haben dieselbe Farbe wie der Hintergrund und heben sich nur über einen hellen und einen dunklen Schatten ab. Kopfzeile und Seitenleiste verschmelzen mit dem Hintergrund, Eingabefelder wirken eingelassen.

- **Hell- und Dunkelmodus** in jedem Theme. Umgeschaltet wird wie gewohnt im Profil (Automatisch / Hell / Dunkel).
- **Primärfarbe** frei wählbar: Buttons, ausgewählte Einträge, Symbole, Fortschrittsbalken.
- **Akzentfarbe** frei wählbar: Schalter, Checkboxen, Hervorhebungen.

![Vorschau hell und dunkel](preview.png)

## Installation

1. In der `configuration.yaml` die Themes einbinden, falls noch nicht geschehen:
   ```yaml
   frontend:
     themes: !include_dir_merge_named themes
   ```
2. **Über HACS:** ⋮ → *Benutzerdefinierte Repositories* → `https://github.com/Ga-Re/HAThemeNeumorphism`, Typ „Theme“. Danach „Neumorphism“ herunterladen. HACS installiert die 10 abgestimmten Kombinationen.

   **Oder von Hand:** eine der beiden Dateien nach `/config/themes/neumorphism.yaml` kopieren:
   - `themes/neumorphism.yaml`: 10 abgestimmte Kombinationen, eine pro Primärfarbe. Für die meisten reicht das.
   - `alle-kombinationen/neumorphism.yaml`: alle 100 Kombinationen aus Primär- und Akzentfarbe. Nötig für die Farbauswahl im Dashboard (siehe unten).
3. Home Assistant neu starten oder die Aktion `frontend.reload_themes` ausführen.
4. **Profil → Theme**: ein „Neumorphism …“-Theme wählen und den Modus einstellen.

## Farben

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

Die Themes heißen `Neumorphism <Primärfarbe> + <Akzentfarbe>`, z. B. `Neumorphism Blau + Orange`.

Die 10 abgestimmten Kombinationen: Blau + Orange, Indigo + Bernstein, Violett + Türkis, Rosa + Violett, Rot + Bernstein, Orange + Blau, Bernstein + Indigo, Grün + Rosa, Türkis + Orange, Graphit + Türkis.

## Farben im Dashboard auswählen (optional)

Home Assistant erlaubt eigene Primär- und Akzentfarben im Profil nur beim Standard-Theme. Mit dem Package in `packages/neumorphism_farbauswahl.yaml` bekommst du dafür zwei Auswahllisten, die du auf jedes Dashboard legen kannst:

1. `alle-kombinationen/neumorphism.yaml` als Theme-Datei verwenden (Installation, Schritt 2).
2. Packages aktivieren, falls noch nicht geschehen:
   ```yaml
   homeassistant:
     packages: !include_dir_named packages
   ```
3. `packages/neumorphism_farbauswahl.yaml` nach `/config/packages/` kopieren und Home Assistant neu starten.
4. Im Profil als Theme **„Backend-ausgewählt“** wählen.
5. Die Entitäten `input_select.neumorphism_primaerfarbe` und `input_select.neumorphism_akzentfarbe` auf ein Dashboard legen, z. B. als Kachel oder in einer Entitäten-Karte.

Bei jeder Änderung setzt eine Automation das passende Theme als Standard für Hell- und Dunkelmodus. Das gilt für alle Benutzer, die „Backend-ausgewählt“ eingestellt haben.

## Eigene Farben

Mit `generate.py` erzeugst du die Theme-Datei mit beliebigen Farben neu. Du brauchst nur Python 3 (ohne Zusatzpakete), am einfachsten auf dem eigenen Rechner.

```bash
python3 generate.py --list                                  # Farbliste anzeigen
python3 generate.py --combo Grün:Orange                     # eine Kombination aus der Liste
python3 generate.py --combo "#0f9d58:#ffb300"               # eigene Hex-Farben
python3 generate.py --combo "Mein Theme=#0f9d58:Rosa"       # mit eigenem Namen
python3 generate.py --combo Blau:Orange --combo Rot:Graphit # mehrere auf einmal
python3 generate.py --all --package packages/neumorphism_farbauswahl.yaml
python3 generate.py --effekt normal                         # Schatteneffekt: dezent, normal oder stark
```

Der Schatteneffekt ist in den mitgelieferten Dateien auf **stark** gestellt. Mit `--effekt normal` oder `--effekt dezent` werden die Schatten kürzer und blasser.

Ohne `-o` landet das Ergebnis in `themes/neumorphism.yaml`. Danach die Datei wie oben kopieren und `frontend.reload_themes` ausführen.

Hintergrund, Schatten, Textfarben und Rundungen stehen oben in `generate.py` (`MODES`, `CARD_RADIUS`, `DIALOG_RADIUS`). Eigene Farben kommen in `COLORS` und erscheinen dann auch in der Farbauswahl.

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
