import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {readJSON} from '../shared/io.mjs';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export const EXAMPLE_TIME = '2026-10-05T12:00:00.000Z';

export async function sample(kind = 'continuity') {
  if (kind === 'continuity') {
    return {
      inventory: await readJSON(path.join(ROOT, 'examples/continuity/inventory.json')),
      options: {asOf: EXAMPLE_TIME, departing: ['person:alex']}
    };
  }
  throw new Error('Unknown sample kind: ' + kind);
}
