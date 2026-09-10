import { Injectable } from '@angular/core';
import { Capacitor, registerPlugin } from '@capacitor/core';

interface NativeBiometricPlugin {
  isAvailable(): Promise<{ isAvailable: boolean; biometryType?: number; deviceIsSecure?: boolean }>;
  verifyIdentity(options: { reason: string; title?: string; subtitle?: string; negativeButtonText?: string; useFallback?: boolean }): Promise<void>;
}

const NativeBiometric = registerPlugin<NativeBiometricPlugin>('NativeBiometric');

export interface BiometricCapability {
  available: boolean;
  native: boolean;
  label: string;
}

/**
 * Convenience re-unlock only. It NEVER creates a Firebase session and never
 * replaces the server PIN/MFA claim. If the native plugin is not present, the
 * app simply keeps using the existing PIN flow.
 */
@Injectable({ providedIn: 'root' })
export class BiometricUnlockService {
  async capability(): Promise<BiometricCapability> {
    if (!Capacitor.isNativePlatform()) {
      return { available: false, native: false, label: 'PIN only in browser' };
    }
    try {
      const result = await NativeBiometric.isAvailable();
      return {
        available: !!result.isAvailable && !!result.deviceIsSecure,
        native: true,
        label: result.isAvailable ? 'Face ID / Touch ID available' : 'Biometrics unavailable',
      };
    } catch {
      return { available: false, native: true, label: 'Native biometric plugin not installed' };
    }
  }

  async verify(): Promise<boolean> {
    const capability = await this.capability();
    if (!capability.available) return false;
    try {
      await NativeBiometric.verifyIdentity({
        reason: 'Confirm your identity to unlock the clinical workspace.',
        title: 'Unlock WoundApp',
        negativeButtonText: 'Use PIN',
        useFallback: false,
      });
      return true;
    } catch {
      return false;
    }
  }
}
