import { getApiKeys } from "@/actions";
import { isServiceError } from "@/lib/utils";
import { ServiceErrorException } from "@/lib/serviceError";
import { ApiKeysList } from "./components/apiKeysList";
import { CreateApiKeyCard } from "./components/createApiKeyCard";
import { McpSetupCard } from "./components/mcpSetupCard";

interface ApiKeysPageProps {
    params: Promise<{
        domain: string;
    }>
}

export default async function ApiKeysPage(props: ApiKeysPageProps) {
    const { domain } = await props.params;

    const apiKeys = await getApiKeys(domain);
    if (isServiceError(apiKeys)) {
        throw new ServiceErrorException(apiKeys);
    }

    return (
        <div className="flex flex-col gap-6">
            <div>
                <h3 className="text-lg font-medium">API Keys</h3>
                <p className="text-sm text-muted-foreground">
                    API keys let tools search your code without a browser session — an AI assistant over MCP, or a script.
                    Each key acts as you.
                </p>
            </div>

            <ApiKeysList apiKeys={apiKeys} />
            <CreateApiKeyCard />
            <McpSetupCard />
        </div>
    )
}
