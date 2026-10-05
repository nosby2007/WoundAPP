import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { IonAvatar, IonBadge, IonButton, IonContent, IonHeader, IonIcon, IonInput, IonItem, IonLabel, IonList, IonNote, IonTitle, IonToolbar } from '@ionic/angular/standalone';
import { chevronBackOutline, sendOutline } from 'ionicons/icons';
import { Observable, of } from 'rxjs';
import { ChatMessage, Conversation, SecureChatService, StaffEntry } from '../../services/secure-chat.service';

@Component({
  selector: 'app-chat',
  standalone: true,
  imports: [CommonModule, FormsModule, IonHeader, IonToolbar, IonTitle, IonContent, IonList, IonItem, IonLabel, IonAvatar, IonBadge, IonButton, IonIcon, IonInput, IonNote],
  template: `
    <ion-header><ion-toolbar><ion-title>Secure Chat</ion-title></ion-toolbar></ion-header>
    <ion-content>
      <div class="chat-shell">
        <section class="sidebar" [class.hidden-mobile]="active">
          <div class="section-title">Start conversation</div>
          <ion-list lines="none">
            <ion-item button detail="false" *ngFor="let staff of staff$ | async" (click)="start(staff)">
              <ion-avatar slot="start"><div class="avatar">{{ initials(staff.displayName) }}</div></ion-avatar>
              <ion-label><strong>{{ staff.displayName }}</strong><p>{{ staff.role || 'staff' }}</p></ion-label>
            </ion-item>
          </ion-list>
          <div class="section-title">Messages</div>
          <ion-list lines="full">
            <ion-item button *ngFor="let c of conversations$ | async" (click)="open(c)">
              <ion-label><strong>{{ c.otherName }}</strong><p>{{ c.lastText || 'Secure conversation' }}</p></ion-label>
              <ion-badge color="danger" *ngIf="c.myUnread">{{ c.myUnread }}</ion-badge>
            </ion-item>
          </ion-list>
        </section>

        <section class="thread" *ngIf="active; else choose">
          <div class="thread-head"><ion-button fill="clear" size="small" (click)="active=null"><ion-icon [icon]="chevronBackOutline"></ion-icon></ion-button><div><strong>{{ active.otherName }}</strong><p>Secure staff message</p></div></div>
          <div class="messages">
            <div *ngFor="let m of messages$ | async" class="bubble" [class.mine]="m.fromUid !== active.otherUid"><small>{{ m.fromName }}</small><div>{{ m.text }}</div></div>
          </div>
          <div class="composer"><ion-input [(ngModel)]="draft" placeholder="Message" (keyup.enter)="send()"></ion-input><ion-button (click)="send()" [disabled]="!draft.trim()"><ion-icon [icon]="sendOutline"></ion-icon></ion-button></div>
        </section>
        <ng-template #choose><section class="empty"><ion-note>Select a staff member or conversation.</ion-note></section></ng-template>
      </div>
    </ion-content>
  `,
  styles: [`
    .chat-shell{display:grid;grid-template-columns:minmax(280px,34%) 1fr;height:100%;background:#f5f7fb}.sidebar{background:white;border-right:1px solid #e5e7eb;overflow:auto}.section-title{padding:18px 16px 8px;font-size:11px;font-weight:800;letter-spacing:.1em;color:#64748b;text-transform:uppercase}.avatar{width:40px;height:40px;border-radius:50%;display:grid;place-items:center;background:#e8f5ee;color:#0f6b46;font-weight:800}.thread{display:flex;flex-direction:column;min-width:0}.thread-head{height:64px;background:white;border-bottom:1px solid #e5e7eb;display:flex;align-items:center;padding:0 10px}.thread-head p{margin:2px 0 0;color:#64748b;font-size:12px}.messages{flex:1;overflow:auto;padding:18px;display:flex;flex-direction:column;gap:10px}.bubble{align-self:flex-start;max-width:80%;background:white;border-radius:16px 16px 16px 4px;padding:10px 12px;box-shadow:0 3px 12px rgba(15,23,42,.06)}.bubble.mine{align-self:flex-end;background:#0f6b46;color:white;border-radius:16px 16px 4px 16px}.bubble small{display:block;opacity:.7;margin-bottom:3px}.composer{display:flex;gap:8px;padding:10px;background:white;border-top:1px solid #e5e7eb}.empty{display:grid;place-items:center;height:100%}@media(max-width:720px){.chat-shell{grid-template-columns:1fr}.thread{position:absolute;inset:0;background:#f5f7fb;z-index:3}.hidden-mobile{display:none}}
  `]
})
export class ChatPage {
  readonly chevronBackOutline = chevronBackOutline;
  readonly sendOutline = sendOutline;
  readonly staff$: Observable<StaffEntry[]>;
  readonly conversations$: Observable<Conversation[]>;
  active: Conversation | null = null;
  messages$: Observable<ChatMessage[]> = of([]);
  draft = '';

  constructor(public chat: SecureChatService) {
    // Keep these Observable instances stable. Creating them from methods in the
    // template caused AsyncPipe to unsubscribe/resubscribe on every change
    // detection pass, which could thrash Firestore listeners and freeze the tab.
    this.staff$ = chat.staff$();
    this.conversations$ = chat.conversations$();
  }

  initials(name:string):string { return name.split(/\s+/).filter(Boolean).slice(0,2).map(x => x[0]?.toUpperCase()).join('') || 'ST'; }
  async start(staff: StaffEntry): Promise<void> { const id = await this.chat.start(staff); this.active = { id, members: [], otherUid: staff.uid, otherName: staff.displayName, myUnread: 0 }; this.messages$ = this.chat.messages$(id); }
  async open(c: Conversation): Promise<void> { this.active = c; this.messages$ = this.chat.messages$(c.id); await this.chat.markRead(c.id); }
  async send(): Promise<void> { if (!this.active || !this.draft.trim()) return; const text = this.draft; this.draft = ''; await this.chat.send(this.active.otherUid, this.active.otherName, text); }
}
