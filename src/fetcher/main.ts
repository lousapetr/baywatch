import { run } from './run.ts';

// One stdout line per run; non-zero exit on any failure.
const outDir = process.env.OUT_DIR;
if (!outDir) {
  console.log(`${new Date().toISOString()} error OUT_DIR is not set`);
  process.exit(1);
}

try {
  console.log(await run({ outDir }));
} catch (e) {
  console.log(`${new Date().toISOString()} error ${e instanceof Error ? e.message : String(e)}`);
  process.exit(1);
}
