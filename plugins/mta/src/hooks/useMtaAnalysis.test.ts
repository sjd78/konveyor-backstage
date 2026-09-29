import { act, renderHook, waitFor } from '@testing-library/react';
import type { MtaApi } from '../api';
import type { KonveyorTask } from '../api/types';
import { useMtaAnalysis } from './useMtaAnalysis';
import { useMtaApi } from './useKonveyorData';

jest.mock('./useKonveyorData', () => ({
  useMtaApi: jest.fn(),
}));

const mockUseMtaApi = useMtaApi as jest.MockedFunction<typeof useMtaApi>;

describe('useMtaAnalysis', () => {
  let mockGetTask: jest.Mock;

  beforeEach(() => {
    jest.useFakeTimers();
    mockGetTask = jest.fn();
    mockUseMtaApi.mockReturnValue({
      getTask: mockGetTask,
    } as unknown as MtaApi);
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  it('returns null task when taskId is undefined', () => {
    const { result } = renderHook(() => useMtaAnalysis(undefined));
    expect(result.current.task).toBeNull();
    expect(result.current.loading).toBe(false);
    expect(mockGetTask).not.toHaveBeenCalled();
  });

  it('polls repeatedly while task is in Running state', async () => {
    const runningTask: KonveyorTask = {
      id: 42,
      addon: 'analyzer',
      state: 'Running',
    };
    const succeededTask: KonveyorTask = {
      id: 42,
      addon: 'analyzer',
      state: 'Succeeded',
    };

    mockGetTask
      .mockResolvedValueOnce(runningTask)
      .mockResolvedValueOnce(succeededTask);

    const { result } = renderHook(() => useMtaAnalysis(42));

    await waitFor(() => {
      expect(result.current.task).toEqual(runningTask);
    });

    expect(mockGetTask).toHaveBeenCalledTimes(1);

    // Fast-forward 3000ms
    act(() => {
      jest.advanceTimersByTime(3000);
    });

    await waitFor(() => {
      expect(result.current.task).toEqual(succeededTask);
    });

    expect(mockGetTask).toHaveBeenCalledTimes(2);

    // Fast-forward another 3000ms - should not poll again because task succeeded
    act(() => {
      jest.advanceTimersByTime(3000);
    });

    expect(mockGetTask).toHaveBeenCalledTimes(2);
  });

  it('cleans up timer on unmount', async () => {
    const runningTask: KonveyorTask = {
      id: 42,
      addon: 'analyzer',
      state: 'Running',
    };
    mockGetTask.mockResolvedValue(runningTask);

    const { unmount } = renderHook(() => useMtaAnalysis(42));

    await waitFor(() => {
      expect(mockGetTask).toHaveBeenCalledTimes(1);
    });

    unmount();

    act(() => {
      jest.advanceTimersByTime(6000);
    });

    expect(mockGetTask).toHaveBeenCalledTimes(1);
  });
});
