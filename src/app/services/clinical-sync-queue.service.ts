import { Injectable, signal } from '@angular/core';

export type ClinicalSyncStatus =
  | 'waiting_for_network'
  | 'syncing'
  | 'synced'
  | 'failed';

export interface ClinicalSyncDescriptor {
  operation: string;
  patientId?: string | null;
  entityType: string;
  entityId?: string | null;
}

export interface ClinicalSyncItem extends ClinicalSyncDescriptor {
  id: string;
  status: ClinicalSyncStatus;
  queuedAt: number;
  lastAttemptAt?: number | null;
  syncedAt?: number | null;
  error?: string | null;
  attempts: number;
}

interface PendingWork<T = unknown> {
  itemId: string;
  run: () => Promise<T>;
  resolve: (value: T | PromiseLike<T>) => void;
  reject: (reason?: unknown) => void;
}

/**
 * In-session clinical mutation queue.
 *
 * Deliberately DOES NOT serialize payloads into localStorage/sessionStorage/
 * IndexedDB. Clinical write closures remain only in memory. That means:
 * - short network interruptions can recover automatically while the app stays open;
 * - a browser/app restart intentionally drops the queue rather than leaving PHI
 *   at rest without an approved device-key encryption strategy.
 *
 * Durable encrypted offline storage is a separate hardening phase.
 */
@Injectable({ providedIn: 'root' })
export class ClinicalSyncQueueService {
  readonly items = signal<ClinicalSyncItem[]>([]);

  // Type erasure is intentionally internal: enqueue<T>() preserves the public
  // Promise<T> contract, while the heterogeneous queue stores work items
  // returning different T values side by side.
  private readonly pending = new Map<string, PendingWork<any>>();

  constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => void this.flush());
    }
  }

  enqueue<T>(descriptor: ClinicalSyncDescriptor, run: () => Promise<T>): Promise<T> {
    const id = this.id();
    const item: ClinicalSyncItem = {
      ...descriptor,
      id,
      status: this.isOnline() ? 'syncing' : 'waiting_for_network',
      queuedAt: Date.now(),
      lastAttemptAt: null,
      syncedAt: null,
      error: null,
      attempts: 0,
    };

    this.push(item);

    return new Promise<T>((resolve, reject) => {
      this.pending.set(id, { itemId: id, run, resolve, reject });
      if (this.isOnline()) {
        void this.execute(id);
      }
    });
  }

  async flush(): Promise<void> {
    if (!this.isOnline()) return;

    const waiting = this.items().filter((item) =>
      item.status === 'waiting_for_network' || item.status === 'failed'
    );
    for (const item of waiting) {
      if (this.pending.has(item.id)) {
        await this.execute(item.id);
      }
    }
  }

  retry(itemId: string): void {
    if (!this.pending.has(itemId)) return;
    if (!this.isOnline()) {
      this.patch(itemId, {
        status: 'waiting_for_network',
        error: null,
      });
      return;
    }
    void this.execute(itemId);
  }

  clearSynced(): void {
    this.items.update((items) => items.filter((item) => item.status !== 'synced'));
  }

  pendingCount(): number {
    return this.items().filter((item) =>
      item.status === 'waiting_for_network' || item.status === 'syncing'
    ).length;
  }

  failedCount(): number {
    return this.items().filter((item) => item.status === 'failed').length;
  }

  private async execute(itemId: string): Promise<void> {
    const work = this.pending.get(itemId);
    if (!work) return;

    if (!this.isOnline()) {
      this.patch(itemId, { status: 'waiting_for_network' });
      return;
    }

    const current = this.items().find((item) => item.id === itemId);
    this.patch(itemId, {
      status: 'syncing',
      attempts: (current?.attempts ?? 0) + 1,
      lastAttemptAt: Date.now(),
      error: null,
    });

    try {
      const result = await work.run();
      this.patch(itemId, {
        status: 'synced',
        syncedAt: Date.now(),
        error: null,
      });
      this.pending.delete(itemId);
      work.resolve(result);
      this.trim();
    } catch (error: any) {
      const networkLost = !this.isOnline();
      this.patch(itemId, {
        status: networkLost ? 'waiting_for_network' : 'failed',
        error: networkLost ? null : (error?.message || 'Sync failed'),
      });

      // A network interruption remains retryable. A server/application error
      // is surfaced to the caller and kept as a failed queue item for review.
      if (!networkLost) {
        this.pending.delete(itemId);
        work.reject(error);
      }
    }
  }

  private push(item: ClinicalSyncItem): void {
    this.items.update((items) => [item, ...items].slice(0, 100));
  }

  private patch(itemId: string, patch: Partial<ClinicalSyncItem>): void {
    this.items.update((items) =>
      items.map((item) => item.id === itemId ? { ...item, ...patch } : item)
    );
  }

  private trim(): void {
    this.items.update((items) => items.slice(0, 100));
  }

  private isOnline(): boolean {
    return typeof navigator === 'undefined' ? true : navigator.onLine;
  }

  private id(): string {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
    return `sync-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }
}
