import { Injectable } from '@angular/core';
import { AngularFireAuth } from '@angular/fire/compat/auth';
import { AngularFirestore } from '@angular/fire/compat/firestore';
import firebase from 'firebase/compat/app';
import { Observable, of } from 'rxjs';
import { catchError } from 'rxjs/operators';

import { TenantService } from './tenant.service';
import { OrderExecution, SharedOrder } from '../models/shared-order.model';

@Injectable({ providedIn: 'root' })
export class SharedOrderService {
  constructor(
    private readonly afs: AngularFirestore,
    private readonly auth: AngularFireAuth,
    private readonly tenant: TenantService,
  ) {}

  listForPatient(patientId: string): Observable<SharedOrder[]> {
    if (!patientId) return of([]);
    return this.afs.collection<SharedOrder>(
      `patients/${patientId}/orders`,
      (ref) => ref.orderBy('orderedAt', 'desc'),
    ).valueChanges({ idField: 'id' }).pipe(
      catchError((error) => {
        console.error('Unable to load shared orders.', error);
        return of([]);
      }),
    );
  }

  async recordExecution(
    order: SharedOrder,
    completedStepIndexes: number[],
    stepLabels: string[],
    note: string | null,
  ): Promise<string> {
    if (!order.id || !order.patientId) {
      throw new Error('This order is missing its patient/order identifier.');
    }
    const orgId = await this.tenant.currentOrgId();
    const user = await this.auth.currentUser;
    if (!orgId || !user) {
      throw new Error('Missing authenticated organization context.');
    }

    const ref = this.afs
      .collection<OrderExecution>(`patients/${order.patientId}/orders/${order.id}/executions`)
      .doc();

    const now = firebase.firestore.FieldValue.serverTimestamp();
    const execution: OrderExecution = {
      orgId,
      patientId: order.patientId,
      orderId: order.id,
      status: 'completed',
      performedBy: {
        uid: user.uid,
        displayName: user.displayName || user.email || null,
      },
      completedStepIndexes,
      stepLabels,
      note: note || null,
      completedAt: now,
      createdAt: now,
    };

    await ref.set(execution);
    return ref.ref.id;
  }
}
