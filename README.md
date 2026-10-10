# Neumorphism für Home Assistant

Ein weiches „Soft UI“-Design für Home Assistant, bei dem alles aus einem Guss wirkt. Karten und Bedienelemente haben die Farbe des Hintergrunds und entstehen nur durch Licht und Schatten: Knöpfe, Kachel-Symbole und Regler treten erhaben hervor, Schieber, Auswahlleisten, Schalter und Eingabefelder sind eingelassen.

- **Hell- und Dunkelmodus**, umgeschaltet wie gewohnt im Profil (Auto / Hell / Dunkel)
- **Geformte Bedienelemente** in Kacheln, Karten und Detailansichten: Schalter, Schieber, Modus-Auswahl, Thermostat- und Luftbefeuchter-Regler, +/–-Knöpfe, Buttons, Eingabefelder
- **Titelleiste ohne Kante**: Der Inhalt läuft beim Scrollen weich darunter aus
- **Knöpfe wie Tropfen**: Nebeneinanderliegende Knöpfe, in der Titelleiste wie in Karten und Dialogen, laufen in der Mitte zusammen
- **Primär- und Akzentfarbe** per Farbwähler direkt im Profil
- **Effektstärke** per Regler, von flach bis kräftig
- Einstellungen werden **pro Benutzer** gespeichert und gelten auf allen Geräten
- Installation über **HACS**, ohne Dateien zu kopieren und ohne Einträge in der `configuration.yaml`

![Vorschau hell und dunkel](preview.png)

## Installation

1. **HACS** → ⋮ → *Benutzerdefinierte Repositories* → `https://github.com/Ga-Re/HAThemeNeumorphism` mit Typ **„Integration“** hinzufügen.
2. „Neumorphism“ in HACS öffnen und **herunterladen**.
3. Home Assistant **neu starten**.
4. *Einstellungen → Geräte & Dienste → Integration hinzufügen* → **„Neumorphism“** → *Absenden*.
5. **Profil → Design**: das Theme **„Neumorphism“** wählen.

Ohne HACS: den Ordner `custom_components/neumorphism` nach `/config/custom_components/neumorphism` kopieren und mit Schritt 3 weitermachen.

Updates kommen über HACS. Nach einem Update lädt Home Assistant automatisch die neue Fassung, auch in der Companion-App.

## Einstellungen

![Einstellungen im Profil](colorpicker.png)

Sobald im Profil das Theme „Neumorphism“ gewählt ist, erscheinen im Bereich „Design“ unter dem Design-Modus:

- **Primärfarbe**: Buttons, Symbole, ausgewählte Einträge, Fortschrittsbalken
- **Akzentfarbe**: Schalter, Checkboxen, Hervorhebungen
- **Effektstärke**: 0 % ist flach ohne Schatten, 100 % der Standard, 200 % besonders kräftig

Zu jeder Farbe gibt es einen Farbwähler und zehn Vorgaben zum Antippen. Änderungen sind sofort zu sehen, schon während du den Farbwähler oder den Regler bewegst. **Zurücksetzen** stellt Farben und Effektstärke auf die Standardwerte zurück.

Die Einstellungen gehören zu deinem Benutzer. Andere Benutzer stellen ihre eigenen Farben ein. Wählst du im Profil ein anderes Theme, setzt Home Assistant die Farben zurück.

### Als Dashboard-Karte

Dieselben Einstellungen gibt es als Karte für ein Dashboard. Beim Bearbeiten des Dashboards unter „Karte hinzufügen“ nach **„Neumorphism Farben“** suchen, oder per YAML:

```yaml
type: custom:neumorphism-color-card
title: Design   # optional
```

## Problemlösung

**Farbwähler und Regler erscheinen nicht im Profil**
1. Ist unter „Design“ das Theme **„Neumorphism“** gewählt? Bei „Standard-Design verwenden“ zeigt Home Assistant nur seine eigenen Farbwähler.
2. Ist die Integration eingerichtet? Unter *Einstellungen → Geräte & Dienste* muss „Neumorphism“ stehen. Nur herunterladen reicht nicht.
3. Companion-App: *Einstellungen → Companion-App → Fehlerbehebung → Frontend-Cache zurücksetzen*. Browser: einmal hart neu laden (Strg/Cmd + Shift + R).

**Das Theme „Neumorphism“ fehlt in der Auswahl**: Die Integration ist nicht eingerichtet oder Home Assistant wurde nach dem Herunterladen nicht neu gestartet.

## Für eigene Karten

Das Theme stellt Schatten-Variablen bereit, die zu Modus und Effektstärke passen:

| Variable | Wirkung |
|---|---|
| `--neumorphism-raised-shadow` | erhaben, für Knöpfe und kleine Flächen |
| `--neumorphism-raised-shadow-l` | stärker erhaben, für große runde Knöpfe |
| `--neumorphism-inset-shadow` | eingelassen, für Spuren und Leisten |
| `--neumorphism-inset-shadow-s` | leicht eingelassen, für Eingabefelder |

Zum Beispiel mit card-mod:

```yaml
card_mod:
  style: |
    ha-card { box-shadow: var(--neumorphism-inset-shadow); }
```

## Theme anpassen

Die Theme-Datei `custom_components/neumorphism/theme/neumorphism.yaml` wird mit `generate.py` erzeugt. Hintergrund, Schatten, Textfarben und Rundungen stehen oben in `generate.py` (`MODES`, `CARD_RADIUS`, `DIALOG_RADIUS`). Nach einer Änderung `python3 generate.py` ausführen (Python 3, keine Zusatzpakete) und die Integration neu laden. Ein HACS-Update überschreibt eigene Änderungen.

## Grenzen

- Geformt werden die Bedienelemente von Home Assistant selbst. Eigene Karten aus HACS oder selbst geschriebene Karten bekommen die erhabene Kartenform (ohne Rand, mit Schatten), durchsichtige Karten bleiben unverändert. Ihre inneren Elemente bringen sie selbst mit, die bleiben flach.
- Neumorphism hat von Natur aus wenig Kontrast zwischen Karte und Hintergrund. Auf sehr hellen oder sehr dunklen Displays sind die Kartenränder schwächer zu sehen.
- Für das Theme, die Einstellungen im Profil und das Formen der Bedienelemente greift die Integration auf interne Teile des Home-Assistant-Frontends zu, für die es keine offizielle Schnittstelle gibt. Nach größeren Home-Assistant-Updates kann eine Anpassung nötig sein. Getestet mit Home Assistant 2026.10.

## Lizenz

[MIT](LICENSE)
