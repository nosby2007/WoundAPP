// Executes the real service with an in-memory transaction adapter. No Firebase access.
const fs=require('fs'),vm=require('vm'),ts=require('typescript'),assert=require('assert');
let actor={uid:'np',orgId:'ORG',displayName:'Test NP',role:'np',roles:['np'],npi:'1234567890'};
let records={},writes=[];
const path=(db,...parts)=>parts.join('/');
const sdk={doc:path,collection:path,serverTimestamp:()=> 'SERVER_TIME',arrayUnion:(...entries)=>entries,
  runTransaction:async(db,fn)=>fn({get:async ref=>({data:()=>records[ref]}),update:(ref,data)=>writes.push({ref,data})})};
const exportsObject={};
const identity={requireCurrentIdentity:async()=>actor},audit={record:async()=>{}};
vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/app/services/assessments.service.ts','utf8'),
  {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,experimentalDecorators:true}}).outputText,
  {exports:exportsObject,require:n=> n==='@angular/core'?{Injectable:()=>target=>target,inject:token=>token?.name==='ClinicalIdentityService'?identity:token?.name==='ClinicalAuditService'?audit:{}}:
    n==='@angular/fire/firestore'?sdk:n.includes('clinical-identity')?{ClinicalIdentityService:class ClinicalIdentityService{}}:
    n.includes('clinical-audit')?{ClinicalAuditService:class ClinicalAuditService{}}:
    n.includes('field-role-policy')?{normalizeFieldRole:r=>String(r).trim().toLowerCase().replace(/[\s-]+/g,'_').replace(/^nurse_practitioner$/,'np')}:{},Date});
const service=new exportsObject.AssessmentsService();
const assessment='patients/p/woundAssessments/a',episode='patients/p/woundEpisodes/e';
async function blocked(fn){writes=[];await assert.rejects(fn);assert.equal(writes.length,0);}
(async()=>{
  records['patients/p']={orgId:'ORG'};
  records[assessment]={orgId:'ORG',patientId:'p',woundId:'w',episodeId:'e',locked:true,esign:{signed:true},measurements:{area:7}};
  await service.recordProviderReview('p','a','Reviewed findings','Concur',true);
  assert.deepEqual(Object.keys(writes[0].data).sort(),['providerReview','updatedAt']);
  assert.equal(writes[0].data.providerReview.reviewedByUid,'np');
  assert.equal(records[assessment].measurements.area,7);
  records[assessment].locked=false;
  await blocked(()=>service.recordProviderReview('p','a','Unsigned findings','Concur',true));
  records[assessment].locked=true;records[assessment].esign.signed=false;
  await blocked(()=>service.recordProviderReview('p','a','Missing signature','Concur',true));
  records[assessment].esign.signed=true;
  actor={...actor,role:'nurse practitioner',roles:['nurse_practitioner']};
  writes=[];await service.recordProviderReview('p','a','Alias review','Concur',true);assert.equal(writes.length,1);
  await blocked(()=>service.recordProviderReview('p','a','', 'Concur',true));
  records[assessment].providerReview={reviewed:true};
  await blocked(()=>service.recordProviderReview('p','a','Second','Concur',true));
  delete records[assessment].providerReview;
  actor={...actor,role:'nurse',roles:['nurse']};
  await blocked(()=>service.recordProviderReview('p','a','RN cannot review','Concur',true));
  await blocked(()=>service.acceptEpisodeResponsibility('p','a'));
  actor={...actor,role:'np',roles:['np']};
  records[episode]={orgId:'ORG',patientId:'p',woundId:'w',status:'active',providerOfRecordUid:null,billingProviderUid:'scheduled'};
  writes=[];await service.acceptEpisodeResponsibility('p','a');
  assert.equal(writes[0].data.providerOfRecordUid,'np');
  assert(!('billingProviderUid' in writes[0].data));
  assert.equal(writes[0].data.providerAssignmentHistory[0].changedByUid,'np');
  records[episode].providerOfRecordUid='other';await blocked(()=>service.acceptEpisodeResponsibility('p','a'));
  records[episode].providerOfRecordUid=null;records[episode].status='closed';await blocked(()=>service.acceptEpisodeResponsibility('p','a'));
  records[episode].status='active';records[episode].orgId='FOREIGN';await blocked(()=>service.acceptEpisodeResponsibility('p','a'));
  records[episode].orgId='ORG';actor={...actor,npi:'invalid'};await blocked(()=>service.acceptEpisodeResponsibility('p','a'));
  actor={...actor,npi:'1234567890'};records[assessment].patientId='different';await blocked(()=>service.recordProviderReview('p','a','Mismatch','Concur',true));
  records[assessment].patientId='p';
  delete records[assessment].orgId;records[assessment].authorIdentity={orgId:'ORG'};
  writes=[];await service.recordProviderReview('p','a','Legacy evidence','Concur',true);assert.equal(writes.length,1);
  records['patients/p'].orgId='FOREIGN';await blocked(()=>service.recordProviderReview('p','a','Foreign parent','Concur',true));
  records['patients/p'].orgId='ORG';
  records[assessment].orgId='FOREIGN';await blocked(()=>service.recordProviderReview('p','a','Foreign','Concur',true));
  console.log('PASS real provider review/assignment transactions: immutable RN evidence, actor, tenant, role, closed episode and no billing overwrite');
})().catch(e=>{console.error(e);process.exitCode=1});
