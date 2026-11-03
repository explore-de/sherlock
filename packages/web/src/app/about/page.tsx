import Link from "next/link";
import { SherlockLogo } from "../components/sherlockLogo";

export default function AboutPage() {
    return <main className="mx-auto max-w-2xl px-6 py-16 space-y-8">
        <SherlockLogo className="h-12" />
        <h1 className="text-3xl font-bold">About Sherlock</h1>
        <p>Sherlock helps you search and explore code across your repositories.</p>
        <section id="help" className="space-y-3"><h2 className="text-xl font-semibold">Help</h2>
            <p>For access, repository connections, or an error, contact the administrator who provided your Sherlock instance. Include the error code when available.</p>
            <p>Setup and configuration guides are included in the project’s README.</p></section>
        <section id="privacy" className="space-y-3"><h2 className="text-xl font-semibold">Your deployment</h2>
            <p>Your instance administrator manages hosting, access, data retention, and any external integrations. Analytics are disabled by default. Ask your administrator for the policies that apply to this deployment.</p></section>
        <Link className="underline" href="/">Open Sherlock</Link>
    </main>;
}
