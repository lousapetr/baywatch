// Test helper: recorded API responses (2026-11-14), requested for all SPOTS.

import { readFileSync } from 'node:fs';
import type { MarineResponse, WeatherResponse } from './openMeteo.ts';

const load = (name: string) =>
  JSON.parse(readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8')) as unknown[];

/** One element per spot, in SPOTS order. */
export const marineFixture = () => load('marine.json') as MarineResponse[];
/** One element per cell, in first-appearance order. */
export const weatherFixture = () => load('weather.json') as WeatherResponse[];
