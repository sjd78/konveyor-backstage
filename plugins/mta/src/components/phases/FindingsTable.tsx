import { Fragment, useCallback, useMemo, useState } from 'react';
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
import { SeverityChip } from '../shared/SeverityChip';
import { IssueDetailPanel } from '../shared/IssueDetailPanel';
import { IconAction, Section } from '../shared/MtaUi';
import type { IssueSeverity, MigrationIssue } from '../../types';
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
  const [expandedIssueId, setExpandedIssueId] = useState<string | null>(null);
  const toggleIssue = useCallback(
    (issueId: string) =>
      setExpandedIssueId(current => (current === issueId ? null : issueId)),
    [],
  );

  const { tableProps } = useTable({
    mode: 'complete',
    data: issues,
    search,
    onSearchChange: setSearch,
    searchFn: searchIssues,
    sortFn: sortIssues,
    // Paging only earns its space when there is more than one page.
    paginationOptions:
      issues.length > PAGE_SIZE
        ? { type: 'page', pageSize: PAGE_SIZE }
        : { type: 'none' },
  });

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
          const expanded = expandedIssueId === issue.id;
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
    [expandedIssueId, toggleIssue],
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
          className={styles.issueTable}
          columnConfig={columns}
          rowConfig={({ item }) => (
            <Fragment key={item.id}>
              <Row id={String(item.id)} columns={columns}>
                {column => column.cell(item)}
              </Row>
              {expandedIssueId === item.id && (
                <Row id={`${item.id}-details`}>
                  <Cell colSpan={columns.length} className={styles.detailCell}>
                    <div id={detailId(item.id)} className={styles.detailPanel}>
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
