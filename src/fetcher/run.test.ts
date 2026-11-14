import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SPOTS } from '../shared/spots.ts';
import { marineFixture, weatherFixture } from './fixtures.ts';
import { run } from './run.ts';

let dir: string;
beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'baywatch-'));
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(async () => {
  vi.restoreAllMocks();
  await rm(dir, { recursive: true, force: true });
});

const ok = (body: unknown) => new Response(JSON.stringify(body));
const goodFetch = (async (url: string) =>
  ok(url.includes('marine-api') ? marineFixture() : weatherFixture())) as unknown as typeof fetch;
const fast = { sleep: async () => {}, backoffMs: () => 0 };

const failing = (async () => new Response('{}', { status: 500 })) as unknown as typeof fetch;
const readStatus = async () => JSON.parse(await readFile(join(dir, 'status.json'), 'utf8'));

describe('status.json', () => {
  it('counts failed runs and resets on success', async () => {
    for (const n of [1, 2, 3]) {
      await expect(run({ outDir: dir, fetchFn: failing, retries: 0, now: 100 + n, ...fast })).rejects.toThrow();
      const s = await readStatus();
      expect(s.consecutiveFailures).toBe(n);
      expect(s.lastAttemptAt).toBe(100 + n);
      expect(s.lastError).toMatch(/500/);
    }
    await run({ outDir: dir, fetchFn: goodFetch, now: 200, ...fast });
    expect(await readStatus()).toEqual({
      version: 1,
      lastAttemptAt: 200,
      lastSuccessAt: 200,
      consecutiveFailures: 0,
      lastError: null,
    });
  });

  it('does not count a retry attempt again', async () => {
    await expect(run({ outDir: dir, fetchFn: failing, retries: 0, now: 1, ...fast })).rejects.toThrow();
    await expect(run({ outDir: dir, fetchFn: failing, retries: 0, now: 2, retry: true, ...fast })).rejects.toThrow();
    expect((await readStatus()).consecutiveFailures).toBe(1);
    await run({ outDir: dir, fetchFn: goodFetch, now: 3, retry: true, ...fast });
    expect((await readStatus()).consecutiveFailures).toBe(0);
  });

  it('keeps the last success time across failures', async () => {
    await run({ outDir: dir, fetchFn: goodFetch, now: 50, ...fast });
    await expect(run({ outDir: dir, fetchFn: failing, retries: 0, now: 60, ...fast })).rejects.toThrow();
    const s = await readStatus();
    expect(s).toMatchObject({ lastSuccessAt: 50, consecutiveFailures: 1, lastAttemptAt: 60 });
  });

  it('starts from defaults when the file is corrupt', async () => {
    await writeFile(join(dir, 'status.json'), '{not json');
    await expect(run({ outDir: dir, fetchFn: failing, retries: 0, now: 5, ...fast })).rejects.toThrow();
    expect((await readStatus()).consecutiveFailures).toBe(1);
  });

  it('is already written when the run is killed mid-fetch', async () => {
    await run({ outDir: dir, fetchFn: goodFetch, now: 10, ...fast });
    const hang = (() => new Promise<Response>(() => {})) as unknown as typeof fetch;
    void run({ outDir: dir, fetchFn: hang, now: 20, ...fast });
    await vi.waitFor(async () => expect((await readStatus()).consecutiveFailures).toBe(1));
    expect(await readStatus()).toMatchObject({ lastAttemptAt: 20, lastSuccessAt: 10 });
  });

  it('does not fail a successful run when status.json cannot be written', async () => {
    await mkdir(join(dir, 'status.json.tmp'));
    const line = await run({ outDir: dir, fetchFn: goodFetch, ...fast });
    expect(line).toMatch(/ ok .* status write failed/);
    expect(line).not.toContain('\n');
    expect(JSON.parse(await readFile(join(dir, 'forecast.json'), 'utf8')).version).toBe(1);
  });
});

describe('run', () => {
  it('writes forecast.json atomically and logs one line', async () => {
    const out = join(dir, 'nested', 'data');
    const line = await run({ outDir: out, fetchFn: goodFetch, now: 1794650000, ...fast });
    expect(line).toMatch(/ok \d+ bytes cells: .*costa-quebrada\+canallave/);
    expect(line).not.toContain('\n');
    expect(await readdir(out)).toEqual(['forecast.json', 'status.json']);
    const f = JSON.parse(await readFile(join(out, 'forecast.json'), 'utf8'));
    expect(f.version).toBe(1);
    expect(f.generatedAt).toBe(1794650000);
    expect(f.cells).toHaveLength(5);
  });

  it('leaves the previous file untouched when the fetch fails', async () => {
    const file = join(dir, 'forecast.json');
    await writeFile(file, 'OLD');
    const failing = (async () => new Response('{}', { status: 500 })) as unknown as typeof fetch;
    await expect(run({ outDir: dir, fetchFn: failing, retries: 0, ...fast })).rejects.toThrow();
    expect(await readFile(file, 'utf8')).toBe('OLD');
    expect((await readdir(dir)).sort()).toEqual(['forecast.json', 'status.json']);
  });

  it('reports a multi-location fallback in the log line', async () => {
    const fx = marineFixture();
    const fetchFn = (async (url: string) => {
      if (!url.includes('marine-api')) return ok(weatherFixture());
      if (url.includes('latitude=43.474,')) return new Response('{}', { status: 500 });
      const i = fx.findIndex((_, k) => url.includes(`latitude=${SPOTS[k]!.lat}&`));
      return ok(fx[i]);
    }) as unknown as typeof fetch;
    const line = await run({ outDir: dir, fetchFn, retries: 0, ...fast });
    expect(line).toMatch(/ ok .* warn: multi-location fallback: .*HTTP 500/);
    expect(line).not.toContain('\n');
  });

  it('leaves the previous file untouched when the write fails', async () => {
    const file = join(dir, 'forecast.json');
    await writeFile(file, 'OLD');
    await mkdir(`${file}.tmp`);
    await expect(run({ outDir: dir, fetchFn: goodFetch, ...fast })).rejects.toThrow();
    expect(await readFile(file, 'utf8')).toBe('OLD');
  });

  it('leaves the previous file untouched when the data is invalid', async () => {
    const file = join(dir, 'forecast.json');
    await writeFile(file, 'OLD');
    const bad = marineFixture();
    bad[0]!.hourly.wave_height!.length = 10;
    const fetchFn = (async (url: string) =>
      ok(url.includes('marine-api') ? bad : weatherFixture())) as unknown as typeof fetch;
    await expect(run({ outDir: dir, fetchFn, retries: 0, ...fast })).rejects.toThrow();
    expect(await readFile(file, 'utf8')).toBe('OLD');
    expect((await readdir(dir)).sort()).toEqual(['forecast.json', 'status.json']);
  });
});
