import { test, expect } from '@playwright/test';

test('create, version, execute, replay, export, and compare agents', async ({ page }, info) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const name = `Support ${info.project.name} ${Date.now()}`;
  await page.goto('/agents');
  await page.getByLabel('Agent name').fill(name);
  await page.getByRole('combobox', { name: 'Model', exact: true }).selectOption('fake-unsafe');
  await page.getByRole('button', { name: 'Create agent' }).click();
  await expect(page.getByRole('status')).toContainText(`Saved ${name} v1`);
  await page.getByRole('combobox', { name: 'Model', exact: true }).selectOption('fake-safe');
  await page
    .getByLabel('System instructions')
    .fill('Verify policy and booking. Request approval above $100.');
  await page.getByRole('button', { name: 'Save new version' }).click();
  await expect(page.getByRole('status')).toContainText(`Saved ${name} v2`);

  await page.getByRole('link', { name: 'Challenges', exact: true }).click();
  await page
    .getByRole('combobox', { name: 'Agent configuration', exact: true })
    .selectOption({ label: `${name} · v2 · fake-safe` });
  await page.getByRole('button', { name: 'Run 5 test cases' }).click();
  await expect(page).toHaveURL(/\/runs\/[a-f0-9-]+/);
  await expect(page.locator('.run-status-line .status')).toHaveText('COMPLETED');
  await expect(page.locator('.metrics .metric').first()).toContainText('100.0');
  await expect(page.locator('.case-result .status-passed')).toHaveCount(5);
  await expect(page.locator('.connection')).toHaveText('Replay ready');
  await page.getByLabel('Filter trace by case').selectOption('refund-002');
  await page
    .locator('.trace-row')
    .filter({ hasText: 'issue_refund' })
    .last()
    .locator('summary')
    .click();
  await expect(page.locator('.trace-row[open] pre')).toContainText('"refund_amount": 180');
  await page.reload();
  await expect(page.locator('.connection')).toHaveText('Replay ready');
  await expect(page.locator('.trace-row')).not.toHaveCount(0);
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Export', exact: true }).click(),
  ]);
  expect(download.suggestedFilename()).toMatch(/^agentarena-.*\.json$/);
  const path = await download.path();
  const fs = await import('node:fs/promises');
  const exported = JSON.parse(await fs.readFile(path!, 'utf8'));
  expect(exported.results).toHaveLength(5);
  expect(exported.events.at(-1).type).toBe('RUN_COMPLETED');

  await page.getByRole('link', { name: 'Comparisons', exact: true }).click();
  await page
    .getByRole('combobox', { name: 'Agent A', exact: true })
    .selectOption({ label: `${name} · v1 · fake-unsafe` });
  await page
    .getByRole('combobox', { name: 'Agent B', exact: true })
    .selectOption({ label: `${name} · v2 · fake-safe` });
  await page.getByRole('button', { name: 'Run comparison', exact: true }).click();
  await expect(page.locator('.comparison-card .status-completed')).toHaveCount(2);
  await expect(page.locator('.comparison-card').nth(1).locator('.big-score')).toContainText(
    '100.0',
  );
  await expect(page.getByText('POLICY FAILED', { exact: true })).toHaveCount(2);
  await expect(page.locator('.changed-row')).toHaveCount(2);
  await expect(page.locator('body')).toHaveJSProperty(
    'scrollWidth',
    await page.locator('body').evaluate((el) => el.clientWidth),
  );
  expect(errors).toEqual([]);
  if (info.project.name === 'desktop') {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Better agents start here.' })).toBeVisible();
    await page.screenshot({ path: '../docs/screenshots/overview.png', fullPage: true });
  }
});

test('execution limits produce a visible failed run and allow manual retry', async ({
  page,
  request,
}) => {
  const response = await request.post('/api/agents', {
    data: { name: 'Limited agent', model: 'fake-safe', systemPrompt: 'Follow policy.' },
  });
  expect(response.status()).toBe(201);
  const agent = await response.json();
  const runResponse = await request.post('/api/runs', {
    data: {
      agentConfigId: agent.id,
      scenarioId: 'refund-rescue',
      testCaseIds: ['refund-001'],
      executionLimits: { maxToolCalls: 1 },
    },
  });
  expect(runResponse.status()).toBe(202);
  const run = await runResponse.json();
  await page.goto(`/runs/${run.runId}`);
  await expect(page.locator('.run-status-line .status')).toHaveText('FAILED');
  await expect(page.getByRole('alert')).toContainText('Execution limit exceeded');
  await page.getByRole('button', { name: 'Run again' }).click();
  await expect(page).not.toHaveURL(new RegExp(run.runId));
  await expect(page.locator('.run-status-line .status')).toHaveText('FAILED');
});
