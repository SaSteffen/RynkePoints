---
title: "Rynke Points"
subtitle: "How to collect your Rynke for the Tour de Paris"
author: "Team Rynkeby Europe"
date: "As of November 2026"
lang: en
---

<!--
Maintainers: this handout is informational only. The specification
specs/003-rynke-evaluation/spec.md is authoritative; if the two differ, fix this
file (FR-019). For now it is an English translation of Hamburg's
docs/rynke-punkte.md with this team's name (spec 026 task T082), and this team's
own rules since feature 039: no Team Rynke, team events or Tour de Paris days,
and since rules version 5 (2026-11-19) the minimum for kilometre Rynke, 25 km
outdoors and 1 km on virtual rides, and since rules version 6 (2026-11-20) an
average of up to 50 km/h on virtual rides. It names the training season (1
September to 31 August) and the qualification period (1 January to 30 June)
apart. Keep the rest in step with Hamburg's. Render
it with `pnpm docs:pdf` and commit public/teams/europe/rynke-points.pdf: the app
links riders to that PDF.
-->

# Together to Paris

**We ride to Paris as a team. We start together, we ride together, and we
arrive together.**

On the Tour, nobody gets left behind. We wait for each other: on the climb,
after a puncture, when someone is having a bad day. That is our promise to
everyone on the team.

For this promise to hold, everyone needs one thing: **a minimum level of
fitness**. Starting badly prepared doesn't only slow you down, it slows down the
whole team:

- **Everyone rides slower.** The team is only as fast as its slowest riders.
  Every stage takes longer, for everyone.
- **The days get long.** More hours in the saddle, less recovery. Breaks and
  arrival move back, and support vehicles and helpers wait too.
- **Fatigue is dangerous.** Riding at your limit means riding without focus. In
  a tight group that puts not only you at risk but everyone around you.
- **Others carry the load.** Whoever can't keep up has to be pulled, pushed or
  put in the support vehicle. That strength is then missing for the others.
- **The mood suffers.** Paris should be an experience for everyone, not a week
  of waiting and gritting your teeth.

That's what the Rynke are for. The minimums aren't there to make life hard. They
make sure that all of us can manage the route day after day under our own
power.

> **You're not only training for yourself. You're training for the team.**
>
> Every kilometre you ride now is a kilometre nobody has to ride for you on the
> Tour.

# What is it about?

Everyone who rides with us on the Tour de Paris should be well prepared on the
bike. To show this, you collect **Training Rynke** in the qualification
period, for the kilometres and the elevation of your rides.

# Training season and qualification period

There are two periods:

- The **training season** runs from **1 September to 31 August**. From
  1 September on, RynkePoints shows your rides, and they count for the badges.
- The **qualification period** runs from **1 January to 30 June**, inside the
  training season. Only rides in it earn Rynke, counted by the day a ride
  starts in your time zone. By 30 June you need all your Training Rynke for
  the Tour.

That's why your rides from the autumn already show up, but don't earn Rynke
yet.

# What do I need for the Tour?

| I'm in with | Training Rynke |
|-------------|---------------:|
| at least    |        **250** |

Of these 250 Training Rynke, at least 84 have to come from outside virtual rides
(see "Virtual rides").

# How you get Rynke

| For                                      | Training Rynke |
|------------------------------------------|---------------:|
| every full 10 km of a ride               |              1 |
| every full 1000 m of elevation (total)   |              5 |

Kilometres bring Rynke only from **25 km** on outdoors and from **1 km** on
virtual rides. Elevation brings Rynke too, and it counts from the **first
metre**, on every ride, however short.

## Kilometres and elevation

Kilometres and elevation are counted differently.

**Kilometres** count for each ride you upload to Strava, one by one.
RynkePoints rounds **each ride down on its own**: every **full 10 km** of a ride
gives 1 Training Rynke. Whatever goes beyond the last full 10 km is lost. It is
**not** added to other rides. That's on purpose: we want proper long rides, not
many short ones.

A ride outdoors needs at least **25 km** for its kilometres to bring Rynke, a
virtual ride at least **1 km**. A shorter ride still counts: its elevation goes
into your elevation total like any other.

**Elevation**, on the other hand, is **never lost**. RynkePoints adds up every
metre of elevation of all your rides in the qualification period, short rides
included. There is no minimum for elevation. Every **full 1000 m** in
total gives 5 Training Rynke. Whatever isn't enough for the next 1000 yet stays
and keeps counting with your next rides.

| Ride(s)                         | Training Rynke | Why                                |
|---------------------------------|---------------:|------------------------------------|
| 79 km                           |              7 | the last 9 km are lost             |
| 100 km                          |             10 |                                    |
| 3 rides of 7 km each            |              0 | each ride under 25 km              |
| 24.9 km outdoors                |              0 | under 25 km                        |
| 25 km outdoors                  |              2 | at least 25 km                     |
| 2 rides of 25 km each           |              4 | 2 + 2, not 50 km = 5               |
| 15 km virtual                   |              1 | at least 1 km virtual              |
| 20 km with 1000 m elevation     |              5 | 0 for km + 5 for elevation         |
| 12 km outdoors with 400 m       |              0 | 400 m go into your elevation total |
| 1999 m of elevation in one ride |              5 | 1 full 1000, 999 m stay            |
| 2 rides of 600 m elevation each |              5 | 1200 m together, 200 m stay        |
| 1999 + 1 m elevation in 2 rides |             10 | 2000 m together                    |
| 79 km with 1999 m of elevation  |             12 | 7 for km + 5 for elevation         |

## One ride, one recording

A ride doesn't count **at all** if your breaks together last **longer than your
moving time**, that is, more than half of the whole recording. Moving time is
the time you were moving. Then there are no Rynke for its kilometres or its
elevation, and its elevation doesn't count towards your elevation total either. If
you ride for 4 hours, your breaks can add up to 4 hours at most.

| Recording                                         | Moving time | Breaks | Training Rynke |
|---------------------------------------------------|------------:|-------:|---------------:|
| 150 km with a coffee stop and a lunch break       |         6 h |    2 h |             15 |
| 100 km with a long café stop                      |         4 h |    3 h |             10 |
| 150 km, breaks exactly as long as the moving time |         6 h |    6 h |             15 |
| 100 km with a very long café stop                 |         4 h |    5 h |              0 |
| 600 km overnight                                  |        24 h |    6 h |             60 |
| To work and back, 40 km, one recording            |         2 h |    7 h |              0 |
| all rides of a week as one recording              |        10 h |  150 h |              0 |

How long a ride takes in total doesn't matter: rides overnight count too, as
long as the breaks are short enough.

So you get the most if you upload each ride as **exactly one** recording:

- If you split a long ride into several recordings, the leftover kilometres are
  lost several times. (Elevation isn't lost that way.)
- If you put several rides into one recording, it usually doesn't count at all
  because of the breaks.

Rides that don't count because of too long a break are shown on your
RynkePoints page with this note.

We brought in this break rule so that nobody games the system. If it leads to
unfair situations, we'll change it.

## What doesn't count

These recordings bring no Rynke, neither for kilometres nor for elevation:

- **Rides flagged by Strava.** If Strava has flagged a ride (it then doesn't
  count for club leaderboards or segment records either), it never counts with
  us, whatever the reason. If you think the flag is wrong, settle it with
  Strava; once it is lifted, the ride is counted by the other rules.
- **Manually entered activities.** What you enter on Strava by hand instead of
  recording it doesn't count. That's also true if your bike computer failed; in
  that case, talk to the organisers (see "Corrections").
- **E-bike and e-mountain bike rides.**
- **Rides too slow or too fast.** If your average (distance divided by moving
  time) is **below 10 km/h** or **above 45 km/h**, that wasn't a bike ride but
  more likely a walk or a trip by car or train. On **virtual rides** the
  average may go up to **50 km/h**: on routes with long descents, an honest
  virtual ride can be that fast.
- **Climbing too fast.** Nobody manages more than **1500 m of elevation per hour
  of moving time** over a whole ride under their own power. That was a cable
  car or a lift.
- **Duplicate recordings.** If you recorded the same ride more than once (say,
  with a bike computer and a phone), the recordings overlap in time. Then only
  the **longest** one counts. Rides that don't overlap in time all count.

| Recording                                             | Training Rynke | Why                           |
|-------------------------------------------------------|---------------:|-------------------------------|
| 80 km on a bike computer, 78 km on a phone, same time |              8 | only the longer one counts    |
| 300 km in 4 h moving time (train)                     |              0 | average 75 km/h               |
| 25 km in 3 h moving time (walk)                       |              0 | average 8.3 km/h              |
| 30 km in 3 h moving time                              |              3 | average of exactly 10 km/h counts |
| 50 km virtual in 1 h moving time, mostly downhill     |              5 | virtual: up to 50 km/h        |
| 50 km outdoors in 1 h moving time                     |              0 | average 50 km/h               |
| 30 km and 2000 m elevation in 1 h moving time (cable car) |          0 | 2000 m of elevation per hour  |
| 200 km entered by hand                                |              0 | entered manually              |
| 100 km on an e-bike                                   |              0 | e-bike                        |
| 100 km, flagged by Strava                             |              0 | flagged by Strava             |

If this hits an honest ride, for example because a GPS glitch pushes your
average up or a mountain bike ride was very slow: correct the ride on Strava
(for example, crop out the glitch) or talk to the organisers. On your
RynkePoints page you see the reason for every ride that doesn't count.

All other bike rides that RynkePoints takes over from Strava count, including
gravel, mountain bike and virtual rides. Running, swimming and other sports
don't count.

## Virtual rides (Zwift & co.)

Rides on an indoor trainer count as normal, with Zwift or similar apps just as
without. Short sessions count too: their kilometres bring Rynke from 1 km on,
and their elevation counts from the first metre. A virtual ride is any ride
that Strava marks as a virtual ride or as an indoor trainer ride. For the Tour,
though: you need at least **84 Training
Rynke**, a third of the 250, from rides outdoors and corrections for rides
outdoors (see "Corrections"). The rest may
come from virtual rides. Whatever you collect virtually stays in your total, but
on its own it won't get you to Paris.

| Training Rynke | of which virtual | without virtual | In?                                 |
|---------------:|-----------------:|----------------:|-------------------------------------|
|            260 |              180 |              80 | no, 4 without virtual are missing   |
|            250 |              160 |              90 | yes                                 |

### Set your real body weight!

In Zwift and similar apps, your speed depends directly on the body weight you
enter. Enter a few kilos less and you ride faster and further for the same
effort, and so collect more Rynke. **That's cheating.**

Enter your **real, current body weight**: not the weight you'd like to have, and
not last summer's. The same goes for your height and for the settings of your
indoor trainer and power meter.

**RynkePoints can't check this. We rely on you.** Cheating here doesn't cheat
the app, it cheats the team: the people you're riding to Paris with, and
everyone who collected honestly. And on the way to Paris, no false weight will
ride you up the hill.

# Which rides count?

- Only rides in the qualification period, **1 January to 30 June**, earn Rynke.
  Nothing before or after does. Your rides of the training season from before
  1 January already show up on your RynkePoints page, marked "doesn't count
  yet", and they count for the badges.
- What matters is the ride's start date in your time zone.
- If you change a ride on Strava (for example its route) or delete it,
  RynkePoints recalculates your Rynke.
- If you uploaded the same ride twice (say, from your bike computer and your
  phone), only the longer recording counts (see "What doesn't count").

# Corrections

If something isn't right, for example your bike computer failed on a ride, talk
to the organisers. They can correct your Rynke, giving a reason. The
correction stays, even when RynkePoints recalculates your Rynke.

A correction counts like Rynke from a ride outdoors, also towards the 84 you
need from outside virtual rides. So the organisers only correct rides
outdoors. If a virtual ride went wrong, upload it to Strava again from your
app.

# Where do I see my total?

On your RynkePoints page you see your Training Rynke, how many you're still
missing, whether you're in, and where your Rynke come from. There
you also see your elevation total and how much is missing for the next
5 Training Rynke, and, if you ride virtually, how many Training Rynke you have
without virtual rides.

Besides you, the organisers see your total, with your first name: your Rynke
and where they come from, what you're still missing, whether you're in, and
how many kilometres and metres of elevation you rode per day. They don't see
your individual rides. In the team's ranking everyone sees your number of
rides, your kilometres and your elevation, but without your name.

# Do the rules change?

Yes, that can happen during the training season. Then RynkePoints recalculates
all Rynke **retroactively** under the new rules, including for rides
you uploaded before the change. So someone who had enough before may fall below
afterwards, and the other way round. The organisers' corrections are kept.

On your RynkePoints page you see since when the current rules apply. We announce
changes in good time.
