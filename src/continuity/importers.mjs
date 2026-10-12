import {assert, object, array, string, parseCSV, timestamp, sha256, endpointReference} from '../shared/data.mjs';
import {validateInventory} from './model.mjs';
const empty=(organization,date,source)=>({version:'1',organization,capturedAt:date,sources:[source],principals:[],connections:[],workflows:[],warnings:[]});
export function importZapierCSV(text,{organization,ownerId,ownerName,capturedAt=new Date().toISOString()}={}) {
  object(organization,'organization');string(ownerId,'Owner ID is required because the Zapier CSV does not establish its exporting member');timestamp(capturedAt);
  const rows=parseCSV(text);assert(rows.length,'No Zapier assets in CSV');
  for(const header of ['type','id','name'])assert(Object.hasOwn(rows[0],header),`Zapier CSV requires ${header} column`);
  const digest=sha256(text),sid=`zapier-export:${digest.slice(0,16)}`;
  const inv=empty(organization,capturedAt,{id:sid,type:'zapier',label:'Zapier member asset CSV (owner supplied separately)',collectedAt:capturedAt,sha256:digest,coverage:'partial'});
  const pid=`zapier:person:${ownerId}`;
  inv.sources.push({id:`manual:${sid}`,type:'manual',label:'Operator-supplied exporting member identity',collectedAt:capturedAt,sha256:null,coverage:'partial'});
  inv.principals.push({id:pid,name:ownerName||ownerId,kind:'person',status:'unknown',sourceId:`manual:${sid}`});
  for(const r of rows) {
    const type=r.type.trim().toLowerCase();string(r.id,'asset.id');
    if(type==='zap')inv.workflows.push({id:`zapier:zap:${r.id}`,platform:'zapier',name:r.name||r.id,ownerIds:[pid],businessOwner:null,purpose:null,connectionIds:[],dependsOnWorkflowIds:[],endpoints:[],state:'unknown',coverage:{owners:'partial',connections:'unknown',endpoints:'unknown',upstream:'unknown'},solutionAware:null,sourceId:sid});
    else if(['auth','app connection','connection','connected app account'].includes(type))inv.connections.push({id:`zapier:auth:${r.id}`,platform:'zapier',name:r.name||r.id,ownerId:pid,binding:'unknown',status:'unknown',expiresAt:null,sourceId:sid});
    else inv.warnings.push(`Unrecognized asset type ${r.type}; asset ${r.id} was not classified.`);
  }
  inv.warnings.push('Zapier asset CSV does not establish Zap-to-connection edges, trigger type, all co-owners, or external callers. Empty edge lists mean unknown, not no dependencies.','Exporting-member identity is administrator-supplied; employment status is unknown until explicitly recorded.');
  return validateInventory(inv);
}
export function importPowerAutomate(raw) {
  object(raw,'Power Automate export');assert(raw.format==='pcnaid-powerautomate-admin-v1','Expected pcnaid-powerautomate-admin-v1 exporter output, not an arbitrary flow package');
  const date=timestamp(raw.capturedAt),digest=sha256(raw),sid=`powerautomate-export:${digest.slice(0,16)}`;
  const inv=empty(raw.organization,date,{id:sid,type:'powerautomate',label:'Selected Power Automate environment admin metadata export',collectedAt:date,sha256:digest,coverage:'partial'});
  const people=new Map();
  const person=(p)=>{
    string(p.id,'owner.id',500);const id=`powerautomate:principal:${p.id}`;
    const candidate={id,name:p.name||p.id,kind:p.kind||'unknown',status:'unknown',sourceId:sid};
    if(people.has(id)){const old=people.get(id);assert(old.kind===candidate.kind,`Conflicting principal kind: ${id}`);}else people.set(id,candidate);
    return id;
  };
  for(const c of array(raw.connections??[],'connections')){object(c,'connection');string(c.id,'connection.id');string(c.environmentId,'connection.environmentId');inv.connections.push({id:`powerautomate:${c.environmentId}:connection:${c.id}`,platform:'powerautomate',name:c.name||c.id,ownerId:c.owner?person(c.owner):null,binding:'unknown',status:['connected','expired','error'].includes(c.status)?c.status:'unknown',expiresAt:c.expiresAt??null,sourceId:sid});}
  for(const f of array(raw.flows,'flows')) {
    string(f.id,'flow.id');string(f.environmentId,'flow.environmentId');
    inv.workflows.push({id:`powerautomate:${f.environmentId}:flow:${f.id}`,platform:'powerautomate',name:f.name||f.id,ownerIds:array(f.owners??[],'owners').map(person),businessOwner:null,purpose:null,connectionIds:array(f.connectionIds??[],'connectionIds').map(id=>`powerautomate:${f.environmentId}:connection:${id}`),dependsOnWorkflowIds:[],endpoints:array(f.endpoints??[],'endpoints').map((e,i)=>({id:`endpoint-${i}`,label:e.label||'HTTP reference',kind:'http',transferChangesUrl:null,reference:endpointReference(e.url)})),state:({enabled:'enabled',started:'enabled',disabled:'disabled',stopped:'disabled'})[String(f.state).toLowerCase()]??'unknown',coverage:{owners:f.ownersComplete===true?'complete':'unknown',connections:f.connectionsComplete===true?'complete':'unknown',endpoints:'unknown',upstream:'unknown'},solutionAware:typeof f.solutionAware==='boolean'?f.solutionAware:null,sourceId:sid});
  }
  inv.principals=[...people.values()];inv.warnings=[...(raw.warnings??[]),'Principal activity, authentication binding, external callers, and business accountability require administrator confirmation. Creator is not treated as current owner.'];
  return validateInventory(inv);
}
