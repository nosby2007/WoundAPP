import { ErrorHandler, Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import { ClinicalAuditService } from './clinical-audit.service';

@Injectable()
export class ClinicalErrorHandler implements ErrorHandler {
  private audit = inject(ClinicalAuditService);
  private router = inject(Router);

  handleError(error: unknown): void {
    console.error(error);
    const anyError = error as any;
    void this.audit.record({
      action: 'client_error',
      route: this.router.url,
      outcome: 'failure',
      reasonCode: String(anyError?.name || 'Error').slice(0, 80),
      metadata: {
        code: typeof anyError?.code === 'string' ? anyError.code : null,
      },
    }).catch(() => undefined);
  }
}
