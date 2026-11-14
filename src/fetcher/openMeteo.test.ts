import { describe, expect, it, vi } from 'vitest';
import { marineFixture, weatherFixture } from './fixtures.ts';
import { fetchMarine, fetchWeather, getJson, marineUrl, validateMarine, validateWeather } from './openMeteo.ts';

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
const fast = { sleep: async () => {}, backoffMs: () => 0 };
const P = [
  { lat: 43.474, lon: -3.893 },
  { lat: 43.476, lon: -3.917 },
];

describe('urls', () => {
  it('builds multi-location requests', () => {
    const u = marineUrl(P);
    expect(u).toContain('latitude=43.474,43.476');
    expect(u).toContain('longitude=-3.893,-3.917');
    expect(u).toContain('timeformat=unixtime');
    expect(u).toContain('forecast_days=8');
    expect(u).toContain('minutely_15=sea_level_height_msl');
  });
});

describe('getJson', () => {
  it('retries 5xx with backoff then succeeds', async () => {
    const fetchFn = vi.fn()
      .mockResolvedValueOnce(json({ reason: 'x' }, 503))
      .mockRejectedValueOnce(new TypeError('fetch failed'))
      .mockResolvedValueOnce(json({ ok: 1 }));
    const sleep = vi.fn(async () => {});
    const out = await getJson('http://x/a?b=1', { fetchFn, sleep, backoffMs: (n) => n * 10 });
    expect(out).toEqual({ ok: 1 });
    expect(fetchFn).toHaveBeenCalledTimes(3);
    expect(sleep.mock.calls).toEqual([[10], [20]]);
  });

  it('gives up after 3 retries', async () => {
    const fetchFn = vi.fn(async () => json({}, 500));
    await expect(getJson('http://x/a', { fetchFn, ...fast })).rejects.toThrow(/HTTP 500/);
    expect(fetchFn).toHaveBeenCalledTimes(4);
  });

  it('does not retry a 400 and reports the reason', async () => {
    const fetchFn = vi.fn(async () => json({ error: true, reason: 'bad param' }, 400));
    await expect(getJson('http://x/a?secret=1', { fetchFn, ...fast })).rejects.toThrow(/bad param/);
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it('aborts a hanging request', async () => {
    const fetchFn = vi.fn((_u: unknown, init?: RequestInit) =>
      new Promise<Response>((_, rej) => init!.signal!.addEventListener('abort', () => rej(new Error('aborted')))),
    );
    await expect(getJson('http://x/a', { fetchFn: fetchFn as unknown as typeof fetch, timeoutMs: 20, retries: 1, ...fast })).rejects.toThrow(/aborted/);
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });
});

describe('validation', () => {
  it('accepts fixtures', () => {
    for (const m of marineFixture()) validateMarine(m);
    for (const w of weatherFixture()) validateWeather(w);
  });

  it('rejects wrong lengths, missing arrays and early nulls', () => {
    let m = marineFixture()[0]!;
    m.hourly.wave_height = m.hourly.wave_height!.slice(1);
    expect(() => validateMarine(m)).toThrow(/wave_height/);
    m = marineFixture()[0]!;
    delete m.hourly.wave_period;
    expect(() => validateMarine(m)).toThrow(/wave_period missing/);
    m = marineFixture()[0]!;
    m.hourly.swell_wave_height![10] = null;
    expect(() => validateMarine(m)).toThrow(/null/);
    m = marineFixture()[0]!;
    m.minutely_15.sea_level_height_msl[5] = null;
    expect(() => validateMarine(m)).toThrow(/null/);
    const w = weatherFixture()[0]!;
    w.daily.sunrise[3] = null as unknown as number;
    expect(() => validateWeather(w)).toThrow(/sunrise/);
  });

  it('rejects gaps in the time axes', () => {
    let m = marineFixture()[0]!;
    m.hourly.time[100]! += 60;
    expect(() => validateMarine(m)).toThrow(/time step/);
    m = marineFixture()[0]!;
    m.minutely_15.time = m.minutely_15.time.map((t) => t + 900);
    expect(() => validateMarine(m)).toThrow(/start differ/);
  });

  it('tolerates nulls in the last day and in optional fields', () => {
    const m = marineFixture()[0]!;
    m.hourly.wave_height![191] = null;
    m.hourly.swell_wave_peak_period!.fill(null);
    expect(() => validateMarine(m)).not.toThrow();
  });

  it('rejects a snapped point far from the request', () => {
    expect(() => validateMarine(marineFixture()[0]!, 'm', { lat: 10, lon: 10 })).toThrow(/requested/);
  });
});

describe('fetchMarine', () => {
  const pts = P;
  it('uses one multi-location call', async () => {
    const fetchFn = vi.fn(async () => json(marineFixture().slice(0, 2)));
    const out = await fetchMarine(pts, { fetchFn: fetchFn as unknown as typeof fetch, ...fast });
    expect(out).toHaveLength(2);
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it('falls back to one call per location on a count mismatch', async () => {
    const fx = marineFixture();
    const fetchFn = vi.fn(async (url: string) => {
      if (url.includes('43.474,43.476')) return json([fx[0]]);
      return json(url.includes('latitude=43.474&') ? fx[0] : fx[1]);
    });
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const out = await fetchMarine(pts, { fetchFn: fetchFn as unknown as typeof fetch, ...fast });
    expect(out).toHaveLength(2);
    expect(out[1]!.longitude).toBe(fx[1]!.longitude);
    expect(fetchFn).toHaveBeenCalledTimes(3);
  });

  it('accepts a bare object for a single location', async () => {
    const fx = weatherFixture();
    const fetchFn = vi.fn(async () => json(fx[0]));
    const out = await fetchWeather([{ lat: 43.474, lon: -3.893 }], { fetchFn: fetchFn as unknown as typeof fetch, ...fast });
    expect(out).toHaveLength(1);
  });

  it('fails when a single-location call fails too', async () => {
    const fetchFn = vi.fn(async () => json({}, 500));
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    await expect(fetchMarine(pts, { fetchFn: fetchFn as unknown as typeof fetch, retries: 0, ...fast })).rejects.toThrow(/HTTP 500/);
  });
});
