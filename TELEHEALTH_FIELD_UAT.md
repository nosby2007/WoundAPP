# WoundAPP field telehealth

Nurse entry points: More > Telehealth (New), physical visit > New Telehealth,
or the wound row > New Telehealth. Creation requires an existing patient,
persisted wound, same-organization provider and consultation reason.

The mobile screen records facilitated consent through the existing JADE
callable API and joins its canonical Twilio room directly. No JADE browser
handoff is required for the nurse. The NP starts/ends the encounter and signs
the provider note in JADE. Billing remains in JADE.

No new Firestore collections or clinical writes are introduced. Existing
authentication, tenant isolation and server-side participant checks remain
authoritative. Tokens are held in memory, never persisted. Virtual appointments
redirect before the physical EVV initialization path. Video requires an online
connection; requests are not placed in the clinical offline queue.

## Required device UAT before release

1. Sign in as an authorized nurse and create a consultation from a wound.
2. Verify patient/wound/provider and record actual patient consent/location.
3. Join from WoundAPP and from the assigned NP account in JADE.
4. Verify two-way audio/video, mute, camera, permissions denied and retry.
5. Verify NP termination disconnects the mobile participant.
6. Navigate away/background the phone: microphone/camera must stop.
7. Attempt another tenant, unassigned participant and unsigned-in access:
   server must deny access.
8. Verify the physical visit's EVV is unchanged by video actions.
9. Verify the NP note and billing review remain in JADE.

Limitations: no push/page notification of the NP; nurse must notify the NP.
No nurse consultation inbox/resume list yet. No automatic physical-visit parent
link is invented; the consultation preserves its canonical patient/wound link.
Capacitor native device camera support requires separate device validation.
No Medicare billability is inferred from video participation.
