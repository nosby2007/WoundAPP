import { Component } from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { IonicModule } from '@ionic/angular';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-login',
  
  standalone: true,                     // ✅ on assume standalone
  imports: [
    IonicModule,
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    RouterModule,
  ],
  templateUrl: './login.page.html',
  styleUrls: ['./login.page.scss'],
})
export class LoginPage {
  loading = false;
  errorMsg = '';

  form = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]],
  });

  constructor(
    private fb: FormBuilder,
    private auth: AuthService,
    private router: Router
  ) {}

  async submit() {
    if (this.form.invalid) return;
    const { email, password } = this.form.value;

    this.loading = true;
    this.errorMsg = '';

    try {
     await this.auth.login(email!, password!);
this.router.navigateByUrl('/tabs/patients', { replaceUrl: true });

    } catch (err: any) {
      console.error(err);
      this.errorMsg = err?.message || 'Login failed';
    } finally {
      this.loading = false;
    }
  }
}
