import { ConnectionList } from "./components/connectionList";
import { Header } from "../components/header";
import { NewConnectionCard } from "./components/newConnectionCard";
import { getConnections, getOrgMembership } from "@/actions";
import { isServiceError } from "@/lib/utils";
import { ServiceErrorException } from "@/lib/serviceError";
import { notFound } from "next/navigation";
import { OrgRole } from "@sourcebot/db";

export default async function ConnectionsPage(props: { params: Promise<{ domain: string }> }) {
    const { domain } = await props.params;

    const connections = await getConnections(domain);
    if (isServiceError(connections)) {
        throw new ServiceErrorException(connections);
    }

    const membership = await getOrgMembership(domain);
    if (isServiceError(membership)) {
        return notFound();
    }

    return (
        <div>
            <Header>
                <h1 className="text-3xl">Connections</h1>
            </Header>
            <div className="flex flex-col md:flex-row gap-4">
                <ConnectionList
                    className="md:w-3/4"
                    isDisabled={membership.role !== OrgRole.OWNER}
                />
                <NewConnectionCard
                    className="md:w-1/4"
                    role={membership.role}
                />
            </div>
        </div>
    );
}
