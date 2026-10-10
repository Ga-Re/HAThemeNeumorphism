# Neumorphism-Theme für Home Assistant

Weiches „Soft UI“-Theme: Karten liegen eine Spur heller als der Hintergrund und heben sich über einen weichen, breiten Schatten unten rechts und einen hellen Schein oben links ab. Kopfzeile und Seitenleiste verschmelzen mit dem Hintergrund, Eingabefelder wirken eingelassen.

- **Hell- und Dunkelmodus** in jedem Theme. Umgeschaltet wird wie gewohnt im Profil (Auto / Hell / Dunkel).
- **Primär- und Akzentfarbe per Farbwähler** direkt im Profil unter „Design“, pro Benutzer gespeichert.
- **Primärfarbe**: Buttons, ausgewählte Einträge, Symbole, Fortschrittsbalken. **Akzentfarbe**: Schalter, Checkboxen, Hervorhebungen.

![Vorschau hell und dunkel](preview.png)

## Installation

1. **Theme:** Über HACS: ⋮ → *Benutzerdefinierte Repositories* → `https://github.com/Ga-Re/HAThemeNeumorphism`, Typ „Theme“, danach „Neumorphism“ herunterladen.
   Oder von Hand: `themes/neumorphism.yaml` nach `/config/themes/neumorphism.yaml` kopieren.
2. **Farbwähler:** `www/neumorphism-colors.js` nach `/config/www/neumorphism-colors.js` kopieren. HACS installiert bei Themes nur den Ordner `themes/`, diese Datei musst du selbst kopieren.
3. In der `configuration.yaml`:
   ```yaml
   frontend:
     themes: !include_dir_merge_named themes
     extra_module_url:
       - /local/neumorphism-colors.js?v=2
   ```
4. Home Assistant neu starten.
5. **Profil → Design**: „Neumorphism“ wählen und den Modus einstellen. Darunter erscheinen die Farbwähler.

Ohne Schritt 2 und den Eintrag `extra_module_url` funktioniert das Theme auch, nur ohne Farbwähler.

## Farben einstellen

![Farbwähler im Profil](colorpicker.png)

Sobald im Profil ein Neumorphism-Theme gewählt ist, zeigt der Bereich „Design“ unter dem Design-Modus die Farbwähler für Primär- und Akzentfarbe, je mit zehn Vorgaben zum Antippen. „Zurücksetzen“ kehrt zu den Farben des Themes zurück. Die Farbe ändert sich sofort, schon während du im Farbwähler ziehst.

Gut zu wissen:
- Die Farben werden wie die übrigen Design-Einstellungen **pro Benutzer** gespeichert, dort wo Home Assistant auch die Farben des Standard-Themes ablegt. Bei älteren Home-Assistant-Versionen gelten sie pro Browser bzw. Gerät.
- Wechselst du im Profil das Theme, setzt Home Assistant die Farben zurück. Erst das Theme wählen, dann die Farben.
- Bei anderen Themes ändert das Modul nichts und blendet die Farbwähler aus.
- Nach einem Update der JS-Datei die Zahl in `?v=2` erhöhen, sonst lädt der Browser oder die App die alte Version aus dem Cache.

Die Farbwähler gibt es auch als Karte für ein Dashboard. Sie speichert in dieselben Einstellungen:

```yaml
type: custom:neumorphism-color-card
title: Farben   # optional
```

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
python3 generate.py --effekt stark                          # Schatteneffekt: dezent, normal oder stark
```

Die mitgelieferte Datei nutzt **normal**. Mit `--effekt stark` werden die Schatten breiter und kräftiger, mit `--effekt dezent` kürzer und blasser.

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
- Die Farbwähler im Profil hängt das Modul in die Profilseite von Home Assistant ein. Ändert Home Assistant diese Seite grundlegend, können sie dort fehlen. Die Dashboard-Karte funktioniert dann weiterhin.
- Runde, erhabene Knöpfe und farbig leuchtende Buttons wie in vielen Neumorphism-Entwürfen lassen sich über ein Theme nicht auf die Bedienelemente von Home Assistant übertragen.
