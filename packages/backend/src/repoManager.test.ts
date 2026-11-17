import { afterEach, expect, test, vi } from 'vitest';
import { Repo, RepoIndexingStatus } from '@sherlock/db';
import { RepoManager } from './repoManager';

vi.mock('./logger.js', () => ({ createLogger: () => ({ info: vi.fn(), error: vi.fn() }) }));
vi.mock('./zoekt.js', () => ({ indexGitRepository: vi.fn() }));

const repo = { id: 1, orgId: 1, displayName: 'test/repo' } as Repo;

function setup() {
    const updateMany = vi.fn().mockResolvedValue({ count: 1 });
    const db = {
        repo: {
            updateMany,
            update: vi.fn().mockResolvedValue(repo),
            findUnique: vi.fn().mockResolvedValue({ ...repo, repoIndexingStatus: RepoIndexingStatus.IN_INDEX_QUEUE }),
        },
        $transaction: vi.fn(async callback => callback({ repo: { updateMany } })),
    };
    const indexQueue = { getJobs: vi.fn().mockResolvedValue([]), addBulk: vi.fn().mockResolvedValue([]) };
    const promClient = {
        pendingRepoIndexingJobs: { inc: vi.fn(), dec: vi.fn() },
        activeRepoIndexingJobs: { inc: vi.fn() },
        repoIndexingReattemptsTotal: { inc: vi.fn() },
    };
    const syncGitRepository = vi.fn();
    // Exercise the real scheduling and retry methods without opening Redis workers.
    const manager = Object.assign(Object.create(RepoManager.prototype), {
        db, indexQueue, promClient, syncGitRepository,
        logger: { info: vi.fn(), error: vi.fn() },
    }) as {
        scheduleRepoIndexingBulk: (repos: Repo[]) => Promise<void>;
        scheduleRepoTimeoutsBulk: (repos: Repo[]) => Promise<void>;
        runIndexJob: (job: { id: string; data: { repo: Repo } }) => Promise<void>;
    };
    return { manager, db, indexQueue, promClient, syncGitRepository };
}

afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
});

test('timeout starts the cooldown and only updates repos still indexing', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-17T12:00:00Z'));
    const { manager, db } = setup();

    await manager.scheduleRepoTimeoutsBulk([repo]);

    expect(db.repo.updateMany).toHaveBeenCalledWith({
        where: { id: { in: [repo.id] }, repoIndexingStatus: RepoIndexingStatus.INDEXING },
        data: { repoIndexingStatus: RepoIndexingStatus.FAILED, indexedAt: new Date() },
    });
});

test('does not requeue a timed-out repo while its original job is unfinished', async () => {
    const { manager, db, indexQueue, promClient } = setup();
    indexQueue.getJobs.mockResolvedValue([{ data: { repo } }]);

    await manager.scheduleRepoIndexingBulk([{ ...repo, repoIndexingStatus: RepoIndexingStatus.FAILED }]);

    expect(indexQueue.getJobs).toHaveBeenCalledWith(['active', 'waiting', 'prioritized', 'delayed', 'waiting-children']);
    expect(indexQueue.addBulk).not.toHaveBeenCalled();
    expect(db.$transaction).not.toHaveBeenCalled();
    expect(promClient.pendingRepoIndexingJobs.inc).not.toHaveBeenCalled();
});

test('schedules other eligible repos and allows a retry once the original job finishes', async () => {
    const { manager, db, indexQueue } = setup();
    const otherRepo = { ...repo, id: 2 };
    indexQueue.getJobs.mockResolvedValueOnce([{ data: { repo } }]);

    await manager.scheduleRepoIndexingBulk([repo, otherRepo]);

    expect(db.repo.updateMany).toHaveBeenLastCalledWith({
        where: { id: { in: [2] } }, data: { repoIndexingStatus: RepoIndexingStatus.IN_INDEX_QUEUE },
    });
    expect(indexQueue.addBulk).toHaveBeenLastCalledWith([
        expect.objectContaining({ data: { repo: otherRepo }, opts: { priority: 1, deduplication: { id: 'repo-2' } } }),
    ]);

    await manager.scheduleRepoIndexingBulk([repo]);

    expect(indexQueue.addBulk).toHaveBeenLastCalledWith([
        expect.objectContaining({ data: { repo }, opts: { priority: 1, deduplication: { id: 'repo-1' } } }),
    ]);
});

test('uses all three backoff delays before exhausting four attempts', async () => {
    vi.useFakeTimers();
    const sleep = vi.spyOn(globalThis, 'setTimeout');
    const { manager, syncGitRepository } = setup();
    syncGitRepository.mockRejectedValue(new Error('code host unavailable'));

    const result = manager.runIndexJob({ id: 'test-job', data: { repo } });
    const rejected = expect(result).rejects.toThrow('code host unavailable');
    await vi.runAllTimersAsync();
    await rejected;

    expect(syncGitRepository).toHaveBeenCalledTimes(4);
    expect(sleep.mock.calls.map(call => call[1])).toEqual([30_000, 120_000, 600_000]);
});
