import { Injectable, signal } from '@angular/core';
import { doc, getDoc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';

export type DurableMutationStatus =
  | 'waiting_for_network'
  | 'syncing'
  | 'synced'
  | 'failed'
  | 'needs_review';

export interface FirestoreServerTimestampMarker {
  __firestoreServerTimestamp: true;
}

export type DurableJson =
  | null
  | boolean
  | number
  | string
  | FirestoreServerTimestampMarker
  | DurableJson[]
  | { [key: string]: DurableJson };

export interface DurableMutationConflictPolicy {
  /**
   * Dot-paths that must still be absent when replay happens.
   * EVV uses this to prevent a queued arrival/departure from overwriting
   * evidence that another device already recorded.
   */
  expectedAbsentFields?: string[];
  /** Optional optimistic concurrency check against the server updatedAt. */
  baseUpdatedAtMs?: number | null;
}

export interface DurableClinicalMutation {
  id: string;
  operation: string;
  firestorePath: string;
  patientId?: string | null;
  entityType: string;
  entityId?: string | null;
  payload: Record<string, DurableJson>;
  conflict?: DurableMutationConflictPolicy;
  queuedAt: number;
}

export interface DurableMutationView {
  id: string;
  operation: string;
  entityType: string;
  entityId?: string | null;
  patientId?: string | null;
  status: DurableMutationStatus;
  queuedAt: number;
  attempts: number;
  lastAttemptAt?: number | null;
  syncedAt?: number | null;
  error?: string | null;
}

interface StoredMutationEnvelope {
  id: string;
  status: DurableMutationStatus;
  queuedAt: number;
  attempts: number;
  lastAttemptAt?: number | null;
  syncedAt?: number | null;
  error?: string | null;
  iv: ArrayBuffer;
  ciphertext: ArrayBuffer;
}

export interface DurableMutationResult {
  id: string;
  status: 'synced' | 'queued' | 'needs_review';
}

export class ClinicalMutationConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ClinicalMutationConflictError';
  }
}

/**
 * Durable encrypted queue for critical clinical Firestore updates.
 *
 * - Payloads are AES-GCM encrypted before IndexedDB persistence.
 * - The AES key is generated as a non-exportable CryptoKey.
 * - No raw key, PHI payload, or plaintext mutation is written to
 *   localStorage/sessionStorage.
 * - Conflict-sensitive fields can declare expectedAbsentFields so replay
 *   never silently overwrites newer EVV/clinical evidence.
 *
 * This is a device/browser-profile at-rest protection boundary. It is not
 * represented as hardware-backed Keychain/Keystore encryption; a native
 * secure-storage adapter can replace the key store later without changing
 * the mutation contract.
 */
@Injectable({ providedIn: 'root' })
export class DurableClinicalMutationService {
  readonly items = signal<DurableMutationView[]>([]);

  private readonly dbName = 'woundapp-clinical-mutations-v1';
  private readonly mutationStore = 'mutations';
  private readonly keyStore = 'keys';
  private readonly keyId = 'clinical-aes-gcm-v1';
  private initPromise: Promise<void> | null = null;
  private flushing = false;

  constructor() {
    if (typeof window !== 'undefined' && typeof indexedDB !== 'undefined') {
      this.initPromise = this.restore();
      window.addEventListener('online', () => void this.flush());
    }
  }

  static serverTimestamp(): FirestoreServerTimestampMarker {
    return { __firestoreServerTimestamp: true };
  }

  /**
   * Persist a critical mutation locally and return as soon as the encrypted
   * envelope is durable. Network delivery continues in the background.
   *
   * Use this for point-of-care exit actions such as EVV checkout: a weak
   * connection must never keep the clinician trapped on the visit screen.
   */
  async queueUpdate(input: Omit<DurableClinicalMutation, 'id' | 'queuedAt'>): Promise<DurableMutationResult> {
    await this.ready();
    const mutation: DurableClinicalMutation = {
      ...input,
      id: this.id(),
      queuedAt: Date.now(),
    };
    const envelope = await this.encryptEnvelope(mutation);
    await this.putEnvelope(envelope);
    await this.reloadViews();

    // Fire-and-forget delivery. The encrypted local envelope is already the
    // durable source for retry, and conflict rules still protect replay.
    if (this.isOnline()) {
      void this.flush();
    }
    return { id: mutation.id, status: 'queued' };
  }

  async enqueueUpdate(input: Omit<DurableClinicalMutation, 'id' | 'queuedAt'>): Promise<DurableMutationResult> {
    await this.ready();
    const mutation: DurableClinicalMutation = {
      ...input,
      id: this.id(),
      queuedAt: Date.now(),
    };
    const envelope = await this.encryptEnvelope(mutation);
    await this.putEnvelope(envelope);
    await this.reloadViews();

    if (!this.isOnline()) {
      return { id: mutation.id, status: 'queued' };
    }

    return this.execute(mutation.id);
  }

  async flush(): Promise<void> {
    await this.ready();
    if (!this.isOnline() || this.flushing) return;
    this.flushing = true;
    try {
      const envelopes = (await this.getAllEnvelopes())
        .sort((a, b) => a.queuedAt - b.queuedAt);
      for (const envelope of envelopes) {
        if (envelope.status === 'waiting_for_network' || envelope.status === 'failed') {
          await this.execute(envelope.id).catch(() => undefined);
        }
      }
    } finally {
      this.flushing = false;
    }
  }

  async retry(id: string): Promise<DurableMutationResult> {
    if (!this.isOnline()) return { id, status: 'queued' };
    return this.execute(id);
  }

  async whenReady(): Promise<void> {
    await this.ready();
  }

  hasPending(operation: string, entityId?: string | null): boolean {
    return this.items().some((item) =>
      item.operation === operation &&
      (entityId == null || item.entityId === entityId) &&
      (item.status === 'waiting_for_network' || item.status === 'syncing')
    );
  }

  async discard(id: string): Promise<void> {
    await this.deleteEnvelope(id);
    await this.reloadViews();
  }

  pendingCount(): number {
    return this.items().filter((item) =>
      item.status === 'waiting_for_network' || item.status === 'syncing'
    ).length;
  }

  conflictCount(): number {
    return this.items().filter((item) => item.status === 'needs_review').length;
  }

  private async execute(id: string): Promise<DurableMutationResult> {
    const envelope = await this.getEnvelope(id);
    if (!envelope) throw new Error('Queued clinical mutation no longer exists.');

    const mutation = await this.decryptEnvelope(envelope);

    const blocker = await this.earlierMutationBlocker(mutation);
    if (blocker) {
      const blockedByReview = blocker.status === 'failed' || blocker.status === 'needs_review';
      await this.patchEnvelope(envelope, {
        status: blockedByReview ? 'needs_review' : 'waiting_for_network',
        error: blockedByReview
          ? 'An earlier clinical write on this same record needs review before this write can replay.'
          : null,
      });
      await this.reloadViews();
      return { id, status: blockedByReview ? 'needs_review' : 'queued' };
    }

    if (!this.isOnline()) {
      await this.patchEnvelope(envelope, { status: 'waiting_for_network' });
      await this.reloadViews();
      return { id, status: 'queued' };
    }

    const attempts = envelope.attempts + 1;
    const lastAttemptAt = Date.now();
    await this.patchEnvelope(envelope, {
      status: 'syncing',
      attempts,
      lastAttemptAt,
      error: null,
    });
    await this.reloadViews();

    try {
      const ref = doc(db, mutation.firestorePath);
      const current = await getDoc(ref);
      if (!current.exists()) {
        throw new ClinicalMutationConflictError('The server record no longer exists. Review before replaying this clinical write.');
      }

      const data = current.data() as Record<string, unknown>;
      const conflict = this.detectConflict(data, mutation.conflict);
      if (conflict) {
        await this.patchEnvelope(await this.requireEnvelope(id), {
          status: 'needs_review',
          error: conflict,
        });
        await this.reloadViews();
        return { id, status: 'needs_review' };
      }

      await updateDoc(ref, this.materializePayload(mutation.payload));
      // Once the server accepted the mutation, remove the encrypted payload
      // from the device. Server/audit evidence is the durable record; keeping
      // synced PHI in the local queue would add exposure with no retry value.
      await this.deleteEnvelope(id);
      await this.reloadViews();
      return { id, status: 'synced' };
    } catch (error: any) {
      if (error instanceof ClinicalMutationConflictError) {
        await this.patchEnvelope(await this.requireEnvelope(id), {
          status: 'needs_review',
          error: error.message,
        });
        await this.reloadViews();
        return { id, status: 'needs_review' };
      }

      const networkLost = !this.isOnline();
      await this.patchEnvelope(await this.requireEnvelope(id), {
        status: networkLost ? 'waiting_for_network' : 'failed',
        error: networkLost ? null : (error?.message || 'Clinical sync failed'),
      });
      await this.reloadViews();
      if (networkLost) return { id, status: 'queued' };
      throw error;
    }
  }

  private async earlierMutationBlocker(
    mutation: DurableClinicalMutation
  ): Promise<StoredMutationEnvelope | null> {
    const envelopes = (await this.getAllEnvelopes())
      .filter((candidate) =>
        candidate.id !== mutation.id &&
        candidate.queuedAt < mutation.queuedAt &&
        candidate.status !== 'synced'
      )
      .sort((a, b) => a.queuedAt - b.queuedAt);

    for (const envelope of envelopes) {
      try {
        const earlier = await this.decryptEnvelope(envelope);
        if (earlier.firestorePath === mutation.firestorePath) {
          return envelope;
        }
      } catch {
        // A previous undecryptable write on this document is a review
        // boundary, not permission to skip ahead.
        return envelope;
      }
    }
    return null;
  }

  private detectConflict(
    server: Record<string, unknown>,
    policy?: DurableMutationConflictPolicy
  ): string | null {
    if (!policy) return null;

    for (const field of policy.expectedAbsentFields ?? []) {
      const value = this.readDotPath(server, field);
      if (value !== undefined && value !== null) {
        return `Server field "${field}" was already recorded by another write. Review required; queued evidence was not applied.`;
      }
    }

    if (policy.baseUpdatedAtMs != null) {
      const serverUpdated = this.toMillis(server['updatedAt']);
      if (serverUpdated != null && serverUpdated > policy.baseUpdatedAtMs) {
        return 'The server record changed after this offline edit started. Review required before applying it.';
      }
    }

    return null;
  }

  private materializePayload(payload: Record<string, DurableJson>): Record<string, unknown> {
    const convert = (value: DurableJson): unknown => {
      if (Array.isArray(value)) return value.map((entry) => convert(entry));
      if (value && typeof value === 'object') {
        if ((value as FirestoreServerTimestampMarker).__firestoreServerTimestamp === true) {
          return serverTimestamp();
        }
        return Object.fromEntries(
          Object.entries(value).map(([key, nested]) => [key, convert(nested as DurableJson)])
        );
      }
      return value;
    };
    return Object.fromEntries(
      Object.entries(payload).map(([key, value]) => [key, convert(value)])
    );
  }

  private async encryptEnvelope(mutation: DurableClinicalMutation): Promise<StoredMutationEnvelope> {
    const key = await this.getOrCreateKey();
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const plaintext = new TextEncoder().encode(JSON.stringify(mutation));
    const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, plaintext);
    return {
      id: mutation.id,
      status: 'waiting_for_network',
      queuedAt: mutation.queuedAt,
      attempts: 0,
      lastAttemptAt: null,
      syncedAt: null,
      error: null,
      iv: iv.buffer,
      ciphertext,
    };
  }

  private async decryptEnvelope(envelope: StoredMutationEnvelope): Promise<DurableClinicalMutation> {
    const key = await this.getOrCreateKey();
    const plaintext = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: new Uint8Array(envelope.iv) },
      key,
      envelope.ciphertext
    );
    return JSON.parse(new TextDecoder().decode(plaintext)) as DurableClinicalMutation;
  }

  private async reloadViews(): Promise<void> {
    const envelopes = await this.getAllEnvelopes();
    const views: DurableMutationView[] = [];
    for (const envelope of envelopes) {
      try {
        const mutation = await this.decryptEnvelope(envelope);
        views.push({
          id: envelope.id,
          operation: mutation.operation,
          entityType: mutation.entityType,
          entityId: mutation.entityId ?? null,
          patientId: mutation.patientId ?? null,
          status: envelope.status,
          queuedAt: envelope.queuedAt,
          attempts: envelope.attempts,
          lastAttemptAt: envelope.lastAttemptAt ?? null,
          syncedAt: envelope.syncedAt ?? null,
          error: envelope.error ?? null,
        });
      } catch {
        views.push({
          id: envelope.id,
          operation: 'encrypted_mutation',
          entityType: 'clinical',
          status: 'needs_review',
          queuedAt: envelope.queuedAt,
          attempts: envelope.attempts,
          error: 'Encrypted mutation could not be decrypted on this device profile.',
        });
      }
    }
    this.items.set(views.sort((a, b) => b.queuedAt - a.queuedAt));
  }

  private async restore(): Promise<void> {
    await this.openDb();
    await this.reloadViews();
    if (this.isOnline()) await this.flush();
  }

  private ready(): Promise<void> {
    if (!this.initPromise) {
      if (typeof indexedDB === 'undefined' || typeof crypto === 'undefined' || !crypto.subtle) {
        return Promise.reject(new Error('Durable encrypted clinical storage is unavailable on this device.'));
      }
      this.initPromise = this.restore();
    }
    return this.initPromise;
  }

  private async getOrCreateKey(): Promise<CryptoKey> {
    const database = await this.openDb();
    const existing = await new Promise<CryptoKey | undefined>((resolve, reject) => {
      const tx = database.transaction(this.keyStore, 'readonly');
      const req = tx.objectStore(this.keyStore).get(this.keyId);
      req.onsuccess = () => resolve(req.result as CryptoKey | undefined);
      req.onerror = () => reject(req.error);
    });
    if (existing) return existing;

    const key = await crypto.subtle.generateKey(
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );
    await new Promise<void>((resolve, reject) => {
      const tx = database.transaction(this.keyStore, 'readwrite');
      tx.objectStore(this.keyStore).put(key, this.keyId);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    return key;
  }

  private openDb(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, 1);
      request.onupgradeneeded = () => {
        const database = request.result;
        if (!database.objectStoreNames.contains(this.mutationStore)) {
          database.createObjectStore(this.mutationStore, { keyPath: 'id' });
        }
        if (!database.objectStoreNames.contains(this.keyStore)) {
          database.createObjectStore(this.keyStore);
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  private async getAllEnvelopes(): Promise<StoredMutationEnvelope[]> {
    const database = await this.openDb();
    return new Promise((resolve, reject) => {
      const tx = database.transaction(this.mutationStore, 'readonly');
      const req = tx.objectStore(this.mutationStore).getAll();
      req.onsuccess = () => resolve((req.result ?? []) as StoredMutationEnvelope[]);
      req.onerror = () => reject(req.error);
    });
  }

  private async getEnvelope(id: string): Promise<StoredMutationEnvelope | undefined> {
    const database = await this.openDb();
    return new Promise((resolve, reject) => {
      const tx = database.transaction(this.mutationStore, 'readonly');
      const req = tx.objectStore(this.mutationStore).get(id);
      req.onsuccess = () => resolve(req.result as StoredMutationEnvelope | undefined);
      req.onerror = () => reject(req.error);
    });
  }

  private async requireEnvelope(id: string): Promise<StoredMutationEnvelope> {
    const envelope = await this.getEnvelope(id);
    if (!envelope) throw new Error('Queued clinical mutation no longer exists.');
    return envelope;
  }

  private async putEnvelope(envelope: StoredMutationEnvelope): Promise<void> {
    const database = await this.openDb();
    return new Promise((resolve, reject) => {
      const tx = database.transaction(this.mutationStore, 'readwrite');
      tx.objectStore(this.mutationStore).put(envelope);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  private async patchEnvelope(
    envelope: StoredMutationEnvelope,
    patch: Partial<StoredMutationEnvelope>
  ): Promise<void> {
    await this.putEnvelope({ ...envelope, ...patch });
  }

  private async deleteEnvelope(id: string): Promise<void> {
    const database = await this.openDb();
    return new Promise((resolve, reject) => {
      const tx = database.transaction(this.mutationStore, 'readwrite');
      tx.objectStore(this.mutationStore).delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  private readDotPath(source: Record<string, unknown>, path: string): unknown {
    return path.split('.').reduce<unknown>((current, segment) => {
      if (!current || typeof current !== 'object') return undefined;
      return (current as Record<string, unknown>)[segment];
    }, source);
  }

  private toMillis(value: unknown): number | null {
    if (!value) return null;
    if (typeof (value as any).toMillis === 'function') return (value as any).toMillis();
    if (typeof (value as any).toDate === 'function') return (value as any).toDate().getTime();
    if (value instanceof Date) return value.getTime();
    if (typeof value === 'number') return value;
    const parsed = new Date(String(value));
    return Number.isNaN(parsed.getTime()) ? null : parsed.getTime();
  }

  private isOnline(): boolean {
    return typeof navigator === 'undefined' ? true : navigator.onLine;
  }

  private id(): string {
    return typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `mutation-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }
}
