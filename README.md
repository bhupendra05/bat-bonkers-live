# Bat Bonkers: live match calendar

The LIVE MATCHES mode of the game reads `fixtures.json` from this site. A GitHub Action (`.github/workflows/live-fixtures.yml`)
refreshes it every 4 hours with one call to the CricAPI cricket feed, keeping only the matches between the game's teams.

Setup: add the repository secret `CRICAPI_KEY` (your key from cricketdata.org), then run the workflow once from the Actions tab.
