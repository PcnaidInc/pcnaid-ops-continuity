import {analyzeContinuity} from '../continuity/analyze.mjs';
import {importPowerAutomate, importZapierCSV} from '../continuity/importers.mjs';
import {annotateInventory} from '../continuity/model.mjs';
import {assert, object} from '../shared/data.mjs';

export function runAnalysis(kind, payload) {
  object(payload, 'analysis request');
  if (kind === 'continuity') {
    let inventory = payload.inventory;
    if (payload.format === 'zapier-csv') inventory = importZapierCSV(payload.text, payload.importOptions ?? {});
    else if (payload.format === 'powerautomate') inventory = importPowerAutomate(payload.inventory);
    else assert(!payload.format || payload.format === 'normalized', 'Unknown continuity format');
    if (payload.annotations) inventory = annotateInventory(inventory, payload.annotations);
    return analyzeContinuity(inventory, payload.options ?? {});
  }
  throw new Error('Unsupported analysis');
}
