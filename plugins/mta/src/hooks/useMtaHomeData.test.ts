import { renderHook, waitFor } from '@testing-library/react';
import { useMtaHomeData } from './useMtaHomeData';
import { usePersonaRole } from './usePersonaRole';
import { useKonveyorApplications } from './useKonveyorData';
import { identityApiRef, useApi } from '@backstage/core-plugin-api';
import { catalogApiRef } from '@backstage/plugin-catalog-react';

jest.mock('./usePersonaRole');
jest.mock('./useKonveyorData');
jest.mock('@backstage/core-plugin-api', () => ({
  ...jest.requireActual('@backstage/core-plugin-api'),
  useApi: jest.fn(),
}));

const mockUsePersonaRole = usePersonaRole as jest.MockedFunction<
  typeof usePersonaRole
>;
const mockUseKonveyorApplications = useKonveyorApplications as jest.MockedFunction<
  typeof useKonveyorApplications
>;
const mockUseApi = useApi as jest.MockedFunction<typeof useApi>;

describe('useMtaHomeData', () => {
  let mockGetEntities: jest.Mock;
  let mockGetBackstageIdentity: jest.Mock;
  let mockCatalogApi: { getEntities: jest.Mock };
  let mockIdentityApi: { getBackstageIdentity: jest.Mock };

  beforeEach(() => {
    mockGetEntities = jest.fn();
    mockGetBackstageIdentity = jest.fn().mockResolvedValue({
      userEntityRef: 'user:default/dev-chen',
    });
    mockCatalogApi = { getEntities: mockGetEntities };
    mockIdentityApi = { getBackstageIdentity: mockGetBackstageIdentity };

    mockUsePersonaRole.mockReturnValue({
      role: 'architect',
      loading: false,
    });

    mockUseKonveyorApplications.mockReturnValue({
      applications: [
        {
          id: 1,
          name: 'inventory-service',
          tags: [{ id: 10, name: 'Java' }],
          tasks: [101],
        },
      ],
      loading: false,
      error: null,
      refetch: jest.fn(),
    });

    mockUseApi.mockImplementation(ref => {
      if (ref === catalogApiRef) {
        return mockCatalogApi;
      }
      if (ref === identityApiRef) {
        return mockIdentityApi;
      }
      return {};
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('correlates catalog entities with Konveyor applications', async () => {
    mockGetEntities.mockResolvedValueOnce({
      items: [
        {
          metadata: {
            name: 'inventory-service',
            title: 'Inventory Service',
            namespace: 'default',
            annotations: {
              'konveyor.io/application-id': '1',
              'mta.konveyor.io/issues-count': '42',
              'mta.konveyor.io/critical-issues': '8',
            },
          },
        },
      ],
    });

    const { result } = renderHook(() => useMtaHomeData());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.apps).toHaveLength(1);
    expect(result.current.apps[0]).toEqual({
      name: 'inventory-service',
      title: 'Inventory Service',
      namespace: 'default',
      status: 'Active',
      issuesCount: 42,
      criticalIssues: 8,
    });
  });

  it('handles empty entities response', async () => {
    mockGetEntities.mockResolvedValueOnce({ items: [] });

    const { result } = renderHook(() => useMtaHomeData());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.apps).toEqual([]);
    expect(result.current.error).toBe(false);
  });
});
