# Bat Bonkers: live match calendar

The LIVE MATCHES mode of the game reads `fixtures.json` from this site. A GitHub Action (`.github/workflows/live-fixtures.yml`)
refreshes it every 4 hours from ESPN's public cricket feed (no key needed), keeping only the Tests, ODIs and T20Is between the game's
nations and the T20s between IPL franchises.

Optional: a repository secret `CRICKETLIVE_API_KEY` (cricketliveapi.com) or `CRICAPI_KEY` (cricketdata.org) switches the job to that provider.
