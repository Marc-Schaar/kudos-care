# Kudos Care: Landingpage

**Self-authored under explicit creative delegation.** Der Auftraggeber hat das Interview
mit "entscheide du" beantwortet. Alles unten ist eine eigene Entscheidung, keine Aussage
von ihm. Einzige wörtliche Vorgabe: "nutze den scroll craft skill und mache besser".
Bestätigt: die `robots.txt`-Sperre bleibt, die Seite ist vor dem Launch nicht indexiert.

## Fakten (aus dem Code, nicht angenommen)

- Formel: `app_maintenance/api/services.py::WeatherWearCalculator`, Koeffizienten aus
  Migration `0006`. Heuristische Startwerte, noch nicht kalibriert. Muss auf der Seite stehen.
- Lebensdauer aus `component_templates.json`: Kette 2.000 km, Kassette 8.000 km,
  Reifen hinten 4.000 km, Reifen vorne 5.000 km, Bremsbeläge 3.000 km, Dichtmilch 120 Tage,
  Bremsflüssigkeit 730 Tage.
- Ampel: ab 80 % warn, ab 100 % kritisch.
- Nicht behaupten: Betriebsstunden, Höhenprofil, Gegenwind als Eingang der Formel, Motorrad,
  "0 manuelle Einträge", "Physik", "messbar".
- Marke: `KUDOS` + `CARE`, Lime `#c8f060`, Barlow Condensed + DM Mono, Rain `#38bdf8`,
  Status `#4ade80` / `#f59e0b` / `#f43f5e`. Keine Fotos, kein KIE-Key.

## Die acht Themen

1. **Stimmung:** Werkstatthandbuch trifft Regenfahrt. Präzise, trocken-witzig, nass.
   Referenzen: Explosionszeichnung im Shimano-Dealer-Manual; die Regenszene in "Blade Runner"
   als Stimmung, nicht als Look; Dieter Rams' Braun-Beschriftungen.
2. **Ablauf:** Satz über die Trennlinie. Beide Zähler laufen gleich. Stille. Regen, nur auf
   einer Seite. Selbst am Wetter drehen. Was der Tacho alles nicht weiß. Die Trennlinie
   wandert weg, das ganze Rad steht im Klartext da.
3. **Energie:** ruhig, ruhig, still, dann laut, dann ruhig mit eigener Hand, dann knapp,
   dann Ruhe.
4. **Gefühl:** siehe Kurve. Der eine Moment: der Regen, der an der Linie aufhört.
5. **Was keine andere Seite tut:** Regen fällt nur auf einer Hälfte des Bildschirms, und dort
   läuft dieselbe Fahrt doppelt so schnell. Die Zahl kommt aus der echten Formel im Browser.
6. **Stil:** dicht und technisch statt premium-minimal: technische Zeichnung, Bemaßung,
   zwei harte Gründe (Graphit und Zeichenpapier).
7. **Struktur:** getrennte Hälften, keine durchgehende Welt. Split Stage.
8. **Material:** keins. Zeichnung als ehrliches Mittel für ein Produkt, das rechnet
   (Welt 8 "Technical drawing"), plus die Bike-Geometrie in echten Millimetern.

## Zweck

- **Für wen:** Leute, die regelmäßig Rad fahren, Strava nutzen und ihre Teile selbst oder in
  der Werkstatt pflegen. Sie wissen, dass eine Kette irgendwann fällig ist, aber nicht wann.
- **Was am Ende geglaubt werden soll:** "Mein Tacho sagt mir nicht, wann mein Rad Wartung
  braucht. Kudos Care schon."
- **Eine Aktion, ein Label:** `Mit Strava verbinden`.

## Die Reise

| # | Beat | Was sich ändert |
|---|---|---|
| 1 | Neugier | Ein Satz läuft über eine Trennlinie durch dasselbe Rad |
| 2 | Einverständnis | Beide Zähler laufen im Gleichschritt: "Da sind sich beide einig" |
| 3 | Stille | Räder stehen, kein Text, die ersten Tropfen |
| 4 | Wende (Peak) | Regen nur links, die Zahl läuft davon, die Linie kippt |
| 5 | Selbst prüfen | Der Besucher dreht am Wetter, die Formel rechnet |
| 6 | Überzeugung | Vier Dinge, die der Tacho nicht kann. Papier wird schmaler |
| 7 | Auflösung | Linie am Rand, Regen hört auf, neue Kette, eine Aktion |

## Feeling Curve

Eine Zeile je Akt: erst das Gefühl, dann was es auslöst.

```
1  Neugier          ein Satz über die Trennlinie, dasselbe Rad in zwei Welten, nichts erklärt sich
2  Sorglosigkeit    0 km | 0 km, beide Zähler laufen gleich, die Räder drehen, "da sind sich beide einig"
3  Anspannung       Text weg, Räder stehen, Kamera geht auf die Kette, die ersten Tropfen
4  Ungläubigkeit    es regnet nur links, die Zahl läuft davon, 2.026 km gegen 1.540 km
5  Kontrolle        die eigene Hand am Wetter, die Hälfte reagiert sofort, die Zahlen stimmen
6  Gewissheit       vier knappe Vergleiche, das Papier schrumpft, der Tacho verstummt
7  Erleichterung    Regen hört auf, Papier ist weg, neue Kette, ein Knopf
```

**Authored silence:** Akt 3 (t 1,9 bis 2,5) ist Absicht. Kein Text, keine Kilometer, die Räder
stehen. Nur die Kamera fährt und die ersten Tropfen fallen.

**Der Peak (Akt 4):** "Der Bildschirm ist zweigeteilt, es regnet nur auf der einen Hälfte, und
da läuft die Zahl plötzlich doppelt so schnell."

**Tell-someone:** Es ist die Seite, auf der es nur auf der einen Hälfte des Bildschirms regnet
und deine Kette dort doppelt so schnell altert.

## Struktur

**Grammatik: Split Stage.** Der Vergleich ist das Produkt, und "Tacho gegen Kette" ist exakt ein
Argument mit zwei Seiten. Warum die anderen nicht:

- *Filmic one-shot:* braucht Footage und verbietet sichtbare Abfolge. Hier gibt es kein Material
  und die Fahrtenliste ist Information.
- *Chaptered editorial:* zu viel Text für ein Produkt, dessen Aussage in zwei Zahlen passt.
- *Live surface:* das Produkt hat Screens, aber die Aussage ist die Abweichung, nicht die UI.
- *Continuous world:* teuer und ohne Footage nicht machbar.
- *Typographic poster:* die Zeichnung trägt mehr als ein Satz.
- *Gallery:* es gibt keine Auswahl zu zeigen.
- *Rhythmic cutlist:* Tempo widerspricht einem Produkt, das auf Genauigkeit baut.

**Signature Move:** Das Wetter gehört nur einer Hälfte. Der Regen endet hart an der Trennlinie;
drei Regler (Regen, Temperatur, Wind) färben und durchnässen nur die dunkle Seite und rechnen mit
der echten Formel. Das eingestellte Wetter landet im Abschluss-Satz.

**Lage der Hälften:** Links die Kette, rechts der Tacho. Das folgt dem Rad: in der
Antriebsseiten-Ansicht fährt es nach rechts, die Kette liegt hinten, der Tacho vorn am Lenker.

## Score

| Akt | Span (vh) | Device | Warum |
|---|---|---|---|
| 1 Neugier | 0,55 | `pin`, Ebenen + Pointer-Parallaxe | Zeichnung mit echter Tiefe vor dem ersten Scroll |
| 2 Sorglosigkeit | 1,35 | `count`, im Gleichschritt | Gleichlauf ist die Aussage, Zahlen tragen sie |
| 3 Stille | 0,6 | leeres `pin`, Kamera | Der Peak braucht etwas, wovon er sich abhebt |
| 4 Peak | 3,6 | bespoke Canvas-Regen + Teilung kippt | Größte Fläche, größte Änderung |
| 5 Kontrolle | 1,5 | Eingabe, kein Scroll | Scroll hört auf, die Hand übernimmt |
| 6 Gewissheit | 1,4 | `reveal` je Seite, Linie wandert | Jede Zeile drückt das Papier weiter weg |
| 7 Auflösung | 1,2 + Hold | Kollaps, `reveal` über die volle Fläche | Das Ende der Grammatik |

Sechs Familien, gesamt rund 10,5 vh, kein Band 13,6 bis 13,8. Der Peak ist der längste Akt.
Verboten durch die Grammatik und nicht verwendet: `pan`, `spotlight`, `magnet`, `drift`, `scrub`.

## Ebenen-Vertrag

| Ebene | Inhalt | Bewegung | Occlusion |
|---|---|---|---|
| Fern | Höhenlinien, je Seite im eigenen Ton | kleinste Verschiebung | hinter allem |
| Mitte | Fahrbahn mit Maßstabs-Strichen | mittel | Räder stehen darauf |
| Motiv | Das Rad, Räder und Kette drehen physikalisch korrekt | Kamera, Kontaktpunkt am Boden | Rohre verdecken Speichen |
| Nah | Leitpfosten, die vorbeiziehen | stärkste Verschiebung | laufen vor dem Rad durch |
| Atmosphäre | Regen, nur dunkle Seite | eigene Zeit, Intensität aus den Daten | vor dem Rad, hinter dem Text |
| Text + Regler | Semantisches HTML | stehen | immer lesbar |

## Abweichung vom Skill, bewusst

Die Engine wird nicht eingebunden: sie hat kein Teardown (Listener und rAF-Loop laufen nach dem
Routenwechsel weiter) und `scrollcraft.css` setzt `html`/`body` global zurück, was die übrige App
träfe. Die Seite treibt ihre Bühne lokal und behält die `data-sc-*`-Marker, damit der Harness läuft.

## Feel-Check

Nicht wirklich kalt: ich habe die Seite selbst gebaut. Ein Durchlauf über die Kontaktblätter, ein
Wort je Akt, erst danach mit der Kurve oben verglichen.

| Akt | Geplant | Gespürt | Folge |
|---|---|---|---|
| 1 | Neugier | Neugier | keine |
| 2 | Sorglosigkeit | Ruhe | passt |
| 3 | Anspannung | Erwartung, schwächer als geplant | Offen: die Zähler bleiben stehen, die Stille ist nicht ganz leer |
| 4 | Ungläubigkeit | Ungläubigkeit | Größte Änderung auf dem Blatt und längster Akt, wie geplant |
| 5 | Kontrolle | zuerst Unruhe | Rad tritt jetzt vor den Reglern zurück, Regen hinter den Text |
| 6 | Gewissheit | Gewissheit, mit Humor | keine |
| 7 | Erleichterung | Erleichterung | Regen hört vor dem letzten Bild auf, neue Kette statt Rot |
