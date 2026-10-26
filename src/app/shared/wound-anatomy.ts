export type BodyView = 'front' | 'back';
export type BodyProfile = 'female' | 'male';
export type AnatomicalLaterality = 'left' | 'right' | 'midline';

export interface AnatomicalZone {
  id: string;
  view: BodyView;
  region: string;
  laterality: AnatomicalLaterality;
  surface: 'anterior' | 'posterior';
  label: string;
  x: number;
  y: number;
}
export interface WoundAnatomyPosition extends AnatomicalZone {
  schemaVersion: 1;
  profile: BodyProfile;
}

export interface WoundMapMarker extends WoundAnatomyPosition {
  woundId: string;
  woundLabel: string;
  status?: string | null;
  index?: number;
}

const zone = (
  id: string,
  view: BodyView,
  region: string,
  laterality: AnatomicalLaterality,
  x: number,
  y: number,
): AnatomicalZone => {
  const surface = view === 'front' ? 'anterior' : 'posterior';
  const side = laterality === 'midline' ? '' : `${laterality[0].toUpperCase()}${laterality.slice(1)} `;
  const surfaceLabel = ['head', 'neck', 'groin', 'sacrum'].includes(region.toLowerCase()) ? '' : `${surface} `;
  return { id, view, region, laterality, surface, label: `${side}${surfaceLabel}${region}`.trim(), x, y };
};

/** Screen left is the patient's right on the front view and the patient's left on the back view. */
export const ANATOMICAL_ZONES: readonly AnatomicalZone[] = [
  zone('front-head', 'front', 'head', 'midline', 50, 8),
  zone('front-neck', 'front', 'neck', 'midline', 50, 16),
  zone('front-right-chest', 'front', 'chest', 'right', 43, 25),
  zone('front-left-chest', 'front', 'chest', 'left', 57, 25),
  zone('front-right-abdomen', 'front', 'abdomen', 'right', 44, 35),
  zone('front-left-abdomen', 'front', 'abdomen', 'left', 56, 35),
  zone('front-groin', 'front', 'groin', 'midline', 50, 44),
  zone('front-right-upper-arm', 'front', 'upper arm', 'right', 31, 29),
  zone('front-left-upper-arm', 'front', 'upper arm', 'left', 69, 29),
  zone('front-right-forearm', 'front', 'forearm', 'right', 25, 42),
  zone('front-left-forearm', 'front', 'forearm', 'left', 75, 42),
  zone('front-right-hand', 'front', 'hand', 'right', 21, 52),
  zone('front-left-hand', 'front', 'hand', 'left', 79, 52),
  zone('front-right-thigh', 'front', 'thigh', 'right', 43, 56),
  zone('front-left-thigh', 'front', 'thigh', 'left', 57, 56),
  zone('front-right-knee', 'front', 'knee', 'right', 43, 68),
  zone('front-left-knee', 'front', 'knee', 'left', 57, 68),
  zone('front-right-lower-leg', 'front', 'lower leg', 'right', 43, 79),
  zone('front-left-lower-leg', 'front', 'lower leg', 'left', 57, 79),
  zone('front-right-ankle', 'front', 'ankle', 'right', 43, 90),
  zone('front-left-ankle', 'front', 'ankle', 'left', 57, 90),
  zone('front-right-foot', 'front', 'dorsal foot', 'right', 42, 96),
  zone('front-left-foot', 'front', 'dorsal foot', 'left', 58, 96),

  zone('back-occiput', 'back', 'occiput', 'midline', 50, 8),
  zone('back-neck', 'back', 'neck', 'midline', 50, 16),
  zone('back-left-upper-back', 'back', 'upper back', 'left', 43, 25),
  zone('back-right-upper-back', 'back', 'upper back', 'right', 57, 25),
  zone('back-left-lower-back', 'back', 'lower back', 'left', 44, 36),
  zone('back-right-lower-back', 'back', 'lower back', 'right', 56, 36),
  zone('back-sacrum', 'back', 'sacrum', 'midline', 50, 43),
  zone('back-left-buttock', 'back', 'buttock', 'left', 44, 48),
  zone('back-right-buttock', 'back', 'buttock', 'right', 56, 48),
  zone('back-left-upper-arm', 'back', 'upper arm', 'left', 31, 29),
  zone('back-right-upper-arm', 'back', 'upper arm', 'right', 69, 29),
  zone('back-left-elbow', 'back', 'elbow', 'left', 27, 38),
  zone('back-right-elbow', 'back', 'elbow', 'right', 73, 38),
  zone('back-left-forearm', 'back', 'forearm', 'left', 24, 46),
  zone('back-right-forearm', 'back', 'forearm', 'right', 76, 46),
  zone('back-left-hand', 'back', 'hand', 'left', 21, 52),
  zone('back-right-hand', 'back', 'hand', 'right', 79, 52),
  zone('back-left-thigh', 'back', 'thigh', 'left', 43, 58),
  zone('back-right-thigh', 'back', 'thigh', 'right', 57, 58),
  zone('back-left-knee', 'back', 'popliteal area', 'left', 43, 69),
  zone('back-right-knee', 'back', 'popliteal area', 'right', 57, 69),
  zone('back-left-calf', 'back', 'calf', 'left', 43, 80),
  zone('back-right-calf', 'back', 'calf', 'right', 57, 80),
  zone('back-left-heel', 'back', 'heel', 'left', 43, 94),
  zone('back-right-heel', 'back', 'heel', 'right', 57, 94),
] as const;

export function zonesForView(view: BodyView): AnatomicalZone[] {
  return ANATOMICAL_ZONES.filter(item => item.view === view);
}

export function selectAnatomicalZone(view: BodyView, x: number, y: number, profile: BodyProfile): WoundAnatomyPosition | null {
  const candidate = zonesForView(view)
    .map(item => ({ item, distance: Math.hypot(item.x - x, item.y - y) }))
    .sort((a, b) => a.distance - b.distance)[0];
  if (!candidate || candidate.distance > 11) return null;
  return { ...candidate.item, schemaVersion: 1, profile };
}

export function positionForZone(id: string, profile: BodyProfile): WoundAnatomyPosition | null {
  const item = ANATOMICAL_ZONES.find(candidate => candidate.id === id);
  return item ? { ...item, schemaVersion: 1, profile } : null;
}

export function normalizeWoundAnatomy(value: unknown): WoundAnatomyPosition | null {
  if (!value || typeof value !== 'object') return null;
  const raw = value as Partial<WoundAnatomyPosition>;
  const canonical = ANATOMICAL_ZONES.find(item => item.id === raw.id);
  if (!canonical) return null;
  const profile: BodyProfile = raw.profile === 'female' ? 'female' : 'male';
  return { ...canonical, schemaVersion: 1, profile };
}
