export type ReferralStatus =
  | 'Received'
  | 'Under Review'
  | 'Insurance Verification'
  | 'Contact/Scheduling'
  | 'Accepted/Scheduled'
  | 'Admitted'
  | 'Declined'
  | 'Unable to Contact'
  | 'Insurance/Network Issue'
  | 'Outside Service Area'
  | 'Duplicate'
  | 'Hospitalized'
  | 'Other / Not Admitted';

export interface ReferralRecord {
  id?: string;
  orgId?: string;
  receivedAt: string;
  referralSource: string;
  referringFacility?: string;
  referringProvider?: string;
  receivedMethod: 'Fax' | 'Portal' | 'Secure Email' | 'Phone' | 'Other';
  requestedService: string;
  primaryPayer?: string;
  secondaryPayer?: string;
  medicarePartA?: boolean;
  medicarePartB?: boolean;
  eligibilityStatus: 'Not Checked' | 'Pending' | 'Verified' | 'Issue Found';
  status: ReferralStatus;
  dispositionReason?: string;
  dispositionReportedBy?: 'Patient' | 'Family/Caregiver' | 'Referring Facility' | 'Provider' | 'Other';
  assignedTo?: string;
  firstVisitDate?: string;
  admitted: boolean;
  servicesRendered: boolean;
  billingAmount: number;
  notes?: string;
  createdAt?: any;
  updatedAt?: any;
}
