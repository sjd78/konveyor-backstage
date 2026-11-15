import {
  clampPageOffset,
  issuePageOffset,
  readIssueParam,
  writeIssueParam,
} from './issueDeepLink';

const ids = (count: number) =>
  Array.from({ length: count }, (_, index) => `issue-${index}`);

describe('issuePageOffset', () => {
  it('resolves a finding on the first page to offset zero', () => {
    expect(issuePageOffset(ids(25), 'issue-0', 10)).toBe(0);
    expect(issuePageOffset(ids(25), 'issue-9', 10)).toBe(0);
  });

  it('resolves a finding on a later page to that page offset', () => {
    expect(issuePageOffset(ids(25), 'issue-10', 10)).toBe(10);
    expect(issuePageOffset(ids(25), 'issue-24', 10)).toBe(20);
    expect(issuePageOffset(ids(32), 'issue-23', 10)).toBe(20);
  });

  it('uses the page size that the table is displaying', () => {
    expect(issuePageOffset(ids(60), 'issue-30', 25)).toBe(25);
    expect(issuePageOffset(ids(60), 'issue-59', 50)).toBe(50);
  });

  it('returns undefined for an unknown or missing id', () => {
    expect(issuePageOffset(ids(25), 'does-not-exist', 10)).toBeUndefined();
    expect(issuePageOffset(ids(25), '', 10)).toBeUndefined();
    expect(issuePageOffset(ids(25), null, 10)).toBeUndefined();
  });

  it('returns undefined without results or a usable page size', () => {
    expect(issuePageOffset([], 'issue-0', 10)).toBeUndefined();
    expect(issuePageOffset(ids(25), 'issue-0', 0)).toBeUndefined();
    expect(issuePageOffset(ids(25), 'issue-0', -10)).toBeUndefined();
  });
});

describe('clampPageOffset', () => {
  it('keeps an offset that still has results', () => {
    expect(clampPageOffset(10, 25, 10)).toBe(10);
  });

  it('moves an offset past the end to the last page', () => {
    expect(clampPageOffset(30, 25, 10)).toBe(20);
    expect(clampPageOffset(25, 10, 10)).toBe(0);
  });

  it('returns zero without results or a usable page size', () => {
    expect(clampPageOffset(20, 0, 10)).toBe(0);
    expect(clampPageOffset(20, 25, 0)).toBe(0);
  });
});

describe('readIssueParam', () => {
  it('reads the finding from the query parameters', () => {
    expect(readIssueParam(new URLSearchParams('issue=issue-4'))).toBe(
      'issue-4',
    );
    expect(readIssueParam(new URLSearchParams('issue=issue-4&view=all'))).toBe(
      'issue-4',
    );
  });

  it('reads no finding from missing or empty parameters', () => {
    expect(readIssueParam(new URLSearchParams())).toBeNull();
    expect(readIssueParam(new URLSearchParams('issue='))).toBeNull();
    expect(readIssueParam(new URLSearchParams('view=all'))).toBeNull();
  });
});

describe('writeIssueParam', () => {
  it('adds the finding and keeps the other parameters', () => {
    expect(
      writeIssueParam(new URLSearchParams('view=all'), 'issue-4').toString(),
    ).toBe('view=all&issue=issue-4');
  });

  it('replaces an existing finding', () => {
    expect(
      writeIssueParam(
        new URLSearchParams('issue=issue-1'),
        'issue-4',
      ).toString(),
    ).toBe('issue=issue-4');
  });

  it('removes the finding and keeps the other parameters', () => {
    expect(
      writeIssueParam(
        new URLSearchParams('view=all&issue=issue-4'),
        null,
      ).toString(),
    ).toBe('view=all');
  });

  it('leaves the given parameters untouched', () => {
    const params = new URLSearchParams('view=all');
    writeIssueParam(params, 'issue-4');
    expect(params.toString()).toBe('view=all');
  });
});
