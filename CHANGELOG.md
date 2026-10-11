# Änderungen

## 8.0.0

**Optik**
- Zustand als Tiefe: eingeschaltete Geräte erscheinen gedrückt, ausgeschaltete erhaben
- Prägung: Überschriften und große Symbole wirken ins Material geprägt
- Körnung: feine oder kräftige Struktur auf allen Flächen
- Licht nach der Sonne: die Lichtrichtung folgt dem Sonnenstand

**Anpassung**
- Vorlagen: sechs fertige Stile, eigene speichern, als Code teilen und einfügen
- Schriftgröße und Abstände (kompakt, normal, luftig)
- Zwei weitere Schriften: Modern (Inter) und Gut lesbar (Atkinson Hyperlegible)
- Diagramme in Themenfarben mit eingelassener Fläche

**Funktionen**
- Eigener Stil pro Dashboard (Administratoren)
- Abendmodus: zwischen Sonnenuntergang und Sonnenaufgang wärmer, flacher und/oder dunkel
- Statusleiste von Browser und App in der Hintergrundfarbe
- Aktionen und Optionen kennen alle neuen Einstellungen

**Qualität**
- Deutlich weniger Rechenlast: geprüft wird nur noch bei Änderungen statt jede Sekunde
- Lesbarkeit: Schrift auf jedem Hintergrund mindestens mit Kontrast nach WCAG AA, im Kontrastmodus noch deutlicher; sichtbarer Fokus bei Bedienung per Tastatur
- Diagnose zum Herunterladen mit Berichten der Geräte
- Automatische Prüfungen bei jeder Änderung und jede Woche gegen die neueste Version von Home Assistant
- Kacheln neuerer Home-Assistant-Versionen sinken beim Drücken ein

## 7.1.1

- Symbole in HACS und in der Update-Liste der Einstellungen: Sie kommen jetzt über Home Assistant aus dem Ordner `brand/` der Integration statt aus der zentralen Sammlung, die keine eigenen Integrationen mehr aufnimmt. Gilt für alle installierten Integrationen mit eigenem Symbol, ab Home Assistant 2026.3

## 7.1.0

- Sektionen können jetzt auch herausgehoben sein: Die Karten jeder Sektion liegen auf einer erhabenen Platte (Profil → Sektionen → *Herausgehoben*, in Aktionen `sections: raised`)
- Bezeichnung „Als Mulden“ heißt jetzt „Eingelassen“

## 7.0.0

**Neu im Profil**
- Hintergrund-Farbton: Standard, Grau, Warm, Sand, Mint, Rosé, Blau oder passend zur Primärfarbe
- Lichtrichtung: oben links, oben oder oben rechts
- Oberfläche: flach, gewölbt oder gemuldet
- Kontrast: hoch mit kräftigerer Schrift, Linien und Schatten und einer feinen Kante
- Rundung von eckig bis doppelt so rund
- Runde Schrift (Nunito), liegt der Integration bei
- Sektionen als Mulden
- Animationen: Knöpfe sinken beim Drücken ein, Schalter und Auswahl gleiten
- Aktive Geräte leuchten sanft in ihrer Zustandsfarbe
- Einstellungen nach Gruppen geordnet

**Neue Funktionen**
- Einstellungen nur für dieses Gerät, etwa für ein Wandtablet, auch mit festem Hell- oder Dunkelmodus
- Sparmodus für schwache Geräte
- Standard für alle Benutzer, im Profil („Als Standard für alle“) oder unter „Konfigurieren“ der Integration
- Aktionen `neumorphism.set_style` und `neumorphism.reset_style` für Automationen und Skripte
- Symbol der Integration, hell und dunkel
- Versionen mit Änderungsprotokoll in HACS

Benötigt Home Assistant 2024.12 oder neuer.
