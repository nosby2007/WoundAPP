import { CommonModule } from '@angular/common';
import { Component, OnDestroy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { Observable, Subscription, of } from 'rxjs';

import { MobileChatMessage, MobileConversation, MobileStaffDirectoryEntry, SecureChatService } from 'src/app/SERVICE/secure-chat.service';

@Component({
  selector: 'app-chat',
  standalone: true,
  imports: [CommonModule, FormsModule, MatButtonModule, MatCardModule, MatFormFieldModule, MatIconModule, MatInputModule, MatSelectModule],
  template: `
    <section class="chat-shell">
      <header class="hero">
        <div><div class="eyebrow">SECURE TEAM COMMUNICATION</div><h1>Chat</h1><p>Messages stay inside the authenticated clinical workspace.</p></div>
        <button mat-stroked-button type="button" (click)="showNewChat = !showNewChat"><mat-icon>add_comment</mat-icon>New chat</button>
      </header>

      <div class="new-chat" *ngIf="showNewChat">
        <mat-form-field appearance="outline">
          <mat-label>Staff member</mat-label>
          <mat-select [(ngModel)]="newStaffUid">
            <mat-option *ngFor="let staff of chat.staff$ | async" [value]="staff.uid">{{ staff.displayName }} <small>({{ staff.role || 'staff' }})</small></mat-option>
          </mat-select>
        </mat-form-field>
        <button mat-flat-button color="primary" type="button" (click)="startChat()" [disabled]="!newStaffUid || busy">Start</button>
      </div>

      <div class="workspace">
        <aside class="conversations">
          <button type="button" class="conversation" *ngFor="let conversation of chat.conversations$ | async; trackBy: trackConversation" (click)="selectConversation(conversation)" [class.active]="conversation.id === active?.id">
            <div class="avatar">{{ initials(conversation.otherName) }}</div>
            <div class="conversation-copy">
              <strong>{{ conversation.otherName }}</strong>
              <span>{{ conversation.lastText || 'Start a secure conversation' }}</span>
            </div>
            <div class="conversation-meta">
              <small>{{ chat.toDate(conversation.lastAt || conversation.updatedAt) | date:'shortTime' }}</small>
              <b *ngIf="conversation.myUnread">{{ conversation.myUnread }}</b>
            </div>
          </button>
          <div class="empty" *ngIf="(chat.conversations$ | async)?.length === 0">No conversations yet.</div>
        </aside>

        <main class="thread" *ngIf="active; else noThread">
          <div class="thread-head"><div class="avatar">{{ initials(active.otherName) }}</div><div><strong>{{ active.otherName }}</strong><span>Secure staff message</span></div></div>
          <div class="messages">
            <div class="message" *ngFor="let message of messages$ | async; trackBy: trackMessage" [class.mine]="message.fromUid === meUid">
              <div class="bubble"><small>{{ message.fromName }}</small><p>{{ message.text }}</p><time>{{ chat.toDate(message.createdAt) | date:'shortTime' }}</time></div>
            </div>
          </div>
          <form class="composer" (ngSubmit)="send()">
            <mat-form-field appearance="outline"><mat-label>Secure message</mat-label><textarea matInput rows="2" [(ngModel)]="draft" name="draft" maxlength="2000"></textarea></mat-form-field>
            <button mat-flat-button color="primary" type="submit" [disabled]="!draft.trim() || busy"><mat-icon>send</mat-icon>Send</button>
          </form>
        </main>

        <ng-template #noThread><main class="thread no-thread"><mat-icon>forum</mat-icon><h2>Select a conversation</h2><p>Choose a staff member or start a new secure chat.</p></main></ng-template>
      </div>

      <div class="error" *ngIf="errorText">{{ errorText }}</div>
    </section>
  `,
  styles: [`
    :host{display:block;background:#f4f7f6;min-height:100vh;padding:16px 12px 96px;color:#12352b}.chat-shell{max-width:1040px;margin:0 auto}.hero{display:flex;justify-content:space-between;gap:16px;align-items:center;background:#fff;border:1px solid #e2e9e6;border-radius:22px;padding:20px}.eyebrow{font-size:11px;font-weight:800;letter-spacing:.12em;color:#198754}.hero h1{font-size:30px;margin:3px 0}.hero p{margin:0;color:#657771}.new-chat{display:flex;gap:10px;align-items:center;background:#fff;border:1px solid #e2e9e6;padding:12px;border-radius:16px;margin-top:12px}.new-chat mat-form-field{flex:1}.workspace{display:grid;grid-template-columns:330px minmax(0,1fr);background:#fff;border:1px solid #e2e9e6;border-radius:22px;overflow:hidden;margin-top:14px;min-height:620px}.conversations{border-right:1px solid #e5ece9;padding:8px}.conversation{width:100%;border:0;background:transparent;display:grid;grid-template-columns:42px 1fr auto;gap:10px;text-align:left;padding:12px;border-radius:14px;cursor:pointer}.conversation:hover,.conversation.active{background:#eef7f2}.avatar{width:40px;height:40px;border-radius:13px;background:#dff0e7;color:#146c43;display:grid;place-items:center;font-weight:800}.conversation-copy{min-width:0}.conversation-copy strong,.conversation-copy span{display:block}.conversation-copy span{font-size:12px;color:#66766f;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-top:3px}.conversation-meta{text-align:right;font-size:11px;color:#77857f}.conversation-meta b{display:block;background:#198754;color:#fff;border-radius:999px;min-width:20px;padding:2px 5px;margin:5px 0 0 auto}.thread{display:grid;grid-template-rows:auto 1fr auto;min-width:0}.thread-head{display:flex;align-items:center;gap:10px;padding:14px 16px;border-bottom:1px solid #e5ece9}.thread-head strong,.thread-head span{display:block}.thread-head span{font-size:12px;color:#718079}.messages{padding:18px;overflow:auto;background:#f8faf9;max-height:520px}.message{display:flex;margin:8px 0}.message.mine{justify-content:flex-end}.bubble{max-width:75%;background:#fff;border:1px solid #e3e9e6;border-radius:16px 16px 16px 4px;padding:9px 11px}.mine .bubble{background:#dff4e7;border-color:#c8e9d5;border-radius:16px 16px 4px 16px}.bubble small,.bubble time{font-size:10px;color:#718079}.bubble p{margin:4px 0;white-space:pre-wrap;word-break:break-word}.composer{display:flex;gap:10px;padding:12px;border-top:1px solid #e5ece9;align-items:end}.composer mat-form-field{flex:1}.empty,.no-thread{padding:30px;color:#718079;text-align:center}.no-thread{display:flex;flex-direction:column;align-items:center;justify-content:center}.no-thread mat-icon{font-size:48px;width:48px;height:48px}.error{background:#8f1f1f;color:#fff;border-radius:12px;padding:10px;margin-top:12px}@media(max-width:760px){:host{padding:10px 8px 90px}.hero{align-items:flex-start;flex-direction:column}.workspace{grid-template-columns:1fr;min-height:0}.conversations{border-right:0;border-bottom:1px solid #e5ece9;max-height:260px;overflow:auto}.thread{min-height:520px}.messages{max-height:390px}.new-chat{align-items:stretch;flex-direction:column}}
  `],
})
export class ChatComponent implements OnDestroy {
  active: MobileConversation | null = null;
  messages$: Observable<MobileChatMessage[]> = of([]);
  meUid: string | null = null;
  draft = '';
  newStaffUid = '';
  showNewChat = false;
  busy = false;
  errorText = '';
  private sub = new Subscription();

  constructor(public chat: SecureChatService) {
    this.sub.add(this.chat.meUid$.subscribe(uid => this.meUid = uid));
  }

  async selectConversation(conversation: MobileConversation): Promise<void> {
    this.active = conversation;
    this.messages$ = this.chat.messages$(conversation.id);
    try { await this.chat.markRead(conversation.id); } catch { /* unread reset is best-effort */ }
  }

  async startChat(): Promise<void> {
    const staff = await this.findStaff(this.newStaffUid);
    if (!staff) return;
    this.busy = true;
    this.errorText = '';
    try {
      const id = await this.chat.startConversation(staff);
      this.active = { id, members: [], otherUid: staff.uid, otherName: staff.displayName, myUnread: 0 };
      this.messages$ = this.chat.messages$(id);
      this.showNewChat = false;
      this.newStaffUid = '';
    } catch (error: any) {
      this.errorText = error?.message || 'Unable to start secure conversation.';
    } finally { this.busy = false; }
  }

  async send(): Promise<void> {
    if (!this.active || !this.draft.trim()) return;
    const text = this.draft.trim();
    this.busy = true;
    this.errorText = '';
    try {
      const id = await this.chat.send(this.active.otherUid, this.active.otherName, text);
      if (id && id !== this.active.id) {
        this.active = { ...this.active, id };
        this.messages$ = this.chat.messages$(id);
      }
      this.draft = '';
    } catch (error: any) {
      this.errorText = error?.message || 'Unable to send message.';
    } finally { this.busy = false; }
  }

  initials(name: string): string {
    return String(name || 'S').trim().split(/\s+/).slice(0, 2).map(part => part[0]?.toUpperCase() || '').join('') || 'S';
  }

  private findStaff(uid: string): Promise<MobileStaffDirectoryEntry | null> {
    return new Promise(resolve => {
      const sub = this.chat.staff$.subscribe(list => {
        resolve(list.find(item => item.uid === uid) || null);
        sub.unsubscribe();
      });
    });
  }

  trackConversation = (_: number, item: MobileConversation) => item.id;
  trackMessage = (_: number, item: MobileChatMessage) => item.id;
  ngOnDestroy(): void { this.sub.unsubscribe(); }
}
