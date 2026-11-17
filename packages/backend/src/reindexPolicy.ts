import type { Prisma } from '@sherlock/db';
import { RepoIndexingStatus } from '@sherlock/db';

const RETRY_DELAYS_MS = [30_000, 120_000, 600_000];

export const getRetryDelayMs = (attempt: number) =>
    RETRY_DELAYS_MS[Math.min(attempt, RETRY_DELAYS_MS.length) - 1];

export const getReposToIndexFilter = (thresholdDate: Date): Prisma.RepoWhereInput => {
    const notIndexedSince = { OR: [{ indexedAt: null }, { indexedAt: { lt: thresholdDate } }] };

    return {
        OR: [
            // "NEW" is really a misnomer here - it just means that the repo needs to be indexed
            // immediately. In most cases, this will be because the repo was just created and
            // is indeed "new". However, it could also be that a "retry" was requested on a failed
            // index. So, we don't want to block on the indexedAt timestamp here.
            { repoIndexingStatus: RepoIndexingStatus.NEW },
            { AND: [{ repoIndexingStatus: RepoIndexingStatus.INDEXED }, notIndexedSince] },
            // A failure is usually transient (code host outage, restart), so it is retried once the
            // cooldown has elapsed. onIndexJobFailed sets indexedAt, which makes it the cooldown start.
            { AND: [{ repoIndexingStatus: RepoIndexingStatus.FAILED }, notIndexedSince] },
        ],
    };
};
