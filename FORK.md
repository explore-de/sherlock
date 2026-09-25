# Sherlock provenance

Sherlock starts from Sourcebot v3.0.4:

- Upstream: https://github.com/sourcebot-dev/sourcebot
- Sourcebot commit: c201a5e1a976002c565f21fb723c4ad51ef38000
- Zoekt commit: cf456394003dd9bfc9a885fdfcc8cc80230a261d
- Zoekt upstream: https://github.com/sourcebot-dev/zoekt

Sourcebot's original MIT license and copyright notice are preserved in LICENSE. Zoekt's Apache-2.0 license is preserved in vendor/zoekt/LICENSE. Other dependencies retain their respective licenses.

This repository has fresh Git history. The historical Sourcebot Enterprise code and later FSL changes were not imported. Zoekt is a vendored source snapshot, not a Git submodule; review licensing and record a new revision here before updating it.

The starting Makefile includes the local Go 1.23.4 toolchain pin and PATH quoting fix from the reviewed Sourcebot checkout. No local credentials, application data, installed dependencies, or compiled artifacts were copied. The upstream tracked .env.development template is included; keep private overrides in ignored .env.development.local.

## Development

Install prerequisites described in CONTRIBUTING.md, then run `make` to install dependencies and build Zoekt. Configure a separate development database and Redis instance before running `yarn dev`; do not reuse an existing newer Sourcebot database for this older version.

Before publishing a product, adapt branding and upstream deployment references, verify the exact dependencies and release image, and package the required third-party notices and applicable source materials. This historical source selection is not a complete dependency or trademark clearance.

## Sherlock identity

User-facing names and logos are Sherlock. Sourcebot attribution remains here, in LICENSE, the About page, and UPSTREAM_CHANGELOG.md. Internal package/environment/storage names are retained for compatibility. Database migrations and third-party source are not rebranded. Historical docs screenshots remain labeled as upstream examples. Upstream hosted services, update checks, and automated deployment workflows were removed; configure your own integrations.

## Dependency updates

- 2026-09-25: Updated vendor/zoekt to close High/Critical CVEs with an available fix (Syft SBOM + Grype scan of the built Docker image).
  - Go toolchain 1.23.4 -> 1.27.1 (`go` directive in vendor/zoekt/go.mod, Dockerfile builder image, `dev:zoekt:build` and Makefile pins).
  - Modules: golang.org/x/crypto v0.31.0 -> v0.57.0, golang.org/x/net v0.33.0 -> v0.59.0, golang.org/x/text v0.21.0 -> v0.42.0, golang.org/x/oauth2 v0.23.0 -> v0.37.0, golang.org/x/sync v0.10.0 -> v0.23.0, golang.org/x/sys v0.28.0 -> v0.48.0, google.golang.org/grpc v1.66.1 -> v1.83.2, github.com/go-git/go-git/v5 v5.13.0 -> v5.19.2, github.com/go-git/go-billy/v5 v5.6.0 -> v5.9.1, go.opentelemetry.io/otel (incl. sdk, trace, metric, bridge/opentracing and the otlptrace exporters) v1.29.0 -> v1.46.0, go.opentelemetry.io/contrib/instrumentation/google.golang.org/grpc/otelgrpc v0.54.0 -> v0.70.0, github.com/klauspost/compress v1.17.9 -> v1.18.7.
  - grpc is held at v1.83.2 rather than v1.84.0: the fix for GHSA-2v4p-qf9q-27wj is present in v1.83.2 but regressed in v1.84.0.
  - Licenses unchanged: golang.org/x/* BSD-3-Clause; grpc, go-git, OpenTelemetry Apache-2.0; klauspost/compress LICENSE file identical between both versions.
  - Source changes, both required by the update:
    - `cmd/zoekt-webserver/main.go` (`newGRPCServer`): otelgrpc v0.67.0 and later removed `StreamServerInterceptor`/`UnaryServerInterceptor`; tracing now uses `grpc.StatsHandler(otelgrpc.NewServerHandler())`. The remaining interceptors and their order are unchanged.
    - `api.go` (`Repository.UnmarshalJSON`): the recursion guard used a named pointer type (`type repository *Repository`), which recurses infinitely under Go 1.27's `encoding/json` and crashed every shard/metadata load with a stack overflow. It now uses a named struct type (`type repository Repository`).
  - Known, unchanged: `go vet` in the Go 1.27 toolchain rejects two findings in `cmd/zoekt-sourcegraph-indexserver` (lock copied by value, non-constant format string in a test), so that package's tests do not compile. Sherlock does not run that command.
