// src/app/shared/healing-trajectory-graph.component.ts
import { Component, Input, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardTitle,
  IonSegment,
  IonSegmentButton,
  IonLabel,
  IonBadge,
  IonIcon,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  trendingDownOutline,
  trendingUpOutline,
  removeOutline,
  analyticsOutline,
  medicalOutline,
  alertCircleOutline,
  calendarOutline,
  speedometerOutline,
  sparklesOutline,
} from 'ionicons/icons';
import { BedsideHealingTrajectory, TrajectoryDataPoint } from './push-score';

@Component({
  selector: 'app-healing-trajectory-graph',
  standalone: true,
  imports: [
    CommonModule,
    IonCard,
    IonCardContent,
    IonCardHeader,
    IonCardTitle,
    IonSegment,
    IonSegmentButton,
    IonLabel,
    IonBadge,
    IonIcon,
  ],
  template: `
    <ion-card class="trajectory-card" *ngIf="trajectory && trajectory.points.length">
      <ion-card-header>
        <div class="card-title-row">
          <div>
            <ion-card-title class="main-title">
              <ion-icon name="analytics-outline"></ion-icon>
              Bedside Healing Trajectory & PUSH
            </ion-card-title>
            <p class="subtitle">
              Tracking {{ trajectory.daysTracked }} days across {{ trajectory.points.length }} clinical assessments
            </p>
          </div>
          <ion-badge [class]="'trajectory-badge ' + trajectory.trajectoryClassification">
            {{
              trajectory.trajectoryClassification === 'rapidly_healing'
                ? 'Rapid Progress'
                : trajectory.trajectoryClassification === 'healing_on_target'
                ? 'Healing On Target'
                : trajectory.trajectoryClassification === 'stalled_delayed'
                ? 'Stalled / Delayed'
                : trajectory.trajectoryClassification === 'deteriorating'
                ? 'Deteriorating'
                : 'Baseline'
            }}
          </ion-badge>
        </div>

        <!-- Metric Switcher Tabs -->
        <ion-segment [value]="activeMetric" (ionChange)="onMetricChange($event)" class="metric-segment">
          <ion-segment-button value="area">
            <ion-label>Area (cm²)</ion-label>
          </ion-segment-button>
          <ion-segment-button value="push">
            <ion-label>PUSH Score (0-17)</ion-label>
          </ion-segment-button>
          <ion-segment-button value="depth">
            <ion-label>Depth (cm)</ion-label>
          </ion-segment-button>
        </ion-segment>
      </ion-card-header>

      <ion-card-content>
        <!-- Clinical Trajectory Summary Metric Cards -->
        <div class="metric-summary-grid">
          <!-- Area Change -->
          <div class="metric-box">
            <span class="box-label">Area Reduction</span>
            <div class="box-value" [class.positive]="trajectory.overallPercentAreaReduction > 0" [class.negative]="trajectory.overallPercentAreaReduction < 0">
              <ion-icon [name]="trajectory.overallPercentAreaReduction > 0 ? 'trending-down-outline' : trajectory.overallPercentAreaReduction < 0 ? 'trending-up-outline' : 'remove-outline'"></ion-icon>
              {{ trajectory.overallPercentAreaReduction > 0 ? '-' + trajectory.overallPercentAreaReduction + '%' : '+' + Math.abs(trajectory.overallPercentAreaReduction) + '%' }}
            </div>
            <span class="box-sub">
              {{ trajectory.baselinePoint?.areaCm2 }} cm² → {{ trajectory.latestPoint?.areaCm2 }} cm²
            </span>
          </div>

          <!-- PUSH Score Change -->
          <div class="metric-box">
            <span class="box-label">PUSH Score</span>
            <div class="box-value" [class.positive]="trajectory.overallPushReduction > 0" [class.negative]="trajectory.overallPushReduction < 0">
              <ion-icon [name]="trajectory.overallPushReduction > 0 ? 'trending-down-outline' : 'trending-up-outline'"></ion-icon>
              {{ trajectory.latestPoint?.pushScore }} / 17
            </div>
            <span class="box-sub">
              {{ trajectory.overallPushReduction >= 0 ? '-' + trajectory.overallPushReduction + ' pts reduction' : '+' + Math.abs(trajectory.overallPushReduction) + ' pts increase' }}
            </span>
          </div>

          <!-- Weekly Velocity -->
          <div class="metric-box">
            <span class="box-label">Healing Velocity</span>
            <div class="box-value neutral">
              <ion-icon name="speedometer-outline"></ion-icon>
              {{ trajectory.weeklyHealingRateCm2 }}
            </div>
            <span class="box-sub">cm² / week</span>
          </div>

          <!-- Est Closure -->
          <div class="metric-box">
            <span class="box-label">Est. Closure</span>
            <div class="box-value" [class.positive]="trajectory.projectedWeeksToClosure !== null">
              <ion-icon name="sparkles-outline"></ion-icon>
              {{ trajectory.projectedWeeksToClosure !== null ? '~' + trajectory.projectedWeeksToClosure + ' wks' : 'N/A' }}
            </div>
            <span class="box-sub">at current rate</span>
          </div>
        </div>

        <!-- SVG Interactive Bedside Chart -->
        <div class="svg-chart-container">
          <svg
            [attr.viewBox]="'0 0 ' + svgWidth + ' ' + svgHeight"
            class="trajectory-svg"
            preserveAspectRatio="xMidYMid meet"
          >
            <defs>
              <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stop-color="#10b981" stop-opacity="0.35" />
                <stop offset="100%" stop-color="#10b981" stop-opacity="0.02" />
              </linearGradient>
              <linearGradient id="pushGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stop-color="#3b82f6" stop-opacity="0.35" />
                <stop offset="100%" stop-color="#3b82f6" stop-opacity="0.02" />
              </linearGradient>
              <linearGradient id="depthGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stop-color="#f59e0b" stop-opacity="0.35" />
                <stop offset="100%" stop-color="#f59e0b" stop-opacity="0.02" />
              </linearGradient>
            </defs>

            <!-- Grid horizontal lines -->
            <g class="grid-lines">
              <line
                *ngFor="let tick of yTicks"
                [attr.x1]="paddingLeft"
                [attr.y1]="tick.y"
                [attr.x2]="svgWidth - paddingRight"
                [attr.y2]="tick.y"
                stroke="#e5e7eb"
                stroke-dasharray="3,3"
                stroke-width="1"
              />
              <text
                *ngFor="let tick of yTicks"
                [attr.x]="paddingLeft - 8"
                [attr.y]="tick.y + 4"
                text-anchor="end"
                class="axis-label"
              >
                {{ tick.val }}
              </text>
            </g>

            <!-- Shaded Area Path -->
            <path
              [attr.d]="svgAreaPath"
              [attr.fill]="
                activeMetric === 'area'
                  ? 'url(#areaGradient)'
                  : activeMetric === 'push'
                  ? 'url(#pushGradient)'
                  : 'url(#depthGradient)'
              "
            />

            <!-- Trend Line Path -->
            <path
              [attr.d]="svgLinePath"
              fill="none"
              [attr.stroke]="
                activeMetric === 'area'
                  ? '#059669'
                  : activeMetric === 'push'
                  ? '#2563eb'
                  : '#d97706'
              "
              stroke-width="3"
              stroke-linecap="round"
              stroke-linejoin="round"
            />

            <!-- Target Closure Horizon Line for Area -->
            <line
              *ngIf="activeMetric === 'area'"
              [attr.x1]="paddingLeft"
              [attr.y1]="zeroY"
              [attr.x2]="svgWidth - paddingRight"
              [attr.y2]="zeroY"
              stroke="#10b981"
              stroke-width="1.5"
              stroke-dasharray="4,2"
            />

            <!-- Data Points -->
            <g *ngFor="let pt of chartPoints; let i = index">
              <!-- Point Circle -->
              <circle
                [attr.cx]="pt.x"
                [attr.cy]="pt.y"
                [attr.r]="selectedPointIndex === i ? 7 : 5"
                [attr.fill]="
                  pt.raw.hasInfectionMarkers
                    ? '#ef4444'
                    : activeMetric === 'area'
                    ? '#059669'
                    : activeMetric === 'push'
                    ? '#2563eb'
                    : '#d97706'
                "
                stroke="#ffffff"
                stroke-width="2"
                class="data-circle"
                (click)="selectPoint(i)"
              />

              <!-- Infection Warning Marker -->
              <g *ngIf="pt.raw.hasInfectionMarkers" [attr.transform]="'translate(' + (pt.x - 6) + ',' + (pt.y - 18) + ')'">
                <circle cx="6" cy="6" r="6" fill="#ef4444" />
                <text x="6" y="9" font-size="9" fill="#ffffff" text-anchor="middle" font-weight="bold">!</text>
              </g>

              <!-- Value Label above point -->
              <text
                [attr.x]="pt.x"
                [attr.y]="pt.y - 10"
                text-anchor="middle"
                class="point-label"
                [class.selected-label]="selectedPointIndex === i"
              >
                {{ pt.val }}
              </text>

              <!-- Date Label along bottom axis -->
              <text
                [attr.x]="pt.x"
                [attr.y]="svgHeight - 10"
                text-anchor="middle"
                class="date-label"
              >
                {{ pt.raw.dateLabel }}
              </text>
            </g>
          </svg>
        </div>

        <!-- Selected Assessment Detail Inspector -->
        <div class="point-inspector" *ngIf="selectedPoint">
          <div class="inspector-header">
            <span class="inspector-date">
              <ion-icon name="calendar-outline"></ion-icon>
              Assessment: {{ selectedPoint.date | date:'mediumDate' }}
            </span>
            <ion-badge [class]="'status-badge ' + selectedPoint.status">
              {{ selectedPoint.status | titlecase }}
            </ion-badge>
          </div>

          <div class="inspector-details">
            <div class="detail-item">
              <span class="detail-title">Dimensions:</span>
              <span class="detail-val">
                {{ selectedPoint.pushBreakdown.lengthCm }} × {{ selectedPoint.pushBreakdown.widthCm }} × {{ selectedPoint.depthCm || 0 }} cm
              </span>
            </div>
            <div class="detail-item">
              <span class="detail-title">Area:</span>
              <span class="detail-val highlight">{{ selectedPoint.areaCm2 }} cm²</span>
            </div>
            <div class="detail-item">
              <span class="detail-title">PUSH Score:</span>
              <span class="detail-val highlight-push">
                {{ selectedPoint.pushScore }}/17 (Area: {{ selectedPoint.pushBreakdown.areaScore }}, Exudate: {{ selectedPoint.pushBreakdown.exudateScore }}, Tissue: {{ selectedPoint.pushBreakdown.tissueScore }})
              </span>
            </div>
            <div class="detail-item">
              <span class="detail-title">Predominant Tissue:</span>
              <span class="detail-val">{{ selectedPoint.pushBreakdown.tissueType }}</span>
            </div>
            <div class="detail-item">
              <span class="detail-title">Exudate Level:</span>
              <span class="detail-val">{{ selectedPoint.pushBreakdown.exudateAmount }}</span>
            </div>
            <div class="detail-item" *ngIf="selectedPoint.percentChangeFromBaseline !== undefined">
              <span class="detail-title">Δ from Baseline:</span>
              <span class="detail-val" [class.text-healed]="selectedPoint.percentChangeFromBaseline > 0" [class.text-enlarged]="selectedPoint.percentChangeFromBaseline < 0">
                {{ selectedPoint.percentChangeFromBaseline > 0 ? selectedPoint.percentChangeFromBaseline + '% reduction' : Math.abs(selectedPoint.percentChangeFromBaseline) + '% enlargement' }}
              </span>
            </div>
          </div>
        </div>

        <!-- Bedside Clinical Trajectory Recommendations -->
        <div class="recommendations-box">
          <div class="rec-header">
            <ion-icon name="medical-outline"></ion-icon>
            <h5>Bedside Clinical Decision Support</h5>
          </div>
          <ul>
            <li *ngFor="let rec of trajectory.clinicalRecommendations">{{ rec }}</li>
          </ul>
        </div>
      </ion-card-content>
    </ion-card>
  `,
  styles: [
    `
      .trajectory-card {
        margin: 16px 0;
        border-radius: 14px;
        box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08);
        border: 1px solid #e5e7eb;
      }
      .card-title-row {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 8px;
        margin-bottom: 12px;
      }
      .main-title {
        font-size: 16px;
        font-weight: 700;
        display: flex;
        align-items: center;
        gap: 6px;
      }
      .subtitle {
        font-size: 12px;
        color: #6b7280;
        margin: 2px 0 0 0;
      }
      .trajectory-badge {
        font-size: 11px;
        padding: 4px 8px;
        border-radius: 6px;
        font-weight: 700;
      }
      .trajectory-badge.rapidly_healing {
        background: #d1fae5;
        color: #065f46;
      }
      .trajectory-badge.healing_on_target {
        background: #ecfdf5;
        color: #047857;
      }
      .trajectory-badge.stalled_delayed {
        background: #fef3c7;
        color: #b45309;
      }
      .trajectory-badge.deteriorating {
        background: #fee2e2;
        color: #b91c1c;
      }
      .metric-segment {
        margin-top: 8px;
      }
      .metric-summary-grid {
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: 8px;
        margin-bottom: 16px;
      }
      @media (min-width: 600px) {
        .metric-summary-grid {
          grid-template-columns: repeat(4, 1fr);
        }
      }
      .metric-box {
        background: #f9fafb;
        padding: 10px;
        border-radius: 8px;
        border: 1px solid #f3f4f6;
        display: flex;
        flex-direction: column;
      }
      .box-label {
        font-size: 11px;
        color: #6b7280;
        font-weight: 600;
        text-transform: uppercase;
      }
      .box-value {
        font-size: 18px;
        font-weight: 800;
        margin: 4px 0 2px 0;
        display: flex;
        align-items: center;
        gap: 4px;
      }
      .box-value.positive {
        color: #059669;
      }
      .box-value.negative {
        color: #dc2626;
      }
      .box-value.neutral {
        color: #2563eb;
      }
      .box-sub {
        font-size: 11px;
        color: #9ca3af;
      }
      .svg-chart-container {
        width: 100%;
        background: #ffffff;
        border-radius: 8px;
        border: 1px solid #e5e7eb;
        padding: 8px 4px 4px 4px;
        box-sizing: border-box;
      }
      .trajectory-svg {
        width: 100%;
        height: auto;
        display: block;
      }
      .axis-label {
        font-size: 10px;
        fill: #9ca3af;
        font-family: sans-serif;
      }
      .point-label {
        font-size: 11px;
        fill: #374151;
        font-weight: 700;
        font-family: sans-serif;
      }
      .point-label.selected-label {
        fill: #111827;
        font-size: 13px;
      }
      .date-label {
        font-size: 10px;
        fill: #6b7280;
        font-family: sans-serif;
      }
      .data-circle {
        cursor: pointer;
        transition: r 0.2s ease;
      }
      .data-circle:hover {
        r: 8;
      }
      .point-inspector {
        background: #f8fafc;
        border: 1px solid #e2e8f0;
        border-radius: 8px;
        padding: 12px;
        margin-top: 12px;
      }
      .inspector-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 8px;
      }
      .inspector-date {
        font-size: 13px;
        font-weight: 700;
        color: #1e293b;
        display: flex;
        align-items: center;
        gap: 6px;
      }
      .status-badge {
        font-size: 10px;
      }
      .status-badge.progressing {
        background: #d1fae5;
        color: #065f46;
      }
      .status-badge.deteriorating {
        background: #fee2e2;
        color: #b91c1c;
      }
      .status-badge.stagnant {
        background: #fef3c7;
        color: #b45309;
      }
      .inspector-details {
        display: grid;
        grid-template-columns: 1fr;
        gap: 6px;
        font-size: 12px;
      }
      @media (min-width: 480px) {
        .inspector-details {
          grid-template-columns: 1fr 1fr;
        }
      }
      .detail-item {
        display: flex;
        justify-content: space-between;
        padding: 4px 6px;
        background: #ffffff;
        border-radius: 4px;
        border: 1px solid #f1f5f9;
      }
      .detail-title {
        color: #64748b;
      }
      .detail-val {
        font-weight: 600;
        color: #0f172a;
      }
      .detail-val.highlight {
        color: #059669;
        font-weight: 700;
      }
      .detail-val.highlight-push {
        color: #2563eb;
        font-weight: 700;
      }
      .text-healed {
        color: #059669;
      }
      .text-enlarged {
        color: #dc2626;
      }
      .recommendations-box {
        background: #f0fdf4;
        border: 1px solid #bbf7d0;
        border-radius: 8px;
        padding: 12px;
        margin-top: 14px;
      }
      .rec-header {
        display: flex;
        align-items: center;
        gap: 6px;
        color: #166534;
        margin-bottom: 6px;
      }
      .rec-header h5 {
        margin: 0;
        font-size: 13px;
        font-weight: 700;
      }
      .recommendations-box ul {
        margin: 0;
        padding-left: 18px;
        color: #15803d;
        font-size: 12px;
      }
      .recommendations-box li {
        margin-bottom: 4px;
      }
    `,
  ],
})
export class HealingTrajectoryGraphComponent implements OnChanges {
  @Input() trajectory: BedsideHealingTrajectory | null = null;

  activeMetric: 'area' | 'push' | 'depth' = 'area';
  selectedPointIndex = 0;
  Math = Math;

  svgWidth = 400;
  svgHeight = 200;
  paddingLeft = 40;
  paddingRight = 24;
  paddingTop = 24;
  paddingBottom = 30;

  chartPoints: Array<{ x: number; y: number; val: number; raw: TrajectoryDataPoint }> = [];
  svgLinePath = '';
  svgAreaPath = '';
  zeroY = 0;
  yTicks: Array<{ y: number; val: number }> = [];

  constructor() {
    addIcons({
      trendingDownOutline,
      trendingUpOutline,
      removeOutline,
      analyticsOutline,
      medicalOutline,
      alertCircleOutline,
      calendarOutline,
      speedometerOutline,
      sparklesOutline,
    });
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['trajectory'] && this.trajectory) {
      this.selectedPointIndex = Math.max(0, this.trajectory.points.length - 1);
      this.calculateChartGeometry();
    }
  }

  onMetricChange(event: any) {
    this.activeMetric = event.detail.value;
    this.calculateChartGeometry();
  }

  selectPoint(index: number) {
    this.selectedPointIndex = index;
  }

  get selectedPoint(): TrajectoryDataPoint | null {
    if (!this.trajectory || !this.trajectory.points.length) return null;
    return this.trajectory.points[this.selectedPointIndex] || null;
  }

  private calculateChartGeometry(): void {
    if (!this.trajectory || !this.trajectory.points.length) return;

    const points = this.trajectory.points;
    const values = points.map(p => {
      if (this.activeMetric === 'area') return p.areaCm2;
      if (this.activeMetric === 'push') return p.pushScore;
      return p.depthCm || 0;
    });

    const maxVal = Math.max(...values, this.activeMetric === 'push' ? 17 : 5);
    const minVal = 0;
    const valRange = Math.max(maxVal - minVal, 1);

    const plotWidth = this.svgWidth - this.paddingLeft - this.paddingRight;
    const plotHeight = this.svgHeight - this.paddingTop - this.paddingBottom;

    this.chartPoints = points.map((p, idx) => {
      const v = values[idx];
      const x =
        points.length === 1
          ? this.paddingLeft + plotWidth / 2
          : this.paddingLeft + (idx / (points.length - 1)) * plotWidth;
      const y = this.paddingTop + plotHeight - ((v - minVal) / valRange) * plotHeight;
      return { x, y, val: v, raw: p };
    });

    this.zeroY = this.paddingTop + plotHeight;

    // Build SVG path strings
    if (this.chartPoints.length === 1) {
      const pt = this.chartPoints[0];
      this.svgLinePath = `M ${pt.x - 20} ${pt.y} L ${pt.x + 20} ${pt.y}`;
      this.svgAreaPath = `M ${pt.x - 20} ${this.zeroY} L ${pt.x - 20} ${pt.y} L ${pt.x + 20} ${pt.y} L ${pt.x + 20} ${this.zeroY} Z`;
    } else {
      let lineD = '';
      this.chartPoints.forEach((pt, idx) => {
        lineD += idx === 0 ? `M ${pt.x} ${pt.y}` : ` L ${pt.x} ${pt.y}`;
      });
      this.svgLinePath = lineD;

      const firstPt = this.chartPoints[0];
      const lastPt = this.chartPoints[this.chartPoints.length - 1];
      this.svgAreaPath = `${lineD} L ${lastPt.x} ${this.zeroY} L ${firstPt.x} ${this.zeroY} Z`;
    }

    // Y ticks
    this.yTicks = [0, 0.25, 0.5, 0.75, 1].map(frac => {
      const val = Math.round((minVal + frac * valRange) * 10) / 10;
      const y = this.paddingTop + plotHeight - frac * plotHeight;
      return { y, val };
    });
  }
}
