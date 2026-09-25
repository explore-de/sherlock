<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="packages/web/public/sherlock-mark.png">
    <img src="packages/web/public/sherlock-mark-light.png" alt="Sherlock" width="200">
  </picture>
</p>

<p align="center">
  <a href="LICENSE"><img alt="license" src="https://img.shields.io/badge/license-MIT-blue"></a>
  <a href="https://github.com/explore-de/sherlock/actions/workflows/pr-gate.yml"><img alt="PR Gate" src="https://github.com/explore-de/sherlock/actions/workflows/pr-gate.yml/badge.svg"></a>
  <a href="https://github.com/explore-de/sherlock/actions/workflows/test-web.yml"><img alt="Test Web" src="https://github.com/explore-de/sherlock/actions/workflows/test-web.yml/badge.svg"></a>
  <a href="https://github.com/explore-de/sherlock/actions/workflows/test-backend.yml"><img alt="Test Backend" src="https://github.com/explore-de/sherlock/actions/workflows/test-backend.yml/badge.svg"></a>
  <a href="https://github.com/explore-de/sherlock/actions/workflows/security.yml"><img alt="Security" src="https://github.com/explore-de/sherlock/actions/workflows/security.yml/badge.svg"></a>
  <a href="https://github.com/explore-de/sherlock/actions/workflows/ghcr-publish.yml"><img alt="Publish to ghcr" src="https://github.com/explore-de/sherlock/actions/workflows/ghcr-publish.yml/badge.svg"></a>
</p>

# Sherlock

Search and explore code across your repositories, on your own infrastructure.

Sherlock indexes the repositories you point it at and makes them searchable by
regular expression and by symbol, across every branch you choose to index. It
runs entirely on your own hardware: no repository content, no query, and no
telemetry leaves the machine you deploy it on.

## What it does

- **Code hosts.** GitHub, GitLab, Gitea and Gerrit, each self-hosted or cloud.
  Whole groups and organizations sync recursively, filtered by topic, and with
  forks or archived repositories excluded.
- **Search.** Regular expressions, symbol lookup and filters over repository,
  language and file path, answered by a vendored
  [Zoekt](https://github.com/sourcebot-dev/zoekt).
- **Authentication.** Microsoft Entra ID, GitHub, Google, email codes, or email
  and password. Off by default; a single environment variable turns it on.
- **Configuration as a file.** Connections can live in a JSON file under version
  control instead of being clicked together in the UI. Sherlock re-reads it when
  it changes.

## Run locally

1. Install Node.js **24.15.0 or newer** (`nvm install && nvm use`), enable Yarn with `corepack enable`, and install Go, Universal Ctags, and Docker. Start Docker before continuing.
2. Run `make` to install the locked dependencies and build the vendored Zoekt search engine.
3. Copy `.env.development` to `.env.development.local`. Configure your database, Redis URL, authentication, and a private encryption key.
4. Set `CONFIG_PATH=/absolute/path/to/sherlock/default-config.json` in `.env.development.local`, then configure repositories in that file, or point `CONFIG_PATH` to your own file. The default configuration indexes no repositories.
5. Run `yarn dev` and open http://localhost:3000. This starts local PostgreSQL 16 and Redis 7.2 containers, builds Zoekt, and applies development migrations. New containers bind only to localhost. Existing containers are reused; their ports and settings are not changed.

If you already manage PostgreSQL and Redis, configure their URLs and run `yarn dev:zoekt:build`, `yarn dev:prisma:migrate:dev`, then run `yarn dev:zoekt`, `yarn dev:backend`, and `yarn dev:web` in separate terminals. Do not run `yarn dev`, which starts the bundled development containers.

Run `yarn test` for all unit tests and `yarn build` for a production build. See [AI search setup](docs/self-hosting/ai-search.md) to enable optional natural-language search.

See [CONTRIBUTING.md](CONTRIBUTING.md) and the
[configuration documentation](docs/self-hosting/configuration.mdx).

## Connect a code host

A declarative configuration file describes what to index. To follow every
project in a GitLab group, including its subgroups:

```json
{
  "connections": {
    "my-gitlab": {
      "type": "gitlab",
      "url": "https://gitlab.example.com",
      "groups": ["my-group"],
      "token": { "env": "GITLAB_TOKEN" },
      "exclude": { "archived": true, "forks": true }
    }
  }
}
```

Point `CONFIG_PATH` at that file and provide `GITLAB_TOKEN` in the environment.
The token decides the scope of the index, and everything it can read becomes
searchable for every signed-in user — Sherlock does not mirror per-user
permissions from the code host. Use a dedicated service account with exactly the
read access you intend to expose, never a personal token.

Other code hosts follow the same shape; see
[declarative config](docs/self-hosting/more/declarative-config.mdx).

## Authentication

Set `SOURCEBOT_AUTH_ENABLED=true` and configure at least one provider. For
Microsoft Entra ID:

```
AUTH_ENTRA_CLIENT_ID=...
AUTH_ENTRA_CLIENT_SECRET=...
AUTH_ENTRA_TENANT_ID=...
AUTH_URL=https://sherlock.example.com
```

Register `<AUTH_URL>/api/auth/callback/microsoft-entra-id` as a redirect URI in
your application, and grant the delegated Microsoft Graph permissions `openid`,
`profile`, `email` and `User.Read`.

The first user to sign in owns the organization. Everyone who follows and was
vouched for by an identity provider joins as a member, which makes the identity
provider your access boundary — restrict who may sign in there. Email and
password accounts are the exception: that sign-up verifies no identity, so such
an account gains no access on its own and must be invited. Set
`AUTH_CREDENTIALS_LOGIN_ENABLED=false` to turn it off entirely.

Details in [authentication](docs/self-hosting/more/authentication.mdx).

## Use it from an AI assistant (MCP)

Sherlock speaks the [Model Context Protocol](https://modelcontextprotocol.io) at
`/api/mcp` over Streamable HTTP, so an assistant can search your code directly
rather than being pasted snippets of it.

Create an API key under **Settings → API Keys** — the key is shown once, and only
its hash is stored. Then register the server:

```sh
claude mcp add --transport http sherlock https://your-sherlock-host/api/mcp \
  --header "Authorization: Bearer YOUR_KEY"
```

The assistant then has four tools:

| Tool | What it does |
| --- | --- |
| `search_code` | Runs a zoekt query and returns matching lines with their line numbers |
| `get_file` | Returns one file in full, with line numbers |
| `list_repos` | Lists indexed repositories, one page at a time |
| `ask_codebase` | Translates a plain-language question into a query and runs it |

Every tool that returns a list is paginated, so a single call cannot flood the
assistant's context. A key acts as the user who created it and sees exactly what
that user sees. Revoking a key in the settings takes effect immediately, and a
key stops working as soon as its owner leaves the organisation or is removed
from it.

## Build your own image

```sh
docker build -t sherlock:local .
docker run --name sherlock -p 127.0.0.1:3000:3000 -v sherlock-data:/data sherlock:local
```

The command above provides a local instance with persistent storage. To use a configuration file, mount it read-only and set `CONFIG_PATH` to its absolute path inside the container. For shared deployments, configure authentication and HTTPS before making the instance reachable outside localhost.

The image starts a PostgreSQL and a Redis instance unless external services are configured, and keeps the index, the database and the cache under `/data` — mount a volume there, or an update discards the index and re-clones everything.

Do not use upstream Sourcebot images for Sherlock. Fly templates require your own unique application name. Registry publishing is manual and targets the current GitHub repository.

## Security checks

Every pull request to `main` runs:

- `PR Gate`: `yarn npm audit` fails on high or critical advisories in the npm dependencies.
- `Security`: builds the Docker image, generates a CycloneDX SBOM with Syft and fails when Grype finds a high or critical vulnerability that has a fix. Results appear under *Security → Code scanning*.

Dependabot opens daily update pull requests for npm, the Dockerfile base images and GitHub Actions (`.github/dependabot.yml`).

Pushes to `main` and `v*` tags also publish two SBOMs to Dependency-Track: `explore/sherlock` (npm dependencies) and `ghcr.io/explore-de/sherlock` (image), as version `dev-<run number>` on `main` or the tag without its `v`. Afterwards `scripts/ci/dtrack-version-cleanup.mjs` keeps the published version and the most recent release active and deactivates older versions. This needs the repository secret `DT_API_KEY` with the permissions `BOM_UPLOAD`, `PROJECT_CREATION_UPLOAD`, `VIEW_PORTFOLIO` and `PORTFOLIO_MANAGEMENT`.

## Identity and integrations

Sherlock has no configured public cloud, support mailbox, community server, or
update feed. The app links to local help. Analytics are disabled by default;
optional telemetry, error reporting and mail integrations require the operator's
own configuration. No upstream documentation analytics key is included. The
subscription and billing code of the hosted upstream product has been removed.

Internal `@sourcebot/*` package names, `SOURCEBOT_*` / `NEXT_PUBLIC_SOURCEBOT_*`
environment variables, and `.sourcebot` storage paths are retained for
compatibility. These are implementation identifiers, not product branding.
Database migration history and vendored source are intentionally preserved.

Documentation screenshots are inherited historical examples and may show upstream
branding; they are not Sherlock product screenshots. Before public distribution,
review third-party license obligations and your deployment's policies.

## Provenance

Sherlock is an independent project originating from Sourcebot v3.0.4, the
last release before Enterprise licensing was introduced. The original MIT
copyright and permission notice remain in [LICENSE](LICENSE). Third-party
components retain their own licenses, inventoried in
[THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md). Exact revisions are recorded
in [FORK.md](FORK.md).
