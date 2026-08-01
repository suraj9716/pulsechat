import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { AuthService, LoginRequest } from '../../../core/services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterLink,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule
  ],
  template: `
    <div class="login-container">
      <mat-card>
        <mat-card-header>
          <mat-card-title>PulseChat</mat-card-title>
        </mat-card-header>
        <mat-card-content>
          <form [formGroup]="form" (ngSubmit)="onSubmit()">
            <mat-form-field appearance="outline" class="full-width">
              <mat-label>Username or Email</mat-label>
              <input matInput formControlName="usernameOrEmail" type="text" />
              @if (form.get('usernameOrEmail')?.hasError('required') && form.get('usernameOrEmail')?.touched) {
                <mat-error>Required</mat-error>
              }
            </mat-form-field>
            <mat-form-field appearance="outline" class="full-width">
              <mat-label>Password</mat-label>
              <input matInput formControlName="password" type="password" />
              @if (form.get('password')?.hasError('required') && form.get('password')?.touched) {
                <mat-error>Required</mat-error>
              }
            </mat-form-field>
            @if (errorMessage) {
              <p class="error">{{ errorMessage }}</p>
            }
            <button mat-flat-button color="primary" type="submit" [disabled]="form.invalid || loading" class="full-width">
              {{ loading ? 'Signing in...' : 'Sign In' }}
            </button>
          </form>
        </mat-card-content>
        <mat-card-footer>
          <a routerLink="/auth/register">Create account</a>
        </mat-card-footer>
      </mat-card>
    </div>
  `,
  styles: [`
    .login-container { display: flex; justify-content: center; align-items: center; min-height: 100vh; padding: 16px; }
    mat-card { max-width: 400px; width: 100%; }
    .full-width { width: 100%; display: block; }
    .error { color: #f44336; margin: 8px 0; }
    mat-card-footer { padding: 16px; text-align: center; }
  `]
})
export class LoginComponent {
  form: FormGroup;
  loading = false;
  errorMessage = '';

  constructor(
    private fb: FormBuilder,
    private auth: AuthService,
    private router: Router
  ) {
    this.form = this.fb.nonNullable.group({
      usernameOrEmail: ['', Validators.required],
      password: ['', Validators.required]
    });
  }

  onSubmit(): void {
    if (this.form.invalid) return;
    this.loading = true;
    this.errorMessage = '';
    this.auth.login(this.form.value as LoginRequest).subscribe({
      next: () => this.router.navigate(['/chat']).then(() => (this.loading = false)),
      error: (err) => {
        this.loading = false;
        if (err.status === 401) {
          this.errorMessage =
            'Invalid username or password for this server. If you registered locally before, create a new account here (Render uses a separate database).';
        } else {
          this.errorMessage = err.error?.error || 'Login failed. Try again.';
        }
      },
      complete: () => (this.loading = false)
    });
  }
}
