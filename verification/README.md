# Compiled release verification

This directory tests the compiled app at the repository root. It contains synthetic test fixtures only, with no application source, personal records, saved backups, browser profiles, or credentials. Tests create fresh disposable browser contexts.

The verification branch runs on a standard GitHub-hosted Ubuntu runner with read-only repository permission. It does not deploy, upload artifacts, or use a cache. Reports appear in the job log and step summary; temporary screenshots, exports, and browser data remain only on the disposable runner.

`mode.txt` selects `full` (the 57-test iPhone WebKit suite and actual service-worker upgrades from both published baselines) or `hosted` (published-file comparison and anonymous Chromium/WebKit PWA checks). Change it to `hosted` and push the verification branch only after the compiled release is published at the existing Pages URL.

The published baselines are `9f6a0ae` for version 2 and `c160ec517059cdc29d4fcbd727378b23d8def6fe` for version 3. Historical hashed assets remain available at the root so an installed older app can finish loading while an update waits.
