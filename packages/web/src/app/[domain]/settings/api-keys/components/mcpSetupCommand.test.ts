import { describe, expect, test } from 'vitest';
import { buildClaudeMcpAddCommand } from './mcpSetupCommand';

describe('buildClaudeMcpAddCommand', () => {
    test('registers the server for the user, so it works outside the current project', () => {
        expect(buildClaudeMcpAddCommand('https://sherlock.example.com')).toContain(' --scope user ');
    });

    test('points the http transport at the mcp endpoint of the given origin', () => {
        expect(buildClaudeMcpAddCommand('https://sherlock.example.com')).toEqual(
            'claude mcp add --scope user --transport http sherlock https://sherlock.example.com/api/mcp --header "Authorization: Bearer YOUR_KEY"'
        );
    });
});
