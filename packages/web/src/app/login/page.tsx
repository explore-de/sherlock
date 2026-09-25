import { auth } from "@/auth";
import { LoginForm } from "./components/loginForm";
import { redirect } from "next/navigation";
import { getProviders } from "@/auth";
import { Footer } from "@/app/components/footer";
import { isOauthProvider } from "./oauthProviders";

interface LoginProps {
    searchParams: Promise<{
        callbackUrl?: string;
        error?: string;
    }>
}

export default async function Login(props: LoginProps) {
    const searchParams = await props.searchParams;
    const session = await auth();
    if (session) {
        return redirect("/");
    }

    const providers = getProviders();
    const providerMap = providers
        .map((provider) => {
            if (typeof provider === "function") {
                const providerData = provider()
                return { id: providerData.id, name: providerData.name }
            } else {
                return { id: provider.id, name: provider.name }
            }
        });

    return (
        <div className="flex flex-col min-h-screen bg-backgroundSecondary">
            <div className="flex-1 flex flex-col items-center p-4 sm:p-12 w-full">
                <LoginForm
                    callbackUrl={searchParams.callbackUrl}
                    error={searchParams.error}
                    enabledMethods={{
                        oauth: providerMap.filter(provider => isOauthProvider(provider.id)),
                        magicLink: providerMap.some(provider => provider.id === "nodemailer"),
                        credentials: providerMap.some(provider => provider.id === "credentials"),
                    }}
                />
            </div>
            <Footer />
        </div>
    )
}
