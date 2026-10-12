import path from 'node:path';
import {sample, ROOT} from '../src/runtime/samples.mjs';
import {runAnalysis} from '../src/runtime/service.mjs';
import {saveReport} from '../src/cli.mjs';

const report = runAnalysis('continuity', await sample('continuity'));
await saveReport(report, path.join(ROOT, 'reports', 'continuity'), {force: true});
console.log('continuity', JSON.stringify(report.summary));
console.log('Fictional sample packet regenerated in reports/.');
