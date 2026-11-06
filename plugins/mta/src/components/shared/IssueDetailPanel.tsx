import { Flex, Link, Text } from '@backstage/ui';
import type { MigrationIssue } from '../../types';
import styles from './IssueDetailPanel.module.css';

export function IssueDetailPanel({ rowData }: { rowData: MigrationIssue }) {
  const links =
    rowData.links?.filter(link => /^https?:\/\//i.test(link.url)) ?? [];
  return (
    <Flex direction="column" gap="3">
      {rowData.problem && (
        <div className={styles.section}>
          <Text as="h3" variant="body-medium" weight="bold">
            Rule description
          </Text>
          <Text as="p" color="secondary">
            {rowData.problem}
          </Text>
        </div>
      )}
      {rowData.message && (
        <div className={styles.section}>
          <Text as="h3" variant="body-medium" weight="bold">
            Incident
          </Text>
          <Text as="p" color="secondary">
            {rowData.message}
          </Text>
        </div>
      )}
      {rowData.codeSnip && (
        <pre className={styles.code}>
          <code>{rowData.codeSnip}</code>
        </pre>
      )}
      {rowData.effort !== undefined && (
        <Text as="p" variant="body-small">
          Rule effort: {rowData.effort}
        </Text>
      )}
      {links.length > 0 && (
        <ul className={styles.links}>
          {links.map(link => (
            <li key={link.url}>
              <Link href={link.url} target="_blank" rel="noopener noreferrer">
                {link.title || link.url}
              </Link>
            </li>
          ))}
        </ul>
      )}
      {!rowData.problem &&
        !rowData.message &&
        !rowData.codeSnip &&
        rowData.effort === undefined &&
        links.length === 0 && (
          <Text as="p" color="secondary">
            No additional details were reported by Hub.
          </Text>
        )}
    </Flex>
  );
}
