import path from 'node:path';
import fs from 'node:fs/promises';
import {readJSON, readText, writeFile, writeJSON} from './shared/io.mjs';
import {assert, pretty, parseJSON} from './shared/data.mjs';
import {analyzeContinuity, compareContinuity} from './continuity/analyze.mjs';
import {importZapierCSV, importPowerAutomate} from './continuity/importers.mjs';
import {mergeInventories, annotateInventory} from './continuity/model.mjs';
import {renderReport, csvReport, packet, dependencyDOT} from './shared/reports.mjs';

export const HELP = `Pcnaid Continuity Tool 0.1.0 — automation continuity assessment

  continuity --input inventory.json --out reports/output
             [--departing exact-id,another-id] [--annotations file.json]
             [--as-of ISO] [--stale-days 30]
  import-zapier --input assets.csv --org-id org-id --org-name "Org name"
                --owner-id ID --owner-name "Owner name" --captured-at ISO
                --out inventory.json
  import-powerautomate --input export.json --out inventory.json
  merge --input platform1.json --input platform2.json --out merged.json
  compare --before old.json --after new.json --out comparison.json
          [--departing exact-id] [--as-of ISO]

--force explicitly permits replacement of output files. Existing paths otherwise fail.
No command installs packages, runs repository code, transfers assets, or changes platform state.
`;

const FLAGS = new Set(['force', 'help']);
const ALLOWED = {
  continuity: ['input', 'out', 'departing', 'annotations', 'as-of', 'stale-days'],
  'import-zapier': ['input', 'out', 'org-id', 'org-name', 'owner-id', 'owner-name', 'captured-at'],
  'import-powerautomate': ['input', 'out'],
  merge: ['input', 'out'],
  compare: ['before', 'after', 'out', 'departing', 'as-of']
};

function parseArgs(argv) {
  let [command, ...rest] = argv;
  if (command && command.startsWith('--')) {
    rest = [command, ...rest];
    command = 'continuity';
  }
  assert(Object.hasOwn(ALLOWED, command), `Unknown command ${command}. Run --help.`);
  const options = {};
  for (let i = 0; i < rest.length; i++) {
    const key = rest[i];
    assert(/^--[a-z][a-z-]*$/.test(key), 'Expected --option followed by a value');
    const name = key.slice(2);
    assert(ALLOWED[command].includes(name) || ['force', 'help'].includes(name), `Unknown option ${key}`);
    const value = FLAGS.has(name) ? true : rest[++i];
    assert(value !== undefined && !String(value).startsWith('--'), `Missing value for ${key}`);
    if (Object.hasOwn(options, name)) {
      assert(['input'].includes(name), 'Duplicate option ' + key);
      options[name] = [].concat(options[name], value);
    } else options[name] = value;
  }
  return {command, options};
}

const need = (o, k) => {
  assert(typeof o[k] === 'string' && o[k].length > 0, `--${k} is required and must occur once`);
  return o[k];
};
const all = x => (x === undefined ? [] : Array.isArray(x) ? x : [x]);
const scenario = o => ({
  departing: (o.departing ?? '').split(',').map(x => x.trim()).filter(Boolean),
  ...(o['as-of'] ? {asOf: o['as-of']} : {}),
  ...(o['stale-days'] ? {staleDays: Number(o['stale-days'])} : {})
});

export async function saveReport(report, out, {force = false} = {}) {
  const files = {
    'report.json': pretty(report),
    'report.html': renderReport(report),
    'findings.csv': csvReport(report),
    'packet.zip': packet(report),
    'dependency-graph.dot': dependencyDOT(report)
  };
  if (!force) {
    for (const name of Object.keys(files)) {
      try {
        await fs.lstat(path.join(out, name));
        throw new Error('Output already exists: ' + path.join(out, name));
      } catch (e) {
        if (e.code !== 'ENOENT') throw e;
      }
    }
  }
  for (const [name, value] of Object.entries(files)) await writeFile(path.join(out, name), value, force);
  return path.resolve(out);
}

export async function main(argv = process.argv.slice(2)) {
  if (!argv.length || argv[0] === '--help' || argv[0] === 'help') {
    console.log(HELP);
    return;
  }
  const {command, options: o} = parseArgs(argv);
  if (o.help) {
    console.log(HELP);
    return;
  }
  const force = !!o.force;
  let report;
  if (command === 'continuity') {
    let inv = await readJSON(need(o, 'input'));
    if (o.annotations) inv = annotateInventory(inv, await readJSON(o.annotations));
    report = analyzeContinuity(inv, scenario(o));
  } else if (command === 'import-zapier') {
    const inv = importZapierCSV(await readText(need(o, 'input')), {
      organization: {id: need(o, 'org-id'), name: need(o, 'org-name')},
      ownerId: need(o, 'owner-id'),
      ownerName: need(o, 'owner-name'),
      capturedAt: need(o, 'captured-at')
    });
    await writeJSON(need(o, 'out'), inv, force);
    console.log('Imported inventory. Relationships and account activity remain unknown until verified.');
    return;
  } else if (command === 'import-powerautomate') {
    await writeJSON(need(o, 'out'), importPowerAutomate(await readJSON(need(o, 'input'))), force);
    console.log('Imported exporter-shaped inventory. Inspect coverage warnings.');
    return;
  } else if (command === 'merge') {
    const inputs = all(o.input);
    assert(inputs.length > 1, 'Provide at least two --input files');
    await writeJSON(need(o, 'out'), mergeInventories(await Promise.all(inputs.map(readJSON))), force);
    console.log('Merged without inferring cross-platform identity matches.');
    return;
  } else if (command === 'compare') {
    await writeJSON(need(o, 'out'), compareContinuity(await readJSON(need(o, 'before')), await readJSON(need(o, 'after')), scenario(o)), force);
    console.log('Comparison written; no longer observed is not proof of remediation.');
    return;
  }
  if (report) {
    const out = await saveReport(report, need(o, 'out'), {force});
    console.log(`${report.kind}: ${out}`);
    console.log(pretty(report.summary));
  }
}
