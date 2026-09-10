import { Component, OnInit } from '@angular/core';
import { Observable, of } from 'rxjs';

import { Patient } from 'src/app/patient.model';
import { PatientService } from 'src/app/SERVICE/patient.service';
import { SharedOrderService } from 'src/app/SERVICE/shared-order.service';
import { SharedOrder } from 'src/app/models/shared-order.model';

type OrderFilter = 'active' | 'due' | 'prn' | 'completed' | 'all';

@Component({
  selector: 'app-orders',
  templateUrl: './orders.component.html',
  styleUrls: ['./orders.component.scss']
})
export class OrdersComponent implements OnInit {
  patients$!: Observable<Patient[]>;
  orders$: Observable<SharedOrder[]> = of([]);

  selectedPatientId = '';
  filter: OrderFilter = 'active';
  selectedOrder: SharedOrder | null = null;
  completedSteps = new Set<number>();
  executionNote = '';
  savingExecution = false;
  message: string | null = null;

  constructor(
    private readonly patients: PatientService,
    private readonly orders: SharedOrderService,
  ) {}

  ngOnInit(): void {
    this.patients$ = this.patients.patient$;
  }

  selectPatient(patientId: string): void {
    this.selectedPatientId = patientId;
    this.orders$ = patientId ? this.orders.listForPatient(patientId) : of([]);
    this.selectedOrder = null;
    this.completedSteps.clear();
    this.message = null;
  }

  setFilter(filter: OrderFilter): void {
    this.filter = filter;
  }

  visibleOrders(orders: SharedOrder[]): SharedOrder[] {
    return (orders || []).filter((order) => {
      if (this.filter === 'all') return true;
      if (this.filter === 'completed') return this.isTerminal(order);
      if (this.filter === 'active') return !this.isTerminal(order);
      if (this.filter === 'prn') return !this.isTerminal(order) && this.isPrn(order);
      if (this.filter === 'due') return !this.isTerminal(order) && this.isDue(order);
      return true;
    });
  }

  isTerminal(order: SharedOrder): boolean {
    const state = (order.workflow?.state || '').toLowerCase();
    return ['completed', 'closed', 'discontinued', 'cancelled', 'canceled'].includes(state);
  }

  isPrn(order: SharedOrder): boolean {
    const frequency = order.clinical?.schedule?.frequency || '';
    return /\bprn\b/i.test(frequency) || /\bprn\b/i.test(order.description || '');
  }

  isDue(order: SharedOrder): boolean {
    const due = this.toDate(order.clinical?.schedule?.nextDueAt || order.clinical?.schedule?.startAt);
    return !!due && due.getTime() <= Date.now();
  }

  openExecution(order: SharedOrder): void {
    this.selectedOrder = order;
    this.completedSteps.clear();
    this.executionNote = '';
    this.message = null;
  }

  closeExecution(): void {
    this.selectedOrder = null;
    this.completedSteps.clear();
  }

  toggleStep(index: number, checked: boolean): void {
    checked ? this.completedSteps.add(index) : this.completedSteps.delete(index);
  }

  executionSteps(order: SharedOrder): string[] {
    const c = order.clinical;
    const steps: string[] = [];
    const push = (label: string, values?: string[]) => {
      (values || []).filter(Boolean).forEach((value) => steps.push(`${label}: ${value}`));
    };

    push('Cleanse', c?.cleanse);
    push('Prep', c?.prep);
    push('Apply', c?.apply);
    push('Cover', c?.cover);
    push('Secure', c?.secure);
    push('Compression', c?.compression);
    push('Offloading', c?.offloading);
    (c?.contingencies || []).forEach((item) => {
      if (item?.trigger && item?.action) steps.push(`${item.trigger}: ${item.action}`);
    });

    if (steps.length) return steps;

    return (order.description || '')
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => !!line)
      .slice(0, 12);
  }

  async saveExecution(): Promise<void> {
    const order = this.selectedOrder;
    if (!order) return;

    const steps = this.executionSteps(order);
    const selected = Array.from(this.completedSteps).sort((a, b) => a - b);
    if (!selected.length) {
      this.message = 'Select at least one completed step before documenting.';
      return;
    }

    this.savingExecution = true;
    this.message = null;
    try {
      await this.orders.recordExecution(
        order,
        selected,
        selected.map((index) => steps[index]).filter(Boolean),
        this.executionNote.trim() || null,
      );
      this.message = 'Order execution documented in the shared chart.';
      this.selectedOrder = null;
      this.completedSteps.clear();
      this.executionNote = '';
    } catch (error: any) {
      console.error(error);
      this.message = error?.message || 'Unable to document the execution.';
    } finally {
      this.savingExecution = false;
    }
  }

  woundLabel(order: SharedOrder): string {
    return order.clinical?.woundLocation || order.algorithmWoundType || order.clinical?.woundType || 'Wound care';
  }

  protocolLabel(order: SharedOrder): string | null {
    const name = order.source?.algorithmName || order.algorithmName;
    if (!name) return null;
    const version = order.source?.algorithmVersion || order.algorithmVersion;
    return version ? `${name} · v${version}` : name;
  }

  orderedAt(order: SharedOrder): Date | null {
    return this.toDate(order.orderedAt);
  }

  private toDate(value: any): Date | null {
    if (!value) return null;
    if (value instanceof Date) return value;
    if (typeof value?.toDate === 'function') return value.toDate();
    const parsed = new Date(value);
    return isNaN(parsed.getTime()) ? null : parsed;
  }
}
