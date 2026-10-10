# Neumorphism-Theme für Home Assistant

Weiches „Soft UI“-Theme: Karten liegen eine Spur heller als der Hintergrund und heben sich über einen weichen, breiten Schatten unten rechts und einen hellen Schein oben links ab. Kopfzeile und Seitenleiste verschmelzen mit dem Hintergrund, Eingabefelder wirken eingelassen.

- **Hell- und Dunkelmodus** in jedem Theme. Umgeschaltet wird wie gewohnt im Profil (Auto / Hell / Dunkel).
- **Primär- und Akzentfarbe per Farbwähler** direkt im Profil unter „Design“, pro Benutzer gespeichert.
- **Primärfarbe**: Buttons, ausgewählte Einträge, Symbole, Fortschrittsbalken. **Akzentfarbe**: Schalter, Checkboxen, Hervorhebungen.

![Vorschau hell und dunkel](preview.png)

## Installation

Das Repository ist eine Home-Assistant-Integration. Sie bringt Theme und Farbwähler mit, es müssen keine Dateien kopiert und keine Einträge in der `configuration.yaml` gemacht werden.

1. **HACS** → ⋮ → *Benutzerdefinierte Repositories* → `https://github.com/Ga-Re/HAThemeNeumorphism`, Typ **„Integration“**. Danach „Neumorphism“ herunterladen.
2. Home Assistant neu starten.
3. *Einstellungen → Geräte & Dienste → Integration hinzufügen* → **„Neumorphism“** → *Absenden*.
4. **Profil → Design**: „Neumorphism“ wählen und den Modus einstellen. Darunter erscheinen die Farbwähler.

Ohne HACS: den Ordner `custom_components/neumorphism` nach `/config/custom_components/neumorphism` kopieren, dann weiter mit Schritt 2.

Updates kommen über HACS. Die Integration hängt die Versionsnummer an das Skript an, Browser und App laden nach einem Update also automatisch die neue Fassung.

### Umstieg von der früheren Theme-Installation

Wer das Theme vorher als HACS-„Theme“ oder von Hand installiert hatte:

1. In HACS den bisherigen Eintrag „Neumorphism“ (Typ Theme) entfernen und das Repository wie oben als **Integration** neu hinzufügen.
2. Falls angelegt: in der `configuration.yaml` die Zeile `- /local/neumorphism-colors.js?v=…` unter `extra_module_url` löschen und die Datei `/config/www/neumorphism-colors.js` entfernen. Die Zeile `themes: !include_dir_merge_named themes` kann bleiben, falls du andere Themes nutzt.
3. Falls angelegt: die Text-Helfer `input_text.neumorphism_primaerfarbe` und `input_text.neumorphism_akzentfarbe` löschen, sie werden nicht mehr gebraucht.

## Farben einstellen

![Farbwähler im Profil](colorpicker.png)

Sobald im Profil ein Neumorphism-Theme gewählt ist, zeigt der Bereich „Design“ unter dem Design-Modus die Farbwähler für Primär- und Akzentfarbe, je mit zehn Vorgaben zum Antippen. „Zurücksetzen“ kehrt zu den Farben des Themes zurück. Die Farbe ändert sich sofort, schon während du im Farbwähler ziehst.

Gut zu wissen:
- Die Farben werden wie die übrigen Design-Einstellungen **pro Benutzer** gespeichert, dort wo Home Assistant auch die Farben des Standard-Themes ablegt. Bei älteren Home-Assistant-Versionen gelten sie pro Browser bzw. Gerät.
- Wechselst du im Profil das Theme, setzt Home Assistant die Farben zurück. Erst das Theme wählen, dann die Farben.
- Bei anderen Themes ändert das Modul nichts und blendet die Farbwähler aus.

Die Farbwähler gibt es auch als Karte für ein Dashboard. Sie speichert in dieselben Einstellungen:

```yaml
type: custom:neumorphism-color-card
title: Farben   # optional
```

## Farbwähler erscheinen nicht

1. Ist im Profil unter „Design“ wirklich ein **Neumorphism**-Theme gewählt? Bei „Standard-Design verwenden“ zeigt Home Assistant seine eigenen Farbwähler, unsere bleiben dann ausgeblendet.
2. Ist die Integration eingerichtet? Unter *Einstellungen → Geräte & Dienste* muss „Neumorphism“ stehen. Nur herunterladen reicht nicht.
3. In der Companion-App den Cache leeren: *Einstellungen → Companion-App → Fehlerbehebung → Frontend-Cache zurücksetzen*. Im Browser einmal hart neu laden (Strg/Cmd + Shift + R).

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

Ohne `-o` landet das Ergebnis in `custom_components/neumorphism/theme/neumorphism.yaml`, also in der Datei, die die Integration lädt. Danach den Ordner `custom_components/neumorphism` nach Home Assistant kopieren und die Integration neu laden. Achtung: Ein HACS-Update überschreibt diese Datei wieder. Eigene Varianten daher besser mit `-o meine-themes.yaml` erzeugen und klassisch über `frontend: themes: !include_dir_merge_named themes` einbinden.

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
- Für das Registrieren der Themes ohne `configuration.yaml` nutzt die Integration interne Datenstrukturen des Frontends, für die es keine offizielle Schnittstelle gibt. Nach größeren Home-Assistant-Updates kann eine Anpassung nötig sein. Getestet mit Home Assistant 2026.10.
