import { Component, OnInit } from '@angular/core';
import { FieldRolePolicyService } from '../services/field-role-policy.service';
import {
  calendarOutline,
  chatbubblesOutline,
  createOutline,
  ellipsisHorizontalCircleOutline,
  peopleOutline,
} from 'ionicons/icons';

@Component({
  selector: 'app-tabs',
  templateUrl: 'tabs.page.html',
  styleUrls: ['tabs.page.scss'],
  standalone: false,
})
export class TabsPage implements OnInit {
  readonly peopleOutline = peopleOutline;
  readonly calendarOutline = calendarOutline;
  readonly createOutline = createOutline;
  readonly chatbubblesOutline = chatbubblesOutline;
  readonly ellipsisHorizontalCircleOutline = ellipsisHorizontalCircleOutline;

  canSeeClinical = false;
  canSeeField = false;
  canSeeNote = false;
  canSeeIntakePatients = false;
  patientsHref = '/tabs/patients';

  constructor(private rolePolicy: FieldRolePolicyService) {}

  async ngOnInit(): Promise<void> {
    const identity = await this.rolePolicy.currentIdentity();
    this.canSeeClinical = this.rolePolicy.canUseClinicalWorkspace(identity);
    this.canSeeField = this.rolePolicy.canUseFieldToday(identity);
    this.canSeeNote = this.canSeeClinical;
    this.canSeeIntakePatients = !this.canSeeClinical && this.rolePolicy.canUseSchedulingWorkspace(identity);
    this.patientsHref = this.canSeeIntakePatients ? '/tabs/intake-patients' : '/tabs/patients';
  }
}
