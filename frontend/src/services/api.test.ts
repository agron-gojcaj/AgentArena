import { afterEach, expect, it, vi } from 'vitest';
import { request } from './api';
afterEach(() => vi.unstubAllGlobals());
it('sends JSON requests and exposes actionable server errors', async () => {
  const fetch = vi
    .fn()
    .mockResolvedValue(
      new Response(JSON.stringify({ error: 'Run queue is full.' }), { status: 429 }),
    );
  vi.stubGlobal('fetch', fetch);
  await expect(request('/runs', { agentConfigId: 'abc' })).rejects.toThrow('Run queue is full.');
  expect(fetch).toHaveBeenCalledWith(
    '/api/runs',
    expect.objectContaining({ method: 'POST', body: '{"agentConfigId":"abc"}' }),
  );
});
it('handles a proxy error that is not JSON', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('unavailable', { status: 502 })));
  await expect(request('/agents')).rejects.toThrow('Request failed (502)');
});
