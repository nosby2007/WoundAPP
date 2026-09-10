export interface SharedOrderClinicalSnapshot {
  woundType?: string | null;
  woundLocation?: string | null;
  priority?: string | null;
  schedule?: {
    frequency?: string | null;
    startAt?: any;
    duration?: string | null;
    nextDueAt?: any;
  } | null;
  cleanse?: string[];
  prep?: string[];
  apply?: string[];
  cover?: string[];
  secure?: string[];
  compression?: string[];
  offloading?: string[];
  contingencies?: Array<{ trigger: string; action: string }>;
  comments?: string | null;
}

export interface SharedOrder {
  id?: string;
  orgId: string;
  facilityId?: string | null;
  patientId: string;
  woundId?: string | null;
  orderType: string;
  description: string;
  orderedAt?: any;
  orderedBy?: {
    uid?: string;
    displayName?: string | null;
    role?: string | null;
    credentials?: string | null;
  };
  workflow?: {
    state?: string;
    [key: string]: any;
  };
  schemaVersion?: number;
  clinical?: SharedOrderClinicalSnapshot | null;
  source?: {
    mode?: 'manual' | 'algorithm';
    algorithmId?: string | null;
    algorithmName?: string | null;
    algorithmVersion?: number | null;
  } | null;
  algorithmName?: string | null;
  algorithmWoundType?: string | null;
  algorithmVersion?: number | null;
}

export interface OrderExecution {
  id?: string;
  orgId: string;
  patientId: string;
  orderId: string;
  status: 'completed';
  performedBy: {
    uid: string;
    displayName?: string | null;
  };
  completedStepIndexes: number[];
  stepLabels: string[];
  note?: string | null;
  completedAt?: any;
  createdAt?: any;
}
