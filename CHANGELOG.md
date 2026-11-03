# Sherlock changelog

## Unreleased

- Replaced product branding and removed upstream cloud, support, update, and deployment destinations.
- Disabled analytics by default.
- Removed the docs and the GitHub Pages site with its workflow.
- Renamed internal identifiers to Sherlock. Existing deployments upgrade in place:
  - Workspace packages are now `@sherlock/*`.
  - Environment variables `SOURCEBOT_*` are now `SHERLOCK_*`, and the build-time `NEXT_PUBLIC_SOURCEBOT_*` are now `NEXT_PUBLIC_SHERLOCK_*`. The old runtime names are still read, with a deprecation warning, and will be removed in a later release. The build-time `NEXT_PUBLIC_*` names have no fallback.
  - The data directory `.sourcebot` is moved to `.sherlock` on start. Mount the volume at `/data`, not at `/data/.sourcebot`, or the move fails and the container stops.
  - The bundled PostgreSQL database `sourcebot` is renamed to `sherlock` on start. A `DATABASE_URL` that still names the old default is rewritten.
  - The telemetry property `sourcebot_version` is now `sherlock_version`.
