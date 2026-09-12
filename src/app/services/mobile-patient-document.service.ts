import { Injectable } from '@angular/core';
import {
  addDoc, collection, getDocs, orderBy, query, serverTimestamp,
} from 'firebase/firestore';
import {
  getDownloadURL, ref as storageRef, uploadBytes,
} from 'firebase/storage';
import { auth, db, storage } from '../firebase';

export interface MobilePatientDocument {
  id: string;
  name: string;
  type?: string | null;
  description?: string | null;
  url: string;
  path: string;
  mimeType?: string | null;
  size?: number | null;
  createdAt?: any;
  uploadedBy?: { uid?: string | null; email?: string | null; role?: string | null };
}

@Injectable({ providedIn: 'root' })
export class MobilePatientDocumentService {
  async list(patientId: string): Promise<MobilePatientDocument[]> {
    const snap = await getDocs(query(
      collection(db, `patients/${patientId}/documents`),
      orderBy('createdAt', 'desc'),
    ));
    return snap.docs.map(d => ({ id: d.id, ...(d.data() as any) } as MobilePatientDocument));
  }

  async upload(
    patientId: string,
    files: File[],
    opts: { type?: string; description?: string }
  ): Promise<void> {
    const user = auth.currentUser;
    if (!user) throw new Error('Sign in required.');
    if (!patientId) throw new Error('Patient is required.');

    let role = 'staff';
    try {
      const token = await user.getIdTokenResult();
      role = String(token.claims['role'] || 'staff');
    } catch {}

    for (const file of files) {
      if (!file.size) continue;
      if (file.size > 25 * 1024 * 1024) throw new Error(`${file.name} exceeds the 25 MB limit.`);

      const fileId = crypto.randomUUID ? crypto.randomUUID() :
        `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
      const safeName = file.name.replace(/[^\w.\-() ]+/g, '_');
      const path = `patients/${patientId}/documents/${fileId}/${safeName}`;
      const ref = storageRef(storage, path);

      await uploadBytes(ref, file, {
        contentType: file.type || 'application/octet-stream',
        customMetadata: {
          patientId,
          uploadedBy: user.uid,
          role,
          type: opts.type || 'other',
        },
      });
      const url = await getDownloadURL(ref);

      await addDoc(collection(db, `patients/${patientId}/documents`), {
        fileId,
        name: file.name,
        size: file.size,
        mimeType: file.type || null,
        type: opts.type || 'other',
        description: opts.description || '',
        url,
        path,
        patientId,
        visibility: 'careTeam',
        uploadedBy: {
          uid: user.uid,
          role,
          email: user.email || null,
        },
        createdAt: serverTimestamp(),
      });
    }
  }
}
