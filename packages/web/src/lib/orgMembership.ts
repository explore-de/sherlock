import { OrgRole } from '@sherlock/db';

export const roleForNewMember = (existingMemberCount: number): OrgRole =>
    existingMemberCount === 0 ? OrgRole.OWNER : OrgRole.MEMBER;

// Credentials signup accepts any syntactically valid email and an 8 character
// password, and verifies neither. Such an account must not grant org access on
// its own; only a provider that established who the user is may do that.
const trustedIdentityProviders = new Set([
    'microsoft-entra-id',
    'github',
    'google',
    'nodemailer',
]);

export const isTrustedIdentityProvider = (provider: string | undefined): boolean =>
    provider !== undefined && trustedIdentityProviders.has(provider);
