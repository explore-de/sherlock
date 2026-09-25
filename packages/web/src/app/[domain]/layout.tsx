import { prisma } from "@/prisma";
import { auth, signOut } from "@/auth";
import { getOrgFromDomain } from "@/data/org";
import { OnboardGuard } from "./components/onboardGuard";
import { cookies, headers } from "next/headers";
import { getSelectorsByUserAgent } from "react-device-detect";
import { MobileUnsupportedSplashScreen } from "./components/mobileUnsupportedSplashScreen";
import { MOBILE_UNSUPPORTED_SPLASH_SCREEN_DISMISSED_COOKIE_NAME } from "@/lib/constants";
import { SyntaxReferenceGuide } from "./components/syntaxReferenceGuide";
import { SyntaxGuideProvider } from "./components/syntaxGuideProvider";
import { env } from "@/env.mjs";
import { notFound, redirect } from "next/navigation";
interface LayoutProps {
    children: React.ReactNode,
    params: Promise<{ domain: string }>
}

export default async function Layout(props: LayoutProps) {
    const { domain } = await props.params;

    const { children } = props;

    const org = await getOrgFromDomain(domain);

    if (!org) {
        return notFound();
    }

    if (env.SOURCEBOT_AUTH_ENABLED === 'true') {
        const session = await auth();
        if (!session) {
            redirect('/login');
        }

        const membership = await prisma.userToOrg.findUnique({
            where: {
                orgId_userId: {
                    orgId: org.id,
                    userId: session.user.id
                }
            }
        });

        if (!membership) {
            const user = await prisma.user.findUnique({
                where: { id: session.user.id },
            });

            // A session can outlive the user it names - a restored database, a
            // deleted account. signOut throws a redirect, so nothing below it
            // runs for that case; a real user who simply lacks membership
            // still gets the 404.
            if (!user) {
                await signOut({ redirectTo: '/login' });
            }

            return notFound();
        }
    }

    if (!org.isOnboarded) {
        return (
            <OnboardGuard>
                {children}
            </OnboardGuard>
        )
    }

    const headersList = await headers();
    const cookieStore = await cookies()
    const userAgent = headersList.get('user-agent');
    const { isMobile } = getSelectorsByUserAgent(userAgent ?? '');

    if (isMobile && !cookieStore.has(MOBILE_UNSUPPORTED_SPLASH_SCREEN_DISMISSED_COOKIE_NAME)) {
        return (
            <MobileUnsupportedSplashScreen />
        )
    }
    return (
        <SyntaxGuideProvider>
            {children}
            <SyntaxReferenceGuide />
        </SyntaxGuideProvider>
    )
}