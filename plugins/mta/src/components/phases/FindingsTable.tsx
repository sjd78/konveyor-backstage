import {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  Cell,
  Column,
  Row,
  SearchField,
  Table,
  Text,
  useTable,
  VisuallyHidden,
  type ColumnConfig,
  type SortDescriptor,
} from '@backstage/ui';
import { RiArrowDownSLine, RiArrowRightSLine } from '@remixicon/react';
import { useSearchParams } from 'react-router-dom';
import { SeverityChip } from '../shared/SeverityChip';
import { IssueDetailPanel } from '../shared/IssueDetailPanel';
import { IconAction, Section } from '../shared/MtaUi';
import type { IssueSeverity, MigrationIssue } from '../../types';
import {
  clampPageOffset,
  issuePageOffset,
  readIssueParam,
  writeIssueParam,
} from './issueDeepLink';
import styles from './FindingsTable.module.css';

/** Severity rank used when the Severity column is sorted. */
const SEVERITIES: IssueSeverity[] = ['critical', 'major', 'minor', 'info'];

/** A page holds at most ten findings, as the Hub table always has. */
const PAGE_SIZE = 10;

/** Stable id of the inline detail a row toggle controls. */
const detailId = (issueId: string) => `issue-details-${issueId}`;

/** How a finding's source location reads in the table and in search. */
function locationText(issue: MigrationIssue): string {
  return issue.file
    ? `${issue.file}${issue.line !== undefined ? `:${issue.line}` : ''}`
    : 'No source location reported';
}

function searchIssues(
  issues: MigrationIssue[],
  search: string,
): MigrationIssue[] {
  const query = search.trim().toLowerCase();
  if (!query) {
    return issues;
  }
  return issues.filter(issue =>
    [
      issue.severity,
      issue.file,
      issue.line !== undefined ? String(issue.line) : '',
      issue.category,
      issue.description,
    ]
      .join(' ')
      .toLowerCase()
      .includes(query),
  );
}

function sortIssues(
  issues: MigrationIssue[],
  sort: SortDescriptor,
): MigrationIssue[] {
  const direction = sort.direction === 'descending' ? -1 : 1;
  const field = String(sort.column);
  if (field === 'severity') {
    return [...issues].sort(
      (a, b) =>
        (SEVERITIES.indexOf(a.severity) - SEVERITIES.indexOf(b.severity)) *
        direction,
    );
  }
  const value = (issue: MigrationIssue): string =>
    field === 'category' ? issue.category : issue.description;
  return [...issues].sort(
    (a, b) =>
      value(a).localeCompare(value(b), undefined, { numeric: true }) *
      direction,
  );
}

/**
 * Break long repository paths at separators instead of mid-token, and read the
 * upstream sentence when Hub reported no location.
 */
function IssueLocation({ issue }: { issue: MigrationIssue }) {
  if (!issue.file) {
    return (
      <Text as="span" variant="body-small" className={styles.issueLocation}>
        {locationText(issue)}
      </Text>
    );
  }
  const segments = issue.file.split('/');
  return (
    <Text as="span" variant="body-small" className={styles.issueLocation}>
      {segments.map((segment, index) => (
        <Fragment key={`${segment}-${index}`}>
          {segment}
          {index < segments.length - 1 && (
            <>
              /<wbr />
            </>
          )}
        </Fragment>
      ))}
      {issue.line !== undefined ? `:${issue.line}` : ''}
    </Text>
  );
}

export function FindingsTable({ issues }: { issues: MigrationIssue[] }) {
  const [search, setSearch] = useState('');
  const [params, setParams] = useSearchParams();
  const issueId = readIssueParam(params);

  const { tableProps } = useTable({
    mode: 'complete',
    data: issues,
    search,
    onSearchChange: setSearch,
    searchFn: searchIssues,
    sortFn: sortIssues,
    // The offset is controlled below, so a link can open a later page.
    paginationOptions: { type: 'none' },
  });

  const ordered = useMemo(() => tableProps.data ?? [], [tableProps.data]);
  const orderedIds = useMemo(() => ordered.map(issue => issue.id), [ordered]);
  const sortDescriptor = tableProps.sort?.descriptor;
  const queryKey = [
    search,
    sortDescriptor ? String(sortDescriptor.column) : '',
    sortDescriptor?.direction ?? '',
  ].join('\u0000');
  /*
   * Paging only earns its space when there is more than one page, and search
   * or sort starts a new result set on the first page.
   */
  const paginated = issues.length > PAGE_SIZE;
  const [pageSize, setPageSize] = useState(PAGE_SIZE);
  const [page, setPage] = useState(() => ({
    offset: issuePageOffset(orderedIds, issueId, pageSize) ?? 0,
    queryKey,
  }));
  const offset = paginated
    ? clampPageOffset(
        page.queryKey === queryKey ? page.offset : 0,
        ordered.length,
        pageSize,
      )
    : 0;
  const pageIssues = paginated
    ? ordered.slice(offset, offset + pageSize)
    : ordered;

  /*
   * A link opens the page that holds its finding. Only a change of the
   * parameter moves the page, so paging and searching are not undone, and an
   * id that search or sort hides leaves the link as it is without expanding
   * anything.
   */
  const appliedIssue = useRef<string | null>(null);
  useEffect(() => {
    if (!issueId) {
      appliedIssue.current = null;
      return;
    }
    if (appliedIssue.current === issueId) {
      return;
    }
    const targetOffset = issuePageOffset(orderedIds, issueId, pageSize);
    if (targetOffset === undefined) {
      return;
    }
    appliedIssue.current = issueId;
    setPage(current =>
      current.queryKey === queryKey && current.offset === targetOffset
        ? current
        : { offset: targetOffset, queryKey },
    );
  }, [issueId, orderedIds, pageSize, queryKey]);

  const toggleIssue = useCallback(
    (id: string) =>
      setParams(
        previous =>
          writeIssueParam(
            previous,
            readIssueParam(previous) === id ? null : id,
          ),
        // Disclosing a row updates the link without adding a history entry.
        { replace: true },
      ),
    [setParams],
  );

  /*
   * Bring a newly opened finding into view, including the one a link opened
   * on a later page. jsdom has no scrollIntoView, hence the guard.
   */
  const scrollToDetail = useCallback((node: HTMLDivElement | null) => {
    if (node && typeof node.scrollIntoView === 'function') {
      node.scrollIntoView({ block: 'nearest' });
    }
  }, []);

  const columns = useMemo<ColumnConfig<MigrationIssue>[]>(
    () => [
      {
        id: 'expand',
        label: '',
        width: 48,
        minWidth: 44,
        header: () => (
          <Column id="expand" width={48} minWidth={44}>
            <VisuallyHidden>Details</VisuallyHidden>
          </Column>
        ),
        cell: issue => {
          const expanded = issueId === issue.id;
          return (
            <Cell>
              <IconAction
                variant="tertiary"
                label={`${expanded ? 'Hide' : 'Show'} details for ${
                  issue.description
                }, ${locationText(issue)}`}
                tooltip={expanded ? 'Hide details' : 'Show details'}
                aria-expanded={expanded}
                aria-controls={expanded ? detailId(issue.id) : undefined}
                icon={
                  expanded ? (
                    <RiArrowDownSLine size={20} />
                  ) : (
                    <RiArrowRightSLine size={20} />
                  )
                }
                onPress={() => toggleIssue(issue.id)}
              />
            </Cell>
          );
        },
      },
      {
        id: 'severity',
        label: 'Severity',
        width: 116,
        minWidth: 112,
        isSortable: true,
        cell: issue => (
          <Cell>
            <SeverityChip severity={issue.severity} />
          </Cell>
        ),
      },
      {
        id: 'location',
        label: 'Location',
        width: '3.5fr',
        minWidth: 220,
        isRowHeader: true,
        cell: issue => (
          <Cell>
            <IssueLocation issue={issue} />
          </Cell>
        ),
      },
      {
        id: 'category',
        label: 'Category',
        width: 128,
        minWidth: 120,
        isSortable: true,
        cell: issue => <Cell>{issue.category}</Cell>,
      },
      {
        id: 'description',
        label: 'Finding',
        width: '2.5fr',
        minWidth: 200,
        isSortable: true,
        cell: issue => (
          <Cell>
            <Text as="span" className={styles.issueDescription}>
              {issue.description}
            </Text>
          </Cell>
        ),
      },
    ],
    [issueId, toggleIssue],
  );

  return (
    <Section
      title={`${issues.length} analysis finding${
        issues.length === 1 ? '' : 's'
      }`}
    >
      <div className={styles.tablePane}>
        <SearchField
          aria-label="Filter"
          placeholder="Filter"
          size="small"
          value={search}
          onChange={setSearch}
          className={styles.search}
        />
        <Table
          {...tableProps}
          data={pageIssues}
          pagination={
            paginated
              ? {
                  type: 'page',
                  pageSize,
                  offset,
                  totalCount: ordered.length,
                  hasNextPage: offset + pageSize < ordered.length,
                  hasPreviousPage: offset > 0,
                  onNextPage: () =>
                    setPage({ offset: offset + pageSize, queryKey }),
                  onPreviousPage: () =>
                    setPage({
                      offset: Math.max(0, offset - pageSize),
                      queryKey,
                    }),
                  onPageSizeChange: size => {
                    setPageSize(size);
                    setPage({ offset: 0, queryKey });
                  },
                }
              : { type: 'none' }
          }
          className={styles.issueTable}
          columnConfig={columns}
          rowConfig={({ item }) => (
            <Fragment key={item.id}>
              <Row id={String(item.id)} columns={columns}>
                {column => column.cell(item)}
              </Row>
              {issueId === item.id && (
                <Row id={`${item.id}-details`}>
                  <Cell colSpan={columns.length} className={styles.detailCell}>
                    <div
                      id={detailId(item.id)}
                      ref={scrollToDetail}
                      className={styles.detailPanel}
                    >
                      <IssueDetailPanel rowData={item} />
                    </div>
                  </Cell>
                </Row>
              )}
            </Fragment>
          )}
          emptyState={
            <Text as="p" color="secondary">
              No records to display
            </Text>
          }
        />
      </div>
    </Section>
  );
}
