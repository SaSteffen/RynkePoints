# Lazy Rider: Gaming the Rynke Rules

**Status**: Informational. [spec.md](spec.md) is authoritative; this document records
why some of its rules exist.

**Date**: 2026-10-06

An agent played an extremely lazy rider who wants to qualify for the Tour de Paris
(250 Training Rynke and 25 Team Rynke) with as little effort as possible. It read
this spec, the rules handout and feature 001's spec, and looked for loopholes. The
rules it worked against: distance rounded down per ride, elevation gain
accumulated over the season, the pause rule, organiser-recorded attendance,
virtual and e-bike rides counting unless excluded, and no caps.

## Main finding

Under those rules a rider could qualify without pedalling once:

- **Team Rynke**: one two-day training weekend in the support van plus three
  technique trainings give 25 Team Rynke and 35 Training Rynke, for about two and
  a half days of showing up.
- **Training Rynke**: the missing 215 come from one private, manually entered
  Strava "Ride" of 2,150 km or 43,000 m elevation gain. It takes about a minute,
  passes the pause rule (a manual entry has no breaks) and nobody sees it, since
  balances are visible only to the rider (FR-015).

Without manual entries, the laziest path was about 2,200 km of e-bike in turbo
mode plus one train trip with the recorder running: about 80 hours sitting down.

## Findings and remedies

| #   | Trick                                                                                                     | Rough gain                                       | Remedy                                                                                                                         |
|-----|-----------------------------------------------------------------------------------------------------------|--------------------------------------------------|--------------------------------------------------------------------------------------------------------------------------------|
| E1  | Manually entered Strava activity, private, any distance or elevation                                      | 215+ Training Rynke in a minute                  | Manual activities never count (FR-005b); feature 001 stores Strava's manual flag                                               |
| E2  | Car, train, plane, chairlift or cable car with the recorder running                                       | Hamburg–Munich by train ≈ 80; cable car ≈ 10     | Rides faster than 45 km/h on average, or climbing more than 1500 m per hour of moving time, do not count (FR-005c)            |
| E3  | Walk, hike or ski tour changed to "Ride"                                                                  | daily 10 km dog walk ≈ 365 a season              | Rides slower than 10 km/h on average do not count (FR-005c)                                                                    |
| E4  | The same ride recorded on several devices or apps                                                         | 2–3× every ride, elevation included              | Of rides of one rider that overlap in time, only the largest counts (FR-005d)                                                  |
| E5  | E-bike in turbo mode                                                                                      | 2,150 km in about 90 hours sitting               | E-bike rides do not count (FR-012 default)                                                                                     |
| E6  | Virtual rides with a too-low body weight, drafting, flat routes, spoofed power                            | faster km for the same effort                    | At most one third of the Training Rynke needed may come from virtual rides (FR-013a); handout appeals to riders to set their real weight. Body weight cannot be checked |
| E7  | Borrowed or fabricated GPS files                                                                          | anything                                         | No action. Passes every check; the app stores no tracks or devices by design (feature 001 FR-014)                              |
| E8  | Strava's "correct elevation" picking the higher of device and map values; short rides adding elevation   | about +10–20% elevation                          | No action. Mostly real climbing                                                                                                |
| E9  | Ride uploaded or entered after the deadline but dated before it; rule changes after the deadline         | late Rynke, qualification flips                  | No action                                                                                                                      |
| E10 | Pause rule: walking the bike during a café stop keeps the clock moving; long breaks split into recordings | small                                            | No action. A fix would cost honest riders more than it saves                                                                   |
| E11 | Cheapest Team Rynke: technique trainings (5 each), support van on a training weekend, roll call then leave | 25 Team Rynke in about 2.5 days without riding  | No action                                                                                                                      |
| E12 | Correction for "missing private rides", then granting private access so the rides are imported as well   | the same rides counted twice                     | No action                                                                                                                      |
| E13 | Organisers never see balances (FR-015), so cheating is never noticed                                      | –                                                | No action in this feature; an organiser view needs its own feature with consent handling                                      |

Also suggested but not adopted: a limit of about 40 m elevation gain per km
(overlaps with the climbing-rate limit), caps per team-event kind, presence for
the whole event, a second organiser approving corrections, corrections tied to
specific rides, and freezing balances at the deadline plus a grace period.

The finding also showed that the spec's edge case on rules needing data that is
not stored used average speed as its example. Average speed can be computed from
stored distance and moving time; the example was corrected.

## Residual risk

Fabricated or borrowed GPS files, wrong body weight in virtual rides and
e-bike rides relabelled as normal rides cannot be detected with the data the app
stores. These rely on riders' honesty.
