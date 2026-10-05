import { Injectable } from '@angular/core';
import { getDownloadURL, ref, uploadString } from 'firebase/storage';
import { auth, storage } from '../firebase';

export interface VisitSignatureAsset {
  storagePath: string;
  downloadUrl: string;
  sha256: string;
  capturedAtIso: string;
}

@Injectable({ providedIn: 'root' })
export class VisitSignatureService {
  async upload(patientId: string, visitId: string, dataUrl: string): Promise<VisitSignatureAsset> {
    const user = auth.currentUser;
    if (!user) throw new Error('Sign in before capturing a visit signature.');
    if (!patientId || !visitId) throw new Error('Patient and visit are required for signature capture.');
    if (!dataUrl.startsWith('data:image/png;base64,')) {
      throw new Error('Visit signature must be a PNG capture.');
    }
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      throw new Error('Electronic signature upload needs a network connection. Use verbal/unable-to-attest or reconnect before checkout.');
    }

    const capturedAtIso = new Date().toISOString();
    const sha256 = await this.sha256(dataUrl);
    const storagePath = `patients/${patientId}/documents/evv-signatures/${visitId}.png`;
    const storageRef = ref(storage, storagePath);

    await uploadString(storageRef, dataUrl, 'data_url', {
      contentType: 'image/png',
      customMetadata: {
        patientId,
        uploadedBy: user.uid,
        visitId,
        assetType: 'evv_patient_signature',
        sha256,
        capturedAtIso,
      },
    });

    return {
      storagePath,
      downloadUrl: await getDownloadURL(storageRef),
      sha256,
      capturedAtIso,
    };
  }

  private async sha256(value: string): Promise<string> {
    if (!crypto?.subtle) throw new Error('Signature integrity hashing is unavailable on this device.');
    const bytes = new TextEncoder().encode(value);
    const digest = await crypto.subtle.digest('SHA-256', bytes);
    return Array.from(new Uint8Array(digest))
      .map((byte) => byte.toString(16).padStart(2, '0'))
      .join('');
  }
}
