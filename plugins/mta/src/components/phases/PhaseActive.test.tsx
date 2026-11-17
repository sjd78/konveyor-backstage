import type { ComponentProps } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { configApiRef, type ConfigApi } from '@backstage/core-plugin-api';
import { mockApis, TestApiProvider } from '@backstage/frontend-test-utils';
import { themes, UnifiedThemeProvider } from '@backstage/theme';
import { MemoryRouter } from 'react-router-dom';
import { PhaseActive } from './PhaseActive';
import {
  deploymentAssetsApiRef,
  type DeploymentAssetsApi,
} from '../../api/deploymentAssets';
import {
  ASSET_FIXTURE_GENERATORS,
  renderAssetFixture,
} from '../../../dev/fixtures/deploymentAssets';
import type { MigrationIssue, Persona } from '../../types';

/** The API pair shape `TestApiProvider` takes, for a list built at runtime. */
type ApiPairs = ComponentProps<typeof TestApiProvider>['apis'];

const LIVE_APPLICATION = { id: 1, name: 'Live application' };
const LIVE_APPLICATION_FILES = renderAssetFixture(LIVE_APPLICATION.name, '');

function devSpacesConfig(url: string): ConfigApi {
  return mockApis.config({ data: { mta: { devSpaces: { url } } } });
}

/** A deployment asset host for the findings screen, rendered by the fixture. */
function deploymentAssetsApi(): DeploymentAssetsApi {
  return {
    renderDeploymentAssets: jest.fn().mockResolvedValue({
      generators: ASSET_FIXTURE_GENERATORS,
      assets: LIVE_APPLICATION_FILES,
    }),
    commitDeploymentAssets: jest.fn(),
    getDeliveredAssets: jest.fn(),
  };
}

function renderFindings(
  persona: Persona | 'unknown',
  onRunAnalysis = jest.fn(),
  issues: MigrationIssue[] = [],
  config?: ConfigApi,
  deploymentAssets?: DeploymentAssetsApi,
) {
  const findings = (
    <MemoryRouter>
      <UnifiedThemeProvider theme={themes.light}>
        <PhaseActive
          app={LIVE_APPLICATION}
          issues={issues}
          persona={persona}
          onRunAnalysis={onRunAnalysis}
        />
      </UnifiedThemeProvider>
    </MemoryRouter>
  );
  const apis: unknown[] = [];
  if (config) {
    apis.push([configApiRef, config]);
  }
  if (deploymentAssets) {
    apis.push([deploymentAssetsApiRef, deploymentAssets]);
  }
  render(
    apis.length ? (
      <TestApiProvider apis={apis as unknown as ApiPairs}>
        {findings}
      </TestApiProvider>
    ) : (
      findings
    ),
  );
  return onRunAnalysis;
}

const finding: MigrationIssue = {
  id: 'issue-1',
  appId: '1',
  severity: 'critical',
  category: 'api-change',
  description: 'Legacy API',
  file: 'src/Legacy.java',
  line: 12,
};

describe('live findings actions', () => {
  it('runs the supplied analysis action for architects', () => {
    const onRunAnalysis = renderFindings('architect');
    fireEvent.click(screen.getByRole('button', { name: 'Run analysis' }));
    expect(onRunAnalysis).toHaveBeenCalledTimes(1);
    expect(
      screen.queryByRole('button', {
        name: /remediat|Dev Spaces|deployment|complete/i,
      }),
    ).not.toBeInTheDocument();
  });

  it.each(['unknown', 'developer'] as const)(
    'does not expose analysis actions for %s',
    persona => {
      renderFindings(persona);
      expect(screen.queryByRole('button')).not.toBeInTheDocument();
    },
  );

  it('does not offer a completion action for a successful empty analysis', () => {
    renderFindings('architect');
    expect(screen.getByText('No findings reported')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /complete/i }),
    ).not.toBeInTheDocument();
  });

  it('shows the findings table beside the analysis action', () => {
    renderFindings('architect', jest.fn(), [finding]);
    expect(
      screen.getByRole('heading', {
        name: 'Analysis findings for Live application',
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: '1 analysis finding' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Run analysis' }),
    ).toBeInTheDocument();
    expect(screen.queryByText('No findings reported')).not.toBeInTheDocument();
  });
});

describe('Dev Spaces link', () => {
  it.each(['architect', 'developer'] as const)(
    'opens the configured dashboard for %s in a new tab',
    persona => {
      renderFindings(
        persona,
        jest.fn(),
        [finding],
        devSpacesConfig('https://devspaces.apps.example.test'),
      );
      const link = screen.getByRole('link', { name: 'Open in Dev Spaces' });
      expect(link).toHaveAttribute(
        'href',
        'https://devspaces.apps.example.test/',
      );
      expect(link).toHaveAttribute('target', '_blank');
      expect(link).toHaveAttribute('rel', 'noopener noreferrer');
      expect(link.querySelector('svg')).not.toBeNull();
    },
  );

  it('treats an invalid dashboard URL as not configured', () => {
    renderFindings(
      'architect',
      jest.fn(),
      [finding],
      devSpacesConfig('not a url'),
    );
    expect(
      screen.queryByRole('link', { name: 'Open in Dev Spaces' }),
    ).not.toBeInTheDocument();
  });

  it('renders no link without configuration', () => {
    renderFindings('architect', jest.fn(), [finding]);
    expect(
      screen.queryByRole('link', { name: 'Open in Dev Spaces' }),
    ).not.toBeInTheDocument();
  });
});

describe('deployment assets entry', () => {
  it('offers generation to architects when a host registers the API', () => {
    renderFindings(
      'architect',
      jest.fn(),
      [finding],
      undefined,
      deploymentAssetsApi(),
    );
    const button = screen.getByRole('button', {
      name: 'Generate deployment assets',
    });
    expect(button.querySelector('svg')).toHaveAttribute('aria-hidden');
    expect(
      screen.getByRole('button', { name: 'Run analysis' }),
    ).toBeInTheDocument();
  });

  it('offers no generation without a host implementation', () => {
    renderFindings('architect', jest.fn(), [finding]);
    expect(
      screen.queryByRole('button', { name: 'Generate deployment assets' }),
    ).not.toBeInTheDocument();
  });

  it.each(['developer', 'unknown'] as const)(
    'offers no generation to %s even with a host implementation',
    persona => {
      renderFindings(
        persona,
        jest.fn(),
        [finding],
        undefined,
        deploymentAssetsApi(),
      );
      expect(
        screen.queryByRole('button', { name: 'Generate deployment assets' }),
      ).not.toBeInTheDocument();
    },
  );

  it('opens the deployment asset dialog for the application', async () => {
    const deploymentAssets = deploymentAssetsApi();
    renderFindings(
      'architect',
      jest.fn(),
      [finding],
      undefined,
      deploymentAssets,
    );
    fireEvent.click(
      screen.getByRole('button', { name: 'Generate deployment assets' }),
    );
    expect(
      await screen.findByRole('heading', {
        name: 'Deployment assets for Live application',
      }),
    ).toBeInTheDocument();
    expect(
      await screen.findByRole('heading', {
        name: `Files (${LIVE_APPLICATION_FILES.length})`,
      }),
    ).toBeInTheDocument();
    expect(deploymentAssets.renderDeploymentAssets).toHaveBeenCalledWith(
      expect.objectContaining({
        application: expect.objectContaining({
          id: 1,
          name: 'Live application',
        }),
      }),
    );
  });
});
