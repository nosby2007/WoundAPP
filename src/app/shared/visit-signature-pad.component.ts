import {
  AfterViewInit,
  Component,
  ElementRef,
  EventEmitter,
  OnDestroy,
  Output,
  ViewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonButton, IonIcon } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { refreshOutline } from 'ionicons/icons';

@Component({
  selector: 'app-visit-signature-pad',
  standalone: true,
  imports: [CommonModule, IonButton, IonIcon],
  template: `
    <div class="signature-shell">
      <div class="signature-head">
        <div>
          <strong>Patient / representative signature</strong>
          <span>Sign inside the box using a finger or stylus.</span>
        </div>
        <ion-button size="small" fill="clear" type="button" (click)="clear()">
          <ion-icon slot="start" name="refresh-outline"></ion-icon>
          Clear
        </ion-button>
      </div>

      <canvas
        #signatureCanvas
        class="signature-canvas"
        aria-label="Patient or representative signature pad"
        (pointerdown)="start($event)"
        (pointermove)="move($event)"
        (pointerup)="end()"
        (pointercancel)="end()"
        (pointerleave)="end()">
      </canvas>

      <div class="signature-foot">
        <span *ngIf="!hasSignature">Signature required for electronic attestation.</span>
        <strong *ngIf="hasSignature">Signature captured</strong>
      </div>
    </div>
  `,
  styles: [`
    .signature-shell{margin-top:12px;border:1px solid #d8e4e8;border-radius:18px;background:#fff;overflow:hidden}
    .signature-head{display:flex;justify-content:space-between;gap:12px;align-items:flex-start;padding:12px 12px 8px}
    .signature-head strong,.signature-head span{display:block}.signature-head strong{font-size:13px;color:#173248}.signature-head span{margin-top:2px;font-size:10px;color:#718696}
    .signature-canvas{display:block;width:100%;height:150px;background:linear-gradient(#fff,#fbfdfe);touch-action:none;border-top:1px dashed #dce7eb;border-bottom:1px dashed #dce7eb}
    .signature-foot{padding:8px 12px;font-size:10px;color:#798c99}.signature-foot strong{color:#0b7551}
  `],
})
export class VisitSignaturePadComponent implements AfterViewInit, OnDestroy {
  @ViewChild('signatureCanvas', { static: true })
  private readonly canvasRef!: ElementRef<HTMLCanvasElement>;

  @Output() readonly signatureChange = new EventEmitter<string | null>();

  hasSignature = false;
  private drawing = false;
  private context: CanvasRenderingContext2D | null = null;
  private resizeObserver: ResizeObserver | null = null;

  constructor() {
    addIcons({ refreshOutline });
  }

  ngAfterViewInit(): void {
    this.resize();
    if (typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(() => this.resize());
      this.resizeObserver.observe(this.canvasRef.nativeElement);
    }
  }

  ngOnDestroy(): void {
    this.resizeObserver?.disconnect();
  }

  start(event: PointerEvent): void {
    const context = this.context;
    if (!context) return;
    const point = this.point(event);
    this.drawing = true;
    this.canvasRef.nativeElement.setPointerCapture?.(event.pointerId);
    context.beginPath();
    context.moveTo(point.x, point.y);
  }

  move(event: PointerEvent): void {
    if (!this.drawing || !this.context) return;
    const point = this.point(event);
    this.context.lineTo(point.x, point.y);
    this.context.stroke();
    this.hasSignature = true;
  }

  end(): void {
    if (!this.drawing) return;
    this.drawing = false;
    this.context?.closePath();
    if (this.hasSignature) {
      this.signatureChange.emit(this.canvasRef.nativeElement.toDataURL('image/png'));
    }
  }

  clear(): void {
    const canvas = this.canvasRef.nativeElement;
    this.context?.clearRect(0, 0, canvas.width, canvas.height);
    this.hasSignature = false;
    this.signatureChange.emit(null);
  }

  private resize(): void {
    const canvas = this.canvasRef.nativeElement;
    const rect = canvas.getBoundingClientRect();
    const ratio = Math.max(1, window.devicePixelRatio || 1);
    canvas.width = Math.max(1, Math.round(rect.width * ratio));
    canvas.height = Math.max(1, Math.round(150 * ratio));

    const context = canvas.getContext('2d');
    if (!context) return;
    context.scale(ratio, ratio);
    context.lineWidth = 2.2;
    context.lineCap = 'round';
    context.lineJoin = 'round';
    context.strokeStyle = '#15324b';
    this.context = context;
  }

  private point(event: PointerEvent): { x: number; y: number } {
    const rect = this.canvasRef.nativeElement.getBoundingClientRect();
    return {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    };
  }
}
