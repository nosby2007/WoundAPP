import { Injectable, inject } from '@angular/core';
import { collection, doc, getDocs, query, where, runTransaction, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { ClinicalIdentityService } from './clinical-identity.service';
import { normalizeFieldRole } from './field-role-policy.service';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../firebase';
import { environment } from '../../environments/environment';

export type ContextKind='diagnostic'|'allergy'|'medicalHistory';
@Injectable({providedIn:'root'})
export class PatientClinicalContextService {
  private identity=inject(ClinicalIdentityService);
  async testInsta():Promise<any>{
    if(environment.firebase.projectId!=='jade-dev-5b0e3')throw Error('Insta synthetic test is DEV only.');
    return (await httpsCallable(functions,'instaIntakeSyntheticV1')({fixtureId:'synthetic-referral-v1'})).data;
  }
  async overview(patientId:string):Promise<{referrals:any[];tasks:any[]}>{
    const actor=await this.identity.requireCurrentIdentity();
    const read=async(path:string)=>(await getDocs(query(collection(db,path),where('orgId','==',actor.orgId),where('patientId','==',patientId)))).docs.map(row=>({...row.data(),id:row.id} as any));
    const [referrals,tasks]=await Promise.all([read('referrals'),read('tasks')]);
    return {referrals,tasks:tasks.filter(t=>t.status!=='done' && t.status!=='cancelled')};
  }
  async list(patientId:string,kind:ContextKind):Promise<any[]> {
    return (await getDocs(collection(db,`patients/${patientId}/${kind}`))).docs.map(d=>({...d.data(),id:d.id}));
  }
  async save(patientId:string,kind:ContextKind,input:any,id?:string):Promise<void> {
    if(!['diagnostic','allergy','medicalHistory'].includes(kind))throw Error('Invalid clinical section.');
    if(!['active','resolved','entered_in_error'].includes(input.status || 'active'))throw Error('Invalid clinical status.');
    const actor=await this.identity.requireCurrentIdentity();
    const roles=[actor.role,...actor.roles].map(normalizeFieldRole);
    if(!roles.some(r=>['nurse','rn','registered_nurse','lpn','np','provider','md','do','physician','org_admin','admin','clinical_admin','super_admin'].includes(r)))throw Error('Clinical authorization required.');
    if(!input.description?.trim() || !input.sourceReference?.trim() || !['staff','referral','patient_report'].includes(input.sourceType))throw Error('Description and supporting source are required.');
    const code=String(input.code || '').trim().toUpperCase();
    if(kind==='diagnostic' && !/^[A-Z][0-9][A-Z0-9](?:\.[A-Z0-9]{1,4})?$/.test(code))throw Error('Enter the documented ICD-10-CM code.');
    const rating=input.symptomControl==null || input.symptomControl==='' ? null:Number(input.symptomControl);
    if(rating!=null && (!Number.isInteger(rating) || rating<0 || rating>4 || /^[VWXYZ]/.test(code)))throw Error('Symptom control is 0–4, and not applicable to V/W/X/Y/Z codes.');
    const ref=id ? doc(db,`patients/${patientId}/${kind}/${id}`):doc(collection(db,`patients/${patientId}/${kind}`));
    // Use JADE's canonical audit collection and actor-bound contract.
    const auditRef=doc(collection(db,'clinicalAuditEvents'));
    await runTransaction(db,async tx=>{
      const patient=(await tx.get(doc(db,`patients/${patientId}`))).data();
      const existing=id ? (await tx.get(ref)).data():null;
      if(!patient || (patient['orgId'] || patient['orgID'])!==actor.orgId || patient['status']==='discharged')throw Error('Patient is not writable in your organization.');
      if(id && (!existing || (existing['orgId'] && existing['orgId']!==actor.orgId)))throw Error('Clinical fact unavailable.');
      if(existing?.['reviewStatus']==='approved' && !roles.some(r=>['np','provider','md','do','physician','org_admin','admin','clinical_admin','super_admin'].includes(r)))throw Error('Provider approval must be revised by a provider.');
      const data={description:input.description.trim(),code:kind==='diagnostic'?code:'',onsetType:input.onsetType || 'unknown',onsetDate:input.onsetDate || null,symptomControl:rating,
        reaction:input.reaction || null,severity:input.severity || null,sourceType:input.sourceType,sourceReference:input.sourceReference.trim(),status:input.status || 'active',reviewStatus:'needs_review',
        reviewedByUid:null,reviewedByName:null,reviewedAt:null,
        patientId,orgId:actor.orgId,updatedAt:serverTimestamp(),updatedByUid:actor.uid,updatedByName:actor.displayName,
        ...(!id?{createdAt:serverTimestamp(),createdByUid:actor.uid,createdByName:actor.displayName}:{})};
      tx.set(ref,data,{merge:true});
      tx.set(auditRef,{orgId:actor.orgId,patientId,documentId:ref.id,actorUid:actor.uid,actorName:actor.displayName,actorRole:actor.role,action:'patient.reconciled',occurredAt:serverTimestamp(),source:'ui',summary:`${kind} recorded from WoundAPP.`,metadata:{kind,previous:existing || null,revision:data}});
    });
  }
}
