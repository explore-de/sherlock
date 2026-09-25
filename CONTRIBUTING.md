# Developing Sherlock

Use the setup instructions in [README.md](README.md). Work on a local branch and run the existing backend and web tests before submitting changes.

```sh
yarn workspace @sourcebot/backend test --run
yarn workspace @sourcebot/web test --run
yarn workspace @sourcebot/backend build
yarn workspace @sourcebot/web exec tsc --noEmit
SKIP_ENV_VALIDATION=1 yarn workspace @sourcebot/web lint
yarn npm audit --all --recursive --severity high
node --test 'scripts/ci/*.test.mjs'
```

Internal workspace and environment names retain their upstream spelling for compatibility. Preserve legal notices and record any vendored updates in FORK.md. Later upstream Sourcebot code must be reviewed for its license before importing it.
