/** Offset of the table page that contains a finding, in the rendered order. */
export function issuePageOffset(
  issueIds: readonly string[],
  issueId: string | null | undefined,
  pageSize: number,
): number | undefined {
  if (!issueId || pageSize <= 0) {
    return undefined;
  }
  const index = issueIds.indexOf(issueId);
  if (index < 0) {
    return undefined;
  }
  return Math.floor(index / pageSize) * pageSize;
}

/** Keep a page offset inside the last page that still has results. */
export function clampPageOffset(
  offset: number,
  totalCount: number,
  pageSize: number,
): number {
  if (pageSize <= 0 || totalCount <= 0) {
    return 0;
  }
  const lastOffset = Math.floor((totalCount - 1) / pageSize) * pageSize;
  return Math.min(Math.max(offset, 0), lastOffset);
}

/** The finding a link points at, or null when the link names none. */
export function readIssueParam(params: URLSearchParams): string | null {
  return params.get('issue') || null;
}

/**
 * Set or clear the finding in a link while keeping every other query
 * parameter, so a shared URL still opens the view it came from.
 */
export function writeIssueParam(
  params: URLSearchParams,
  issueId: string | null,
): URLSearchParams {
  const next = new URLSearchParams(params);
  if (issueId) {
    next.set('issue', issueId);
  } else {
    next.delete('issue');
  }
  return next;
}
