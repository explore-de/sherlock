# Sherlock changelog

## Unreleased

- Replaced product branding and removed upstream cloud, support, update, and deployment destinations.
- Disabled analytics by default.
- Removed the docs.
- Renamed internal identifiers to Sherlock: packages `@sherlock/*`, `SHERLOCK_*` and `NEXT_PUBLIC_SHERLOCK_*` variables, the `.sherlock` data directory and the `sherlock` database. This is a breaking change for existing deployments: data, encryption key and sessions of a previous installation are not carried over.
