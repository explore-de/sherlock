import { auth } from "@/auth";
import { NavigationMenu } from "../components/navigationMenu";
import { redirect } from "next/navigation";

export default async function Layout(
    props: Readonly<{
        children: React.ReactNode;
        params: Promise<{ domain: string }>;
    }>
) {
    const { domain } = await props.params;

    const { children } = props;

    const session = await auth();
    if (!session) {
        return redirect(`/${domain}`);
    }

    return (
        <div className="min-h-screen flex flex-col">
            <NavigationMenu domain={domain} />
            <main className="flex-grow flex justify-center p-4 bg-backgroundSecondary relative">
                <div className="w-full max-w-6xl p-6">{children}</div>
            </main>
        </div>
    )
}