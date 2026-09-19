# Night raid / world-time contract

## Purpose

Make night a five-minute shared danger window in which 喰滅廻遊 players may invade a Village world, without making life simulation depend on render frame rate or device wall-clock time.

## Canonical time model

- Village simulation keeps its existing canonical `clock` in world-days and derived `time` in world-hours.
- One complete world day is 10 real-time minutes at 1x. Daylight is 05:00–17:00 world time (5 real minutes) and the raid-capable night is 17:00–05:00 (5 real minutes).
- Simulation speed scales the world clock. Pausing/backgrounding pauses local progression; host-authoritative online sessions use host monotonic elapsed time.
- The night identity is `nightId = floor(clock + 7/24)`. This gives exactly one stable identifier across the 17:00–05:00 interval, including midnight.

## Raid window

- 喰滅廻遊 invasion admission is open only while the authoritative Village clock is in the night interval.
- Existing one-visit-per-monster-per-village protection remains. Night does not reset that ledger.
- A demon admitted before dawn may finish the already-started encounter, but no new demon admission occurs after 05:00.
- Village NPCs begin shelter behavior at night. Guards, watch facilities, ward lamps, and player defenders remain meaningful.
- Existing simulated 魔王軍 raids remain a separate PvE system. They must not be renamed or silently treated as 喰滅廻遊 players.

## Cross-app consistency

- Apps do not import one another. Shared time/window rules live in a shared package and are consumed by Village, Rinne presentation, and raid/network admission as needed.
- The Village host is authoritative for whether invasion is open. 喰滅廻遊 clients may display eligibility but do not decide it.
- Rinne life aging is independent of the Village day/night cycle. Connecting to a Village does not accelerate or rewind a character's age.

## UX states

Day: ordinary village life; invasion closed.
Dusk: residents head home and the UI warns that night is approaching.
Night: five-minute danger window; invasion is possible and the village visibly darkens.
Dawn: new admission closes, surviving residents return to normal schedules, and the night result is recorded.

## Acceptance

- 1x full day = 600 seconds; night = 300 seconds.
- Night remains correct across midnight and across save/restore.
- Admission uses authoritative world time, not browser local time.
- Existing raid visit ledger and save compatibility are preserved.
- Unit tests cover boundaries 16:59, 17:00, 04:59, 05:00 and stable nightId across midnight.
