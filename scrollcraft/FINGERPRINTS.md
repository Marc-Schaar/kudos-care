# Fingerprints

Every site you build with **scroll-craft** gets one row here, appended after it
ships. The registry exists so your next build can prove it is a different page
rather than a re-skin of one you already made.

This file is **yours**. It starts empty on purpose: the gate is about not
repeating *yourself*, so it has nothing to say until you have built something.

The rules and the gate live in the skill's
`references/uniqueness.md`. Short version:

**A new build must differ from EVERY row below on at least 4 of the 6
dimensions.** Four against each row individually, not four on average across the
table. If a planned build fails, change the plan. Never edit a row to make room
for it.

The six dimensions are: **grammar**, **nav treatment**, **hero device**,
**act-sequence shape**, **close pattern**, **signature move**.

Dimension 6 is free, because a signature move is unique by definition. So the
gate really asks for three more out of the remaining five, and a build that
changes only grammar and world will fail it.

---

## The registry

| Build | Grammar | Nav treatment | Hero device | Act-sequence shape | Close pattern | Signature move | World | Port |
|---|---|---|---|---|---|---|---|---|
| kudos-care | Split stage | Keine Leiste. Die Trennlinie ist das Chrome: die Wortmarke KUDOS\|CARE reitet darauf, jede Fahrt ist ein Strich, nasse in Blau | Ein Satz läuft über die Linie, dasselbe Rad in zwei Häuten, fünf Ebenen (Höhenlinien, Fahrbahn, Rad, Leitpfosten, Text) | 1 Pin, 7 Akte, 10,5 vh: Pin + Parallaxe, Count, leerer Pin, Canvas-Regen + Kamera, Eingabe, Reveal je Seite, Kollaps | Linie wandert zum rechten Rand, Regen hört auf, Kette wird neu, CTA in der Gewinnerhälfte | Das Wetter gehört nur einer Hälfte: Regen endet hart an der Linie, drei Regler rechnen die echte Formel und färben nur die dunkle Seite | Technical drawing auf Graphit und Zeichenpapier, Geometrie in echten mm | Angular `/`, Port 4200 |

*(empty: your first build has nothing to clear, so build whatever the interview
points at. From the second onwards, this table is the constraint.)*

---

## What is taken

Add a bullet here whenever a build claims something a later build should avoid
reusing: a grammar, a nav treatment, a close pattern, a signature move, an
act-count-and-length band. The shared columns are what the next build inherits
as a constraint, so writing them down is the whole point.

Nothing is taken yet.

---

## Appending a row

After shipping, add one line to the table and one bullet to **What is taken** if
the build claimed something new. Fill every column. Say what the build shares
with existing rows.

Rows are append-only. A build that has been superseded stays in the table,
because the space it occupies is still occupied.

---

## Worked example

The skill's author kept a registry of twelve builds across eight page grammars.
If you want to see what a filled-in table looks like, and which shapes tend to
collide, read `EXAMPLES.md` in the scroll-craft repository. Treat it as
illustration only: those rows are somebody else's builds and they do **not**
constrain yours.
