'use client';

import { executeSearch } from '@/lib/searchExecution';

import {
    ResizableHandle,
    ResizablePanel,
    ResizablePanelGroup,
} from "@/components/ui/resizable";
import { Separator } from "@/components/ui/separator";
import useCaptureEvent from "@/hooks/useCaptureEvent";
import { useNonEmptyQueryParam } from "@/hooks/useNonEmptyQueryParam";
import { useSearchHistory } from "@/hooks/useSearchHistory";
import { Repository, SearchQueryParams, SearchResponse, SearchResultFile } from "@/lib/types";
import { createPathWithQueryParams, measure } from "@/lib/utils";
import { InfoCircledIcon, SymbolIcon } from "@radix-ui/react-icons";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ImperativePanelHandle } from "react-resizable-panels";
import { getRepos } from "../../api/(client)/client";
import { ArrowRight, Sparkles } from "lucide-react";
import { ServiceErrorException } from "@/lib/serviceError";
import { TopBar } from "../components/topBar";
import { CodePreviewPanel } from "./components/codePreviewPanel";
import { FilterPanel } from "./components/filterPanel";
import { SearchResultsPanel } from "./components/searchResultsPanel";
import { useDomain } from "@/hooks/useDomain";

const DEFAULT_MAX_MATCH_DISPLAY_COUNT = 10000;

export default function SearchPage() {
    // We need a suspense boundary here since we are accessing query params
    // in the top level page.
    // @see : https://nextjs.org/docs/messages/missing-suspense-with-csr-bailout
    return (
        <Suspense>
            <SearchPageInternal />
        </Suspense>
    )
}

const SearchPageInternal = () => {
    const router = useRouter();
    const searchQuery = useNonEmptyQueryParam(SearchQueryParams.query) ?? "";
    const aiSearchQuery = useNonEmptyQueryParam(SearchQueryParams.aiQuery) ?? "";
    const _maxMatchDisplayCount = parseInt(useNonEmptyQueryParam(SearchQueryParams.maxMatchDisplayCount) ?? `${DEFAULT_MAX_MATCH_DISPLAY_COUNT}`);
    const maxMatchDisplayCount = isNaN(_maxMatchDisplayCount) ? DEFAULT_MAX_MATCH_DISPLAY_COUNT : _maxMatchDisplayCount;
    const { setSearchHistory } = useSearchHistory();
    const captureEvent = useCaptureEvent();
    const domain = useDomain();

    const { data: searchResponse, isLoading, isError, error } = useQuery({
        queryKey: ["search", domain, searchQuery, aiSearchQuery, maxMatchDisplayCount],
        queryFn: ({ signal }): Promise<{ data: SearchResponse & { translatedQuery?: string }, durationMs: number }> =>
            measure(() => executeSearch(searchQuery, aiSearchQuery, maxMatchDisplayCount, domain, signal), "client.search"),
        select: ({ data, durationMs }) => ({
            ...data,
            durationMs,
        }),
        enabled: searchQuery.length > 0 || aiSearchQuery.length > 0,
        retry: false,
        refetchOnWindowFocus: false,
    });


    // Write the query to the search history
    useEffect(() => {
        if (searchQuery.length === 0) {
            return;
        }

        const now = new Date().toUTCString();
        setSearchHistory((searchHistory) => [
            {
                query: searchQuery,
                date: now,
            },
            ...searchHistory.filter(search => search.query !== searchQuery),
        ])
    }, [searchQuery, setSearchHistory]);

    // Use the /api/repos endpoint to get a useful list of
    // repository metadata (like host type, repo name, etc.)
    // Convert this into a map of repo name to repo metadata
    // for easy lookup.
    const { data: repoMetadata } = useQuery({
        queryKey: ["repos"],
        queryFn: () => getRepos(domain),
        select: (data): Record<string, Repository> =>
            data.List.Repos
                .map(r => r.Repository)
                .reduce(
                    (acc, repo) => ({
                        ...acc,
                        [repo.Name]: repo,
                    }),
                    {},
                ),
        refetchOnWindowFocus: false,
    });

    useEffect(() => {
        if (!searchResponse) {
            return;
        }

        const fileLanguages = searchResponse.Result.Files?.map(file => file.Language) || [];

        captureEvent("search_finished", {
            contentBytesLoaded: searchResponse.Result.ContentBytesLoaded,
            indexBytesLoaded: searchResponse.Result.IndexBytesLoaded,
            crashes: searchResponse.Result.Crashes,
            durationMs: searchResponse.Result.Duration / 1000000,
            fileCount: searchResponse.Result.FileCount,
            shardFilesConsidered: searchResponse.Result.ShardFilesConsidered,
            filesConsidered: searchResponse.Result.FilesConsidered,
            filesLoaded: searchResponse.Result.FilesLoaded,
            filesSkipped: searchResponse.Result.FilesSkipped,
            shardsScanned: searchResponse.Result.ShardsScanned,
            shardsSkipped: searchResponse.Result.ShardsSkipped,
            shardsSkippedFilter: searchResponse.Result.ShardsSkippedFilter,
            matchCount: searchResponse.Result.MatchCount,
            ngramMatches: searchResponse.Result.NgramMatches,
            ngramLookups: searchResponse.Result.NgramLookups,
            wait: searchResponse.Result.Wait,
            matchTreeConstruction: searchResponse.Result.MatchTreeConstruction,
            matchTreeSearch: searchResponse.Result.MatchTreeSearch,
            regexpsConsidered: searchResponse.Result.RegexpsConsidered,
            flushReason: searchResponse.Result.FlushReason,
            fileLanguages,
        });
    }, [captureEvent, searchQuery, searchResponse]);

    const { fileMatches, searchDurationMs, totalMatchCount, isBranchFilteringEnabled, repoUrlTemplates } = useMemo(() => {
        if (!searchResponse) {
            return {
                fileMatches: [],
                searchDurationMs: 0,
                totalMatchCount: 0,
                isBranchFilteringEnabled: false,
                repoUrlTemplates: {},
            };
        }

        return {
            fileMatches: searchResponse.Result.Files ?? [],
            searchDurationMs: Math.round(searchResponse.durationMs),
            totalMatchCount: searchResponse.Result.MatchCount,
            isBranchFilteringEnabled: searchResponse.isBranchFilteringEnabled,
            repoUrlTemplates: searchResponse.Result.RepoURLs,
        }
    }, [searchResponse]);

    // A failed AI search carries the query that was attempted, so that the user
    // can see what the translation produced instead of a bare error.
    const attemptedQuery = useMemo(() => {
        const serviceError = error instanceof ServiceErrorException ? error.serviceError : undefined;
        const translatedQuery = serviceError?.data?.translatedQuery;
        return typeof translatedQuery === 'string' ? translatedQuery : undefined;
    }, [error]);

    const isMoreResultsButtonVisible = useMemo(() => {
        return totalMatchCount > maxMatchDisplayCount;
    }, [totalMatchCount, maxMatchDisplayCount]);

    const numMatches = useMemo(() => {
        // Accumualtes the number of matches across all files
        return fileMatches.reduce(
            (acc, file) =>
                acc + file.ChunkMatches.reduce(
                    (acc, chunk) => acc + chunk.Ranges.length,
                    0,
                ),
            0,
        );
    }, [fileMatches]);

    const onLoadMoreResults = useCallback(() => {
        const url = createPathWithQueryParams(`/${domain}/search`,
            [SearchQueryParams.aiQuery, aiSearchQuery || null],
            [SearchQueryParams.query, searchResponse?.translatedQuery ?? searchQuery],
            [SearchQueryParams.maxMatchDisplayCount, `${maxMatchDisplayCount * 2}`],
        )
        router.push(url);
    }, [maxMatchDisplayCount, router, searchQuery, aiSearchQuery, domain, searchResponse?.translatedQuery]);

    return (
        <div className="flex flex-col h-screen overflow-clip">
            {/* TopBar */}
            <div className="sticky top-0 left-0 right-0 z-10">
                <TopBar
                    defaultSearchQuery={searchQuery}
                    defaultAiSearchQuery={aiSearchQuery}
                    domain={domain}
                />
                <Separator />
            </div>

            {searchResponse?.translatedQuery && (
                <div className="flex flex-row flex-wrap items-center gap-x-2 gap-y-1 border-b border-foreground/10 bg-foreground/5 px-3 py-2 text-sm">
                    <Sparkles className="h-4 w-4 shrink-0 text-foreground/70" />
                    <span className="italic text-muted-foreground">{aiSearchQuery}</span>
                    <ArrowRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    <code className="break-all font-mono font-medium text-foreground">{searchResponse.translatedQuery}</code>
                </div>
            )}

            {isError && aiSearchQuery.length > 0 ? (
                <div className="flex flex-col items-center justify-center h-full gap-3 px-6">
                    <p className="font-semibold text-center">AI search unavailable</p>
                    {attemptedQuery ? (
                        <>
                            <div className="flex flex-row flex-wrap items-center justify-center gap-x-2 gap-y-1 rounded-md border border-foreground/10 bg-foreground/5 px-3 py-2 text-sm">
                                <span className="text-muted-foreground">Tried:</span>
                                <code className="break-all font-mono font-medium text-foreground">{attemptedQuery}</code>
                            </div>
                            <p className="max-w-xl text-sm text-muted-foreground text-center">
                                {`...but the underlying search failed: ${(error as ServiceErrorException).serviceError.message}`}
                            </p>
                        </>
                    ) : (
                        <>
                            {(error as ServiceErrorException)?.serviceError?.message && (
                                <p className="max-w-xl text-sm text-muted-foreground text-center">
                                    {(error as ServiceErrorException).serviceError.message}
                                </p>
                            )}
                            <p className="text-sm text-muted-foreground text-center">Try again, rephrase your description, or use a normal search.</p>
                        </>
                    )}
                </div>
            ) : isLoading ? (
                <div className="flex flex-col items-center justify-center h-full gap-2">
                    <SymbolIcon className="h-6 w-6 animate-spin" />
                    <p className="font-semibold text-center">Searching...</p>
                </div>
            ) : (
                <PanelGroup
                    fileMatches={fileMatches}
                    isMoreResultsButtonVisible={isMoreResultsButtonVisible}
                    onLoadMoreResults={onLoadMoreResults}
                    isBranchFilteringEnabled={isBranchFilteringEnabled}
                    repoUrlTemplates={repoUrlTemplates}
                    repoMetadata={repoMetadata ?? {}}
                    searchDurationMs={searchDurationMs}
                    numMatches={numMatches}
                />
            )}
        </div>
    );
}

interface PanelGroupProps {
    fileMatches: SearchResultFile[];
    isMoreResultsButtonVisible?: boolean;
    onLoadMoreResults: () => void;
    isBranchFilteringEnabled: boolean;
    repoUrlTemplates: Record<string, string>;
    repoMetadata: Record<string, Repository>;
    searchDurationMs: number;
    numMatches: number;
}

const PanelGroup = ({
    fileMatches,
    isMoreResultsButtonVisible,
    onLoadMoreResults,
    isBranchFilteringEnabled,
    repoUrlTemplates,
    repoMetadata,
    searchDurationMs,
    numMatches,
}: PanelGroupProps) => {
    const [selectedMatchIndex, setSelectedMatchIndex] = useState(0);
    const [selectedFile, setSelectedFile] = useState<SearchResultFile | undefined>(undefined);
    const [filteredFileMatches, setFilteredFileMatches] = useState<SearchResultFile[]>(fileMatches);

    const codePreviewPanelRef = useRef<ImperativePanelHandle>(null);
    useEffect(() => {
        if (selectedFile) {
            codePreviewPanelRef.current?.expand();
        } else {
            codePreviewPanelRef.current?.collapse();
        }
    }, [selectedFile]);

    const onFilterChanged = useCallback((matches: SearchResultFile[]) => {
        setFilteredFileMatches(matches);
    }, []);

    return (
        <ResizablePanelGroup
            direction="horizontal"
            className="h-full"
        >
            {/* ~~ Filter panel ~~ */}
            <ResizablePanel
                minSize={20}
                maxSize={30}
                defaultSize={20}
                collapsible={true}
                id={'filter-panel'}
                order={1}
            >
                <FilterPanel
                    matches={fileMatches}
                    onFilterChanged={onFilterChanged}
                    repoMetadata={repoMetadata}
                />
            </ResizablePanel>
            <ResizableHandle
                className="w-px bg-accent transition-colors delay-50 data-[resize-handle-state=drag]:bg-accent-foreground data-[resize-handle-state=hover]:bg-accent-foreground"
            />

            {/* ~~ Search results ~~ */}
            <ResizablePanel
                minSize={10}
                id={'search-results-panel'}
                order={2}
            >
                <div className="py-1 px-2 flex flex-row items-center">
                    <InfoCircledIcon className="w-4 h-4 mr-2" />
                    {
                        fileMatches.length > 0 ? (
                            <p className="text-sm font-medium">{`[${searchDurationMs} ms] Found ${numMatches} matches in ${fileMatches.length} ${fileMatches.length > 1 ? 'files' : 'file'}`}</p>
                        ) : (
                            <p className="text-sm font-medium">No results</p>
                        )
                    }
                    {isMoreResultsButtonVisible && (
                        <div
                            className="cursor-pointer text-primary text-sm hover:underline ml-4"
                            onClick={onLoadMoreResults}
                        >
                            (load more)
                        </div>
                    )}
                </div>
                {filteredFileMatches.length > 0 ? (
                    <SearchResultsPanel
                        fileMatches={filteredFileMatches}
                        onOpenFileMatch={(fileMatch) => {
                            setSelectedFile(fileMatch);
                        }}
                        onMatchIndexChanged={(matchIndex) => {
                            setSelectedMatchIndex(matchIndex);
                        }}
                        isLoadMoreButtonVisible={!!isMoreResultsButtonVisible}
                        onLoadMoreButtonClicked={onLoadMoreResults}
                        isBranchFilteringEnabled={isBranchFilteringEnabled}
                        repoMetadata={repoMetadata}
                    />
                ) : (
                    <div className="flex flex-col items-center justify-center h-full">
                        <p className="text-sm text-muted-foreground">No results found</p>
                    </div>
                )}
            </ResizablePanel>
            <ResizableHandle
                className="mt-7 w-px bg-accent transition-colors delay-50 data-[resize-handle-state=drag]:bg-accent-foreground data-[resize-handle-state=hover]:bg-accent-foreground"
            />

            {/* ~~ Code preview ~~ */}
            <ResizablePanel
                ref={codePreviewPanelRef}
                minSize={10}
                collapsible={true}
                id={'code-preview-panel'}
                order={3}
            >
                <CodePreviewPanel
                    fileMatch={selectedFile}
                    onClose={() => setSelectedFile(undefined)}
                    selectedMatchIndex={selectedMatchIndex}
                    onSelectedMatchIndexChange={setSelectedMatchIndex}
                    repoUrlTemplates={repoUrlTemplates}
                />
            </ResizablePanel>
        </ResizablePanelGroup>
    )
}
