import { Injectable } from '@angular/core';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  runTransaction,
  serverTimestamp,
  Timestamp,
  where,
} from 'firebase/firestore';
import { Observable } from 'rxjs';
import { auth, db } from '../firebase';
import { TenantService } from './tenant.service';
import { ClinicalIdentityService, ClinicalIdentitySnapshot } from './clinical-identity.service';

export type MobileRoundStatus = 'scheduled' | 'in_progress' | 'completed' | 'cancelled';
export type MobileRoundPatientStatus = 'pending' | 'in_progress' | 'evaluated' | 'seen' | 'skipped';

export interface MobileFacility {
  id: string; orgId: string; name: string; type?: string;
  address1?: string | null; address2?: string | null; city?: string | null; state?: string | null; zip?: string | null;
  mainPhone?: string | null; active?: boolean;
}

export interface MobileRoundPatient {
  patientId: string; patientName: string; roomNumber?: string | null; unit?: string | null; status: MobileRoundPatientStatus;
  assessmentIds?: string[]; woundIds?: string[]; evaluationStartedAt?: any; evaluatedAt?: any; visitedAt?: any;
  qaStatus?: 'not_ready' | 'ready' | 'approved' | 'returned'; qaNote?: string | null; note?: string | null;
}

export interface MobileWoundRound {
  id: string; orgId: string; facilityId: string; facilityName: string; roundDate: string; status: MobileRoundStatus; patients: MobileRoundPatient[];
  summary?: string | null; qaStatus?: 'not_ready' | 'ready' | 'approved' | 'returned'; startedAt?: any; scheduledAt?: any; completedAt?: any; createdAt?: any;
  startedBy?: ClinicalIdentitySnapshot | null;
  completedBy?: ClinicalIdentitySnapshot | null;
}

@Injectable({ providedIn: 'root' })
export class WoundRoundMobileService {
  constructor(private tenant: TenantService, private clinicalIdentity: ClinicalIdentityService) {}

  facilities$(): Observable<MobileFacility[]> {
    return new Observable(subscriber => {
      let stop = () => {};
      this.tenant.currentOrgId().then(orgId => {
        if (!orgId) { subscriber.next([]); return; }
        const facilityCollection = collection(db, 'organizations', orgId, 'facilities');
        stop = onSnapshot(facilityCollection, snap => {
          subscriber.next(
            snap.docs
              .map(d => ({ id: d.id, orgId, ...d.data() } as MobileFacility))
              .filter(f => f.active !== false)
              .sort((a, b) => (a.name || '').localeCompare(b.name || ''))
          );
        }, err => subscriber.error(err));
      }).catch(err => subscriber.error(err));
      return () => stop();
    });
  }

  rounds$(): Observable<MobileWoundRound[]> {
    return new Observable(subscriber => {
      let stop = () => {};
      this.tenant.currentOrgId().then(orgId => {
        if (!orgId) { subscriber.next([]); return; }
        stop = onSnapshot(query(collection(db, 'woundRounds'), where('orgId', '==', orgId)), snap => {
          subscriber.next(snap.docs.map(d => ({ id:d.id, ...d.data() } as MobileWoundRound)).sort((a,b) => this.roundSort(b)-this.roundSort(a)));
        }, err => subscriber.error(err));
      }).catch(err => subscriber.error(err));
      return () => stop();
    });
  }

  round$(roundId: string): Observable<MobileWoundRound | null> {
    return new Observable(subscriber => {
      const stop = onSnapshot(doc(db, 'woundRounds', roundId), snap => subscriber.next(snap.exists() ? ({ id:snap.id, ...snap.data() } as MobileWoundRound) : null), err => subscriber.error(err));
      return () => stop();
    });
  }

  async canAuthor(): Promise<boolean> {
    const user = auth.currentUser; if (!user) return false;
    const token = await user.getIdTokenResult();
    const roles = [token.claims['role'], ...(Array.isArray(token.claims['roles']) ? token.claims['roles'] as unknown[] : [])].map(v => String(v || '').toLowerCase());
    return roles.some(role => ['admin','org_admin','clinical_admin','provider','np','nurse','rn','wound_nurse_internal'].includes(role));
  }

  async startRound(facility: MobileFacility, roundDate: string): Promise<string> {
    if (!(await this.canAuthor())) throw new Error('Your role cannot start a wound round');
    const user = auth.currentUser; const orgId = await this.tenant.currentOrgId();
    if (!user || !orgId) throw new Error('Sign in required');
    if (!facility?.id || facility.orgId !== orgId) throw new Error('Choose a facility in your organization');
    const identity = await this.clinicalIdentity.requireCurrentIdentity();
    const patients = await this.buildRoster(orgId, facility.id);
    const ref = doc(collection(db, 'woundRounds'));
    await runTransaction(db, async tx => tx.set(ref, {
      orgId, facilityId:facility.id, facilityName:facility.name, roundDate, status:'in_progress', patients, summary:null, qaStatus:'not_ready', reportVersion:1,
      startedAt:serverTimestamp(), startedBy:identity,
      createdAt:serverTimestamp(), updatedAt:serverTimestamp(),
    }));
    return ref.id;
  }

  async startScheduled(roundId: string): Promise<void> {
    if (!(await this.canAuthor())) throw new Error('Your role cannot start a wound round');
    const user = auth.currentUser; const orgId = await this.tenant.currentOrgId();
    if (!user || !orgId) throw new Error('Sign in required');
    const identity = await this.clinicalIdentity.requireCurrentIdentity();
    const ref = doc(db, 'woundRounds', roundId); const snap = await getDoc(ref);
    if (!snap.exists()) throw new Error('Round not found');
    const round = snap.data() as any;
    if (round.orgId !== orgId || round.status !== 'scheduled') throw new Error('This round cannot be started');
    const patients = await this.buildRoster(orgId, round.facilityId);
    await runTransaction(db, async tx => {
      const current = await tx.get(ref);
      if (!current.exists() || (current.data() as any).status !== 'scheduled') throw new Error('Round already started');
      tx.update(ref, { status:'in_progress', patients, startedAt:serverTimestamp(), startedBy:identity, updatedAt:serverTimestamp() });
    });
  }

  async markPatient(roundId: string, patientId: string, status: MobileRoundPatientStatus, note?: string): Promise<void> {
    if (!(await this.canAuthor())) throw new Error('Your role cannot update wound rounds');
    const ref = doc(db, 'woundRounds', roundId);
    let discovered: { assessmentId:string; woundId?:string|null } | null = null;
    if (status === 'evaluated' || status === 'seen') {
      const before = await getDoc(ref);
      if (!before.exists()) throw new Error('Round not found');
      const entry = ((before.data() as any).patients || []).find((p:MobileRoundPatient) => p.patientId === patientId) as MobileRoundPatient | undefined;
      if (entry && !(entry.assessmentIds || []).length) discovered = await this.latestRoundAssessment(patientId, entry.evaluationStartedAt);
    }
    await runTransaction(db, async tx => {
      const snap = await tx.get(ref); if (!snap.exists()) throw new Error('Round not found');
      const round = snap.data() as any; const now = Timestamp.now(); let found = false;
      const patients = (round.patients || []).map((entry: MobileRoundPatient) => {
        if (entry.patientId !== patientId) return entry; found = true;
        let assessmentIds = entry.assessmentIds || []; let woundIds = entry.woundIds || [];
        if (!assessmentIds.length && discovered) {
          assessmentIds = [discovered.assessmentId];
          if (discovered.woundId) woundIds = Array.from(new Set([...woundIds, discovered.woundId]));
        }
        if ((status === 'evaluated' || status === 'seen') && !assessmentIds.length) throw new Error('Complete a wound assessment for this round before closing the patient');
        return { ...entry, status, assessmentIds, woundIds, note:note ?? entry.note ?? null,
          visitedAt:status === 'pending' ? null : (entry.visitedAt || now),
          evaluationStartedAt:status === 'in_progress' ? (entry.evaluationStartedAt || now) : (entry.evaluationStartedAt || null),
          evaluatedAt:status === 'evaluated' || status === 'seen' ? now : (entry.evaluatedAt || null),
          qaStatus:status === 'evaluated' || status === 'seen' ? 'ready' : 'not_ready' };
      });
      if (!found) throw new Error('Patient is not in this round');
      tx.update(ref, { patients, status:'in_progress', qaStatus:'not_ready', updatedAt:serverTimestamp() });
    });
  }

  async linkAssessment(roundId:string, patientId:string, assessmentId:string, woundId?:string|null):Promise<void>{
    if(!roundId||!patientId||!assessmentId)return; const ref=doc(db,'woundRounds',roundId);
    await runTransaction(db,async tx=>{const snap=await tx.get(ref);if(!snap.exists())throw new Error('Round not found');const round=snap.data() as any;let found=false;const now=Timestamp.now();const patients=(round.patients||[]).map((entry:MobileRoundPatient)=>{if(entry.patientId!==patientId)return entry;found=true;return{...entry,status:'in_progress',assessmentIds:Array.from(new Set([...(entry.assessmentIds||[]),assessmentId])),woundIds:woundId?Array.from(new Set([...(entry.woundIds||[]),woundId])):(entry.woundIds||[]),evaluationStartedAt:entry.evaluationStartedAt||now,visitedAt:entry.visitedAt||now,qaStatus:'not_ready'};});if(!found)throw new Error('Patient is not in this round');tx.update(ref,{patients,status:'in_progress',qaStatus:'not_ready',updatedAt:serverTimestamp()});});
  }

  async completeRound(roundId:string):Promise<void>{
    if(!(await this.canAuthor()))throw new Error('Your role cannot complete wound rounds');
    const user=auth.currentUser;if(!user)throw new Error('Sign in required');
    const identity=await this.clinicalIdentity.requireCurrentIdentity();
    const ref=doc(db,'woundRounds',roundId);
    await runTransaction(db,async tx=>{const snap=await tx.get(ref);if(!snap.exists())throw new Error('Round not found');const round=snap.data() as any;const ready=(round.patients||[]).every((p:MobileRoundPatient)=>['evaluated','seen','skipped'].includes(p.status));if(!ready)throw new Error('Resolve every patient before completing the round');tx.update(ref,{status:'completed',qaStatus:'ready',completedAt:serverTimestamp(),completedBy:identity,updatedAt:serverTimestamp()});});
  }

  private async buildRoster(orgId:string,facilityId:string):Promise<MobileRoundPatient[]>{
    const snap=await getDocs(query(collection(db,'patients'),where('orgId','==',orgId)));
    return snap.docs.map(d=>({id:d.id,...d.data()} as any)).filter(p=>p.facilityId===facilityId&&(!p.patientStatus||p.patientStatus==='active')).map(p=>({patientId:p.id,patientName:p.preferredName||p.name||'Patient',roomNumber:p.roomNumber??p.room??null,unit:p.unit??null,status:'pending' as const,assessmentIds:[],woundIds:[],evaluationStartedAt:null,evaluatedAt:null,visitedAt:null,qaStatus:'not_ready' as const,note:null})).sort((a,b)=>(a.roomNumber||'').localeCompare(b.roomNumber||'')||a.patientName.localeCompare(b.patientName));
  }

  private async latestRoundAssessment(patientId:string, startedAt:any):Promise<{assessmentId:string;woundId?:string|null}|null>{
    const user=auth.currentUser;if(!user)return null;const snap=await getDocs(collection(db,'patients',patientId,'assessments'));const started=this.toMillis(startedAt);
    const candidates=snap.docs.map(d=>({id:d.id,...d.data()} as any)).filter(a=>{const owner=a.createdByUid||a.createdBy;const at=this.toMillis(a.assessedAt||a.createdAt);return(!owner||owner===user.uid)&&(!started||!at||at>=started);}).sort((a,b)=>this.toMillis(b.assessedAt||b.createdAt)-this.toMillis(a.assessedAt||a.createdAt));
    const latest=candidates[0];return latest?{assessmentId:latest.id,woundId:latest.woundId??latest.id}:null;
  }

  private toMillis(value:any):number{if(!value)return 0;if(typeof value.toMillis==='function')return value.toMillis();if(typeof value.toDate==='function')return value.toDate().getTime();const d=value instanceof Date?value:new Date(value);return Number.isNaN(d.getTime())?0:d.getTime();}
  private roundSort(round:MobileWoundRound):number{const value=round.startedAt||round.scheduledAt||round.createdAt;const t=this.toMillis(value);if(t)return t;const date=Date.parse(round.roundDate||'');return Number.isFinite(date)?date:0;}
}
