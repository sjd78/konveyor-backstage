import { useImperativeHandle, useRef, type Ref } from 'react';
import { Flex, Radio, RadioGroup, Text } from '@backstage/ui';
import type { DeploymentAssetRepository } from '../../api/deploymentAssets';
import { shortRepoName } from '../../repository';
import styles from './DeploymentAssetDialog.module.css';
import { AccessibleTextField } from './AccessibleTextField';

const URL_ERROR =
  'Enter a Git repository URL, such as https://github.com/acme/deploy-config';

interface AssetRepositorySettingsProps {
  id: string;
  repository: DeploymentAssetRepository;
  sourceRepoUrl: string;
  configRepoUrl: string;
  showUrlError: boolean;
  disabled: boolean;
  urlInputRef: Ref<HTMLInputElement>;
  onRepositoryChange: (repository: DeploymentAssetRepository) => void;
  onConfigRepoUrlChange: (url: string) => void;
  onConfigRepoUrlBlur: () => void;
}

/**
 * Where the new branch goes: the application source repository, or a separate
 * configuration repository the member enters here.
 */
export function AssetRepositorySettings({
  id,
  repository,
  sourceRepoUrl,
  configRepoUrl,
  showUrlError,
  disabled,
  urlInputRef,
  onRepositoryChange,
  onConfigRepoUrlChange,
  onConfigRepoUrlBlur,
}: AssetRepositorySettingsProps) {
  const field = useRef<HTMLDivElement>(null);
  useImperativeHandle(
    urlInputRef,
    () => field.current?.querySelector('input') as HTMLInputElement,
  );
  const sourceName = shortRepoName(sourceRepoUrl);
  return (
    <div className={styles.settings} id={id}>
      <Flex direction="column" gap="3">
        <RadioGroup
          className={styles.radioGroup}
          label="Repository for the new branch"
          value={repository}
          onChange={value =>
            onRepositoryChange(value as DeploymentAssetRepository)
          }
          isDisabled={disabled}
        >
          <Radio className={styles.radio} value="source">
            <span className={styles.radioText}>
              <span className={styles.radioTitle}>
                <Text as="span">Application source repository</Text>
                {sourceName && (
                  <span className={styles.radioCode}>{sourceName}</span>
                )}
              </span>
              <Text as="span" variant="body-small" color="secondary">
                Files are added next to the application code
              </Text>
            </span>
          </Radio>
          <Radio className={styles.radio} value="config">
            <span className={styles.radioText}>
              <Text as="span">Separate configuration repository</Text>
              <Text as="span" variant="body-small" color="secondary">
                For teams that keep deployment configuration apart from
                application code
              </Text>
            </span>
          </Radio>
        </RadioGroup>
        {repository === 'config' && (
          <AccessibleTextField
            className={styles.urlField}
            ref={field}
            label="Configuration repository URL"
            placeholder="https://github.com/acme/deploy-config"
            isRequired
            isDisabled={disabled}
            value={configRepoUrl}
            isInvalid={showUrlError}
            errorText={URL_ERROR}
            helperText="Files are committed to this repository on a new branch"
            onChange={onConfigRepoUrlChange}
            onBlur={onConfigRepoUrlBlur}
          />
        )}
      </Flex>
    </div>
  );
}
