'use client';

import { useClickListener } from "@/hooks/useClickListener";
import { useTailwind } from "@/hooks/useTailwind";
import { SearchQueryParams } from "@/lib/types";
import { cn, createPathWithQueryParams } from "@/lib/utils";
import {
    cursorCharLeft,
    cursorCharRight,
    cursorDocEnd,
    cursorDocStart,
    cursorLineBoundaryBackward,
    cursorLineBoundaryForward,
    deleteCharBackward,
    deleteCharForward,
    deleteGroupBackward,
    deleteGroupForward,
    deleteLineBoundaryBackward,
    deleteLineBoundaryForward,
    history,
    historyKeymap,
    selectAll,
    selectCharLeft,
    selectCharRight,
    selectDocEnd,
    selectDocStart,
    selectLineBoundaryBackward,
    selectLineBoundaryForward
} from "@codemirror/commands";
import { tags as t } from '@lezer/highlight';
import { createTheme } from '@uiw/codemirror-themes';
import CodeMirror, { Annotation, EditorView, KeyBinding, keymap, ReactCodeMirrorRef } from "@uiw/react-codemirror";
import { cva } from "class-variance-authority";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useHotkeys } from 'react-hotkeys-hook';
import { SearchSuggestionsBox } from "./searchSuggestionsBox";
import { useSuggestionsData } from "./useSuggestionsData";
import { zoekt } from "./zoektLanguageExtension";
import { CounterClockwiseClockIcon } from "@radix-ui/react-icons";
import { useSuggestionModeAndQuery } from "./useSuggestionModeAndQuery";
import { useAiSearchModels } from "./useAiSearchModels";
import { useAiQueryPreview } from "./useAiQueryPreview";
import { ArrowRight, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { Toggle } from "@/components/ui/toggle";
import { useDomain } from "@/hooks/useDomain";
import { KeyboardShortcutHint } from "../keyboardShortcutHint";

interface SearchBarProps {
    className?: string;
    size?: "default" | "sm";
    defaultQuery?: string;
    defaultAiQuery?: string;
    autoFocus?: boolean;
}

const searchBarKeymap: readonly KeyBinding[] = ([
    { key: "ArrowLeft", run: cursorCharLeft, shift: selectCharLeft, preventDefault: true },
    { key: "ArrowRight", run: cursorCharRight, shift: selectCharRight, preventDefault: true },

    { key: "Home", run: cursorLineBoundaryBackward, shift: selectLineBoundaryBackward, preventDefault: true },
    { key: "Mod-Home", run: cursorDocStart, shift: selectDocStart },

    { key: "End", run: cursorLineBoundaryForward, shift: selectLineBoundaryForward, preventDefault: true },
    { key: "Mod-End", run: cursorDocEnd, shift: selectDocEnd },

    { key: "Mod-a", run: selectAll },

    { key: "Backspace", run: deleteCharBackward, shift: deleteCharBackward },
    { key: "Delete", run: deleteCharForward },
    { key: "Mod-Backspace", mac: "Alt-Backspace", run: deleteGroupBackward },
    { key: "Mod-Delete", mac: "Alt-Delete", run: deleteGroupForward },
    { mac: "Mod-Backspace", run: deleteLineBoundaryBackward },
    { mac: "Mod-Delete", run: deleteLineBoundaryForward }
] as KeyBinding[]).concat(historyKeymap);

const searchBarContainerVariants = cva(
    "search-bar-container flex items-center justify-center gap-1 py-0.5 px-2 border rounded-md relative",
    {
        variants: {
            size: {
                default: "h-10",
                sm: "h-8"
            }
        },
        defaultVariants: {
            size: "default",
        }
    }
);

export const SearchBar = ({
    className,
    size,
    defaultQuery,
    defaultAiQuery,
    autoFocus,
}: SearchBarProps) => {
    const router = useRouter();
    const domain = useDomain();
    const tailwind = useTailwind();
    const suggestionBoxRef = useRef<HTMLDivElement>(null);
    const editorRef = useRef<ReactCodeMirrorRef>(null);
    const [cursorPosition, setCursorPosition] = useState(0);
    const [isSuggestionsEnabled, setIsSuggestionsEnabled] = useState(false);
    const [isSuggestionsBoxFocused, setIsSuggestionsBoxFocused] = useState(false);
    const [isHistorySearchEnabled, setIsHistorySearchEnabled] = useState(false);
    const { isAiSearchAvailable } = useAiSearchModels();
    const [isAiSearchModeEnabled, setIsAiSearchModeEnabled] = useState(!!defaultAiQuery);
    const [aiQuery, setAiQuery] = useState(defaultAiQuery ?? "");

    const focusEditor = useCallback(() => editorRef.current?.view?.focus(), []);
    const focusSuggestionsBox = useCallback(() => suggestionBoxRef.current?.focus(), []);

    const [_query, setQuery] = useState(defaultQuery ?? "");
    const query = useMemo(() => {
        // Replace any newlines with spaces to handle
        // copy & pasting text with newlines.
        return _query.replaceAll(/\n/g, " ");
    }, [_query]);

    // When the user navigates backwards/forwards while on the
    // search page (causing the `query` search param to change),
    // we want to update what query is displayed in the search bar.
    useEffect(() => {
        if (defaultQuery) {
            setQuery(defaultQuery);
        }
    }, [defaultQuery])

    // Mirror of the above for AI search: keeps the bar's text and mode in
    // sync with the `aiQuery` search param on back/forward navigation.
    useEffect(() => {
        setAiQuery(defaultAiQuery ?? "");
        setIsAiSearchModeEnabled(!!defaultAiQuery);
    }, [defaultAiQuery])

    const { suggestionMode, suggestionQuery } = useSuggestionModeAndQuery({
        isSuggestionsEnabled,
        isHistorySearchEnabled,
        cursorPosition,
        query,
    });

    const suggestionData = useSuggestionsData({
        suggestionMode,
        suggestionQuery,
    });

    const theme = useMemo(() => {
        return createTheme({
            theme: 'light',
            settings: {
                background: tailwind.theme.colors.background,
                foreground: tailwind.theme.colors.foreground,
                caret: '#AEAFAD',
            },
            styles: [
                {
                    tag: t.keyword,
                    color: tailwind.theme.colors.highlight,
                },
                {
                    tag: t.string,
                    color: '#2aa198',
                },
                {
                    tag: t.operator,
                    color: '#d33682',
                },
                {
                    tag: t.paren,
                    color: tailwind.theme.colors.highlight,
                },
            ],
        });
    }, [tailwind]);

    const extensions = useMemo(() => {
        return [
            keymap.of(searchBarKeymap),
            history(),
            zoekt(),
            EditorView.updateListener.of(update => {
                if (update.selectionSet) {
                    const selection = update.state.selection.main;
                    if (selection.empty) {
                        setCursorPosition(selection.anchor);
                    }
                }
            })
        ];
    }, []);

    // Hotkey to focus the search bar.
    useHotkeys('/', (event) => {
        event.preventDefault();
        focusEditor();
        setIsSuggestionsEnabled(true);
        if (editorRef.current?.view) {
            cursorDocEnd({
                state: editorRef.current.view.state,
                dispatch: editorRef.current.view.dispatch,
            });
        }
    });

    // Collapse the suggestions box if the user clicks outside of the search bar container.
    useClickListener('.search-bar-container', (isElementClicked) => {
        if (!isElementClicked) {
            setIsSuggestionsEnabled(false);
        } else {
            setIsSuggestionsEnabled(true);
        }
    });

    const onSubmit = useCallback((query: string) => {
        setIsSuggestionsEnabled(false);
        setIsHistorySearchEnabled(false);

        const url = createPathWithQueryParams(`/${domain}/search`,
            [SearchQueryParams.query, query],
        );
        router.push(url);
    }, [domain, router]);

    const canSubmitAiQuery = useMemo(() => aiQuery.trim().length > 0, [aiQuery]);

    const { preview: aiQueryPreview, isLoading: isAiQueryPreviewLoading } = useAiQueryPreview({
        query: aiQuery,
        // A query that has already been submitted is shown alongside its results;
        // previewing it again here would only repeat what the user can already see.
        isEnabled: isAiSearchModeEnabled && aiQuery !== (defaultAiQuery ?? ""),
    });

    const onSubmitAiQuery = useCallback((query: string) => {
        if (query.trim().length === 0) {
            return;
        }

        const url = createPathWithQueryParams(`/${domain}/search`,
            [SearchQueryParams.aiQuery, query],
            [SearchQueryParams.query, aiQueryPreview ?? ""],
        );
        router.push(url);
    }, [domain, router, aiQueryPreview]);

    return (
        <div
            className={cn(searchBarContainerVariants({ size, className }))}
            onKeyDown={(e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    if (isAiSearchModeEnabled) {
                        onSubmitAiQuery(aiQuery);
                        return;
                    }

                    setIsSuggestionsEnabled(false);
                    onSubmit(query);
                }

                if (isAiSearchModeEnabled) {
                    return;
                }

                if (e.key === 'Escape') {
                    e.preventDefault();
                    setIsSuggestionsEnabled(false);
                }

                if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    setIsSuggestionsEnabled(true);
                    focusSuggestionsBox();
                }

                if (e.key === 'ArrowUp') {
                    e.preventDefault();
                }
            }}
        >
            {isAiSearchAvailable && (
                <AiSearchButton
                    isToggled={isAiSearchModeEnabled}
                    onClick={() => {
                        setIsSuggestionsEnabled(false);
                        setIsHistorySearchEnabled(false);
                        setIsAiSearchModeEnabled(!isAiSearchModeEnabled);
                    }}
                />
            )}
            {isAiSearchModeEnabled ? (
                <>
                    <div className="h-6 w-[2px] shrink-0 animate-pulse rounded-full bg-linear-to-b from-foreground to-foreground/10" />
                    <Badge
                        variant="outline"
                        className="shrink-0 animate-shimmer border-foreground/20 bg-linear-to-r from-background via-foreground/10 to-background bg-size-[200%_100%] px-1.5 py-0 text-[10px] font-semibold uppercase tracking-wide text-foreground"
                    >
                        AI
                    </Badge>
                    <input
                        className="w-full bg-transparent outline-hidden text-sm placeholder:text-muted-foreground"
                        placeholder="Describe what you're looking for..."
                        value={aiQuery}
                        onChange={(e) => setAiQuery(e.target.value)}
                        autoFocus={true}
                    />
                    <AiSearchSubmitButton
                        isEnabled={canSubmitAiQuery}
                        onClick={() => onSubmitAiQuery(aiQuery)}
                    />
                    <AiQueryPreviewBox
                        preview={aiQueryPreview}
                        isLoading={isAiQueryPreviewLoading}
                        onSelect={(preview) => onSubmit(preview)}
                    />
                </>
            ) : (
                <>
                <SearchHistoryButton
                    isToggled={isHistorySearchEnabled}
                    onClick={() => {
                        setQuery("");
                        setIsHistorySearchEnabled(!isHistorySearchEnabled);
                        setIsSuggestionsEnabled(true);
                        focusEditor();
                    }}
                />
                <Separator
                    className="h-6"
                    orientation="vertical"
                />
                <CodeMirror
                    ref={editorRef}
                    className="overflow-x-auto w-full"
                    placeholder={isHistorySearchEnabled ? "Filter history..." : "Search (/) through repos..."}
                    value={query}
                    onChange={(value) => {
                        setQuery(value);
                        // Whenever the user types, we want to re-enable
                        // the suggestions box.
                        setIsSuggestionsEnabled(true);
                    }}
                    theme={theme}
                    basicSetup={false}
                    extensions={extensions}
                    indentWithTab={false}
                    autoFocus={autoFocus ?? false}
                />
                <KeyboardShortcutHint shortcut="/" />
                <SearchSuggestionsBox
                    ref={suggestionBoxRef}
                    query={query}
                    suggestionQuery={suggestionQuery}
                    suggestionMode={suggestionMode}
                    onCompletion={(newQuery: string, newCursorPosition: number, autoSubmit = false) => {
                        setQuery(newQuery);

                        // Move the cursor to it's new position.
                        // @note : normally, react-codemirror handles syncing `query`
                        // and the document state, but this happens on re-render. Since
                        // we want to move the cursor before the component re-renders,
                        // we manually update the document state inline.
                        editorRef.current?.view?.dispatch({
                            changes: { from: 0, to: query.length, insert: newQuery },
                            annotations: [Annotation.define<boolean>().of(true)],
                        });

                        editorRef.current?.view?.dispatch({
                            selection: { anchor: newCursorPosition, head: newCursorPosition },
                        });

                        // Re-focus the editor since suggestions cause focus to be lost (both click & keyboard)
                        editorRef.current?.view?.focus();

                        if (autoSubmit) {
                            onSubmit(newQuery);
                        }
                    }}
                    isEnabled={isSuggestionsEnabled}
                    onReturnFocus={() => {
                        focusEditor();
                    }}
                    isFocused={isSuggestionsBoxFocused}
                    onFocus={() => {
                        setIsSuggestionsBoxFocused(document.activeElement === suggestionBoxRef.current);
                    }}
                    onBlur={() => {
                        setIsSuggestionsBoxFocused(document.activeElement === suggestionBoxRef.current);
                    }}
                    cursorPosition={cursorPosition}
                    {...suggestionData}
                />
                </>
            )}
        </div>
    )
}

const AiQueryPreviewBox = ({
    preview,
    isLoading,
    onSelect,
}: {
    preview?: string,
    isLoading: boolean,
    onSelect: (preview: string) => void,
}) => {
    if (!preview && !isLoading) {
        return null;
    }

    return (
        <div className="w-full absolute z-10 top-12 left-0 animate-in fade-in-0 slide-in-from-top-1 duration-200 border border-foreground/10 rounded-md bg-background shadow-lg dark:shadow-[0_4px_24px_rgba(255,255,255,0.05)] p-1">
            {preview ? (
                <button
                    type="button"
                    onClick={() => onSelect(preview)}
                    className={cn(
                        "group flex w-full cursor-pointer flex-row items-baseline gap-2 rounded-sm px-2 py-1.5 text-left text-sm outline-hidden",
                        "transition-all duration-300 ease-out",
                        "hover:bg-foreground/6 hover:shadow-[0_1px_8px_rgba(0,0,0,0.06)] dark:hover:shadow-[0_1px_8px_rgba(255,255,255,0.06)]",
                        "focus-visible:bg-foreground/6 focus-visible:ring-1 focus-visible:ring-foreground/20",
                        "active:scale-[0.99] active:bg-foreground/9",
                    )}
                >
                    <span className="shrink-0 text-muted-foreground">
                        Will search for:
                    </span>
                    <code className="font-mono text-foreground break-all transition-colors duration-300 group-hover:text-foreground group-focus-visible:text-foreground">
                        {preview}
                    </code>
                    <span className="ml-auto flex shrink-0 items-center gap-1 text-xs text-muted-foreground opacity-0 transition-all duration-300 ease-out -translate-x-1.5 group-hover:translate-x-0 group-hover:opacity-100 group-focus-visible:translate-x-0 group-focus-visible:opacity-100">
                        Search
                        <ArrowRight className="h-3 w-3 transition-transform duration-300 group-hover:translate-x-0.5" />
                    </span>
                </button>
            ) : (
                <div className="flex w-full flex-row items-center rounded-sm px-2 py-1.5 text-sm">
                    <span
                        className="animate-shimmer bg-size-[200%_100%] bg-clip-text text-transparent bg-[linear-gradient(110deg,var(--color-muted-foreground)_40%,var(--color-foreground)_50%,var(--color-muted-foreground)_60%)]"
                    >
                        Working out what to search for&hellip;
                    </span>
                </div>
            )}
        </div>
    )
}

const AiSearchButton = ({
    isToggled,
    onClick,
}: {
    isToggled: boolean,
    onClick: () => void
}) => {
    return (
        <Tooltip>
            <TooltipTrigger
                asChild={true}
            >
                {/* @see : https://github.com/shadcn-ui/ui/issues/1988#issuecomment-1980597269 */}
                <div>
                    <Toggle
                        pressed={isToggled}
                        className={cn(
                            "group h-6 w-6 min-w-6 px-0 p-1 cursor-pointer transition-all duration-300",
                            "bg-foreground/5 text-foreground/70 dark:bg-foreground/10 dark:text-foreground/80",
                            "hover:scale-110 hover:bg-foreground/10 hover:text-foreground hover:shadow-[0_0_10px_rgba(0,0,0,0.15)] dark:hover:bg-foreground/20 dark:hover:shadow-[0_0_10px_rgba(255,255,255,0.2)]",
                            "data-[state=on]:bg-foreground data-[state=on]:text-background data-[state=on]:shadow-[0_0_12px_rgba(0,0,0,0.25)] dark:data-[state=on]:shadow-[0_0_14px_rgba(255,255,255,0.3)]",
                        )}
                        onClick={onClick}
                    >
                        <Sparkles className="h-4 w-4 transition-transform duration-300 group-hover:rotate-12 group-hover:scale-110" />
                    </Toggle>
                </div>
            </TooltipTrigger>
            <TooltipContent
                side="bottom"
            >
                AI search
            </TooltipContent>
        </Tooltip>
    )
}

const AiSearchSubmitButton = ({
    isEnabled,
    onClick,
}: {
    isEnabled: boolean,
    onClick: () => void
}) => {
    return (
        <Tooltip>
            <TooltipTrigger
                asChild={true}
            >
                {/* @see : https://github.com/shadcn-ui/ui/issues/1988#issuecomment-1980597269 */}
                <div>
                    <button
                        type="button"
                        aria-label="Run AI search"
                        disabled={!isEnabled}
                        onClick={onClick}
                        className={cn(
                            "group flex h-6 w-6 min-w-6 shrink-0 items-center justify-center rounded-full transition-all duration-300",
                            isEnabled
                                ? "cursor-pointer bg-foreground text-background hover:scale-110 hover:shadow-[0_0_12px_rgba(0,0,0,0.3)] dark:hover:shadow-[0_0_12px_rgba(255,255,255,0.3)]"
                                : "cursor-not-allowed bg-muted text-muted-foreground/50",
                        )}
                    >
                        <ArrowRight className="h-3.5 w-3.5 transition-transform duration-300 group-hover:translate-x-0.5" />
                    </button>
                </div>
            </TooltipTrigger>
            <TooltipContent
                side="bottom"
            >
                Run AI search
            </TooltipContent>
        </Tooltip>
    )
}

const SearchHistoryButton = ({
    isToggled,
    onClick,
}: {
    isToggled: boolean,
    onClick: () => void
}) => {
    return (
        <Tooltip>
            <TooltipTrigger
                asChild={true}
            >
                {/* @see : https://github.com/shadcn-ui/ui/issues/1988#issuecomment-1980597269 */}
                <div>
                    <Toggle
                        pressed={isToggled}
                        className="h-6 w-6 min-w-6 px-0 p-1 cursor-pointer"
                        onClick={onClick}
                    >
                        <CounterClockwiseClockIcon />
                    </Toggle>
                </div>
            </TooltipTrigger>
            <TooltipContent
                side="bottom"
            >
                Search history
            </TooltipContent>
        </Tooltip>
    )
}
