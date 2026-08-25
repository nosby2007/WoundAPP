export interface Patient {
    id?: string;
    /** The owning organization. Every Firestore rule on `patients` keys
     *  off this, so a record without it is invisible and unsaveable. */
    orgId?: string;
    name: string;
    gender: string;
    dob: Date;
    address: string;
    phone: string;
    email: string;
    quartier: string;
    docteur: string;
    departement: string;
    raison: string;
    paiement: string;
    Ename: string;
    relationship: string;
    Ephone: string;
  }