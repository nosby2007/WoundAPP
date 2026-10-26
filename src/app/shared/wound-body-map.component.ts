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
  @Output() positionChange = new EventEmitter<WoundAnatomyPosition>();
  @Output() markerSelect = new EventEmitter<WoundMapMarker>();

  view: BodyView = 'front';
  profile: BodyProfile = 'female';
  selectionMessage = '';

  get visibleMarkers(): WoundMapMarker[] { return this.markers.filter(marker => marker.view === this.view); }
  get visiblePosition(): WoundAnatomyPosition | null { return this.position?.view === this.view ? this.position : null; }
  get zones() { return zonesForView(this.view); }
  get torsoPath(): string {
    return this.profile === 'female'
      ? 'M38 20 Q33 25 36 34 Q39 41 39 47 Q50 52 61 47 Q61 41 64 34 Q67 25 62 20 Q50 17 38 20Z'
      : 'M36 20 Q32 27 37 38 L40 48 Q50 51 60 48 L63 38 Q68 27 64 20 Q50 16 36 20Z';
  }

  constructor() {
    this.syncFromPosition();
  }

  ngOnChanges(): void { this.syncFromPosition(); }

  chooseView(view: BodyView): void { this.view = view; this.selectionMessage = ''; }
  chooseProfile(profile: BodyProfile): void {
    this.profile = profile;
    if (this.position) {
      const updated = positionForZone(this.position.id, profile);
      if (updated) this.emit(updated);
    }
  }

  selectFromPointer(event: MouseEvent): void {
    if (!this.interactive) return;
    const svg = event.currentTarget as SVGSVGElement;
    const rect = svg.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 100;
    const y = ((event.clientY - rect.top) / rect.height) * 100;
    const selected = selectAnatomicalZone(this.view, x, y, this.profile);
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
    this.markerSelect.emit(marker);
  }

  markerX(marker: WoundMapMarker): number {
    const peers = this.visibleMarkers.filter(item => item.id === marker.id);
    if (peers.length === 1) return marker.x;
    const index = Math.max(0, peers.findIndex(item => item.woundId === marker.woundId));
    return marker.x + [-3, 3, 0, -4, 4][index % 5];
  }

  markerY(marker: WoundMapMarker): number {
    const peers = this.visibleMarkers.filter(item => item.id === marker.id);
    if (peers.length === 1) return marker.y;
    const index = Math.max(0, peers.findIndex(item => item.woundId === marker.woundId));
    return marker.y + Math.floor(index / 5) * 4;
  }

  private emit(position: WoundAnatomyPosition): void {
    this.position = position;
    this.view = position.view;
    this.profile = position.profile;
    this.selectionMessage = position.label;
    this.positionChange.emit(position);
  }

  private syncFromPosition(): void {
    if (!this.position) return;
    this.view = this.position.view;
    this.profile = this.position.profile;
  }
}
