import { describe, expect, it } from 'vitest';
import { mergeEvents } from './useRunEvents';
import type { ArenaEvent } from '../types';
const event = (id: number): ArenaEvent => ({
  eventId: id,
  runId: 'a',
  caseId: null,
  sequence: id,
  type: 'MODEL_OUTPUT',
  timestamp: '',
  payload: {},
});
describe('event replay', () => {
  it('deduplicates reconnect deliveries and orders out-of-order batches', () => {
    expect(mergeEvents([event(3), event(1)], [event(2), event(3)]).map((e) => e.eventId)).toEqual([
      1, 2, 3,
    ]);
  });
});
