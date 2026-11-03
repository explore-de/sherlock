import { describe, expect, test } from 'vitest';
import { OrgRole } from '@sherlock/db';
import { roleForNewMember, isTrustedIdentityProvider } from './orgMembership';

describe('roleForNewMember', () => {
    test('makes the first user the owner of the default org', () => {
        expect(roleForNewMember(0)).toEqual(OrgRole.OWNER);
    });

    test('joins every later user as a member', () => {
        expect(roleForNewMember(1)).toEqual(OrgRole.MEMBER);
        expect(roleForNewMember(7)).toEqual(OrgRole.MEMBER);
    });
});

describe('isTrustedIdentityProvider', () => {
    test('trusts an external identity provider that verified the user', () => {
        expect(isTrustedIdentityProvider('microsoft-entra-id')).toBe(true);
        expect(isTrustedIdentityProvider('github')).toBe(true);
        expect(isTrustedIdentityProvider('google')).toBe(true);
        expect(isTrustedIdentityProvider('nodemailer')).toBe(true);
    });

    test('does not trust credentials signup, which verifies no identity', () => {
        expect(isTrustedIdentityProvider('credentials')).toBe(false);
    });

    test('does not trust an unknown or missing provider', () => {
        expect(isTrustedIdentityProvider(undefined)).toBe(false);
        expect(isTrustedIdentityProvider('')).toBe(false);
    });
});
