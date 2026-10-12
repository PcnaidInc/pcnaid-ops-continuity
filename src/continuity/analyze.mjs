import {assert, timestamp, sha256, VERSION, canonical} from '../shared/data.mjs';
import {validateInventory} from './model.mjs';
const ruleSources={
  microsoft:'https://learn.microsoft.com/en-us/troubleshoot/power-platform/power-automate/flow-management/manage-orphan-flow-when-owner-leaves-org',
  zapier:'https://help.zapier.com/hc/en-us/articles/8496281082253-Remove-members-from-your-Team-or-Enterprise-account'
};
export function analyzeContinuity(raw,{departing=[],asOf=new Date().toISOString(),staleDays=30}={}) {
  const inv=validateInventory(raw);timestamp(asOf);assert(Array.isArray(departing)&&departing.every(x=>typeof x==='string'),'departing must be principal IDs');
  assert(Number.isInteger(staleDays)&&staleDays>0&&staleDays<=365,'staleDays must be 1–365');
  const principals=new Map(inv.principals.map(p=>[p.id,p])),connections=new Map(inv.connections.map(c=>[c.id,c])),workflows=new Map(inv.workflows.map(w=>[w.id,w])),sources=new Map(inv.sources.map(s=>[s.id,s]));
  for(const id of departing)assert(principals.has(id),`Unknown departing principal ${id}; use exact inventory IDs`);
  const unavailable=id=>departing.includes(id)||['departing','departed','disabled'].includes(principals.get(id)?.status);
  const findings=[];const results=[];const edges=[];const cutoff=Date.parse(asOf);
  for(const w of inv.workflows){
    const wf=[];
    function add(code,severity,title,detail,action,field,confidence='inferred',reference=null){
      const f={id:sha256(`${inv.organization.id}|${w.id}|${code}|${field}`).slice(0,20),workflowId:w.id,code,severity,title,detail,action,confidence,sourceId:w.sourceId,field,reference};wf.push(f);findings.push(f);
    }
    const evidence=sources.get(w.sourceId)?.type==='manual'?'administrator_supplied':'confirmed_in_export';
    if(w.coverage.owners!=='complete')add('C001','unknown','Owner coverage is incomplete','The input does not establish the complete current owner set.','Confirm current ownership in the source platform.','coverage.owners','unknown');
    if(!w.ownerIds.length&&w.coverage.owners==='complete')add('C002','high','No technical owner recorded','The declared-complete owner export is empty. This is not a live platform check.','Assign an accountable technical owner using the platform procedure.','ownerIds',evidence,ruleSources.microsoft);
    for(const id of w.ownerIds){
      edges.push({from:w.id,to:id,kind:'owned_by',confidence:evidence});
      const p=principals.get(id);
      if(!p)add('C003','unknown','Owner record is missing',`Reference ${id} has no principal record.`,'Resolve the principal reference; do not assume it is a departed account.',`ownerIds:${id}`,'unknown');
      else if(unavailable(id))add('C004','high','Owner is leaving or unavailable',`${p.name} is marked unavailable by the inventory or this scenario.`,'Confirm co-owner continuity and reauthentication requirements before access removal.',`ownerIds:${id}`,departing.includes(id)?'administrator_supplied':evidence,ruleSources.microsoft);
      else if(p.status==='unknown')add('C005','unknown','Owner activity is unverified',`${p.name}: the input does not establish active status.`,'Confirm this account is active and can maintain the workflow.',`ownerIds:${id}`,'unknown');
      if(p?.kind==='unknown')add('C020','unknown','Owner identity type is unknown','An owner record is not classified as a person, service identity, or group.','Confirm the principal type and who can administer it.',`ownerKind:${id}`,'unknown');
    }
    if(w.ownerIds.length===1&&principals.get(w.ownerIds[0])?.kind==='person')add('C006','medium','Single human owner recorded','Only one human technical owner appears in the supplied record.','Add a supported co-owner or document and test the approved transfer procedure.','ownerIds',w.coverage.owners==='complete'?evidence:'inferred');
    if(!w.businessOwner)add('C007','medium','Business owner is not documented','No person or team is accountable for the business outcome in this inventory.','Record the accountable business owner.','businessOwner','confirmed_in_input');
    if(!w.purpose)add('C008','low','Business purpose is not documented','The workflow has no business-purpose annotation.','Document inputs, outcome, cadence, and business impact.','purpose','confirmed_in_input');
    for(const [key,value]of Object.entries(w.coverage))if(key!=='owners'&&value!=='complete')add('C009','unknown',`${key[0].toUpperCase()+key.slice(1)} coverage is incomplete`,'Missing relationships cannot be treated as absence of dependencies.',`Validate ${key} and mark coverage complete only after checking.`,`coverage.${key}`,'unknown');
    for(const id of w.connectionIds){
      edges.push({from:w.id,to:id,kind:'uses_connection',confidence:evidence});const c=connections.get(id);
      if(!c){add('C010','unknown','Connection reference cannot be resolved',`Connection ${id} has no record.`,'Obtain the missing connection metadata.',`connectionIds:${id}`,'unknown');continue;}
      if(c.ownerId)edges.push({from:c.id,to:c.ownerId,kind:'authenticated_owner',confidence:sources.get(c.sourceId)?.type==='manual'?'administrator_supplied':'confirmed_in_export'});
      if(c.binding==='person')add('C011','medium','Person-bound connection','Authentication is recorded as bound to a person.','Reauthenticate or transfer with a supported identity, then test end to end.',`connection:${id}:binding`,evidence,ruleSources.microsoft);
      if(c.binding==='unknown')add('C012','unknown','Connection binding is unknown','The record does not establish personal versus organization-managed authentication.','Confirm the authentication owner and transfer behavior.',`connection:${id}:binding`,'unknown');
      if(c.ownerId&&unavailable(c.ownerId))add('C013','high','Connection owner is leaving or unavailable','A referenced connection depends on an unavailable principal.','Reauthenticate the connection and test a business transaction before revocation.',`connection:${id}:ownerId`,'inferred',ruleSources.microsoft);
      else if(!c.ownerId||!principals.has(c.ownerId)||principals.get(c.ownerId).status==='unknown')add('C014','unknown','Connection owner cannot be confirmed active','Authentication ownership or principal activity is not established.','Verify connection ownership and account activity.',`connection:${id}:ownerId`,'unknown');
      if(['error','expired'].includes(c.status))add('C015','high','Connection is not healthy',`Recorded connection status: ${c.status}.`,'Repair authentication in the source platform and validate the workflow.',`connection:${id}:status`,evidence);
      else if(c.status==='unknown')add('C016','unknown','Connection health is unknown','No current connection-health observation was supplied.','Check the connection in its native platform.',`connection:${id}:status`,'unknown');
      if(c.expiresAt){const days=(Date.parse(c.expiresAt)-cutoff)/86400000;if(days<=30)add('C017',days<=0?'high':'medium',days<=0?'Credential metadata indicates expiration':'Credential expiration is approaching',`Recorded expiry: ${c.expiresAt}; this is not a secret or token inspection.`,'Schedule supported renewal and re-test dependent workflows.',`connection:${id}:expiresAt`,evidence);}
    }
    for(const e of w.endpoints) {
      const transfer=e.transferChangesUrl===true||(w.platform==='zapier'&&['catch_hook','catch_raw_hook'].includes(e.kind));
      if(transfer)add('C018','high','Endpoint is transfer-sensitive','This endpoint is recorded as changing on transfer, or is a Zapier Catch Hook / Catch Raw Hook trigger. External caller coverage is not implied.','Record all external callers, update them during transfer, and test delivery plus business processing.',`endpoints:${e.id}`,'inferred',w.platform==='zapier'?ruleSources.zapier:null);
      else if(e.transferChangesUrl===null)add('C019','unknown','Endpoint transfer behavior is unknown','No verified transfer behavior was supplied.','Confirm endpoint stability and external callers before transfer.',`endpoints:${e.id}`,'unknown');
    }
    for(const id of w.dependsOnWorkflowIds){edges.push({from:w.id,to:id,kind:'depends_on_workflow',confidence:evidence});if(!workflows.has(id))add('C021','unknown','Upstream workflow record is missing',`Missing workflow ${id}.`,'Import the upstream workflow or document its independent handoff.',`upstream:${id}`,'unknown');}
    if(w.state==='unknown')add('C022','unknown','Workflow activation state is unknown','The input does not establish enabled versus disabled status.','Confirm whether this workflow is in service.','state','unknown');
    const relatedSources=new Set([w.sourceId,...w.ownerIds.map(id=>principals.get(id)?.sourceId),...w.connectionIds.flatMap(id=>{const c=connections.get(id);return [c?.sourceId,principals.get(c?.ownerId)?.sourceId];})].filter(Boolean));
    for(const sourceId of relatedSources){const source=sources.get(sourceId),age=(cutoff-Date.parse(source.collectedAt))/86400000;
      if(age>staleDays)add('C023','unknown','Source metadata is stale',`Source ${sourceId} is ${Math.floor(age)} days old; configured limit is ${staleDays}.`,'Obtain a fresh export before the handoff.',`source:${sourceId}:collectedAt`,'unknown');
      if(age < -1/24)add('C024','unknown','Source timestamp is in the future',`Source ${sourceId} is more than one hour later than the assessment time.`,'Correct the source/assessment timestamp.',`source:${sourceId}:collectedAt`,'unknown');
    }
    if(w.platform==='powerautomate'&&w.solutionAware!==true&&w.ownerIds.some(unavailable))add('C025','medium','Confirm Power Automate transfer procedure','Solution-aware status is false or unknown; in-place owner changes cannot be assumed.','Check the supported owner-change or export/import procedure for this flow.','solutionAware','inferred','https://learn.microsoft.com/en-us/power-automate/create-team-flows');
    results.push({workflowId:w.id,name:w.name,platform:w.platform,state:w.state,businessOwner:w.businessOwner,purpose:w.purpose,status:wf.some(f=>f.severity==='high')?'attention_required':wf.some(f=>f.severity==='unknown')?'unknown':wf.length?'incomplete':'documented',findingIds:wf.map(f=>f.id)});
  }
  // Breadth-first propagation over explicit edges; cycles cannot cause repeated transitions.
  const dependents=new Map(),byId=new Map(results.map(r=>[r.workflowId,r]));
  for(const w of inv.workflows)for(const upstream of w.dependsOnWorkflowIds){if(!dependents.has(upstream))dependents.set(upstream,[]);dependents.get(upstream).push(w.id);}
  const queue=results.filter(r=>r.status==='attention_required').map(r=>r.workflowId),seenEdges=new Set();
  for(let i=0;i<queue.length;i++){
    const upstream=queue[i];
    for(const id of dependents.get(upstream)??[]){const edge=canonical([id,upstream]);if(seenEdges.has(edge))continue;seenEdges.add(edge);const r=byId.get(id),w=workflows.get(id);
      const f={id:sha256(`${inv.organization.id}|${id}|C026|${upstream}`).slice(0,20),workflowId:id,code:'C026',severity:'high',title:'Upstream workflow needs attention',detail:`An explicitly linked upstream workflow (${upstream}) has attention-required findings.`,action:'Coordinate the upstream handoff and perform an end-to-end test.',confidence:'inferred',sourceId:w.sourceId,field:upstream,reference:null};
      findings.push(f);r.findingIds.push(f.id);if(r.status!=='attention_required'){r.status='attention_required';queue.push(id);}
    }
  }
  const counts={documented:0,incomplete:0,attention_required:0,unknown:0};for(const r of results)counts[r.status]++;
  const unused=inv.connections.filter(c=>!inv.workflows.some(w=>w.connectionIds.includes(c.id))).map(c=>c.id);
  return {kind:'continuity',version:VERSION,generatedAt:timestamp(asOf),organization:inv.organization,inputSha256:sha256(inv),scenario:{departing,staleDays},summary:{workflows:results.length,connections:inv.connections.length,principals:inv.principals.length,findings:findings.length,statuses:counts,completeConnectionCoverage:inv.workflows.filter(w=>w.coverage.connections==='complete').length},workflows:results,findings,edges:[...new Map(edges.map(e=>[canonical(e),e])).values()],unlinkedConnections:unused,inventory:inv,warnings:[...inv.warnings,...(!results.length?['No workflows were supplied. This empty assessment cannot establish coverage or continuity.']:[]),...(unused.length?['Unlinked connections are not classified as unused: missing relationship coverage may explain them.']:[])],limitations:['Read-only assessment of supplied metadata, not live discovery or a security certification.','Documented means required metadata passed these checks; it does not certify a transfer is safe.','Unknown/incomplete relationships are not inferred from shared names, CSV ordering, or app labels.','Source timestamps are operator/export timestamps, not independently trusted time.','Disabled workflows remain in scope because they may be re-enabled.','Connection expiry is assessed only when supplied; an absent expiry is not evidence of a non-expiring credential.']};
}
export function compareContinuity(before,after,options={}) {
  const a=analyzeContinuity(before,options),b=analyzeContinuity(after,options);assert(a.organization.id===b.organization.id,'Comparison must use the same organization');
  const left=new Map(a.findings.map(f=>[f.id,f])),right=new Map(b.findings.map(f=>[f.id,f]));
  return {kind:'continuity-diff',generatedAt:b.generatedAt,organization:b.organization,previousSha256:a.inputSha256,currentSha256:b.inputSha256,introduced:[...right.values()].filter(f=>!left.has(f.id)),noLongerObserved:[...left.values()].filter(f=>!right.has(f.id)),changed:[...right.values()].filter(f=>left.has(f.id)&&canonical(f)!==canonical(left.get(f.id))),warning:'No longer observed is not proof of remediation; coverage, scenario, and source records may have changed.'};
}
