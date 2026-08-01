import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatSelectModule } from '@angular/material/select';
import { AuthService, RegisterRequest } from '../../../core/services/auth.service';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterLink,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatSelectModule
  ],
  template: `
    <div class="register-container">
      <mat-card>
        <mat-card-header>
          <mat-card-title>Join PulseChat</mat-card-title>
        </mat-card-header>
        <mat-card-content>
          <form [formGroup]="form" (ngSubmit)="onSubmit()">
            <mat-form-field appearance="outline" class="full-width">
              <mat-label>Username</mat-label>
              <input matInput formControlName="username" type="text" />
              <mat-error>Username 3-50 chars, alphanumeric and underscore</mat-error>
            </mat-form-field>
            <mat-form-field appearance="outline" class="full-width">
              <mat-label>Email</mat-label>
              <input matInput formControlName="email" type="email" />
              <mat-error>Valid email required</mat-error>
            </mat-form-field>
            <mat-form-field appearance="outline" class="full-width">
              <mat-label>Password</mat-label>
              <input matInput formControlName="password" type="password" />
              <mat-error>Min 8 chars, upper, lower, digit</mat-error>
            </mat-form-field>
            <mat-form-field appearance="outline" class="full-width">
              <mat-label>Gender</mat-label>
              <mat-select formControlName="gender">
                <mat-option value="MALE">Male</mat-option>
                <mat-option value="FEMALE">Female</mat-option>
              </mat-select>
            </mat-form-field>
            @if (errorMessage) {
              <p class="error">{{ errorMessage }}</p>
            }
            <button mat-flat-button color="primary" type="submit" [disabled]="form.invalid || loading" class="full-width">
              {{ loading ? 'Creating...' : 'Create Account' }}
            </button>
          </form>
        </mat-card-content>
        <mat-card-footer>
          <a routerLink="/auth/login">Already have account? Login</a>
        </mat-card-footer>
      </mat-card>
    </div>
  `,
  styles: [`
    .register-container { display: flex; justify-content: center; align-items: center; min-height: 100vh; padding: 16px; }
    mat-card { max-width: 400px; width: 100%; }
    .full-width { width: 100%; display: block; }
    .error { color: #f44336; margin: 8px 0; }
    mat-card-footer { padding: 16px; text-align: center; }
  `]
})
export class RegisterComponent {
  form: FormGroup;
  loading = false;
  errorMessage = '';

  constructor(
    private fb: FormBuilder,
    private auth: AuthService,
    private router: Router
  ) {
    this.form = this.fb.nonNullable.group({
      username: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(50), Validators.pattern(/^[a-zA-Z0-9_]+$/)]],
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(8), Validators.pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/)]],
      gender: ['MALE', Validators.required]
    });
  }

  onSubmit(): void {
    if (this.form.invalid) return;
    this.loading = true;
    this.errorMessage = '';
    this.auth.register(this.form.value as RegisterRequest).subscribe({
      next: () => this.router.navigate(['/chat']).then(() => (this.loading = false)),
      error: (err) => {
        this.loading = false;
        this.errorMessage = err.error?.error || 'Registration failed';
      },
      complete: () => (this.loading = false)
    });
  }
}
