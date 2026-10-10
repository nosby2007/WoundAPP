import { FormBuilder, Validators } from '@angular/forms';

/** Canonical JADE procedure fields; never copy a previous visit's procedure. */
export function assessmentDebridementGroup(fb: FormBuilder) {
  const measurement = () => fb.control<number | null>(null, Validators.min(0));
  const group = fb.group({
    performed: fb.control<boolean | null>(null),
    type: [''], indication: [''], consentObtained: fb.control<boolean | null>(null),
    instrument: [''], tissueLevel: [''], areaDebridedCm2: measurement(),
    anesthesia: [''], hemostasis: [''], tolerated: [''], complications: [''], note: [''],
    postMeasurements: fb.group({
      length: measurement(), width: measurement(), depth: measurement(),
      area: measurement(), volume: measurement(),
    }),
  });
  // Unchecking hides the inputs without discarding an in-progress entry.
  // Disabled hidden controls cannot block saving because of an old invalid value.
  const updateVisibility = (performed: boolean | null) => {
    for (const [name, control] of Object.entries(group.controls)) {
      if (name === 'performed') continue;
      if (performed === true) control.enable({ emitEvent: false });
      else control.disable({ emitEvent: false });
    }
  };
  group.controls.performed.valueChanges.subscribe(updateVisibility);
  updateVisibility(null);
  return group;
}

export function assessmentDebridementPayload(value: any): any | null {
  if (value?.performed == null) return null;
  // Hidden fields must not describe a procedure that was not performed.
  if (value.performed !== true) return { performed: false };
  return { ...value, postMeasurements: { ...value.postMeasurements } };
}
