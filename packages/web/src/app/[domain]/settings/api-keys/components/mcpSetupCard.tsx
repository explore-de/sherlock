'use client';

import { useCallback, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LucideCheck, LucideCopy } from "lucide-react";
import { buildClaudeMcpAddCommand } from "./mcpSetupCommand";

export const McpSetupCard = () => {
    const [hasCopied, setHasCopied] = useState(false);

    // Rendered on the client so the command carries the host the user actually
    // reached this page on, rather than a build-time guess.
    const origin = typeof window === "undefined" ? "" : window.location.origin;
    const command = buildClaudeMcpAddCommand(origin);

    const onCopy = useCallback(() => {
        navigator.clipboard.writeText(command).then(() => {
            setHasCopied(true);
            setTimeout(() => setHasCopied(false), 2000);
        });
    }, [command]);

    return (
        <Card>
            <CardHeader>
                <CardTitle className="text-base">Use Sherlock from Claude</CardTitle>
                <CardDescription>
                    Register Sherlock as an MCP server and Claude can search every indexed repository.
                    Replace YOUR_KEY with the key you just created.
                </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
                <div className="flex flex-row items-start gap-2">
                    <code className="flex-1 overflow-x-auto whitespace-pre rounded-md bg-muted px-3 py-2 font-mono text-xs">
                        {command}
                    </code>
                    <Button variant="outline" size="icon" onClick={onCopy} aria-label="Copy command">
                        {hasCopied
                            ? <LucideCheck className="h-4 w-4" />
                            : <LucideCopy className="h-4 w-4" />}
                    </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                    Claude then has <span className="font-mono">search_code</span>,{" "}
                    <span className="font-mono">get_file</span>,{" "}
                    <span className="font-mono">list_repos</span> and{" "}
                    <span className="font-mono">ask_codebase</span>.
                </p>
            </CardContent>
        </Card>
    );
};
