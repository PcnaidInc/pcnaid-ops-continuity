import {assert, object, string, array, enumValue, timestamp, uniqueBy, noExtra, sanitize, endpointReference} from '../shared/data.mjs';
const platform = v => enumValue(v,['powerautomate','zapier','manual'],'platform');
const completeness=v=>enumValue(v,['complete','partial','unknown'],'coverage');
const optionalText=(v,n)=>v==null?null:string(v,n);
export function validateInventory(raw) {
  object(raw,'inventory');noExtra(raw,['version','organization','capturedAt','sources','principals','connections','workflows','warnings'],'inventory');
  assert(raw.version==='1','Inventory version must be "1"');object(raw.organization,'organization');
  const organization={id:string(raw.organization.id,'organization.id',200),name:string(raw.organization.name,'organization.name',300)};
  timestamp(raw.capturedAt,'capturedAt');
  const sources=array(raw.sources,'sources',1000).map(s=>{
    object(s,'source');return {id:string(s.id,'source.id',300),type:enumValue(s.type,['manual','powerautomate','zapier'],'source.type'),label:string(s.label,'source.label'),collectedAt:timestamp(s.collectedAt),sha256:s.sha256==null?null:string(s.sha256,'source.sha256',100),coverage:completeness(s.coverage??'unknown')};
  });
  const sourceIds=new Set(sources.map(s=>s.id));
  const sourceId=id=>{string(id,'sourceId',300);assert(sourceIds.has(id),`Unknown sourceId: ${id}`);return id;};
  const principals=array(raw.principals,'principals').map(p=>{
    object(p,'principal');return {id:string(p.id,'principal.id',500),name:string(p.name,'principal.name',500),kind:enumValue(p.kind,['person','service','group','unknown'],'principal.kind'),status:enumValue(p.status,['active','departing','departed','disabled','unknown'],'principal.status'),sourceId:sourceId(p.sourceId)};
  });
  const connections=array(raw.connections,'connections').map(c=>{
    object(c,'connection');return {id:string(c.id,'connection.id',500),platform:platform(c.platform),name:string(c.name,'connection.name',500),ownerId:optionalText(c.ownerId,'connection.ownerId'),binding:enumValue(c.binding,['person','organization','unknown'],'connection.binding'),status:enumValue(c.status,['connected','expired','error','unknown'],'connection.status'),expiresAt:c.expiresAt==null?null:timestamp(c.expiresAt,'expiresAt'),sourceId:sourceId(c.sourceId)};
  });
  const workflows=array(raw.workflows,'workflows',5000).map(w=>{
    object(w,'workflow');object(w.coverage,'workflow.coverage');
    const ids=(v,n)=>{array(v,n,1000);v.forEach(i=>string(i,n,500));assert(new Set(v).size===v.length,`Duplicate entries in ${n}`);return v;};
    assert(w.solutionAware===null||typeof w.solutionAware==='boolean','solutionAware must be boolean or null');
    const endpoints=array(w.endpoints??[],'endpoints',100).map(e=>{
      object(e,'endpoint');assert(e.transferChangesUrl===null||typeof e.transferChangesUrl==='boolean','transferChangesUrl must be boolean or null');
      return {id:string(e.id,'endpoint.id',500),label:string(e.label,'endpoint.label',500),kind:enumValue(e.kind,['catch_hook','catch_raw_hook','http','unknown'],'endpoint.kind'),transferChangesUrl:e.transferChangesUrl,reference:e.reference==null?null:endpointReference(optionalText(e.reference,'endpoint.reference'))};
    });uniqueBy(endpoints,'endpoint');
    return {id:string(w.id,'workflow.id',500),platform:platform(w.platform),name:string(w.name,'workflow.name',500),ownerIds:ids(w.ownerIds,'ownerIds'),businessOwner:optionalText(w.businessOwner,'businessOwner'),purpose:optionalText(w.purpose,'purpose'),connectionIds:ids(w.connectionIds,'connectionIds'),dependsOnWorkflowIds:ids(w.dependsOnWorkflowIds??[],'dependsOnWorkflowIds'),endpoints,state:enumValue(w.state,['enabled','disabled','unknown'],'workflow.state'),coverage:{owners:completeness(w.coverage.owners),connections:completeness(w.coverage.connections),endpoints:completeness(w.coverage.endpoints),upstream:completeness(w.coverage.upstream??'unknown')},solutionAware:w.solutionAware,sourceId:sourceId(w.sourceId)};
  });
  for(const [name,items]of Object.entries({sources,principals,connections,workflows}))uniqueBy(items,name);
  uniqueBy([...principals,...connections,...workflows],'graph node');
  return sanitize({version:'1',organization,capturedAt:timestamp(raw.capturedAt),sources,principals,connections,workflows,warnings:array(raw.warnings??[],'warnings',1000).map(w=>string(w,'warning'))});
}
export function mergeInventories(inventories) {
  assert(inventories.length>0,'At least one inventory is required');
  const normalized=inventories.map(validateInventory), result=structuredClone(normalized[0]);
  for(const inventory of normalized.slice(1)) {
    assert(inventory.organization.id===result.organization.id,'Cannot merge different organizations; choose the same explicit organization ID');
    for(const key of ['sources','principals','connections','workflows']) {
      const existing=new Map(result[key].map(x=>[x.id,x]));
      for(const item of inventory[key]) {
        if(existing.has(item.id))assert(JSON.stringify(existing.get(item.id))===JSON.stringify(item),`Conflicting ${key} ID ${item.id}; resolve explicitly before merging`);
        else {result[key].push(item);existing.set(item.id,item);}
      }
    }
    result.warnings.push(...inventory.warnings);
    if(Date.parse(inventory.capturedAt)<Date.parse(result.capturedAt))result.capturedAt=inventory.capturedAt;
  }
  result.warnings=[...new Set(result.warnings)];return validateInventory(result);
}
export function annotateInventory(raw, annotations) {
  const inventory=validateInventory(raw);array(annotations,'annotations',5000);
  for(const patch of annotations){
    object(patch,'annotation');noExtra(patch,['workflowId','businessOwner','purpose'],'annotation');
    const w=inventory.workflows.find(w=>w.id===patch.workflowId);assert(w,`Unknown annotation workflow ID: ${patch.workflowId}`);
    if(Object.hasOwn(patch,'businessOwner'))w.businessOwner=optionalText(patch.businessOwner,'businessOwner');
    if(Object.hasOwn(patch,'purpose'))w.purpose=optionalText(patch.purpose,'purpose');
  }
  if(annotations.length)inventory.warnings.push('Business owner/purpose annotations were supplied by the administrator; source-platform metadata was not modified.');
  return validateInventory(inventory);
}
