import { test } from "node:test";
import assert from "node:assert/strict";
import { isReleaseVersion, planCleanup, fetchAllVersions, lookupVersion, runCleanup } from "./dtrack-version-cleanup.mjs";

const uuid = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const version = (n, v, active, lastBomImport) => ({ uuid: uuid(n), name: "explore/sherlock", version: v, active, lastBomImport });

test("release versions are semver without a prerelease suffix, optionally prefixed", () => {
    for (const v of ["1.2.3", "3.0.9", "reactor-1.2.3", "a.b_c-10.0.1"]) {
        assert.equal(isReleaseVersion(v), true, v);
    }
    for (const v of ["dev-42", "1.2.3-SNAPSHOT", "1.2.3-alpha", "v3.0.9", "1.2", "1.2.3.4", ""]) {
        assert.equal(isReleaseVersion(v), false, v);
    }
});

test("keeps only the current version by default and deactivates every other active version", () => {
    const versions = [
        version(1, "dev-10", true, 100),
        version(2, "dev-11", true, 200),
        version(3, "3.0.9", true, 150),
        version(4, "dev-12", true, 300),
    ];

    const plan = planCleanup({ versions, currentUuid: uuid(4), keepTags: 0 });

    assert.deepEqual(plan.current, { uuid: uuid(4), version: "dev-12", reactivate: false });
    assert.deepEqual(plan.actions, [
        { uuid: uuid(1), version: "dev-10", action: "deactivate" },
        { uuid: uuid(2), version: "dev-11", action: "deactivate" },
        { uuid: uuid(3), version: "3.0.9", action: "deactivate" },
    ]);
});

test("keeps the N most recently imported release versions, decided by lastBomImport and not by semver", () => {
    const versions = [
        version(1, "3.0.9", true, 100),
        version(2, "3.0.7", false, 500),
        version(3, "3.0.8", true, 300),
        version(4, "dev-50", true, 900),
        version(5, "dev-51", true, 1000),
    ];

    const plan = planCleanup({ versions, currentUuid: uuid(5), keepTags: 2 });

    assert.deepEqual(plan.actions, [
        { uuid: uuid(1), version: "3.0.9", action: "deactivate" },
        { uuid: uuid(2), version: "3.0.7", action: "reactivate" },
        { uuid: uuid(3), version: "3.0.8", action: "keep" },
        { uuid: uuid(4), version: "dev-50", action: "deactivate" },
    ]);
});

test("leaves already inactive versions outside the keep set untouched", () => {
    const versions = [version(1, "dev-1", false, 1), version(2, "dev-2", true, 2)];

    const plan = planCleanup({ versions, currentUuid: uuid(2), keepTags: 0 });

    assert.deepEqual(plan.actions, [{ uuid: uuid(1), version: "dev-1", action: "none" }]);
});

test("reactivates the current version when it is inactive", () => {
    const versions = [version(1, "3.1.0", false, 10)];

    const plan = planCleanup({ versions, currentUuid: uuid(1), keepTags: 0 });

    assert.deepEqual(plan.current, { uuid: uuid(1), version: "3.1.0", reactivate: true });
    assert.deepEqual(plan.actions, []);
});

test("the current version never counts towards the kept release tags", () => {
    const versions = [version(1, "3.0.8", true, 10), version(2, "3.0.9", true, 20)];

    const plan = planCleanup({ versions, currentUuid: uuid(2), keepTags: 1 });

    assert.deepEqual(plan.actions, [{ uuid: uuid(1), version: "3.0.8", action: "keep" }]);
});

test("rejects a version list that does not contain the current version", () => {
    assert.throws(() => planCleanup({ versions: [version(1, "dev-1", true, 1)], currentUuid: uuid(9), keepTags: 0 }), /current version/);
});

test("rejects API rows with an invalid uuid instead of patching them", () => {
    const versions = [{ uuid: "../../team", version: "dev-1", active: true, lastBomImport: 1 }, version(2, "dev-2", true, 2)];

    assert.throws(() => planCleanup({ versions, currentUuid: uuid(2), keepTags: 0 }), /invalid uuid/i);
});

const jsonResponse = (status, body, headers = {}) =>
    new Response(body === undefined ? null : JSON.stringify(body), { status, headers: { "content-type": "application/json", ...headers } });

const recordingFetch = (handler) => {
    const calls = [];
    const fetchImpl = async (url, init = {}) => {
        const call = { url: new URL(url), method: init.method ?? "GET", headers: init.headers ?? {}, body: init.body };
        calls.push(call);
        return handler(call, calls.length);
    };
    return { calls, fetchImpl };
};

test("fetches every page until X-Total-Count is reached and keeps only exact name matches", async () => {
    const page1 = Array.from({ length: 100 }, (_, i) => version(i + 1, `dev-${i + 1}`, true, i));
    const page2 = [version(101, "dev-101", true, 101), { ...version(102, "dev-102", true, 102), name: "explore/sherlock-old" }];
    const { calls, fetchImpl } = recordingFetch(({ url }) =>
        jsonResponse(200, url.searchParams.get("pageNumber") === "1" ? page1 : page2, { "X-Total-Count": "102" }),
    );

    const versions = await fetchAllVersions({ baseUrl: "https://dt.example", apiKey: "k", project: "explore/sherlock", fetchImpl });

    assert.equal(versions.length, 101);
    assert.equal(calls.length, 2);
    assert.equal(calls[0].url.pathname, "/api/v1/project");
    assert.equal(calls[0].url.searchParams.get("name"), "explore/sherlock");
    assert.equal(calls[0].url.searchParams.get("excludeInactive"), "false");
    assert.equal(calls[0].url.searchParams.get("pageSize"), "100");
    assert.equal(calls[1].url.searchParams.get("pageNumber"), "2");
    assert.equal(calls[0].headers["X-Api-Key"], "k");
});

test("lookup retries while the uploaded version is not processed yet, then returns its uuid", async () => {
    const { calls, fetchImpl } = recordingFetch((_, n) => (n < 3 ? jsonResponse(404) : jsonResponse(200, version(7, "dev-7", true, 7))));

    const found = await lookupVersion({
        baseUrl: "https://dt.example", apiKey: "k", project: "explore/sherlock", version: "dev-7",
        fetchImpl, timeoutMs: 60_000, intervalMs: 0, sleep: async () => {},
    });

    assert.equal(found, uuid(7));
    assert.equal(calls.length, 3);
    assert.equal(calls[0].url.pathname, "/api/v1/project/lookup");
    assert.equal(calls[0].url.searchParams.get("version"), "dev-7");
});

test("lookup gives up after the timeout when the version never appears", async () => {
    let now = 0;
    const { fetchImpl } = recordingFetch(() => jsonResponse(404));

    await assert.rejects(
        lookupVersion({
            baseUrl: "https://dt.example", apiKey: "k", project: "explore/sherlock", version: "dev-7",
            fetchImpl, timeoutMs: 10_000, intervalMs: 5_000, sleep: async (ms) => { now += ms; }, now: () => now,
        }),
        /not found/,
    );
});

test("lookup fails immediately on an authorization error instead of polling", async () => {
    const { calls, fetchImpl } = recordingFetch(() => jsonResponse(403, { message: "forbidden" }));

    await assert.rejects(
        lookupVersion({
            baseUrl: "https://dt.example", apiKey: "k", project: "explore/sherlock", version: "dev-7",
            fetchImpl, timeoutMs: 60_000, intervalMs: 0, sleep: async () => {},
        }),
        /HTTP 403/,
    );
    assert.equal(calls.length, 1);
});

const cleanupServer = ({ versions, patchStatus = () => 200 }) =>
    recordingFetch(({ url, method }) => {
        if (url.pathname === "/api/v1/project/lookup") {
            return jsonResponse(200, versions.find((v) => v.version === url.searchParams.get("version")));
        }
        if (url.pathname === "/api/v1/project" && method === "GET") {
            return jsonResponse(200, versions, { "X-Total-Count": String(versions.length) });
        }
        if (method === "PATCH") {
            return jsonResponse(patchStatus(url.pathname.split("/").pop()), {});
        }
        return jsonResponse(500, { unexpected: `${method} ${url.pathname}` });
    });

test("run deactivates stale versions and marks the current version active and latest", async () => {
    const versions = [version(1, "dev-1", true, 1), version(2, "dev-2", true, 2)];
    const { calls, fetchImpl } = cleanupServer({ versions });

    const summary = await runCleanup({
        baseUrl: "https://dt.example/", apiKey: "k", project: "explore/sherlock", version: "dev-2", keepTags: 0,
        dryRun: false, fetchImpl, log: () => {}, sleep: async () => {},
    });

    const patches = calls.filter((c) => c.method === "PATCH").map((c) => [c.url.pathname, JSON.parse(c.body)]);
    assert.deepEqual(patches, [
        [`/api/v1/project/${uuid(1)}`, { active: false }],
        [`/api/v1/project/${uuid(2)}`, { active: true, isLatest: true }],
    ]);
    assert.deepEqual(summary, { deactivated: 1, reactivated: 0, failed: 0 });
});

test("dry run reports the plan without sending any PATCH", async () => {
    const versions = [version(1, "dev-1", true, 1), version(2, "dev-2", true, 2)];
    const { calls, fetchImpl } = cleanupServer({ versions });
    const lines = [];

    await runCleanup({
        baseUrl: "https://dt.example", apiKey: "k", project: "explore/sherlock", version: "dev-2", keepTags: 0,
        dryRun: true, fetchImpl, log: (l) => lines.push(l), sleep: async () => {},
    });

    assert.equal(calls.filter((c) => c.method === "PATCH").length, 0);
    assert.ok(lines.some((l) => l.includes("WOULD DEACTIVATE") && l.includes("dev-1")));
});

test("run keeps going after a failed PATCH but reports the failure so the caller can exit non-zero", async () => {
    const versions = [version(1, "dev-1", true, 1), version(2, "dev-2", true, 2), version(3, "dev-3", true, 3)];
    const { calls, fetchImpl } = cleanupServer({ versions, patchStatus: (id) => (id === uuid(1) ? 502 : 200) });

    const summary = await runCleanup({
        baseUrl: "https://dt.example", apiKey: "k", project: "explore/sherlock", version: "dev-3", keepTags: 0,
        dryRun: false, fetchImpl, log: () => {}, sleep: async () => {},
    });

    assert.equal(calls.filter((c) => c.method === "PATCH").length, 3);
    assert.deepEqual(summary, { deactivated: 1, reactivated: 0, failed: 1 });
});
