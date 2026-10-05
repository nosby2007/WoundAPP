import { Injectable } from '@angular/core';
import { collection, doc, limit, onSnapshot, orderBy, query, serverTimestamp, setDoc, where } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { Observable } from 'rxjs';
import { auth, db, functions } from '../firebase';
import { TenantService } from './tenant.service';

export interface StaffEntry { uid: string; displayName: string; role: string; }
export interface Conversation { id: string; members: string[]; memberNames?: Record<string,string>; unread?: Record<string,number>; updatedAt?: any; lastAt?: any; lastText?: string; otherUid: string; otherName: string; myUnread: number; }
export interface ChatMessage { id: string; fromUid: string; fromName: string; text: string; createdAt?: any; }

@Injectable({ providedIn: 'root' })
export class SecureChatService {
  constructor(private tenant: TenantService) {}

  staff$(): Observable<StaffEntry[]> {
    return new Observable(sub => {
      const me = auth.currentUser?.uid;
      let stop = () => {};
      this.tenant.currentOrgId().then(orgId => {
        if (!orgId) { sub.next([]); return; }
        const q = query(collection(db, 'staffPublic'), where('orgId','==',orgId), where('status','==','active'), orderBy('displayName','asc'));
        stop = onSnapshot(q, snap => sub.next(snap.docs.map(d => ({ uid:d.id, displayName:String((d.data() as any).displayName || 'Staff'), role:String((d.data() as any).role || '') })).filter(x => x.uid !== me)), err => { console.warn('[Chat] staff unavailable', err); sub.next([]); });
      });
      return () => stop();
    });
  }

  conversations$(): Observable<Conversation[]> {
    return new Observable(sub => {
      const uid = auth.currentUser?.uid; if (!uid) { sub.next([]); return; }
      const q = query(collection(db, 'conversations'), where('members','array-contains',uid));
      const stop = onSnapshot(q, snap => {
        const rows = snap.docs.map(d => { const data:any = d.data(); const otherUid = (data.members || []).find((x:string) => x !== uid) || ''; return { id:d.id, ...data, otherUid, otherName:data.memberNames?.[otherUid] || 'Staff', myUnread:Number(data.unread?.[uid] || 0) } as Conversation; });
        rows.sort((a,b) => this.time(b.updatedAt || b.lastAt) - this.time(a.updatedAt || a.lastAt)); sub.next(rows);
      }, err => { console.warn('[Chat] conversations unavailable', err); sub.next([]); });
      return () => stop();
    });
  }

  messages$(conversationId: string): Observable<ChatMessage[]> {
    return new Observable(sub => {
      if (!conversationId) { sub.next([]); return; }
      const q = query(collection(db, 'conversations', conversationId, 'messages'), orderBy('createdAt','desc'), limit(75));
      const stop = onSnapshot(q, snap => sub.next(snap.docs.map(d => ({ id:d.id, ...d.data() } as ChatMessage)).reverse()), err => { console.warn('[Chat] messages unavailable', err); sub.next([]); });
      return () => stop();
    });
  }

  async start(other: StaffEntry): Promise<string> {
    const call = httpsCallable<any, any>(functions, 'ensureConversationV1');
    const result = await call({ otherUid: other.uid, otherName: other.displayName, myName: auth.currentUser?.displayName || auth.currentUser?.email || 'Staff' });
    return result.data?.convId || '';
  }

  async send(otherUid: string, otherName: string, text: string): Promise<string> {
    const clean = text.trim(); if (!clean) throw new Error('Message is empty');
    const call = httpsCallable<any, any>(functions, 'sendChatMessageV1');
    const result = await call({ otherUid, otherName, text: clean, myName: auth.currentUser?.displayName || auth.currentUser?.email || 'Staff' });
    return result.data?.convId || '';
  }

  async markRead(conversationId: string): Promise<void> {
    const uid = auth.currentUser?.uid; if (!uid) return;
    await setDoc(doc(db, 'conversations', conversationId), { unread: { [uid]: 0 }, lastReadAt: { [uid]: serverTimestamp() }, updatedAt: serverTimestamp() }, { merge: true });
  }

  private time(value:any):number { const d = value?.toDate ? value.toDate() : value ? new Date(value) : null; return d?.getTime?.() || 0; }
}
