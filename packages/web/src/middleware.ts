import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { env } from './env.mjs'
import { SINGLE_TENANT_ORG_DOMAIN } from '@/lib/constants'

export async function middleware(request: NextRequest) {
    const url = request.nextUrl.clone();

    if ([
        "/about",
        "/icon.svg",
        "/sherlock-logo.svg",
        "/sherlock-social.png",
        "/sherlock-smoking.png",
    ].includes(url.pathname)) {
        return NextResponse.next();
    }

    if (env.SOURCEBOT_TENANCY_MODE !== 'single') {
        return NextResponse.next();
    }

    // Enable these domains when auth is enabled.
    if (env.SOURCEBOT_AUTH_ENABLED === 'true' &&
        (
            url.pathname.startsWith('/login') ||
            url.pathname.startsWith('/redeem')
        )
    ) {
        return NextResponse.next();
    }

    const pathSegments = url.pathname.split('/').filter(Boolean);
    const currentDomain = pathSegments[0];

    // If we're already on the correct domain path, allow
    if (currentDomain === SINGLE_TENANT_ORG_DOMAIN) {
        return NextResponse.next();
    }

    url.pathname = `/${SINGLE_TENANT_ORG_DOMAIN}${pathSegments.length > 1 ? '/' + pathSegments.slice(1).join('/') : ''}`;
    return NextResponse.redirect(url);
}

export const config = {
    // https://nextjs.org/docs/app/building-your-application/routing/middleware#matcher
    matcher: [
        '/((?!api|_next/static|ingest|monitoring|_next/image|favicon.ico|sitemap.xml|robots.txt|arrow.png|placeholder_avatar.png|sherlock-mark.png|sherlock-mark-light.png).*)',
    ],
}
