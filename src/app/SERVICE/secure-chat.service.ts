import { Injectable } from '@angular/core';
import { AngularFireAuth } from '@angular/fire/compat/auth';
import { AngularFirestore } from '@angular/fire/compat/firestore';
import { AngularFireFunctions } from '@angular/fire/compat/functions';
import firebase from 'firebase/compat/app';
import { Observable, combineLatest, of } from 'rxjs';
import { catchError, map, shareReplay, switchMap, take } from 'rxjs/operators';

import { TenantService } from './tenant.service';

export interface MobileStaffDirectoryEntry {
  uid: string;
  displayName: string;
  role: string;
}

export interface MobileConversation {
  id: string;
  orgId?: string | null;
  members: string[];
  memberNames?: Record<string, string>;
  unread?: Record<string, number>;
  lastText?: string;
  lastFromUid?: string;
  lastAt?: any;
  updatedAt?: any;
  otherUid: string;
  otherName: string;
  myUnread: number;
}

export interface MobileChatMessage {
  id: string;
  orgId?: string | null;
  fromUid: string;
  fromName: string;
  text: string;
  createdAt?: any;
}

@Injectable({ providedIn: 'root' })
export class SecureChatService {
  readonly meUid$: Observable<string | null>;
  readonly staff$: Observable<MobileStaffDirectoryEntry[]>;
  readonly conversations$: Observable<MobileConversation[]>;

  constructor(
    private afs: AngularFirestore,
    private auth: AngularFireAuth,
    private functions: AngularFireFunctions,
    private tenant: TenantService,
  ) {
    this.meUid$ = this.auth.authState.pipe(
      map(user => user?.uid || null),
      shareReplay({ bufferSize: 1, refCount: true }),
    );

    this.staff$ = combineLatest([this.meUid$, this.tenant.orgId$]).pipe(
      switchMap(([uid, orgId]) => {
        if (!uid || !orgId) return of([] as MobileStaffDirectoryEntry[]);
        return this.afs.collection<any>('staffPublic', ref =>
          ref.where('orgId', '==', orgId)
            .where('status', '==', 'active')
            .orderBy('displayName', 'asc')
        ).snapshotChanges().pipe(
          map(snaps => snaps
            .map(s => ({
              uid: s.payload.doc.id,
              displayName: String((s.payload.doc.data() as any)?.displayName || 'Staff'),
              role: String((s.payload.doc.data() as any)?.role || ''),
            }))
            .filter(entry => entry.uid !== uid)),
          catchError(error => {
            console.warn('[Chat] staff directory unavailable.', error);
            return of([] as MobileStaffDirectoryEntry[]);
          }),
        );
      }),
      shareReplay({ bufferSize: 1, refCount: true }),
    );

    this.conversations$ = this.meUid$.pipe(
      switchMap(uid => {
        if (!uid) return of([] as MobileConversation[]);
        return this.afs.collection<any>('conversations', ref =>
          ref.where('members', 'array-contains', uid)
        ).snapshotChanges().pipe(
          map(snaps => snaps.map(s => {
            const data = s.payload.doc.data() as any;
            const members = Array.isArray(data.members) ? data.members : [];
            const otherUid = members.find((member: string) => member !== uid) || '';
            return {
              id: s.payload.doc.id,
              ...data,
              otherUid,
              otherName: data.memberNames?.[otherUid] || 'Staff',
              myUnread: Number(data.unread?.[uid] || 0),
            } as MobileConversation;
          }).sort((a, b) => this.timeValue(b.updatedAt || b.lastAt) - this.timeValue(a.updatedAt || a.lastAt))),
          catchError(error => {
            console.warn('[Chat] conversation list unavailable.', error);
            return of([] as MobileConversation[]);
          }),
        );
      }),
      shareReplay({ bufferSize: 1, refCount: true }),
    );
  }

  messages$(conversationId: string): Observable<MobileChatMessage[]> {
    if (!conversationId) return of([]);
    return this.afs.collection<any>(`conversations/${conversationId}/messages`, ref =>
      ref.orderBy('createdAt', 'desc').limit(75)
    ).snapshotChanges().pipe(
      map(snaps => snaps.map(s => ({ id: s.payload.doc.id, ...(s.payload.doc.data() as any) } as MobileChatMessage)).reverse()),
      catchError(error => {
        console.warn('[Chat] message stream unavailable.', error);
        return of([] as MobileChatMessage[]);
      }),
    );
  }

  async startConversation(other: MobileStaffDirectoryEntry): Promise<string> {
    const callable = this.functions.httpsCallable('ensureConversationV1');
    const response: any = await callable({
      otherUid: other.uid,
      otherName: other.displayName,
      myName: await this.myDisplayName(),
    }).toPromise();
    return response?.convId || '';
  }

  async send(otherUid: string, otherName: string, text: string): Promise<string> {
    const clean = String(text || '').trim();
    if (!clean) throw new Error('Message is empty.');
    const callable = this.functions.httpsCallable('sendChatMessageV1');
    const response: any = await callable({
      otherUid,
      otherName,
      myName: await this.myDisplayName(),
      text: clean,
    }).toPromise();
    return response?.convId || '';
  }

  async markRead(conversationId: string): Promise<void> {
    const user = await this.auth.currentUser;
    if (!user || !conversationId) return;
    await this.afs.doc(`conversations/${conversationId}`).set({
      [`unread.${user.uid}`]: 0,
      [`lastReadAt.${user.uid}`]: firebase.firestore.FieldValue.serverTimestamp(),
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });
  }

  toDate(value: any): Date | null {
    if (!value) return null;
    if (typeof value.toDate === 'function') return value.toDate();
    if (typeof value.seconds === 'number') return new Date(value.seconds * 1000);
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  private timeValue(value: any): number {
    return this.toDate(value)?.getTime() || 0;
  }

  private async myDisplayName(): Promise<string> {
    const user = await this.auth.currentUser;
    if (!user) return 'Staff';
    if (user.displayName) return user.displayName;
    const doc = await this.afs.doc<any>(`staffPublic/${user.uid}`).valueChanges().pipe(
      take(1),
      catchError(() => of(null)),
    ).toPromise();
    return String(doc?.displayName || user.email || 'Staff');
  }
}
