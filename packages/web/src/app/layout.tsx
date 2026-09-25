import type { Metadata } from "next";
import { Jersey_10 } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "next-themes";
import { QueryClientProvider } from "./queryClientProvider";
import { PostHogProvider } from "./posthogProvider";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SessionProvider } from "next-auth/react";
import { env } from "@/env.mjs";
import { headers } from "next/headers";

// Pixel typeface used for the Sherlock wordmark. Jersey 10, SIL OFL 1.1.
// Single weight by design: asking for 700 would make the browser synthesise a
// bold, which smears the pixel grid.
const pixelFont = Jersey_10({
    weight: "400",
    subsets: ["latin"],
    variable: "--font-pixel",
    display: "swap",
});

export async function generateMetadata(): Promise<Metadata> {
    const requestHeaders = await headers();
    const configuredUrl = new URL(env.AUTH_URL);
    const host = requestHeaders.get("x-forwarded-host")?.split(",")[0].trim()
        || requestHeaders.get("host");
    const protocol = requestHeaders.get("x-forwarded-proto")?.split(",")[0].trim()
        || configuredUrl.protocol.replace(":", "");
    let metadataBase = configuredUrl;
    // Resolve images against the current public host, including reverse proxies
    // and temporary tunnels, rather than baking a deployment URL into the build.
    if (host && (protocol === "https" || protocol === "http")) {
        try {
            metadataBase = new URL(`${protocol}://${host}`);
        } catch {
            // Fall back to the configured URL for malformed proxy headers.
        }
    }

    const title = "Sherlock";
    const description = "Search and explore code across your repositories, on your own infrastructure.";
    const image = {
        url: new URL("/sherlock-social.png", metadataBase).toString(),
        width: 1200,
        height: 630,
        alt: "Sherlock — Your codebase, connected. Search and explore code on your own infrastructure.",
        type: "image/png",
    };

    return {
        metadataBase,
        title,
        description,
        applicationName: title,
        openGraph: {
            type: "website",
            siteName: title,
            title,
            description,
            images: [image],
        },
        twitter: {
            card: "summary_large_image",
            title,
            description,
            images: [image],
        },
    };
}

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html
            lang="en"
            className={pixelFont.variable}
            // @see : https://github.com/pacocoursey/next-themes?tab=readme-ov-file#with-app
            suppressHydrationWarning
        >
            <body>
                <Toaster />
                <SessionProvider>
                    <PostHogProvider disabled={env.SOURCEBOT_TELEMETRY_DISABLED === "true"}>
                        <ThemeProvider
                            attribute="class"
                            defaultTheme="dark"
                            enableSystem
                            disableTransitionOnChange
                        >
                            <QueryClientProvider>
                                <TooltipProvider>
                                    {children}
                                </TooltipProvider>
                            </QueryClientProvider>
                        </ThemeProvider>
                    </PostHogProvider>
                </SessionProvider>
            </body>
        </html>
    );
}
