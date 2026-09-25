import { NavigationMenu } from "../components/navigationMenu";

export default async function Layout(
    props: Readonly<{
        children: React.ReactNode;
        params: Promise<{ domain: string }>;
    }>
) {
    const { domain } = await props.params;

    const { children } = props;

    return (
        <div className="min-h-screen flex flex-col">
            <NavigationMenu domain={domain} />
            <main className="flex-grow flex justify-center p-4 bg-backgroundSecondary relative">
                <div className="w-full max-w-6xl rounded-lg p-6">{children}</div>
            </main>
        </div>
    )
}