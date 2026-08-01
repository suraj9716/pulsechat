import { Component, OnInit, signal } from '@angular/core';

import { CommonModule } from '@angular/common';

import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';

import { MatCardModule } from '@angular/material/card';

import { MatFormFieldModule } from '@angular/material/form-field';

import { MatInputModule } from '@angular/material/input';

import { MatSelectModule } from '@angular/material/select';

import { MatButtonModule } from '@angular/material/button';

import { MatIconModule } from '@angular/material/icon';

import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';

import { UserApiService, MyProfile, PublicUserProfile } from '../../../core/services/user-api.service';

import { FriendApiService, FriendStatusResponse } from '../../../core/services/friend-api.service';

import { BlockApiService } from '../../../core/services/block-api.service';

import { ChatApiService } from '../../../core/services/chat-api.service';

import { CallService } from '../../../core/services/call.service';

import { FriendNotificationService } from '../../../core/services/friend-notification.service';

import { AuthService } from '../../../core/services/auth.service';



@Component({

  selector: 'app-profile',

  standalone: true,

  imports: [

    CommonModule,

    ReactiveFormsModule,

    RouterLink,

    MatCardModule,

    MatFormFieldModule,

    MatInputModule,

    MatSelectModule,

    MatButtonModule,

    MatIconModule,

    MatSnackBarModule

  ],

  template: `

    <div class="profile-page">

      @if (loading()) {

        <p class="loading">Loading profile...</p>

      } @else if (isOwnProfile()) {

        <header class="hero">

          <div class="avatar large">{{ initials(myProfile()?.username) }}</div>

          <h1>My Profile</h1>

          <p>Manage how others see you on PulseChat</p>

        </header>



        <mat-card class="profile-card">

          <form [formGroup]="form" (ngSubmit)="save()">

            <mat-form-field appearance="outline" class="full-width">

              <mat-label>Username</mat-label>

              <input matInput formControlName="username" />

              <mat-hint>3–50 chars, letters, numbers, underscore</mat-hint>

              @if (form.get('username')?.invalid && form.get('username')?.touched) {

                <mat-error>Invalid username</mat-error>

              }

            </mat-form-field>



            <div class="readonly-field">

              <label>Email</label>

              <span>{{ myProfile()?.email }}</span>

              <small>Only you can see your email</small>

            </div>



            <mat-form-field appearance="outline" class="full-width">

              <mat-label>Gender</mat-label>

              <mat-select formControlName="gender">

                <mat-option value="MALE">Male</mat-option>

                <mat-option value="FEMALE">Female</mat-option>

              </mat-select>

            </mat-form-field>



            <mat-form-field appearance="outline" class="full-width">

              <mat-label>Bio</mat-label>

              <textarea matInput formControlName="bio" rows="3" placeholder="Tell others about yourself..."></textarea>

            </mat-form-field>



            <button mat-flat-button color="primary" type="submit" [disabled]="form.invalid || saving()">

              {{ saving() ? 'Saving...' : 'Save Profile' }}

            </button>

          </form>

        </mat-card>

      } @else if (publicProfile()) {

        <header class="hero public">

          <div class="avatar large">{{ initials(publicProfile()!.username) }}</div>

          <h1>{{ publicProfile()!.username }}</h1>

          <span class="gender-badge">{{ genderLabel(publicProfile()!.gender) }}</span>

          <span class="status-pill" [class.online]="publicProfile()!.onlineStatus">

            {{ publicProfile()!.onlineStatus ? 'Online' : 'Offline' }}

          </span>

        </header>



        <mat-card class="profile-card">

          <h3>About</h3>

          <p class="bio">{{ publicProfile()!.bio || 'No bio yet.' }}</p>



          <div class="actions">

            @if (isFriend()) {

              <button mat-flat-button color="primary" [routerLink]="['/friends/chat', publicProfile()!.id]">

                <mat-icon>chat</mat-icon> Message

              </button>

              <button mat-stroked-button color="primary" (click)="startCall()">

                <mat-icon>call</mat-icon> Call

              </button>

              <button mat-stroked-button color="warn" (click)="removeFriend()">

                <mat-icon>person_remove</mat-icon> Remove Friend

              </button>

            } @else if (pendingReceived()) {

              <span class="status-note">{{ publicProfile()!.username }} sent you a friend request</span>

              <button mat-flat-button color="primary" (click)="confirmFriend()">

                <mat-icon>how_to_reg</mat-icon> Confirm Friend

              </button>

              <button mat-stroked-button (click)="declineFriend()">Decline</button>

            } @else if (pendingSent()) {

              <button mat-button disabled class="sent-btn">

                <mat-icon>schedule</mat-icon> Friend Request Sent

              </button>

            } @else {

              <button mat-flat-button color="primary" (click)="addFriend()" [disabled]="friendAction()">

                <mat-icon>person_add</mat-icon> Add Friend

              </button>

              <button mat-stroked-button (click)="tryMessage()">

                <mat-icon>chat</mat-icon> Message

              </button>

            }

            <button mat-stroked-button color="warn" (click)="blockUser()">

              <mat-icon>block</mat-icon> Block

            </button>

          </div>

        </mat-card>



        <button mat-button routerLink="/chat" class="back-link">

          <mat-icon>arrow_back</mat-icon> Back to Home

        </button>

      }

    </div>

  `,

  styles: [`

    .profile-page { max-width: 560px; margin: 0 auto; padding: 24px 20px 48px; }

    .loading { text-align: center; color: #888; padding: 48px; }

    .hero {

      text-align: center;

      padding: 32px 24px;

      border-radius: 20px;

      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);

      color: #fff;

      margin-bottom: 24px;

      box-shadow: 0 12px 40px rgba(102, 126, 234, 0.3);

    }

    .hero h1 { margin: 12px 0 4px; font-size: 1.6rem; }

    .hero p { margin: 0; opacity: 0.9; font-size: 0.95rem; }

    .hero.public { display: flex; flex-direction: column; align-items: center; gap: 8px; }

    .avatar.large {

      width: 72px; height: 72px; border-radius: 50%;

      background: rgba(255,255,255,0.25);

      display: flex; align-items: center; justify-content: center;

      font-weight: 700; font-size: 1.4rem; margin: 0 auto;

    }

    .hero.public .avatar.large { margin: 0; }

    .gender-badge {

      background: rgba(255,255,255,0.2);

      padding: 4px 12px; border-radius: 999px; font-size: 0.85rem;

    }

    .status-pill {

      font-size: 0.85rem; opacity: 0.9;

    }

    .status-pill.online::before { content: '● '; color: #a5f3a5; }

    .profile-card { padding: 24px; border-radius: 16px; margin-bottom: 16px; }

    .full-width { width: 100%; display: block; margin-bottom: 8px; }

    .readonly-field {

      margin-bottom: 16px; padding: 12px 16px;

      background: #f5f7ff; border-radius: 10px;

    }

    .readonly-field label { display: block; font-size: 0.75rem; color: #666; margin-bottom: 4px; }

    .readonly-field span { font-weight: 500; }

    .readonly-field small { display: block; font-size: 0.75rem; color: #888; margin-top: 4px; }

    .bio { color: #444; line-height: 1.5; margin: 0 0 20px; white-space: pre-wrap; }

    .actions { display: flex; flex-wrap: wrap; gap: 10px; }

    .actions button mat-icon { margin-right: 4px; vertical-align: middle; font-size: 18px; width: 18px; height: 18px; }

    .status-note { width: 100%; margin-bottom: 8px; color: #444; font-size: 0.95rem; }

    .sent-btn { opacity: 0.9; }

    .back-link { margin-top: 8px; }

    @media (max-width: 768px) {

      .profile-page { padding: 12px 12px 32px; }

      .hero { padding: 24px 16px; border-radius: 16px; }

      .hero h1 { font-size: 1.35rem; }

      .profile-card { padding: 16px; }

      .actions { flex-direction: column; }

      .actions button { width: 100%; }

    }

  `]

})

export class ProfileComponent implements OnInit {

  loading = signal(true);

  saving = signal(false);

  isOwnProfile = signal(true);

  myProfile = signal<MyProfile | null>(null);

  publicProfile = signal<PublicUserProfile | null>(null);

  isFriend = signal(false);

  pendingSent = signal(false);

  pendingReceived = signal(false);

  incomingRequestId = signal<string | null>(null);

  friendAction = signal(false);

  form: FormGroup;

  private viewedUserId: string | null = null;



  constructor(

    private route: ActivatedRoute,

    private router: Router,

    private userApi: UserApiService,

    private friendApi: FriendApiService,

    private blockApi: BlockApiService,

    private chatApi: ChatApiService,

    private callService: CallService,

    private friendNotification: FriendNotificationService,

    private auth: AuthService,

    private fb: FormBuilder,

    private snackBar: MatSnackBar

  ) {

    this.form = this.fb.nonNullable.group({

      username: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(50), Validators.pattern(/^[a-zA-Z0-9_]+$/)]],

      bio: ['', Validators.maxLength(500)],

      gender: ['MALE' as const, Validators.required]

    });

  }



  ngOnInit(): void {

    this.route.paramMap.subscribe((params) => {

      this.viewedUserId = params.get('userId');

      const myId = this.auth.user()?.id;

      if (!this.viewedUserId || this.viewedUserId === myId) {

        this.isOwnProfile.set(true);

        this.loadMyProfile();

      } else {

        this.isOwnProfile.set(false);

        this.loadPublicProfile(this.viewedUserId);

      }

    });

  }



  initials(name?: string): string {

    return (name || '?').slice(0, 2).toUpperCase();

  }



  genderLabel(g: string): string {

    return g === 'FEMALE' ? 'Female' : 'Male';

  }



  private loadRelationship(userId: string): void {

    this.friendApi.getRelationshipStatus(userId).subscribe({

      next: (s) => this.applyStatus(s),

      error: () => {}

    });

  }



  private applyStatus(s: FriendStatusResponse): void {

    this.isFriend.set(s.friends);

    this.pendingSent.set(s.pendingSent);

    this.pendingReceived.set(s.pendingReceived);

    this.incomingRequestId.set(s.pendingReceivedRequestId ?? null);

  }



  private loadMyProfile(): void {

    this.loading.set(true);

    this.userApi.getMyProfile().subscribe({

      next: (p) => {

        this.myProfile.set(p);

        this.form.patchValue({ username: p.username, bio: p.bio ?? '', gender: p.gender });

        this.loading.set(false);

      },

      error: () => this.loading.set(false)

    });

  }



  private loadPublicProfile(userId: string): void {

    this.loading.set(true);

    this.userApi.getUserProfile(userId).subscribe({

      next: (p) => {

        this.publicProfile.set(p);

        this.loading.set(false);

        this.loadRelationship(p.id);

      },

      error: () => {

        this.loading.set(false);

        this.router.navigate(['/chat']);

      }

    });

  }



  save(): void {

    if (this.form.invalid) return;

    this.saving.set(true);

    this.userApi.updateMyProfile(this.form.value).subscribe({

      next: (p) => {

        this.myProfile.set(p);

        this.auth.updateStoredUser({ username: p.username, bio: p.bio, gender: p.gender });

        this.saving.set(false);

        this.snackBar.open('Profile updated!', 'OK', { duration: 3000 });

      },

      error: (err) => {

        this.saving.set(false);

        this.snackBar.open(err.error?.error || 'Could not save profile', 'OK', { duration: 4000 });

      }

    });

  }



  addFriend(): void {

    const p = this.publicProfile();

    if (!p || this.pendingSent() || this.isFriend()) return;

    this.friendAction.set(true);

    this.friendApi.sendRequest(p.id).subscribe({

      next: () => {

        this.pendingSent.set(true);

        this.friendAction.set(false);

        this.snackBar.open('Friend request sent!', 'OK', { duration: 3000 });

      },

      error: (err) => {

        this.friendAction.set(false);

        const msg = err.error?.error ?? '';

        if (msg.includes('Already') || msg.includes('already sent')) {

          this.pendingSent.set(true);

        }

        this.snackBar.open(msg || 'Could not send request', 'OK', { duration: 4000 });

      }

    });

  }



  confirmFriend(): void {

    const id = this.incomingRequestId();

    const p = this.publicProfile();

    if (!p) return;

    const accept = (requestId: string) => {

      this.friendApi.accept(requestId).subscribe(() => {

        this.isFriend.set(true);

        this.pendingReceived.set(false);

        this.pendingSent.set(false);

        this.friendNotification.onRequestHandled();

        this.snackBar.open('You are now friends!', 'OK', { duration: 3000 });

      });

    };

    if (id) { accept(id); return; }

    this.friendApi.getPendingRequests().subscribe((reqs) => {

      const req = reqs.find((r) => r.sender.id === p.id);

      if (req) accept(req.id);

    });

  }



  declineFriend(): void {

    const id = this.incomingRequestId();

    const p = this.publicProfile();

    if (!p) return;

    const reject = (requestId: string) => {

      this.friendApi.reject(requestId).subscribe(() => {

        this.pendingReceived.set(false);

        this.friendNotification.onRequestHandled();

      });

    };

    if (id) { reject(id); return; }

    this.friendApi.getPendingRequests().subscribe((reqs) => {

      const req = reqs.find((r) => r.sender.id === p.id);

      if (req) reject(req.id);

    });

  }



  tryMessage(): void {

    const p = this.publicProfile();

    if (!p) return;

    this.chatApi.getFriendRoom(p.id).subscribe({

      next: () => this.router.navigate(['/friends/chat', p.id]),

      error: () => this.snackBar.open('Pehle Add Friend karein, phir message bhej sakte hain', 'OK', { duration: 4000 })

    });

  }



  startCall(): void {

    const p = this.publicProfile();

    if (!p || !this.isFriend()) return;

    void this.callService.startCall(p.id, p.username);

  }



  removeFriend(): void {

    const p = this.publicProfile();

    if (!p || !confirm(`Remove ${p.username} from friends? Chat history will be deleted.`)) return;

    this.friendApi.removeFriend(p.id).subscribe(() => {

      this.isFriend.set(false);

      this.snackBar.open('Friend removed', 'OK', { duration: 3000 });

    });

  }



  blockUser(): void {

    const p = this.publicProfile();

    if (!p || !confirm(`Block ${p.username}? They won't be able to message you.`)) return;

    this.blockApi.blockUser(p.id).subscribe(() => {

      this.isFriend.set(false);

      this.snackBar.open('User blocked', 'OK', { duration: 3000 });

      this.router.navigate(['/chat']);

    });

  }

}


