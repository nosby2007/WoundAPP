import { Injectable } from '@angular/core';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../firebase';

export interface MobileVoiceNoteResult {
  transcript: string;
  draft: string;
  provenance: {
    sessionId: string;
    transcriptSha256: string;
    durationSeconds: number;
    mimeType: string;
    recordedAtIso: string;
    language?: string | null;
  };
}

@Injectable({ providedIn: 'root' })
export class MobileVoiceNoteService {
  private recorder: MediaRecorder | null = null;
  private stream: MediaStream | null = null;
  private chunks: Blob[] = [];
  private startedAt = 0;

  get supported(): boolean {
    return typeof navigator !== 'undefined' &&
      !!navigator.mediaDevices?.getUserMedia &&
      typeof MediaRecorder !== 'undefined';
  }

  get recording(): boolean {
    return this.recorder?.state === 'recording';
  }

  async start(): Promise<void> {
    if (!this.supported) throw new Error('Voice dictation is not supported on this device/browser.');
    if (this.recording) return;

    this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const preferred = [
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/mp4',
    ].find((type) => MediaRecorder.isTypeSupported(type));

    this.chunks = [];
    this.recorder = preferred
      ? new MediaRecorder(this.stream, { mimeType: preferred })
      : new MediaRecorder(this.stream);

    this.recorder.ondataavailable = (event) => {
      if (event.data?.size) this.chunks.push(event.data);
    };
    this.startedAt = Date.now();
    this.recorder.start(500);
  }

  async stopAndCreateDraft(): Promise<MobileVoiceNoteResult> {
    if (!this.recorder || this.recorder.state !== 'recording') {
      throw new Error('No active voice recording.');
    }

    const recorder = this.recorder;
    const blob = await new Promise<Blob>((resolve, reject) => {
      recorder.onerror = () => reject(new Error('Voice recording failed.'));
      recorder.onstop = () => {
        const type = recorder.mimeType?.split(';')[0] || this.chunks[0]?.type?.split(';')[0] || 'audio/webm';
        resolve(new Blob(this.chunks, { type }));
      };
      recorder.stop();
    });

    this.stopStream();

    const durationSeconds = Math.max(1, Math.round((Date.now() - this.startedAt) / 1000));
    if (durationSeconds > 120) throw new Error('Voice dictation is limited to 2 minutes per clip.');
    if (!blob.size) throw new Error('Voice recording is empty.');
    if (blob.size > 3 * 1024 * 1024) throw new Error('Voice recording is too large. Record a shorter clip.');

    const callable = httpsCallable<any, any>(functions, 'transcribeClinicalVoiceV1');
    const response = await callable({
      audioBase64: await this.toBase64(blob),
      mimeType: blob.type || 'audio/webm',
      durationSeconds,
      reportType: 'wound_progress_note',
      sections: [
        { key: 'visit_note', title: 'Clinician visit narrative', required: false },
      ],
      language: null,
    });

    const data = response.data || {};
    const draft = Array.isArray(data.drafts)
      ? String(data.drafts.find((item: any) => item?.key === 'visit_note')?.text || '').trim()
      : '';

    if (!draft) throw new Error('Dictation was transcribed, but no clinical narrative draft was produced.');

    return {
      transcript: String(data.transcript || '').trim(),
      draft,
      provenance: data.provenance,
    };
  }

  cancel(): void {
    if (this.recorder?.state === 'recording') {
      this.recorder.onstop = null;
      this.recorder.stop();
    }
    this.stopStream();
    this.chunks = [];
    this.startedAt = 0;
  }

  private stopStream(): void {
    this.stream?.getTracks().forEach((track) => track.stop());
    this.stream = null;
    this.recorder = null;
  }

  private toBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error('Unable to read the voice recording.'));
      reader.onload = () => {
        const result = String(reader.result || '');
        const comma = result.indexOf(',');
        resolve(comma >= 0 ? result.slice(comma + 1) : result);
      };
      reader.readAsDataURL(blob);
    });
  }
}
