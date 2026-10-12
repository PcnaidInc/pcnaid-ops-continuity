import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {ROOT} from '../src/runtime/samples.mjs';

const invoke = args => spawnSync(process.execPath, ['bin/pcnaid-continuity.mjs', ...args], {cwd: ROOT, encoding: 'utf8'});

test('CLI help works without package install', () => assert.match(invoke(['--help']).stdout, /No command installs packages/));
test('CLI rejects unknown options', () => assert.equal(invoke(['continuity', '--typo', 'value']).status, 1));
test('CLI requires output explicitly', () => assert.equal(invoke(['continuity', '--input', 'examples/continuity/inventory.json']).status, 1));
test('CLI runs continuity analysis and produces packet', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'pcnaid-cli-continuity-'));
  try {
    const res = invoke(['continuity', '--input', 'examples/continuity/inventory.json', '--out', dir]);
    assert.equal(res.status, 0, res.stderr);
    assert.match(res.stdout, /continuity:/);
    const packetStat = await fs.stat(path.join(dir, 'packet.zip'));
    assert(packetStat.size > 100);
    const dotStat = await fs.stat(path.join(dir, 'dependency-graph.dot'));
    assert(dotStat.size > 0);
  } finally {
    await fs.rm(dir, {recursive: true, force: true});
  }
});
