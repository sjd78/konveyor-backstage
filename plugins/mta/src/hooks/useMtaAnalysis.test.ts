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

  it.each(['Ready', 'Postponed', 'QuotaBlocked'] as const)(
    'continues polling a %s task until Hub reports a terminal state',
    async state => {
      mockGetTask
        .mockResolvedValueOnce({ id: 42, addon: 'analyzer', state })
        .mockResolvedValueOnce({
          id: 42,
          addon: 'analyzer',
          state: 'Canceled',
        });
      const { result } = renderHook(() => useMtaAnalysis(42));
      await waitFor(() => expect(result.current.task?.state).toBe(state));
      await act(async () => {
        jest.advanceTimersByTime(3000);
      });
      expect(result.current.task?.state).toBe('Canceled');
      await act(async () => {
        jest.advanceTimersByTime(3000);
      });
      expect(mockGetTask).toHaveBeenCalledTimes(2);
    },
  );

  it('clears a polling error and resumes when explicitly refreshed', async () => {
    mockGetTask
      .mockRejectedValueOnce(new Error('Hub is unavailable'))
      .mockResolvedValueOnce({ id: 42, addon: 'analyzer', state: 'Running' })
      .mockResolvedValueOnce({ id: 42, addon: 'analyzer', state: 'Succeeded' });
    const { result } = renderHook(() => useMtaAnalysis(42));
    await waitFor(() =>
      expect(result.current.error?.message).toBe('Hub is unavailable'),
    );
    await act(async () => {
      await result.current.refetch();
    });
    expect(result.current.error).toBeNull();
    expect(result.current.task?.state).toBe('Running');
    await act(async () => {
      jest.advanceTimersByTime(3000);
    });
    expect(result.current.task?.state).toBe('Succeeded');
  });

  it('ignores an old in-flight task after the selected task changes', async () => {
    let resolveOld: ((task: KonveyorTask) => void) | undefined;
    mockGetTask
      .mockReturnValueOnce(
        new Promise<KonveyorTask>(resolve => {
          resolveOld = resolve;
        }),
      )
      .mockResolvedValueOnce({ id: 43, addon: 'analyzer', state: 'Succeeded' });
    const { result, rerender } = renderHook(({ id }) => useMtaAnalysis(id), {
      initialProps: { id: 42 },
    });
    rerender({ id: 43 });
    await waitFor(() => expect(result.current.task?.id).toBe(43));
    await act(async () => {
      resolveOld?.({ id: 42, addon: 'analyzer', state: 'Running' });
    });
    expect(result.current.task?.id).toBe(43);
    await act(async () => {
      jest.advanceTimersByTime(3000);
    });
    expect(mockGetTask).toHaveBeenCalledTimes(2);
  });
});
