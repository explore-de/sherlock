# Developing Sherlock

Use the setup instructions in [README.md](README.md). Work on a local branch and run the existing backend and web tests before submitting changes.

```sh
yarn workspace @sherlock/backend test --run
yarn workspace @sherlock/web test --run
yarn workspace @sherlock/backend build
yarn workspace @sherlock/web exec tsc --noEmit
SKIP_ENV_VALIDATION=1 yarn workspace @sherlock/web lint
yarn npm audit --all --recursive --severity high
```

Preserve legal notices and record any vendored updates in FORK.md. Review the license of any code from another project before importing it.
