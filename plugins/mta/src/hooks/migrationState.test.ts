import type { KonveyorTask } from '../api/types';
import {
  deriveKonveyorPhase,
  getLatestKonveyorTask,
  isAnalysisTask,
  isDiscoveryTask,
  isTaskActive,
} from './migrationState';

const task = (overrides: Partial<KonveyorTask> = {}): KonveyorTask => ({
  id: 1,
  addon: 'analyzer',
  kind: 'analyzer',
  state: 'Succeeded',
  ...overrides,
});

describe('shared Hub lifecycle', () => {
  it('treats technology discovery through analyzer as discovery, not findings', () => {
    const discovery = task({ kind: 'tech-discovery' });
    expect(isDiscoveryTask(discovery)).toBe(true);
    expect(isAnalysisTask(discovery)).toBe(false);
    expect(deriveKonveyorPhase([discovery])).toBe('Path Selection');
  });

  it('recognizes discovery mode for legacy analyzer tasks', () => {
    const discovery = task({
      data: { mode: { discovery: true } },
      state: 'Running',
    });
    expect(deriveKonveyorPhase([discovery])).toBe('Discovery');
  });

  it.each([
    'Created',
    'Ready',
    'Postponed',
    'QuotaBlocked',
    'Pending',
    'Running',
  ] as const)('does not turn a %s task into findings', state => {
    const pending = task({ state });
    expect(isTaskActive(pending)).toBe(true);
    expect(deriveKonveyorPhase([pending], true)).toBe('Analysis');
  });

  it('uses actual analysis availability even when history is absent', () => {
    expect(deriveKonveyorPhase([], true)).toBe('Active');
    expect(deriveKonveyorPhase([], false)).toBe('Not Started');
  });

  it('does not treat successful zero-finding analysis as completed', () => {
    expect(deriveKonveyorPhase([task()], true)).toBe('Active');
  });

  it('requires persisted analysis before reporting findings after a successful task', () => {
    expect(deriveKonveyorPhase([task()], false)).toBe('Analysis Unavailable');
  });

  it('selects the latest relevant task regardless of response order or unrelated tasks', () => {
    const failed = task({ id: 8, state: 'Failed' });
    const tasks = [
      failed,
      task({ id: 99, addon: 'report', kind: 'report' }),
      task({ id: 2 }),
    ];
    expect(getLatestKonveyorTask(tasks)).toBe(failed);
    expect(deriveKonveyorPhase(tasks, true)).toBe('Failed');
  });

  it('preserves a newer cancellation rather than presenting older findings as current', () => {
    expect(
      deriveKonveyorPhase([task(), task({ id: 2, state: 'Canceled' })], true),
    ).toBe('Failed');
  });
});
