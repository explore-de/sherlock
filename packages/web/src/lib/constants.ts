
// @note: Order is important here.
export enum OnboardingSteps {
    CreateOrg = 'create-org',
    ConnectCodeHost = 'connect-code-host',
    InviteTeam = 'invite-team',
    Complete = 'complete',
}

export const MOBILE_UNSUPPORTED_SPLASH_SCREEN_DISMISSED_COOKIE_NAME = 'sb.mobile-unsupported-splash-screen-dismissed';

export const SINGLE_TENANT_USER_ID = '1';
export const SINGLE_TENANT_USER_EMAIL = 'default@sherlock.invalid'; // Internal identity; never used as a support destination
export const SINGLE_TENANT_ORG_ID = 1;
export const SINGLE_TENANT_ORG_DOMAIN = '~';
export const SINGLE_TENANT_ORG_NAME = 'default';
