/*
 * Copyright 2026 The Backstage Authors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
import { useState, type ReactNode, type ComponentProps, type Ref } from 'react';
import {
  ButtonIcon,
  Card,
  CardBody,
  CardHeader,
  Flex,
  Text,
  Tooltip,
  TooltipTrigger,
} from '@backstage/ui';
import {
  RiCheckLine,
  RiErrorWarningLine,
  RiInformationLine,
} from '@remixicon/react';
import styles from './mta.module.css';
import emptyIllustration from '../../assets/rh-manage-cloud-services-gray.svg';

/** Shared MTA compositions. BUI owns controls, semantics and interaction states. */
export function Section({
  title,
  description,
  children,
  actions,
}: {
  title?: string;
  description?: ReactNode;
  children: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <Card className={styles.card}>
      {title && (
        <CardHeader>
          <Flex justify="between" align="start" gap="3">
            <div className={styles.sectionHeading}>
              <Text as="h2" variant="body-large" weight="bold">
                {title}
              </Text>
              {description && (
                <Text as="p" color="secondary">
                  {description}
                </Text>
              )}
            </div>
            {actions}
          </Flex>
        </CardHeader>
      )}
      <CardBody>
        <Flex direction="column" gap="4">
          {children}
        </Flex>
      </CardBody>
    </Card>
  );
}

/** Label and value pair used for read-only configuration and metadata. */
export function DetailRow({
  label,
  children,
}: {
  label: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className={styles.detailRow}>
      <div className={styles.detailLabel}>
        {typeof label === 'string' ? (
          <Text as="span" color="secondary">
            {label}
          </Text>
        ) : (
          label
        )}
      </div>
      <div className={styles.detailValue}>{children}</div>
    </div>
  );
}

export function DetailList({ children }: { children: ReactNode }) {
  return <div className={styles.detailList}>{children}</div>;
}

export type StatusTone =
  | 'neutral'
  | 'info'
  | 'success'
  | 'warning'
  | 'warning-emphasis'
  | 'danger';

const TONE_ICON = {
  success: RiCheckLine,
  warning: RiErrorWarningLine,
  'warning-emphasis': RiErrorWarningLine,
  danger: RiErrorWarningLine,
  info: RiInformationLine,
  neutral: RiInformationLine,
} as const;

const TONE_CLASS = {
  neutral: styles.toneNeutral,
  info: styles.toneInfo,
  success: styles.toneSuccess,
  warning: styles.toneWarning,
  'warning-emphasis': styles.toneWarningEmphasis,
  danger: styles.toneDanger,
} as const;

/**
 * Static status label. It reads as text, not as a control: the markup has no
 * role and no Tab stop, so keyboard focus never lands on a status value. The
 * `.tag` class reproduces the metrics of the BUI Tag it replaced.
 */
export function StatusTag({
  children,
  tone = 'neutral',
  withIcon = false,
}: {
  children: string;
  tone?: StatusTone;
  withIcon?: boolean;
}) {
  const Icon = TONE_ICON[tone];
  return (
    <span className={[styles.tag, TONE_CLASS[tone]].join(' ')}>
      {withIcon && <Icon size={16} aria-hidden />}
      {children}
    </span>
  );
}

export function EmptyState({
  title,
  description,
  action,
  compact = false,
  headingLevel = 2,
  headingVariant = 'title-small',
}: {
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  compact?: boolean;
  headingLevel?: 2 | 3;
  /** Card-embedded states can drop one type step to stay below the card title. */
  headingVariant?: 'title-small' | 'title-x-small';
}) {
  const Heading = headingLevel === 3 ? 'h3' : 'h2';
  const content = (
    <>
      <img
        src={emptyIllustration}
        alt=""
        className={compact ? styles.compactImage : styles.emptyImage}
      />
      <Flex direction="column" gap="3" className={styles.emptyText}>
        <Text as={Heading} variant={headingVariant}>
          {title}
        </Text>
        {description && (
          <Text as="p" color="secondary">
            {description}
          </Text>
        )}
        {action && <div>{action}</div>}
      </Flex>
    </>
  );
  if (compact) {
    return <div className={styles.emptyCompact}>{content}</div>;
  }
  /*
   * The frame is the query container: the state splits into two columns only
   * when the tab itself is wide enough, not when the viewport is. RHDH hosts
   * the tab in a card beside the right rail at desktop widths.
   */
  return (
    <div className={styles.emptyFrame}>
      <div className={styles.empty}>{content}</div>
    </div>
  );
}

export function TaskProgress({ label }: { label: string }) {
  return (
    <div
      className={styles.taskProgress}
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <Text as="p">{label}</Text>
      <div className={styles.progress} aria-hidden>
        <div className={styles.progressIndicator} />
      </div>
    </div>
  );
}

export function IconAction({
  label,
  tooltip,
  buttonRef,
  ...props
}: Omit<ComponentProps<typeof ButtonIcon>, 'aria-label' | 'ref'> & {
  label: string;
  /** Short visible label; defaults to the accessible name. */
  tooltip?: string;
  buttonRef?: Ref<HTMLButtonElement>;
}) {
  const [open, setOpen] = useState(false);
  return (
    <TooltipTrigger isOpen={open} onOpenChange={setOpen}>
      <ButtonIcon
        {...props}
        ref={buttonRef}
        aria-label={label}
        onHoverStart={event => {
          setOpen(true);
          props.onHoverStart?.(event);
        }}
        onHoverEnd={event => {
          setOpen(false);
          props.onHoverEnd?.(event);
        }}
        onFocus={event => {
          setOpen(true);
          props.onFocus?.(event);
        }}
        onBlur={event => {
          setOpen(false);
          props.onBlur?.(event);
        }}
      />
      <Tooltip>{tooltip ?? label}</Tooltip>
    </TooltipTrigger>
  );
}
