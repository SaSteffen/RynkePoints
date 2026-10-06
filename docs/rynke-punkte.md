---
title: "Rynke-Punkte"
subtitle: "So sammelst du deine Rynke für die Tour de Paris"
author: "Team Rynkeby Hamburg"
date: "Stand: Oktober 2026"
lang: de
---

<!--
Maintainers: this handout is informational only. The specification
specs/003-rynke-evaluation/spec.md is authoritative; if the two differ, fix this
file (FR-019). Render it with `pnpm docs:pdf`.
-->

# Worum geht es?

Wer mit uns auf die Tour de Paris fährt, soll gut vorbereitet sein – auf dem Rad
und im Team. Dafür sammelst du über die Saison **Rynke**. Es gibt zwei Sorten:

- **Trainingsrynke** bekommst du fürs Radfahren: für Kilometer, Höhenmeter und für
  gemeinsame Trainings.
- **Teamrynke** bekommst du nur für Teamtermine: Teamtrainings,
  Trainingswochenenden und Techniktrainings.

# Was brauche ich für die Tour?

| Ich bin dabei mit | Trainingsrynke | Teamrynke |
|-------------------|---------------:|----------:|
| mindestens        |        **250** |    **25** |

Du brauchst **beides**. Zusätzliche Trainingsrynke gleichen fehlende Teamrynke
nicht aus und umgekehrt. Mit 400 Trainingsrynke und 20 Teamrynke bist du also
noch nicht dabei.

# So bekommst du Rynke

| Wofür                              | Teamrynke | Trainingsrynke |
|------------------------------------|----------:|---------------:|
| je volle 10 km einer Fahrt         |         – |              1 |
| je volle 1000 Höhenmeter (Saison) |         – |              5 |
| 1 Teamtraining                     |         1 |              5 |
| 1 Tag Trainingswochenende          |         5 |             10 |
| 1 Techniktraining                  |         5 |              5 |

## Kilometer und Höhenmeter

Kilometer und Höhenmeter werden unterschiedlich gezählt.

**Kilometer** zählen für jede Radfahrt, die du auf Strava hochlädst, einzeln.
RynkePoints rundet **jede Fahrt für sich ab**: Pro **vollen 10 km** einer Fahrt
gibt es 1 Trainingsrynke. Was über die letzten vollen 10 km hinausgeht, verfällt.
Es wird **nicht** mit anderen Fahrten zusammengezählt. Das ist Absicht: Wir wollen
ordentlich lange Ausfahrten, nicht viele kurze.

**Höhenmeter** gehen dagegen **nie verloren**. RynkePoints zählt die Höhenmeter
all deiner Fahrten der Saison zusammen. Pro **vollen 1000 Höhenmeter** insgesamt
gibt es 5 Trainingsrynke. Was noch nicht für die nächsten 1000 reicht, bleibt
stehen und zählt mit deinen nächsten Fahrten weiter.

| Fahrt(en)                         | Trainingsrynke | Warum                                 |
|-----------------------------------|---------------:|---------------------------------------|
| 79 km                             |              7 | die letzten 9 km verfallen            |
| 100 km                            |             10 |                                       |
| 3 Fahrten à 7 km                  |              0 | jede Fahrt unter 10 km                |
| 2 Fahrten à 25 km                 |              4 | 2 + 2, nicht 50 km = 5                |
| 1999 Höhenmeter in einer Fahrt    |              5 | 1 volle 1000, 999 m bleiben stehen    |
| 2 Fahrten à 600 Höhenmeter        |              5 | 1200 m zusammen, 200 m bleiben stehen |
| 1999 + 1 Höhenmeter in 2 Fahrten  |             10 | 2000 m zusammen                       |
| 79 km mit 1999 Höhenmetern        |             12 | 7 für km + 5 für Höhenmeter           |

Die Regel für Kilometer soll verhindern, dass jemand das System austrickst, zum
Beispiel mit vielen kurzen Fahrten. Sollte sie zu unfairen Ergebnissen führen,
passen wir sie an.

## Eine Ausfahrt, eine Aufzeichnung

Eine Fahrt zählt **gar nicht**, wenn deine Pausen zusammen **länger als die
Hälfte deiner Fahrzeit** dauern. Fahrzeit ist die Zeit, in der du dich bewegt
hast. Dann gibt es weder für Kilometer noch für Höhenmeter Rynke, und ihre
Höhenmeter zählen auch nicht zu deiner Saisonsumme. Wer 4 Stunden
fährt, darf also höchstens 2 Stunden Pause machen.

| Aufzeichnung                                        | Fahrzeit | Pause | Trainingsrynke |
|-----------------------------------------------------|---------:|------:|---------------:|
| 150 km mit Kaffee- und Mittagspause                 |      6 h |   2 h |             15 |
| 150 km, Pause genau halb so lang wie die Fahrzeit   |      6 h |   3 h |             15 |
| 100 km mit sehr langer Café-Pause                   |      4 h |   3 h |              0 |
| 600 km über Nacht                                   |     24 h |   6 h |             60 |
| Weg zur Arbeit und zurück, 40 km, eine Aufzeichnung |      2 h |   7 h |              0 |
| alle Fahrten einer Woche als eine Aufzeichnung      |     10 h | 150 h |              0 |

Wie lange eine Fahrt insgesamt dauert, spielt keine Rolle: Auch Fahrten über
Nacht zählen, solange die Pausen kurz genug sind.

Am meisten bekommst du also, wenn du jede Ausfahrt als **genau eine**
Aufzeichnung hochlädst:

- Teilst du eine lange Ausfahrt in mehrere Aufzeichnungen auf, verfallen die
  Kilometer-Reste mehrfach. (Höhenmeter gehen dabei nicht verloren.)
- Legst du mehrere Fahrten in eine Aufzeichnung zusammen, zählt sie wegen der
  Pausen meist gar nicht.

Fahrten, die wegen zu langer Pause nicht zählen, siehst du auf deiner
RynkePoints-Seite mit diesem Hinweis.

Es zählen alle Radfahrten, die RynkePoints von Strava übernimmt (auch virtuelle
Fahrten, E-Bike, Gravel und Mountainbike), solange die Organisatoren eine Sportart
nicht ausschließen. Laufen, Schwimmen und andere Sportarten zählen nicht.

## Teamtermine

Nach jedem Teamtermin tragen die Organisatoren ein, wer dabei war. Nur diese
Eintragung zählt. RynkePoints erkennt die Teilnahme **nicht** automatisch an deiner
Fahrt. Du bekommst die Rynke für einen Termin also auch dann, wenn du ihn nicht auf
Strava aufgezeichnet hast, zum Beispiel bei einem Techniktraining.

- Ein **Trainingswochenende** zählt **pro Tag**: Zwei Tage dabei ergeben
  10 Teamrynke und 20 Trainingsrynke.
- Jeder Termin zählt für dich höchstens einmal.

## Fahrten bei Teamterminen zählen zusätzlich

Fährst du beim Teamtraining mit und lädst die Fahrt auf Strava hoch, bekommst du
**beides**: die festen Rynke für den Termin und die Rynke für Kilometer und
Höhenmeter deiner Fahrt.

> Beispiel: Teamtraining, 60 km, 1000 Höhenmeter
>
> - Teamtraining: 1 Teamrynke + 5 Trainingsrynke
> - 60 km: 6 Trainingsrynke
> - 1000 Höhenmeter: 5 Trainingsrynke
>
> **Ergebnis: 1 Teamrynke und 16 Trainingsrynke**

Teamrynke bekommst du nur über Teamtermine. Alleine fahren bringt nur
Trainingsrynke.

# Welche Fahrten zählen?

- Nur Fahrten und Termine **ab dem Saisonstart**. Haben die Organisatoren einen
  **Stichtag** festgelegt, zählt nichts mehr, was danach stattfindet.
- Maßgeblich ist das Startdatum der Fahrt in deiner Zeitzone.
- Änderst du eine Fahrt auf Strava (zum Beispiel die Strecke) oder löschst du sie,
  rechnet RynkePoints deine Rynke neu.
- Hast du dieselbe Fahrt doppelt hochgeladen (etwa vom Radcomputer und vom Handy),
  zählt sie doppelt. Bitte lösch das Duplikat auf Strava.

# Korrekturen

Stimmt etwas nicht, zum Beispiel fehlt dein Name bei einem Teamtermin, sprich die
Organisatoren an. Sie können deine Rynke mit einer Begründung korrigieren. Die
Korrektur bleibt bestehen, auch wenn RynkePoints deine Rynke neu berechnet.

# Wo sehe ich meinen Stand?

Auf deiner RynkePoints-Seite siehst du deine Trainingsrynke und Teamrynke, wie
viele dir noch fehlen, ob du dabei bist und woher deine Rynke kommen. Dort siehst
du auch deine Höhenmeter der Saison und wie viele bis zu den nächsten 5
Trainingsrynke fehlen. Deinen Stand
siehst nur du.

# Ändern sich die Regeln?

Ja, das kann während der Saison passieren. Dann rechnet RynkePoints alle Rynke
der **ganzen Saison rückwirkend** mit den neuen Regeln neu, auch für Fahrten, die
du schon vor der Änderung hochgeladen hast. Wer vorher genug hatte, kann danach
also auch wieder darunter liegen, und umgekehrt. Korrekturen der Organisatoren
bleiben dabei erhalten.

Auf deiner RynkePoints-Seite siehst du, seit wann die aktuellen Regeln gelten. Wir
geben Änderungen rechtzeitig bekannt.
