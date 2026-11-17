import { beforeEach, expect, test, vi } from 'vitest';

const gitMock = vi.hoisted(() => ({
    clone: vi.fn(),
    fetch: vi.fn(),
    cwd: vi.fn(),
}));

vi.mock('simple-git', () => ({
    simpleGit: () => gitMock,
}));

import { cloneRepository, fetchRepository } from './git';

beforeEach(() => {
    vi.resetAllMocks();
    gitMock.cwd.mockReturnValue(gitMock);
});

test('fetch failure carries the git error message', async () => {
    gitMock.fetch.mockRejectedValue(new Error('fatal: unable to access: The requested URL returned error: 503'));

    await expect(fetchRepository('/data/repos/1')).rejects.toThrow('returned error: 503');
});

test('clone failure carries the git error message', async () => {
    gitMock.clone.mockRejectedValue(new Error('fatal: repository not found'));

    await expect(cloneRepository('https://gitlab.example/a/b.git', '/data/repos/1')).rejects.toThrow('repository not found');
});

test('credentials in the clone url never reach the error message', async () => {
    gitMock.clone.mockRejectedValue(new Error("fatal: unable to access 'https://oauth2:s3cr3t@gitlab.example/a/b.git/': 401"));

    const error = await cloneRepository('https://oauth2:s3cr3t@gitlab.example/a/b.git', '/data/repos/1').catch(e => e);

    expect(error.message).not.toContain('s3cr3t');
});
