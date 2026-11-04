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
import { useCallback, useEffect, useRef, useState } from 'react';
import { useApi } from '@backstage/core-plugin-api';
import {
  Alert,
  Button,
  ButtonLink,
  Dialog,
  DialogBody,
  DialogFooter,
  DialogHeader,
  Flex,
  Skeleton,
  Text,
  VisuallyHidden,
} from '@backstage/ui';
import {
  RiCheckboxCircleLine,
  RiCheckLine,
  RiClipboardLine,
  RiDownloadLine,
  RiExternalLinkLine,
} from '@remixicon/react';
import {
  ASSET_BRANCH_NAME,
  deploymentAssetsApiRef,
  type AssetCommitResult,
  type AssetRenderResult,
  type DeploymentAssetApplication,
  type DeploymentAssetRepository,
} from '../../api/deploymentAssets';
import {
  isValidRepoUrl,
  parseRepositoryUrl,
  safeWebHref,
  shortRepoName,
} from '../../repository';
import { EmptyState, TaskProgress } from '../shared/MtaUi';
import { AssetFileBrowser } from './AssetFileBrowser';
import { AssetRepositorySettings } from './AssetRepositorySettings';
import { createZipArchive } from './createZipArchive';
import styles from './DeploymentAssetDialog.module.css';

type RenderState =
  | { status: 'loading' }
  | { status: 'failed'; message: string }
  | { status: 'ready'; result: AssetRenderResult };

type DeliveryState =
  | { status: 'idle' }
  | { status: 'committing' }
  | { status: 'failed'; message: string }
  | { status: 'committed'; result: AssetCommitResult }
  | { status: 'downloaded' };

const SETTINGS_ID = 'asset-repository-settings';

// The dialog stays clear of the global header and never exceeds the viewport.
const WORKSPACE_HEIGHT = 'clamp(22rem, calc(100dvh - 12rem), 52rem)';
const WORKSPACE_MAX_HEIGHT = 'calc(100dvh - 12rem)';

interface DeploymentAssetDialogProps {
  open: boolean;
  onClose: () => void;
  /** The Hub application the rendered files belong to. */
  application: DeploymentAssetApplication;
}

function isAbortError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    (error as { name?: string }).name === 'AbortError'
  );
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** Hands the archive to the browser without navigating away from the dialog. */
function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  // Revoking in the same task can cancel the download in some browsers.
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

/** Copies the destination URL for a host that returns no branch link. */
function CopyUrlButton({ text }: { text: string }) {
  const [result, setResult] = useState<'idle' | 'copied' | 'failed'>('idle');
  return (
    <Flex direction="column" align="start" gap="2">
      <Button
        variant="secondary"
        iconStart={
          result === 'copied' ? (
            <RiCheckLine aria-hidden />
          ) : (
            <RiClipboardLine aria-hidden />
          )
        }
        onPress={async () => {
          try {
            await navigator.clipboard.writeText(text);
            setResult('copied');
          } catch {
            setResult('failed');
          }
        }}
      >
        {result === 'copied' ? 'Copied' : 'Copy URL'}
      </Button>
      {result !== 'idle' && (
        <Text as="span" variant="body-small" role="status">
          {result === 'copied'
            ? 'Copied to clipboard'
            : 'Could not copy the URL. Select it and copy it manually.'}
        </Text>
      )}
    </Flex>
  );
}

/**
 * Workspace for the deployment assets the Hub renders for one application:
 * browse and preview the files, download them as an archive, or commit them to
 * a new branch of the application source repository or a configuration
 * repository.
 */
export function DeploymentAssetDialog({
  open,
  onClose,
  application,
}: DeploymentAssetDialogProps) {
  const api = useApi(deploymentAssetsApiRef);
  const [render, setRender] = useState<RenderState>({ status: 'loading' });
  const [delivery, setDelivery] = useState<DeliveryState>({ status: 'idle' });
  const [selectedPath, setSelectedPath] = useState('');
  const [repository, setRepository] =
    useState<DeploymentAssetRepository>('source');
  const [configRepoUrl, setConfigRepoUrl] = useState('');
  const [urlTouched, setUrlTouched] = useState(false);
  const [editing, setEditing] = useState(false);
  const [archiveError, setArchiveError] = useState<string>();
  const urlInputRef = useRef<HTMLInputElement>(null);
  const editorRef = useRef<HTMLDivElement>(null);
  // Set when Change opens the editor, so focus lands on the selected repository
  // once it expands.
  const focusEditorOnOpen = useRef(false);
  const abortRef = useRef<AbortController | null>(null);
  // The footer action that replaces the one the member pressed, so focus lands
  // on the next step instead of the document body.
  const footerActionRef = useRef<HTMLButtonElement>(null);
  const browserRef = useRef<HTMLDivElement>(null);

  const startRender = useCallback(() => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setRender({ status: 'loading' });
    setDelivery({ status: 'idle' });
    setArchiveError(undefined);
    api
      .renderDeploymentAssets({ application, signal: controller.signal })
      .then(result => {
        setSelectedPath(result.assets[0]?.path ?? '');
        setRender({ status: 'ready', result });
      })
      .catch(error => {
        if (isAbortError(error)) return;
        setRender({ status: 'failed', message: messageOf(error) });
      });
  }, [api, application]);

  // Each open starts a fresh render and resets the destination form.
  useEffect(() => {
    if (!open) return undefined;
    setRepository('source');
    setConfigRepoUrl('');
    setUrlTouched(false);
    setEditing(false);
    startRender();
    return () => abortRef.current?.abort();
    // Only re-run when the dialog opens; a new application reopens the dialog.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!editing || !focusEditorOnOpen.current) return;
    focusEditorOnOpen.current = false;
    editorRef.current
      ?.querySelector<HTMLInputElement>('input[type="radio"]:checked')
      ?.focus();
  }, [editing]);

  const committing = delivery.status === 'committing';
  const sourceRepoUrl = application.repository?.url ?? '';
  const urlInvalid = repository === 'config' && !isValidRepoUrl(configRepoUrl);
  const targetRepoUrl =
    repository === 'config' ? configRepoUrl.trim() : sourceRepoUrl;
  const repoLabel = urlInvalid
    ? 'a separate configuration repository'
    : shortRepoName(targetRepoUrl);

  const handleClose = () => {
    if (committing) return;
    onClose();
  };

  const handleCommit = () => {
    if (urlInvalid) {
      setEditing(true);
      setUrlTouched(true);
      window.setTimeout(() => urlInputRef.current?.focus());
      return;
    }
    const controller = new AbortController();
    abortRef.current = controller;
    setDelivery({ status: 'committing' });
    api
      .commitDeploymentAssets({
        application,
        repository,
        repositoryUrl: targetRepoUrl,
        signal: controller.signal,
      })
      .then(result => {
        setDelivery({ status: 'committed', result });
      })
      .catch(error => {
        if (isAbortError(error)) return;
        setDelivery({ status: 'failed', message: messageOf(error) });
      });
  };

  const handleDownload = () => {
    if (render.status !== 'ready') return;
    const folder = `${application.name}-deployment-assets`;
    setArchiveError(undefined);
    try {
      const archive = createZipArchive(
        render.result.assets.map(asset => ({
          path: `${folder}/${asset.path}`,
          content: asset.content,
        })),
      );
      downloadBlob(archive, `${folder}.zip`);
    } catch (error) {
      setArchiveError(
        error instanceof Error
          ? error.message
          : 'The archive could not be created.',
      );
      return;
    }
    setDelivery({ status: 'downloaded' });
  };

  const assets = render.status === 'ready' ? render.result.assets : [];
  const delivered =
    delivery.status === 'committed' || delivery.status === 'downloaded';
  // A commit result is not trusted input: only an http(s) branch or repository
  // URL becomes a link.
  const deliveredHref =
    delivery.status === 'committed'
      ? safeWebHref(delivery.result.branchUrl) ??
        safeWebHref(parseRepositoryUrl(delivery.result.repositoryUrl).webUrl)
      : undefined;
  const showPreview =
    render.status === 'ready' && assets.length > 0 && !delivered;
  const workspace = render.status === 'loading' || showPreview;

  // Move focus to the footer action that replaced the one the member pressed.
  useEffect(() => {
    if (
      render.status === 'failed' ||
      delivered ||
      (render.status === 'ready' && !assets.length)
    ) {
      footerActionRef.current?.focus();
    }
  }, [render.status, delivered, assets.length]);

  // Focus the first file as soon as the files replace the loading state. The
  // dialog owns this instead of relying on DOM autofocus, which the lint rules
  // reject. `aria-current` marks the row the browser selected.
  useEffect(() => {
    if (!showPreview) return;
    const selected = browserRef.current?.querySelector<HTMLButtonElement>(
      '[aria-current="true"]',
    );
    selected?.focus({ preventScroll: true });
    selected?.scrollIntoView?.({ block: 'nearest' });
  }, [showPreview]);

  return (
    <Dialog
      isOpen={open}
      onOpenChange={next => {
        if (!next) handleClose();
      }}
      isDismissable={!committing}
      isKeyboardDismissDisabled={committing}
      // A percentage keeps the dialog inside its overlay. In the app the
      // overlay covers the viewport, so this is the same width as 100vw.
      width="min(76rem, calc(100% - 1.5rem))"
      height={workspace ? WORKSPACE_HEIGHT : undefined}
      style={{ maxHeight: workspace ? WORKSPACE_MAX_HEIGHT : undefined }}
      className={styles.dialog}
    >
      <DialogHeader>
        <Text as="span" variant="title-x-small">
          Deployment assets for {application.name}
        </Text>
      </DialogHeader>
      <DialogBody
        className={[
          workspace ? styles.previewBody : styles.dialogBody,
          editing && showPreview ? styles.bodyEditing : '',
        ]
          .filter(Boolean)
          .join(' ')}
        aria-busy={render.status === 'loading'}
      >
        {render.status === 'loading' && (
          <div className={styles.loading}>
            <TaskProgress label="Preparing files." />
            <div className={styles.skeleton} aria-hidden="true">
              <div className={styles.skeletonTree}>
                <Flex direction="column" gap="2">
                  {[72, 88, 64, 80, 58, 84, 68, 62].map((width, index) => (
                    <Skeleton key={index} height={20} width={`${width}%`} />
                  ))}
                </Flex>
              </div>
              <div className={styles.skeletonViewer}>
                <Skeleton height={16} width="42%" />
                <Skeleton height={12} width="28%" />
                <Flex direction="column" gap="2">
                  {[84, 66, 76, 48, 90, 70, 58, 78, 52, 68].map(
                    (width, index) => (
                      <Skeleton key={index} height={14} width={`${width}%`} />
                    ),
                  )}
                </Flex>
              </div>
            </div>
          </div>
        )}

        {render.status === 'failed' && (
          <Alert
            status="danger"
            title="Could not prepare deployment assets"
            description={`${render.message} Your selections are kept when you retry.`}
          />
        )}

        {render.status === 'ready' && !assets.length && (
          <EmptyState
            compact
            headingLevel={3}
            headingVariant="title-x-small"
            title="No deployment assets for this application"
            description={`The selected target has no generators that apply to ${application.name}. Ask your migration architect to add generators to the target in MTA.`}
          />
        )}

        {showPreview && render.status === 'ready' && (
          <div ref={browserRef} className={styles.preview}>
            <VisuallyHidden>
              <span role="status">{`${assets.length} deployment assets ready`}</span>
            </VisuallyHidden>
            <AssetFileBrowser
              generators={render.result.generators}
              assets={assets}
              selectedPath={selectedPath}
              onSelect={setSelectedPath}
            />
          </div>
        )}

        {delivery.status === 'committed' && (
          <div className={styles.result} role="status">
            <RiCheckboxCircleLine
              size={48}
              className={styles.resultIcon}
              aria-hidden
            />
            <Text as="h3" variant="title-x-small">
              {assets.length} files committed
            </Text>
            <Flex direction="column" gap="1" className={styles.resultText}>
              <Text as="p" color="secondary">
                New branch{' '}
                <code className={styles.codeChip}>
                  {delivery.result.branch}
                </code>{' '}
                in{' '}
                <code className={styles.codeChip}>
                  {shortRepoName(delivery.result.repositoryUrl)}
                </code>
              </Text>
              <Text as="p" color="secondary">
                The default branch is not changed. Open a pull request in your
                Git provider to merge it.
              </Text>
            </Flex>
            {deliveredHref ? (
              <ButtonLink
                variant="secondary"
                href={deliveredHref}
                target="_blank"
                rel="noopener noreferrer"
                iconStart={<RiExternalLinkLine aria-hidden />}
              >
                {delivery.result.branchUrl ? 'Open branch' : 'Open repository'}
              </ButtonLink>
            ) : (
              <Flex direction="column" gap="2" align="start">
                <Text
                  as="span"
                  variant="body-small"
                  className={styles.codeChip}
                >
                  {delivery.result.repositoryUrl}
                </Text>
                <CopyUrlButton text={delivery.result.repositoryUrl} />
              </Flex>
            )}
          </div>
        )}

        {delivery.status === 'downloaded' && (
          <div className={styles.result} role="status">
            <RiCheckboxCircleLine
              size={48}
              className={styles.resultIcon}
              aria-hidden
            />
            <Text as="h3" variant="title-x-small">
              Archive downloaded
            </Text>
            <Flex direction="column" gap="1" className={styles.resultText}>
              <Text as="p" color="secondary">
                {assets.length} files in{' '}
                <code className={styles.codeChip}>
                  {application.name}-deployment-assets.zip
                </code>
              </Text>
              <Text as="p" color="secondary">
                Add them to the repository your team deploys from.
              </Text>
            </Flex>
          </div>
        )}
      </DialogBody>

      {render.status === 'loading' && (
        <DialogFooter>
          <Button variant="tertiary" onPress={handleClose}>
            Cancel
          </Button>
        </DialogFooter>
      )}

      {render.status === 'failed' && (
        <DialogFooter>
          <Button variant="tertiary" onPress={handleClose}>
            Cancel
          </Button>
          <Button ref={footerActionRef} variant="primary" onPress={startRender}>
            Retry
          </Button>
        </DialogFooter>
      )}

      {((render.status === 'ready' && !assets.length) || delivered) && (
        <DialogFooter>
          <Button
            ref={footerActionRef}
            variant="secondary"
            onPress={handleClose}
          >
            {delivered ? 'Done' : 'Close'}
          </Button>
        </DialogFooter>
      )}

      {showPreview && (
        <div
          className={[styles.footer, editing ? styles.footerEditing : '']
            .filter(Boolean)
            .join(' ')}
        >
          {delivery.status === 'failed' && (
            <Alert
              status="danger"
              title="Could not commit files"
              description={`${delivery.message} Your choices are kept.`}
            />
          )}
          {archiveError && (
            <Alert
              status="danger"
              title="Could not create the archive"
              description={archiveError}
            />
          )}
          {editing && (
            <div ref={editorRef}>
              <AssetRepositorySettings
                id={SETTINGS_ID}
                repository={repository}
                sourceRepoUrl={sourceRepoUrl}
                configRepoUrl={configRepoUrl}
                showUrlError={urlTouched && urlInvalid}
                disabled={committing}
                urlInputRef={urlInputRef}
                onRepositoryChange={next => {
                  setRepository(next);
                  setUrlTouched(false);
                  if (next === 'config' && !configRepoUrl)
                    window.setTimeout(() => urlInputRef.current?.focus());
                }}
                onConfigRepoUrlChange={setConfigRepoUrl}
                onConfigRepoUrlBlur={() => {
                  if (configRepoUrl) setUrlTouched(true);
                }}
              />
            </div>
          )}
          <div className={styles.footerRow}>
            <div className={styles.destination}>
              <Text as="p" variant="body-medium" color="secondary">
                New branch{' '}
                <code className={styles.codeChip}>{ASSET_BRANCH_NAME}</code> in{' '}
                {urlInvalid ? (
                  'a separate configuration repository'
                ) : (
                  <code className={styles.codeChip}>{repoLabel}</code>
                )}
              </Text>
              <Button
                size="small"
                variant="tertiary"
                aria-expanded={editing}
                aria-controls={editing ? SETTINGS_ID : undefined}
                isDisabled={committing}
                onPress={() => {
                  focusEditorOnOpen.current = !editing;
                  setEditing(!editing);
                }}
              >
                {editing ? 'Done' : 'Change'}
              </Button>
            </div>
            <div className={styles.actions}>
              <Button
                variant="tertiary"
                onPress={handleClose}
                isDisabled={committing}
              >
                Cancel
              </Button>
              <Button
                className={styles.download}
                variant="secondary"
                iconStart={<RiDownloadLine aria-hidden />}
                onPress={handleDownload}
                isDisabled={committing}
              >
                Download ZIP
              </Button>
              <Button
                className={styles.commit}
                variant="primary"
                onPress={handleCommit}
                isDisabled={committing}
                isPending={committing}
              >
                Commit files
              </Button>
            </div>
          </div>
        </div>
      )}
    </Dialog>
  );
}
