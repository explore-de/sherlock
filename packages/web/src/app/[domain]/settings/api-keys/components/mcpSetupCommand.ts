export const buildClaudeMcpAddCommand = (origin: string) =>
    `claude mcp add --scope user --transport http sherlock ${origin}/api/mcp --header "Authorization: Bearer YOUR_KEY"`;
