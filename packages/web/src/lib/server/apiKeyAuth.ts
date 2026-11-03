import type { Prisma } from '@sherlock/db';

import { hashApiKey } from '../apiKey';

/**
 * Narrowed to the one delegate this module touches, so a test can supply a stub
 * without standing up a database.
 */
interface ApiKeyClient {
    apiKey: Pick<Prisma.ApiKeyDelegate, 'findUnique' | 'update'>;
    userToOrg: Pick<Prisma.UserToOrgDelegate, 'findUnique'>;
}

export interface ApiKeyIdentity {
    orgId: number;
    user: { id: string; email: string | null };
}

export const resolveApiKey = async (
    client: ApiKeyClient,
    token: string,
): Promise<ApiKeyIdentity | undefined> => {
    if (!token) {
        return undefined;
    }

    const record = await client.apiKey.findUnique({
        where: { hash: hashApiKey(token) },
        select: {
            id: true,
            orgId: true,
            userId: true,
            user: { select: { id: true, email: true } },
        },
    });

    // A key outlives the user it was issued for if the account was deleted; it
    // must not keep granting access on their behalf.
    if (!record || !record.user) {
        return undefined;
    }

    // The key names the org it was issued for, but membership is revocable - an
    // owner removing a member leaves that member's keys behind. Access follows
    // current membership, not what was true at creation.
    const membership = await client.userToOrg.findUnique({
        where: {
            orgId_userId: {
                orgId: record.orgId,
                userId: record.userId,
            },
        },
    });

    if (!membership) {
        return undefined;
    }

    try {
        await client.apiKey.update({
            where: { id: record.id },
            data: { lastUsedAt: new Date() },
        });
    } catch {
        // Bookkeeping - a failure here is not a reason to refuse a valid key.
    }

    return { orgId: record.orgId, user: record.user };
};
