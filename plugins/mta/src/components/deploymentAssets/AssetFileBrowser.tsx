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
import {
  Fragment,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type RefObject,
} from 'react';
import {
  Button,
  ButtonIcon,
  Text,
  Tooltip,
  TooltipTrigger,
} from '@backstage/ui';
import {
  RiArrowDownSLine,
  RiArrowRightSLine,
  RiCheckLine,
  RiClipboardLine,
  RiFileTextLine,
} from '@remixicon/react';
import type { AssetGenerator, RenderedAsset } from '../../api/deploymentAssets';
import { groupAssets } from './assetGroups';
import styles from './AssetFileBrowser.module.css';

function splitPath(path: string): { name: string; dir: string } {
  const index = path.lastIndexOf('/');
  return index < 0
    ? { name: path, dir: '/' }
    : { name: path.slice(index + 1), dir: path.slice(0, index + 1) };
}

/**
 * Measures whether the given elements are clipped and controls the tooltip
 * that discloses them. Both spans of a file row decide: the directory can clip
 * while the short file name still fits.
 */
function useClippedTooltip(
  primary: RefObject<HTMLElement | null>,
  secondary?: RefObject<HTMLElement | null>,
) {
  const [clipped, setClipped] = useState(false);
  const [open, setOpen] = useState(false);
  const measure = useCallback(() => {
    const next = [primary.current, secondary?.current].some(
      element => element && element.scrollWidth > element.clientWidth,
    );
    setClipped(next);
    return next;
  }, [primary, secondary]);
  useEffect(() => {
    measure();
    const targets = [primary.current, secondary?.current].filter(
      (element): element is HTMLElement => Boolean(element),
    );
    if (!targets.length) return undefined;
    // Some embedded browsers do not offer these; the name still renders, only
    // the disclosure stays closed.
    const observer =
      typeof ResizeObserver === 'undefined'
        ? undefined
        : new ResizeObserver(measure);
    targets.forEach(element => observer?.observe(element));
    // A late font load can clip the directory after mount.
    document.fonts?.addEventListener('loadingdone', measure);
    return () => {
      observer?.disconnect();
      document.fonts?.removeEventListener('loadingdone', measure);
    };
  }, [measure, primary, secondary]);
  // Focus can scroll the row into view and a tooltip closes when the page
  // scrolls. Measure again, then wait for that scroll to land.
  const frame = useRef(0);
  const hide = () => {
    cancelAnimationFrame(frame.current);
    setOpen(false);
  };
  const show = () => {
    if (!measure()) {
      // Nothing is clipped, so there is no full value to disclose.
      hide();
      return;
    }
    cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(() => {
      frame.current = requestAnimationFrame(() => setOpen(true));
    });
  };
  useEffect(() => () => cancelAnimationFrame(frame.current), []);
  return { clipped, open, setOpen, show, hide };
}

/** Copies one rendered file and reports the result without shifting the layout. */
function CopyFileButton({ path, content }: { path: string; content: string }) {
  const [result, setResult] = useState<'idle' | 'copied' | 'failed'>('idle');
  const label = 'Copy file contents';
  useEffect(() => setResult('idle'), [path]);
  let status = '';
  if (result === 'copied') status = 'File contents copied to clipboard';
  else if (result === 'failed') status = 'Could not copy file contents';
  return (
    <>
      <TooltipTrigger>
        <ButtonIcon
          className={styles.copy}
          variant="secondary"
          aria-label={label}
          icon={
            result === 'copied' ? (
              <RiCheckLine aria-hidden />
            ) : (
              <RiClipboardLine aria-hidden />
            )
          }
          onPress={async () => {
            try {
              await navigator.clipboard.writeText(content);
              setResult('copied');
            } catch {
              setResult('failed');
            }
          }}
        />
        <Tooltip>
          {result === 'failed'
            ? 'Copy failed. Select the file contents and copy them manually.'
            : label}
        </Tooltip>
      </TooltipTrigger>
      <span className={styles.srOnly} role="status">
        {status}
      </span>
    </>
  );
}

/** The rendered path, with the full value in a tooltip only when it is clipped. */
function TruncatedPath({ path }: { path: string }) {
  const labelRef = useRef<HTMLSpanElement>(null);
  const { clipped, open, setOpen, show, hide } = useClippedTooltip(labelRef);
  return (
    <TooltipTrigger isOpen={clipped && open} onOpenChange={setOpen}>
      <span
        ref={labelRef}
        className={styles.path}
        onMouseEnter={show}
        onMouseLeave={hide}
      >
        {path}
      </span>
      <Tooltip>{path}</Tooltip>
    </TooltipTrigger>
  );
}

/** A file row whose tooltip opens when its name or its directory is clipped. */
function AssetFileRow({
  asset,
  selected,
  register,
  onKeyDown,
  onSelect,
}: {
  asset: RenderedAsset;
  selected: boolean;
  register: (element: HTMLButtonElement | null) => void;
  onKeyDown: (event: KeyboardEvent<HTMLButtonElement>) => void;
  onSelect: () => void;
}) {
  const { name, dir } = splitPath(asset.path);
  const nameRef = useRef<HTMLSpanElement>(null);
  const dirRef = useRef<HTMLSpanElement>(null);
  const { clipped, open, setOpen, show, hide } = useClippedTooltip(
    nameRef,
    dirRef,
  );
  return (
    <TooltipTrigger isOpen={clipped && open} onOpenChange={setOpen}>
      <Button
        ref={register}
        variant="tertiary"
        className={styles.file}
        aria-label={asset.path}
        aria-current={selected ? 'true' : undefined}
        iconStart={<RiFileTextLine aria-hidden />}
        onKeyDown={onKeyDown}
        onHoverStart={show}
        onHoverEnd={hide}
        onFocus={show}
        onBlur={hide}
        onPress={onSelect}
      >
        <span className={styles.fileText}>
          <span ref={nameRef} className={styles.fileName}>
            {name}
          </span>
          <span ref={dirRef} className={styles.fileDir}>
            {dir}
          </span>
        </span>
      </Button>
      <Tooltip>{asset.path}</Tooltip>
    </TooltipTrigger>
  );
}

interface AssetFileBrowserProps {
  generators: AssetGenerator[];
  assets: RenderedAsset[];
  selectedPath: string;
  onSelect: (path: string) => void;
  autoFocus?: boolean;
}

export function AssetFileBrowser({
  generators,
  assets,
  selectedPath,
  onSelect,
  autoFocus,
}: AssetFileBrowserProps) {
  const refs = useRef(new Map<string, HTMLButtonElement>());
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(new Set());
  // Ties each group toggle to its list on a page that renders more than one
  // browser, such as the state gallery.
  const idPrefix = useId();

  // Group in generator order so the list reads the same way the Hub reports it.
  const groups = useMemo(
    () => groupAssets(generators, assets),
    [generators, assets],
  );
  // Arrow keys move through the files a person can see, skipping collapsed groups.
  const visiblePaths = useMemo(
    () =>
      groups
        .filter(group => !collapsed.has(group.generator.id))
        .flatMap(group => group.assets.map(asset => asset.path)),
    [groups, collapsed],
  );

  const selected =
    assets.find(asset => asset.path === selectedPath) ?? assets[0];
  const provenance = generators.find(
    generator => generator.id === selected?.generatorId,
  );

  // Move focus to the first file once, when the files first appear.
  const didFocus = useRef(false);
  useEffect(() => {
    if (autoFocus && selected && !didFocus.current) {
      const element = refs.current.get(selected.path);
      // Keep the focused file fully visible when the tree only fits one row,
      // such as the stacked mobile layout.
      element?.focus({ preventScroll: true });
      element?.scrollIntoView?.({ block: 'nearest' });
      didFocus.current = true;
    }
  }, [autoFocus, selected]);

  if (!selected) return null;

  const handleKeys = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
    if (!visiblePaths.length) return;
    event.preventDefault();
    // Follow the focused row, not the selected one: Tab can move focus away
    // from the selection, and the next arrow key must start where focus is.
    const focusedPath = Array.from(refs.current.entries()).find(
      ([, button]) => button === event.currentTarget,
    )?.[0];
    const current = focusedPath ? visiblePaths.indexOf(focusedPath) : -1;
    let index: number;
    if (event.key === 'Home') index = 0;
    else if (event.key === 'End') index = visiblePaths.length - 1;
    else if (current < 0) index = 0;
    else
      index = Math.min(
        Math.max(current + (event.key === 'ArrowDown' ? 1 : -1), 0),
        visiblePaths.length - 1,
      );
    const next = visiblePaths[index];
    if (next) {
      onSelect(next);
      refs.current.get(next)?.focus();
    }
  };

  const provenanceLine = provenance?.description
    ? `${provenance.name} generator: ${provenance.description}`
    : `${provenance?.name ?? 'Unknown'} generator · ${
        selected.content.split('\n').length
      } lines`;

  return (
    <div className={styles.browser}>
      <nav className={styles.tree} aria-label="Generated files">
        <div className={styles.treeHeader}>
          <Text as="h3" variant="body-medium" weight="bold">
            Files ({assets.length})
          </Text>
        </div>
        <ul className={styles.groups}>
          {groups.map(({ generator, assets: files }) => {
            const expanded = !collapsed.has(generator.id);
            const groupId = `${idPrefix}asset-group-${generator.id}`;
            const toggle = () =>
              setCollapsed(previous => {
                const next = new Set(previous);
                if (next.has(generator.id)) next.delete(generator.id);
                else next.add(generator.id);
                return next;
              });
            const header = (
              <Button
                variant="tertiary"
                className={styles.group}
                aria-expanded={expanded}
                aria-controls={expanded ? groupId : undefined}
                iconStart={
                  expanded ? (
                    <RiArrowDownSLine aria-hidden />
                  ) : (
                    <RiArrowRightSLine aria-hidden />
                  )
                }
                onPress={toggle}
              >
                <span className={styles.groupName}>{generator.name}</span>
                <Text
                  as="span"
                  variant="body-small"
                  color="secondary"
                  className={styles.groupCount}
                >
                  {files.length}
                </Text>
              </Button>
            );
            return (
              <li key={generator.id}>
                {generator.description ? (
                  <TooltipTrigger>
                    {header}
                    <Tooltip>{generator.description}</Tooltip>
                  </TooltipTrigger>
                ) : (
                  header
                )}
                {expanded && (
                  <ul className={styles.files} id={groupId}>
                    {files.map(asset => (
                      <li key={asset.path}>
                        <AssetFileRow
                          asset={asset}
                          selected={asset.path === selected.path}
                          register={element => {
                            if (element) refs.current.set(asset.path, element);
                            else refs.current.delete(asset.path);
                          }}
                          onKeyDown={handleKeys}
                          onSelect={() => onSelect(asset.path)}
                        />
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      </nav>

      <section
        className={styles.viewer}
        aria-label={`Contents of ${selected.path}`}
      >
        <div className={styles.viewerHeader}>
          <div className={styles.viewerTitle}>
            <h3 className={styles.pathHeading}>
              <TruncatedPath path={selected.path} />
            </h3>
            <Text
              as="p"
              variant="body-small"
              color="secondary"
              className={styles.provenance}
            >
              {provenanceLine}
            </Text>
          </div>
          <CopyFileButton path={selected.path} content={selected.content} />
        </div>
        <pre
          className={styles.code}
          role="region"
          aria-label={`Source of ${selected.path}`}
        >
          <code>
            {selected.content.split('\n').map((line, index) => (
              <Fragment key={index}>
                <span className={styles.lineNumber} aria-hidden="true">
                  {index + 1}
                </span>
                {line}
                {'\n'}
              </Fragment>
            ))}
          </code>
        </pre>
      </section>
    </div>
  );
}
