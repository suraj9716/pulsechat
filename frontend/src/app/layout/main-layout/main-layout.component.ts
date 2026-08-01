import { Component, OnInit, OnDestroy, signal, effect } from '@angular/core';

import { CommonModule } from '@angular/common';

import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';

import { BreakpointObserver } from '@angular/cdk/layout';

import { MatToolbarModule } from '@angular/material/toolbar';

import { MatSidenavModule } from '@angular/material/sidenav';

import { MatListModule } from '@angular/material/list';

import { MatIconModule } from '@angular/material/icon';

import { MatButtonModule } from '@angular/material/button';

import { MatMenuModule } from '@angular/material/menu';

import { MatCardModule } from '@angular/material/card';

import { MatBadgeModule } from '@angular/material/badge';

import { AuthService } from '../../core/services/auth.service';

import { WebSocketService, IncomingFriendRequest } from '../../core/services/websocket.service';

import { FriendApiService } from '../../core/services/friend-api.service';

import { UnreadCountService } from '../../core/services/unread-count.service';

import { FriendNotificationService } from '../../core/services/friend-notification.service';

import { CallService } from '../../core/services/call.service';

import { APP_NAME } from '../../core/constants/app.constants';

import { Subscription } from 'rxjs';



@Component({

  selector: 'app-main-layout',

  standalone: true,

  imports: [

    CommonModule,

    RouterOutlet,

    RouterLink,

    RouterLinkActive,

    MatToolbarModule,

    MatSidenavModule,

    MatListModule,

    MatIconModule,

    MatButtonModule,

    MatMenuModule,

    MatCardModule,

    MatBadgeModule

  ],

  template: `

    <mat-toolbar class="app-toolbar">

      @if (isMobile()) {

        <button mat-icon-button class="menu-btn" (click)="toggleSidenav()" aria-label="Toggle navigation">

          <mat-icon>{{ sidenavOpened() ? 'close' : 'menu' }}</mat-icon>

        </button>

      }

      <mat-icon class="brand-icon">bolt</mat-icon>

      <span class="brand">{{ appName }}</span>

      <span class="spacer"></span>

      <span class="username">{{ auth.user()?.username }}</span>

      <button mat-icon-button [matMenuTriggerFor]="menu">

        <mat-icon>account_circle</mat-icon>

      </button>

      <mat-menu #menu="matMenu">

        <a mat-menu-item routerLink="/profile">

          <mat-icon>person</mat-icon>

          Profile

        </a>

        <button mat-menu-item (click)="logout()">

          <mat-icon>logout</mat-icon>

          Logout

        </button>

      </mat-menu>

    </mat-toolbar>



    @if (incomingRequest()) {

      <div class="friend-request-banner">

        <mat-card>

          <mat-card-content class="banner-content">

            <mat-icon>person_add</mat-icon>

            <span><strong>{{ incomingRequest()!.sender.username }}</strong> sent you a friend request</span>

            <div class="banner-actions">

              <button mat-flat-button color="primary" (click)="acceptRequest()">Confirm Friend</button>

              <button mat-button (click)="rejectRequest()">Decline</button>

            </div>

          </mat-card-content>

        </mat-card>

      </div>

    }



    @if (call.state() === 'incoming') {

      <div class="call-overlay incoming">

        <mat-card>

          <mat-card-content>

            <mat-icon class="call-icon">call</mat-icon>

            <p><strong>{{ call.remoteUsername() }}</strong> is calling...</p>

            <div class="call-actions">

              <button mat-fab color="primary" (click)="acceptCall()"><mat-icon>call</mat-icon></button>

              <button mat-fab color="warn" (click)="rejectCall()"><mat-icon>call_end</mat-icon></button>

            </div>

          </mat-card-content>

        </mat-card>

      </div>

    } @else if (call.state() === 'outgoing' || call.state() === 'active') {

      <div class="call-overlay active">

        <mat-card>

          <mat-card-content>

            <mat-icon class="call-icon">call</mat-icon>

            <p>{{ call.state() === 'outgoing' ? 'Calling' : 'On call with' }} <strong>{{ call.remoteUsername() }}</strong></p>

            <button mat-fab color="warn" (click)="hangUp()"><mat-icon>call_end</mat-icon></button>

          </mat-card-content>

        </mat-card>

      </div>

    }



    <mat-sidenav-container class="layout-container">

      <mat-sidenav

        [mode]="isMobile() ? 'over' : 'side'"

        [opened]="sidenavOpened()"

        (openedChange)="sidenavOpened.set($event)"

        class="app-sidenav">

        <mat-nav-list>

          <a mat-list-item routerLink="/chat" routerLinkActive="active" class="nav-item"

             (click)="closeSidenavIfMobile()"

             [matBadge]="totalUnread() > 0 ? totalUnread() : null"

             matBadgeColor="accent"

             matBadgeSize="small"

             [matBadgeHidden]="totalUnread() === 0">

            <mat-icon matListItemIcon>home</mat-icon>

            <span matListItemTitle>Home</span>

          </a>

          <a mat-list-item routerLink="/friends" routerLinkActive="active" class="nav-item"

             (click)="closeSidenavIfMobile()"

             [matBadge]="friendsBadge() > 0 ? friendsBadge() : null"

             matBadgeColor="accent"

             matBadgeSize="small"

             [matBadgeHidden]="friendsBadge() === 0">

            <mat-icon matListItemIcon>group</mat-icon>

            <span matListItemTitle>Friends</span>

            @if (pendingRequests() > 0) {

              <span matListItemMeta class="nav-hint">{{ pendingRequests() }} request{{ pendingRequests() > 1 ? 's' : '' }}</span>

            }

          </a>

        </mat-nav-list>

      </mat-sidenav>

      <mat-sidenav-content class="app-content">

        <router-outlet></router-outlet>

      </mat-sidenav-content>

    </mat-sidenav-container>

  `,

  styles: [`

    .app-toolbar {

      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%) !important;

      color: #fff;

      box-shadow: 0 2px 12px rgba(102, 126, 234, 0.3);

    }



    .brand-icon {

      margin-right: 8px;

    }



    .brand {

      font-weight: 700;

      font-size: 1.15rem;

      letter-spacing: -0.02em;

    }



    .username {

      margin-right: 8px;

      opacity: 0.95;

      font-size: 0.9rem;

    }



    .spacer { flex: 1 1 auto; }



    .friend-request-banner {

      padding: 12px 16px 0;

      max-width: 800px;

      margin: 0 auto;

    }



    .banner-content {

      display: flex;

      align-items: center;

      justify-content: space-between;

      gap: 16px;

      flex-wrap: wrap;

    }



    .banner-content mat-icon {

      color: #667eea;

    }



    .banner-actions { display: flex; gap: 8px; }



    .layout-container {

      height: calc(100vh - 64px);

      background: #f0f2f8;

    }



    .app-sidenav {

      width: 220px;

      border-right: none;

      box-shadow: 2px 0 12px rgba(0, 0, 0, 0.04);

      background: #fff;

    }



    .nav-item {

      margin: 4px 8px;

      border-radius: 10px;

    }



    .nav-item.active {

      background: linear-gradient(135deg, rgba(102, 126, 234, 0.12), rgba(118, 75, 162, 0.12)) !important;

      color: #667eea;

    }



    .nav-item.active mat-icon {

      color: #667eea;

    }



    .nav-hint { font-size: 0.68rem; color: #e65100; font-weight: 600; margin-left: auto; }



    .app-content {

      overflow-y: auto;

    }

    .call-overlay {

      position: fixed;

      inset: 0;

      background: rgba(0,0,0,0.55);

      display: flex;

      align-items: center;

      justify-content: center;

      z-index: 1000;

      padding: 16px;

    }

    .call-overlay mat-card { max-width: 320px; width: 100%; text-align: center; padding: 24px; border-radius: 20px; }

    .call-icon { font-size: 48px; width: 48px; height: 48px; color: #667eea; margin-bottom: 8px; }

    .call-actions { display: flex; justify-content: center; gap: 24px; margin-top: 16px; }

    .menu-btn { margin-right: 4px; }

    @media (max-width: 959px) {

      .username { display: none; }

      .brand { font-size: 1rem; }

      .friend-request-banner { padding: 8px 12px 0; }

      .banner-content {

        flex-direction: column;

        align-items: stretch;

        text-align: center;

      }

      .banner-actions { justify-content: center; flex-wrap: wrap; }

      .layout-container { height: calc(100dvh - 56px); }

      .app-sidenav { width: min(280px, 85vw); }

    }

    @media (max-width: 480px) {

      .brand-icon { display: none; }

      .call-overlay mat-card { padding: 16px; }

    }

  `]

})

export class MainLayoutComponent implements OnInit, OnDestroy {

  appName = APP_NAME;

  incomingRequest = signal<IncomingFriendRequest | null>(null);

  totalUnread = this.unread.totalUnread;

  friendsBadge = this.friendNotification.friendsBadge;

  pendingRequests = this.friendNotification.pendingCount;

  call = this.callService;

  isMobile = signal(false);

  sidenavOpened = signal(true);

  private sub: Subscription | null = null;

  private bpSub: Subscription | null = null;



  constructor(

    public auth: AuthService,

    private ws: WebSocketService,

    private friendApi: FriendApiService,

    private unread: UnreadCountService,

    private friendNotification: FriendNotificationService,

    public callService: CallService,

    private breakpoint: BreakpointObserver

  ) {

    effect(() => {

      const pending = this.friendNotification.pendingRequests();

      const current = this.incomingRequest();

      if (current && !pending.some((r) => r.id === current.id)) {

        this.incomingRequest.set(null);

      }

    });

  }



  ngOnInit(): void {

    this.bpSub = this.breakpoint.observe(['(max-width: 959px)']).subscribe((state) => {

      const mobile = state.matches;

      this.isMobile.set(mobile);

      this.sidenavOpened.set(!mobile);

    });

    this.ws.connect();

    this.unread.startListening();

    this.friendNotification.startListening();

    this.callService.startListening();

    this.unread.refreshFromOverview();

    this.sub = this.ws.subscribeFriendRequests().subscribe((req) => {

      this.friendApi.areFriends(req.sender.id).subscribe(({ friends }) => {

        if (!friends) {

          this.incomingRequest.set(req);

        }

      });

    });

  }



  ngOnDestroy(): void {

    this.sub?.unsubscribe();

    this.bpSub?.unsubscribe();

  }



  toggleSidenav(): void {

    this.sidenavOpened.update((open) => !open);

  }



  closeSidenavIfMobile(): void {

    if (this.isMobile()) {

      this.sidenavOpened.set(false);

    }

  }



  acceptRequest(): void {

    const req = this.incomingRequest();

    if (!req) return;

    this.friendApi.accept(req.id).subscribe(() => {

      this.incomingRequest.set(null);

      this.friendNotification.onRequestHandled();

      this.unread.refreshFromOverview();

    });

  }



  rejectRequest(): void {

    const req = this.incomingRequest();

    if (!req) return;

    this.friendApi.reject(req.id).subscribe(() => {

      this.incomingRequest.set(null);

      this.friendNotification.onRequestHandled();

    });

  }



  logout(): void {

    this.auth.logout();

  }



  acceptCall(): void {

    void this.callService.acceptCall();

  }



  rejectCall(): void {

    this.callService.rejectCall();

  }



  hangUp(): void {

    this.callService.hangUp();

  }

}


