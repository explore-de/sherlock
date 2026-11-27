'use client';

import { useCallback, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { createApiKey } from "@/actions";
import { useDomain } from "@/hooks/useDomain";
import { useToast } from "@/components/hooks/use-toast";
import { useRouter } from "next/navigation";
import { isServiceError } from "@/lib/utils";
import { LucideCopy, LucideCheck } from "lucide-react";

export const CreateApiKeyCard = () => {
    const [name, setName] = useState("");
    const [isCreating, setIsCreating] = useState(false);
    const [createdKey, setCreatedKey] = useState<string | null>(null);
    const [hasCopied, setHasCopied] = useState(false);
    const domain = useDomain();
    const { toast } = useToast();
    const router = useRouter();

    const onCreate = useCallback(() => {
        setIsCreating(true);
        createApiKey(name, domain)
            .then((response) => {
                if (isServiceError(response)) {
                    toast({ description: `❌ Failed to create key. Reason: ${response.message}` });
                } else {
                    setCreatedKey(response.key);
                    setName("");
                    router.refresh();
                }
            })
            .finally(() => setIsCreating(false));
    }, [name, domain, router, toast]);

    const onCopy = useCallback(() => {
        if (!createdKey) {
            return;
        }
        navigator.clipboard.writeText(createdKey).then(() => {
            setHasCopied(true);
            setTimeout(() => setHasCopied(false), 2000);
        });
    }, [createdKey]);

    return (
        <>
            <Card>
                <CardHeader>
                    <CardTitle className="text-base">Create an API key</CardTitle>
                    <CardDescription>
                        Name it after where you will use it, so you know which one to revoke later.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <form
                        className="flex flex-col sm:flex-row gap-2"
                        onSubmit={(event) => {
                            event.preventDefault();
                            onCreate();
                        }}
                    >
                        <Input
                            id="api-key-name"
                            placeholder="Claude Code on my laptop"
                            value={name}
                            onChange={(event) => setName(event.target.value)}
                            maxLength={80}
                        />
                        <Button type="submit" disabled={name.trim().length === 0 || isCreating}>
                            {isCreating ? "Creating…" : "Create key"}
                        </Button>
                    </form>
                </CardContent>
            </Card>

            <Dialog open={createdKey !== null} onOpenChange={(open) => !open && setCreatedKey(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Copy your key now</DialogTitle>
                        <DialogDescription>
                            This is the only time it is shown. Only a hash is stored, so it cannot be
                            recovered — if you lose it, revoke the key and create a new one.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="flex min-w-0 flex-row items-center gap-2">
                        <code className="min-w-0 flex-1 break-all rounded-md bg-muted px-3 py-2 font-mono text-sm">
                            {createdKey}
                        </code>
                        <Button variant="outline" size="icon" onClick={onCopy} aria-label="Copy key">
                            {hasCopied
                                ? <LucideCheck className="h-4 w-4" />
                                : <LucideCopy className="h-4 w-4" />}
                        </Button>
                    </div>
                    <DialogFooter>
                        <Button onClick={() => setCreatedKey(null)}>Done</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
};
