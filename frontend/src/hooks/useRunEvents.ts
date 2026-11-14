import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { ArenaEvent } from '../types';

export function mergeEvents(current: ArenaEvent[], incoming: ArenaEvent[]): ArenaEvent[] {
  return [
    ...new Map([...current, ...incoming].map((event) => [event.eventId, event])).values(),
  ].sort((a, b) => a.eventId - b.eventId);
}
export function useRunEvents(runId: string) {
  const client = useQueryClient();
  const [events, setEvents] = useState<ArenaEvent[]>([]);
  const [connection, setConnection] = useState('Connecting');
  useEffect(() => {
    setEvents([]);
    setConnection('Connecting');
    const source = new EventSource(`/api/runs/${runId}/events`);
    source.onopen = () => setConnection('Live');
    source.addEventListener('arena', (event: MessageEvent<string>) => {
      const incoming = JSON.parse(event.data) as ArenaEvent;
      setEvents((current) => mergeEvents(current, [incoming]));
      if (['CASE_COMPLETED', 'RUN_COMPLETED', 'RUN_FAILED'].includes(incoming.type)) {
        void client.invalidateQueries({ queryKey: ['run', runId] });
        void client.invalidateQueries({ queryKey: ['runs'] });
      }
    });
    source.addEventListener('end', () => {
      setConnection('Replay ready');
      source.close();
    });
    source.onerror = () => setConnection('Reconnecting');
    return () => source.close();
  }, [runId, client]);
  return { events, connection };
}
