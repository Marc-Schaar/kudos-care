# Kudos Care: der Bereich nach dem Login

**Self-authored, not interviewed.** Einzige wörtliche Vorgabe: "mache das frontemd besser
vorallem dem teil nach dem login nutze den scrollcraft skill aber brauche dort nicht umbedingt
scrolö animationen". Alles unten ist eine eigene Entscheidung und setzt die Marke aus
`../kudos-care/BRIEF.md` fort.

Das hier ist keine Marketing-Seite, sondern ein Werkzeug, das jemand wiederholt öffnet. Aus dem
Skill gelten deshalb: Taste-Floor, Gefühlskurve mit einem Höhepunkt, ein Signature Move, die
Grammatik und der Fingerprint-Gate. Nicht: Scrub, Pin, Scrollbühne, Asset-Generierung.

## Fakten (aus dem Code und den Bildern, nicht angenommen)

- `wear_km` und `weather_wear_km` kommen je Teil aus der API (Kette im Testrad: 1.063 km gegen
  1.291 km). Der Abstand ist das Versprechen der Landing-Page. Nach dem Login war er nirgends zu
  sehen, `wear_ratio` steckte als ein einziger Balken dahinter.
- Überfällige Balken sehen alle gleich aus, ob 120 % oder 970 %, weil bei 100 % gekappt wird.
- Das Dashboard zählt überfällige *Räder* ("1 überfällig"), die Rad-Seite überfällige *Teile*
  ("6 überfällig"). Beides trägt dasselbe Wort.
- Die Status-Farben fehlten im hellen Modus, `--muted` lag dort bei etwa 3:1.
- Fließtext in DM Mono: alles wiegt gleich viel, die Squint-Prüfung fällt durch. Mono ist laut
  Taste-Floor für Daten da, nicht als Kostüm für "technisch".
- `/activities/` liefert je Fahrt `track` und `weather_data`, die Liste nutzt beides nicht.
- Eine Zeichnung mit Landmarken je Rad-Typ gab es schon (`bike-diagram-component`), sie fiel beim
  Umbau in `43293eb` weg. Die Illustrationen in `public/bike-illustrations/` sind noch da.
- Nicht behaupten: Betriebsstunden, Motorrad, eine kalibrierte Formel. Die Koeffizienten sind
  heuristische Startwerte, "mit Wetter" ist eine Rechnung und keine Messung.

## Die acht Themen

1. **Stimmung:** Werkstatthandbuch auf dem Tresen. Präzise, trocken, griffbereit. Referenzen wie
   bei der Landing-Page: Explosionszeichnung im Shimano-Dealer-Manual, Rams' Braun-Beschriftungen.
2. **Ablauf:** Befund als Satz. Das Rad als Zeichnung, mit Hinweislinien auf die Baugruppen. Was als
   Nächstes dran ist. Was gefahren wurde.
3. **Energie:** ruhig, solange nichts ansteht. Nur Status darf laut werden.
4. **Gefühl:** siehe Kurve. Der eine Moment: die Hinweislinie, die genau auf das Teil zeigt.
5. **Was keine andere App tut:** Der Verschleiß wird wie eine Bemaßung gezeichnet. Tacho und
   Wetter stehen als zwei Maßlinien übereinander, die zweite läuft sichtbar über das Rad hinaus.
6. **Stil:** dicht und technisch, Graphit und Zeichenpapier, keine Pillen und kein Glas.
7. **Struktur:** getrennte Orte einer App, keine durchgehende Welt.
8. **Material:** die vorhandenen Illustrationen je Rad-Typ, echte Daten aus der API.

## Zweck

- **Für wen:** Leute, die ihr Rad nach der Fahrt kurz prüfen wollen und am Wochenende daran schrauben.
- **Was nach einem Blick klar sein soll:** "Ich weiß, was an meinem Rad als Nächstes dran ist, und
  wo es sitzt."
- **Die eine Aktion:** das Fällige erledigen. Ein Label: `Erledigt`.

## Gefühlskurve

Eine Zeile je Ort: erst das Gefühl, dann was es auslöst.

```
1  Orientierung   ein Satz statt einer Begrüßung: "6 Dinge am Rad sind überfällig."
2  Wiedererkennen das eigene Rad als Zeichnung, Hinweislinien zeigen auf die Stelle
3  Klarheit       die Liste in fester Reihenfolge, "noch 709 km" statt Prozent
4  Aha            zwei Maßlinien: Tacho 1.063 km, mit Wetter 1.291 km
5  Bestätigung    Fahrten als Strichliste, jede nasse Fahrt in Blau, daher kommt der Aufschlag
6  Erledigung     ein Knopf am Posten, die Zeile verschwindet, der Satz oben ändert sich
```

**Der Peak (2 + 4):** "Die App zeigt mein Rad wie im Werkstatthandbuch, mit einer Linie genau auf das
fällige Teil, und zeichnet darunter, wie weit das Wetter dem Tacho voraus ist."

**Ohne Autoren-Stille:** eine Arbeitsfläche hat keine Pausen. Die Ruhe entsteht dadurch, dass
Baugruppen ohne Befund in Tintengrau zurücktreten.

**Tell-someone:** Es ist die App, die dein Rad wie ein Werkstatthandbuch beschriftet, und die
Linie zeigt auf das Teil, um das du dich jetzt kümmern musst.

## Struktur

**Grammatik: Live surface.** Das Produkt ist die Oberfläche, also gibt es App-Chrome statt
Marketing-Navigation, der Einstieg ist der aktuelle Zustand statt eines Titels, und der Abschluss ist
eine echte Eingabe (`Erledigt`), kein Knopf-Finale. Warum die anderen nicht: *Filmic*, *Continuous
world* und *Rhythmic cutlist* setzen einen einmaligen Durchlauf voraus, diese Seiten werden täglich
geöffnet. *Chaptered editorial* und *Typographic poster* wären zu viel Text und zu wenig Daten.
*Gallery* gibt es nichts auszuwählen. *Split stage* ist die Landing-Page, ihre Argumentation ist hier
schon gewonnen.

**Signature Move:** Die Maßlinie. Hinweislinien vom Rad zur Baugruppe, darunter Tacho und Wetter als
zwei Bemaßungen derselben Zeichnung, gemessen an den Radachsen. Dieselbe Sprache im Kleinen: das
Verschleiß-Lineal mit Marken bei 80 % und 100 %, das über die Grenze hinaus läuft.

**Device-Ersatz:** Es gibt keine Scroll-Geräte. Die einzige Bewegung beim Ankommen: die Linien
zeichnen sich einmal kurz, unter `prefers-reduced-motion` stehen sie sofort da.

## Raster

| Ort | Primär | Sekundär | Warum so |
|---|---|---|---|
| Start | Befund-Satz | Zeichnung, dann "Als Nächstes dran" | Antwort vor Daten |
| Fahrten | Strichliste und Summen-Satz | Monate mit Routenform | Routen erkennt man an der Form |
| Fahrt | Karte | Was sie gekostet hat, Wetter | Karte war ganz unten, zwei Knöpfe ganz oben |
| Räder | Rad-Zeichnung je Rad | Name, Status, km | Garage statt Tabelle |
| Rad | Zeichnung mit Maßlinien | fällig links, Laufräder und Baugruppen rechts | Ansehen und Ändern an einem Ort |
| Baugruppe | Teile mit Lineal | Pflege in der zweiten Spalte | Sechs Mal "+ Weiteres Teil" war Lärm |

## Abweichung vom Skill, bewusst

Der Prüf-Harness des Skills (`shoot.mjs`) fährt Scroll-Akte ab und findet in einer App keine.
Geprüft wird stattdessen mit einem eigenen Playwright-Lauf: jede Seite auf Desktop und Handy, in
beiden Farbmodi, mit gemessenem Kontrast, Mindestschriftgröße, Trefferflächen, horizontalem Überlauf
und Konsolenfehlern, dazu die Bedienwege per Klick.

## Feel-Check

Nicht kalt: selbst gebaut. Ein Durchgang über die Bildschirmfotos, ein Wort je Ort, danach
mit der Kurve verglichen.

| Ort | Geplant | Gespürt | Folge |
|---|---|---|---|
| 1 | Orientierung | Orientierung | keine |
| 2 | Wiedererkennen | anfangs Leere (Linien fehlten im Ganzseiten-Foto) | Fotomodus, kein Seitenfehler; Linien liegen am Bildschirm richtig, Rahmen-Punkt ans Steuerrohr verlegt |
| 3 | Klarheit | Klarheit, am Handy erst Gedränge | Knopf unter den Titel, Liste unter der Zeichnung zeigt zuerst nur Auffälliges |
| 4 | Aha | Aha | keine |
| 5 | Bestätigung | Bestätigung | keine |
| 6 | Erledigung | Erledigung | geprüft mit abgefangenem Request: Meldung, Neuladen, Satz oben |

Fingerprint-Gate gegen `kudos-care`: alle sechs Dimensionen verschieden (Grammatik, Navigation,
Einstieg, Ablauf ohne Scroll-Akte, Abschluss als Eingabe, Signature Move).
