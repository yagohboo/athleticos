# Compiled release verification

The two standard Ubuntu jobs run Chromium and iPhone 13 WebKit against the versioned release entry in `release-entry.txt`. Both run every app workflow independently, followed by real service-worker updates from versions 2, 3, 3.1 and 3.2. The upgrade fixtures use disposable browser contexts and synthetic records. The 3.2 fixture also creates a personalized program and an unfinished setup before upgrading.

Once production has published the tested files, `hosted` mode checks every current and retained file over HTTPS and verifies the installed app in both engines, including the offline training photograph, saved sets, timers and secondary screens. The branch has read-only permissions. Reports appear in the job log and summary.
