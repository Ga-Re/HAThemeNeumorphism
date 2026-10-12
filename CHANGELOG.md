# Änderungen

## 8.3.0

- Eigene Hintergrundfarbe: Unter *Hintergrund* öffnet *Eigene* einen Farbwähler. Hell wird der Hintergrund genau diese Farbe (Helligkeit so weit begrenzt, dass die Schatten wirken), dunkel ein dunkler Ton im selben Farbton; Schatten, Mulden und Schieber passen sich an. Änderungen sind schon beim Ziehen zu sehen
- Auch als Standard für alle (Optionen der Integration) und in der Aktion „Stil festlegen“ als *Eigene Hintergrundfarbe*

## 8.2.1

- Prägung: Überschriften wirken jetzt wirklich ins Material gedrückt, mit einer Schattenkante innen zum Licht hin und einer hellen Lippe außen auf der Gegenseite (vorher nur ein Schatten außen, der bei heller Schrift wie eine Kontur aussah). Das Muster in den Einstellungen zeigt denselben Effekt

## 8.2.0

**Einstellungen**
- Vorschau an jeder Einstellung statt einer allgemeinen Vorschau: jede Auswahl zeigt im Kleinen, was sie bewirkt (Lichtrichtung mit Lichtquelle und Schatten, Oberfläche, Kontrast, Zustand als Tiefe, Prägung, Körnung, Schrift, Abstände, Sektionen, Diagramme, Animationen, Leuchten, Abendmodus vorher und nachher, Eigene Karten, Add-ons, Hell oder dunkel)
- Effektstärke, Rundung und Schriftgröße zeigen den Wert schon beim Ziehen an einem Beispiel
- Hell oder dunkel für dieses Gerät heißt jetzt „Ausnahme für hell oder dunkel“ (Keine, Immer hell, Immer dunkel); der Hinweis erklärt, dass der Design-Modus von Home Assistant schon für alle Geräte des Benutzers gilt

## 8.1.0

**Einstellungen**
- Vorschau mit echten Kacheln: zwei Vorschau-Lampen oben in den Einstellungen zeigen jede Änderung sofort (Leuchten, Zustand als Tiefe, Rundung, Schrift, Sektionen, Prägung), bleiben beim Blättern sichtbar und lassen sich zuklappen. *Vorführen* schaltet sie ein paar Mal um, damit Animationen und Leuchten zu sehen sind; geschaltet wird nichts Echtes
- Diagramm-Vorschau bei *Diagramme*, *Abend ansehen* beim Abendmodus
- Beim Bearbeiten eines Dashboards zeigt die Seite dessen Stil
- Übersichtlicher: Gruppen zum Auf- und Zuklappen, in der Kopfzeile jeweils die aktuellen Werte; offene Gruppen merkt sich das Gerät
- Auswahl und Regler zeigen immer, was gespeichert wird, auch während Abendmodus oder der Stil eines Dashboards darüber liegen; ein Hinweis nennt, was gerade überlagert ist (vorher sprang z. B. die Effektstärke abends nach dem Loslassen auf die Hälfte)
- Gewählte Werte werden Screenreadern als gedrückt gemeldet

**Korrekturen**
- Knöpfe in der Fußzeile von Dialogen (Abbrechen, Speichern) verloren ihren Schatten
- Eigene Karten, die beim Laden versteckt sind (eingeklappt, in Pop-ups, in Tabs), werden geformt, sobald sie sichtbar werden
- Die Einstellungskarte auf einem Dashboard wurde selbst wie eine fremde Karte umgeformt
- „Hell“ oder „Dunkel“ für dieses Gerät gilt nur noch mit dem Neumorphism-Theme; vorher blieb der Modus nach einem Theme-Wechsel ohne Einstellmöglichkeit erzwungen
- Nach „Themes neu laden“ bleibt Neumorphism das Standard-Theme des Servers, samt Farbe der App
- „Stil aufheben“ mit leerer Auswahl hebt nichts mehr auf (vorher alles)
- „Als Standard für alle“ übernimmt nur noch gewählte Werte; was auf dem Standard des Themes steht, folgt künftigen Versionen
- Beim Entfernen der Integration werden Stile der Dashboards und Vorgaben aus Automationen mit gelöscht

**Weniger Rechenlast und Speicher**
- Lang laufende Geräte (z. B. Wandtablets): Karten, Knöpfe, Seiten und Fenster von Add-ons, die nicht mehr angezeigt werden, werden sofort vergessen; Stylesheets sammeln sich nicht mehr an
- Die Einstellungen im Profil und in der Karte rechnen nur noch bei Änderungen, nicht bei jeder Zustandsänderung in Home Assistant
- Ruhende Geräte prüfen alle 5 Sekunden nur noch den Sonnenstand, alles andere einmal pro Minute
- Karten, die sich ständig ändern, werden höchstens viermal pro Sekunde neu eingeordnet; Farben der Schatten werden nur nach Änderungen neu gelesen
- Automationen, die immer wieder denselben Stil setzen, schreiben nichts mehr auf die Festplatte

## 8.0.1

- Aktion „Stil festlegen“: Die Auswahl für Körnung, Eigene Karten und Add-ons zeigt wieder alle Werte (An/Aus wurden falsch gelesen)

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
