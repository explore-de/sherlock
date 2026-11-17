import { expect, test } from 'vitest';
import { RepoIndexingStatus } from '@sherlock/db';
import { getReposToIndexFilter, getRetryDelayMs } from './reindexPolicy';

const threshold = new Date('2026-01-01T00:00:00Z');

const branchFor = (status: RepoIndexingStatus) =>
    getReposToIndexFilter(threshold).OR!.find(branch =>
        JSON.stringify(branch).includes(`"${status}"`)
    );

test('picks up NEW repos regardless of indexedAt', () => {
    expect(branchFor(RepoIndexingStatus.NEW)).toEqual({ repoIndexingStatus: RepoIndexingStatus.NEW });
});

test('picks up INDEXED repos once the reindex interval elapsed', () => {
    expect(JSON.stringify(branchFor(RepoIndexingStatus.INDEXED))).toContain('"lt"');
});

test('picks up FAILED repos only after the cooldown elapsed', () => {
    expect(branchFor(RepoIndexingStatus.FAILED)).toEqual({
        AND: [
            { repoIndexingStatus: RepoIndexingStatus.FAILED },
            { OR: [{ indexedAt: null }, { indexedAt: { lt: threshold } }] },
        ],
    });
});

test('retry delay grows between attempts', () => {
    const delays = [1, 2, 3].map(getRetryDelayMs);
    expect(delays).toEqual([30_000, 120_000, 600_000]);
});

test('retry delay stays at the last step beyond the table', () => {
    expect(getRetryDelayMs(9)).toBe(600_000);
});
