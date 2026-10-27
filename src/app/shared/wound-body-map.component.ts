import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, OnChanges, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  BodyProfile,
  BodyView,
  WoundAnatomyPosition,
  WoundMapMarker,
  positionForZone,
  selectAnatomicalZone,
  zonesForView,
} from './wound-anatomy';

@Component({
  selector: 'app-wound-body-map',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './wound-body-map.component.html',
  styleUrls: ['./wound-body-map.component.scss'],
})
export class WoundBodyMapComponent implements OnChanges {
  @Input() position: WoundAnatomyPosition | null = null;
  @Input() markers: WoundMapMarker[] = [];
  @Input() interactive = true;
  @Input() allowStickerPlacement = false;
  @Input() movableMarkers = false;
  @Input() patientProfile: BodyProfile | null = null;
  @Output() positionChange = new EventEmitter<WoundAnatomyPosition>();
  @Output() markerSelect = new EventEmitter<WoundMapMarker>();
  @Output() stickerPlace = new EventEmitter<WoundAnatomyPosition>();
  @Output() markerMove = new EventEmitter<{ marker: WoundMapMarker; position: WoundAnatomyPosition }>();

  view: BodyView = 'front';
  profile: BodyProfile = 'female';
  zoom = 1;
  selectionMessage = '';
  placingSticker = false;
  dragPreview: WoundAnatomyPosition | null = null;
  private draggedMarker: WoundMapMarker | null = null;
  private markerWasMoved = false;
  private suppressMarkerClick = '';

  get visibleMarkers(): WoundMapMarker[] { return this.markers.filter(marker => marker.view === this.view); }
  get visiblePosition(): WoundAnatomyPosition | null { return this.position?.view === this.view ? this.position : null; }
  get zones() { return zonesForView(this.view, this.profile); }
  get avatarSrc(): string { return `assets/body-map/${this.profile}-${this.view}.png`; }
  get patientScreenLeft(): 'L' | 'R' { return this.view === 'front' ? 'R' : 'L'; }
  get patientScreenRight(): 'L' | 'R' { return this.view === 'front' ? 'L' : 'R'; }

  constructor() {
    this.syncFromPosition();
  }

  ngOnChanges(): void { this.syncFromPosition(); }

  chooseView(view: BodyView): void { this.view = view; this.selectionMessage = ''; }
  rotateView(): void { this.chooseView(this.view === 'front' ? 'back' : 'front'); }
  chooseProfile(profile: BodyProfile): void {
    if (this.patientProfile) return;
    this.profile = profile;
    if (this.position) {
      const updated = positionForZone(this.position.id, profile);
      if (updated) this.emit(updated);
    }
  }

  zoomIn(): void { this.zoom = Math.min(2, Number((this.zoom + 0.25).toFixed(2))); }
  zoomOut(): void { this.zoom = Math.max(1, Number((this.zoom - 0.25).toFixed(2))); }
  resetZoom(): void { this.zoom = 1; }

  selectFromPointer(event: MouseEvent): void {
    if (this.allowStickerPlacement && this.placingSticker) {
      this.placeSticker(event);
      return;
    }
    if (!this.interactive) return;
    const selected = this.positionFromPointer(event);
    if (!selected) {
      this.selectionMessage = 'Tap closer to the body, or select a region from the list.';
      return;
    }
    this.emit(selected);
  }

  selectZone(zoneId: string): void {
    const selected = positionForZone(zoneId, this.profile);
    if (selected) this.emit(selected);
  }

  activateMarker(event: Event, marker: WoundMapMarker): void {
    event.stopPropagation();
    if (this.suppressMarkerClick === marker.woundId) {
      this.suppressMarkerClick = '';
      return;
    }
    this.markerSelect.emit(marker);
  }

  toggleStickerPlacement(): void {
    this.placingSticker = !this.placingSticker;
    this.selectionMessage = this.placingSticker
      ? 'Tap the anatomical site, or drag this sticker onto the body.'
      : '';
  }

  dragStickerStarted(event: DragEvent): void {
    this.placingSticker = true;
    event.dataTransfer?.setData('application/x-wound-sticker', 'new-wound');
    if (event.dataTransfer) event.dataTransfer.effectAllowed = 'copy';
  }

  allowStickerDrop(event: DragEvent): void {
    if (!this.allowStickerPlacement) return;
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy';
  }

  dropSticker(event: DragEvent): void {
    if (!this.allowStickerPlacement) return;
    event.preventDefault();
    this.placeSticker(event);
  }

  startMarkerDrag(event: PointerEvent, marker: WoundMapMarker): void {
    if (!this.movableMarkers) return;
    event.preventDefault();
    event.stopPropagation();
    this.draggedMarker = marker;
    this.dragPreview = marker;
    this.markerWasMoved = false;
    (event.currentTarget as SVGGElement).setPointerCapture?.(event.pointerId);
  }

  moveMarker(event: PointerEvent): void {
    if (!this.draggedMarker) return;
    const position = this.positionFromPointer(event);
    if (!position) return;
    this.markerWasMoved = true;
    this.dragPreview = position;
  }

  finishMarkerDrag(event: PointerEvent): void {
    if (!this.draggedMarker) return;
    event.preventDefault();
    event.stopPropagation();
    const marker = this.draggedMarker;
    const position = this.dragPreview;
    this.draggedMarker = null;
    this.dragPreview = null;
    if (this.markerWasMoved && position) {
      this.suppressMarkerClick = marker.woundId;
      this.markerMove.emit({ marker, position });
    }
    this.markerWasMoved = false;
  }

  markerX(marker: WoundMapMarker): number {
    if (this.draggedMarker?.woundId === marker.woundId && this.dragPreview) return this.dragPreview.x;
    const peers = this.visibleMarkers.filter(item => item.id === marker.id);
    if (peers.length === 1) return marker.x;
    const index = Math.max(0, peers.findIndex(item => item.woundId === marker.woundId));
    return marker.x + [-3, 3, 0, -4, 4][index % 5];
  }

  markerY(marker: WoundMapMarker): number {
    if (this.draggedMarker?.woundId === marker.woundId && this.dragPreview) return this.dragPreview.y;
    const peers = this.visibleMarkers.filter(item => item.id === marker.id);
    if (peers.length === 1) return marker.y;
    const index = Math.max(0, peers.findIndex(item => item.woundId === marker.woundId));
    return marker.y + Math.floor(index / 5) * 4;
  }

  displayY(value: number): number { return value * 1.5; }

  private placeSticker(event: MouseEvent): void {
    const selected = this.positionFromPointer(event);
    if (!selected) {
      this.selectionMessage = 'Place the sticker closer to the body.';
      return;
    }
    this.placingSticker = false;
    this.selectionMessage = selected.label;
    this.stickerPlace.emit(selected);
  }

  private positionFromPointer(event: MouseEvent): WoundAnatomyPosition | null {
    const svg = event.currentTarget as SVGSVGElement;
    const rect = svg.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 100;
    const y = ((event.clientY - rect.top) / rect.height) * 100;
    return selectAnatomicalZone(this.view, x, y, this.profile);
  }

  private emit(position: WoundAnatomyPosition): void {
    this.position = position;
    this.view = position.view;
    this.profile = position.profile;
    this.selectionMessage = position.label;
    this.positionChange.emit(position);
  }

  private syncFromPosition(): void {
    if (this.position) this.view = this.position.view;
    this.profile = this.patientProfile || this.position?.profile || this.profile;
  }
}
