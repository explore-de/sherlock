#!/usr/bin/env node
// Keeps the just-published Dependency-Track project version active and latest,
// optionally keeps the N most recently imported release versions active, and
// deactivates every other version of the project.
//
// Mirrors the behaviour of the internal `dtrack-version-cleanup` tool (exp/docker),
// reimplemented for this public repository against the Dependency-Track 5 REST API.

import { pathToFileURL } from "node:url";
import { parseArgs } from "node:util";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const RELEASE_VERSION_RE = /^([0-9A-Za-z._-]+-)?[0-9]+\.[0-9]+\.[0-9]+$/;
const PAGE_SIZE = 100;
const REQUEST_TIMEOUT_MS = 30_000;

export const isReleaseVersion = (version) => RELEASE_VERSION_RE.test(version);

export const planCleanup = ({ versions, currentUuid, keepTags }) => {
    for (const v of versions) {
        if (!UUID_RE.test(String(v.uuid))) {
            throw new Error(`Invalid uuid from Dependency-Track: ${JSON.stringify(v.uuid)}`);
        }
    }

    const current = versions.find((v) => v.uuid === currentUuid);
    if (!current) {
        throw new Error(`The current version (${currentUuid}) is missing from the project's version list`);
    }

    const others = versions.filter((v) => v.uuid !== currentUuid);
    const keptReleases = new Set(
        others
            .filter((v) => isReleaseVersion(v.version))
            .sort((a, b) => (Number(b.lastBomImport) || 0) - (Number(a.lastBomImport) || 0))
            .slice(0, keepTags)
            .map((v) => v.uuid),
    );

    const actionFor = (v) => {
        if (keptReleases.has(v.uuid)) {
            return v.active ? "keep" : "reactivate";
        }
        return v.active ? "deactivate" : "none";
    };

    return {
        current: { uuid: current.uuid, version: current.version, reactivate: !current.active },
        actions: others.map((v) => ({ uuid: v.uuid, version: v.version, action: actionFor(v) })),
    };
};

const apiUrl = (baseUrl, path, params = {}) => {
    const url = new URL(`${baseUrl.replace(/\/+$/, "")}/api/v1${path}`);
    for (const [key, value] of Object.entries(params)) {
        url.searchParams.set(key, String(value));
    }
    return url;
};

const request = (fetchImpl, apiKey, url, init = {}) =>
    fetchImpl(url, {
        ...init,
        headers: { "X-Api-Key": apiKey, Accept: "application/json", ...(init.headers ?? {}) },
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });

const failure = async (what, response) =>
    new Error(`${what} failed with HTTP ${response.status}: ${(await response.text()).slice(0, 500)}`);

export const fetchAllVersions = async ({ baseUrl, apiKey, project, fetchImpl = fetch }) => {
    const versions = [];
    for (let pageNumber = 1; ; pageNumber++) {
        const url = apiUrl(baseUrl, "/project", { name: project, excludeInactive: false, pageSize: PAGE_SIZE, pageNumber });
        const response = await request(fetchImpl, apiKey, url);
        if (!response.ok) {
            throw await failure("Listing project versions", response);
        }
        const page = await response.json();
        if (!Array.isArray(page)) {
            throw new Error("Listing project versions returned an unexpected payload (expected an array)");
        }
        versions.push(...page);

        const total = Number(response.headers.get("X-Total-Count"));
        if (page.length < PAGE_SIZE || (Number.isFinite(total) && versions.length >= total)) {
            break;
        }
    }
    return versions.filter((v) => v.name === project);
};

export const lookupVersion = async ({
    baseUrl, apiKey, project, version, fetchImpl = fetch,
    timeoutMs = 60_000, intervalMs = 5_000,
    sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
    now = () => Date.now(),
    log = () => {},
}) => {
    const url = apiUrl(baseUrl, "/project/lookup", { name: project, version });
    const deadline = now() + timeoutMs;

    for (;;) {
        let response;
        try {
            response = await request(fetchImpl, apiKey, url);
        } catch (error) {
            response = { status: 0, ok: false, statusText: String(error) };
        }

        if (response.ok) {
            const found = await response.json();
            if (!found || !UUID_RE.test(String(found.uuid))) {
                throw new Error("Project lookup returned no valid uuid");
            }
            return found.uuid;
        }

        const retryable = response.status === 404 || response.status === 0 || response.status >= 500;
        if (!retryable) {
            throw await failure("Project lookup", response);
        }
        if (now() >= deadline) {
            throw new Error(`Version '${version}' of '${project}' not found in Dependency-Track after ${timeoutMs / 1000}s (last HTTP ${response.status})`);
        }
        log(`Version '${version}' not visible yet (HTTP ${response.status}), retrying...`);
        await sleep(intervalMs);
    }
};

const patchProject = async (fetchImpl, baseUrl, apiKey, uuid, body) => {
    try {
        const response = await request(fetchImpl, apiKey, apiUrl(baseUrl, `/project/${uuid}`), {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
        });
        return response.status;
    } catch {
        return 0;
    }
};

export const runCleanup = async ({
    baseUrl, apiKey, project, version, keepTags = 0, dryRun = false,
    fetchImpl = fetch, log = console.log, sleep, lookupTimeoutMs,
}) => {
    log(`=== Dependency-Track version cleanup: ${project} ===`);
    log(`Keep active: ${version} (current) + up to ${keepTags} most recent release version(s)${dryRun ? " [DRY RUN]" : ""}`);

    const currentUuid = await lookupVersion({ baseUrl, apiKey, project, version, fetchImpl, sleep, log, timeoutMs: lookupTimeoutMs });
    const versions = await fetchAllVersions({ baseUrl, apiKey, project, fetchImpl });
    const plan = planCleanup({ versions, currentUuid, keepTags });

    const summary = { deactivated: 0, reactivated: 0, failed: 0 };
    const apply = async ({ uuid, version: v }, { verb, done, body, counter }) => {
        const id = `${v} (${uuid})`;
        if (dryRun) {
            log(`  [WOULD ${verb}]  ${id}`);
            return;
        }
        const status = await patchProject(fetchImpl, baseUrl, apiKey, uuid, body);
        if (status >= 200 && status < 300) {
            log(`  [${done}]  ${id}`);
            if (counter) summary[counter]++;
        } else {
            log(`  [FAILED]  ${verb.toLowerCase()} ${id} (HTTP ${status})`);
            summary.failed++;
        }
    };

    for (const entry of plan.actions) {
        const id = `${entry.version} (${entry.uuid})`;
        if (entry.action === "keep") {
            log(`  [KEEP TAG]  ${id}`);
        } else if (entry.action === "none") {
            log(`  [ALREADY INACTIVE]  ${id}`);
        } else if (entry.action === "deactivate") {
            await apply(entry, { verb: "DEACTIVATE", done: "DEACTIVATED", body: { active: false }, counter: "deactivated" });
        } else if (entry.action === "reactivate") {
            await apply(entry, { verb: "REACTIVATE", done: "REACTIVATED", body: { active: true }, counter: "reactivated" });
        }
    }

    await apply(plan.current, { verb: "MARK CURRENT ACTIVE AND LATEST", done: "CURRENT, ACTIVE, LATEST", body: { active: true, isLatest: true } });

    log(dryRun
        ? `Dry run complete. ${plan.actions.length} other version(s) inspected, no changes made.`
        : `Done. ${summary.deactivated} deactivated, ${summary.reactivated} reactivated, ${summary.failed} failed.`);
    return summary;
};

const main = async () => {
    const { values } = parseArgs({
        options: {
            url: { type: "string" },
            project: { type: "string" },
            version: { type: "string" },
            "keep-tags": { type: "string", default: "0" },
            "dry-run": { type: "boolean", default: false },
        },
    });

    const apiKey = process.env.DT_API_KEY ?? "";
    const missing = [["--url", values.url], ["--project", values.project], ["--version", values.version], ["DT_API_KEY", apiKey]]
        .filter(([, value]) => !value)
        .map(([name]) => name);
    if (missing.length > 0) {
        throw new Error(`Missing required input: ${missing.join(", ")}`);
    }
    if (!/^[0-9]+$/.test(values["keep-tags"])) {
        throw new Error(`--keep-tags must be a non-negative integer (got '${values["keep-tags"]}')`);
    }

    const summary = await runCleanup({
        baseUrl: values.url,
        apiKey,
        project: values.project,
        version: values.version,
        keepTags: Number(values["keep-tags"]),
        dryRun: values["dry-run"],
    });
    if (summary.failed > 0) {
        process.exitCode = 1;
    }
};

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
    main().catch((error) => {
        console.error(`ERROR: ${error.message}`);
        process.exitCode = 1;
    });
}
