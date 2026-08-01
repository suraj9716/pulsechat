import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';

export const routes: Routes = [
  { path: 'auth/login', loadComponent: () => import('./features/auth/login/login.component').then(m => m.LoginComponent) },
  { path: 'auth/register', loadComponent: () => import('./features/auth/register/register.component').then(m => m.RegisterComponent) },
  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () => import('./layout/main-layout/main-layout.component').then(m => m.MainLayoutComponent),
    children: [
      { path: '', redirectTo: 'chat', pathMatch: 'full' },
      { path: 'chat', loadComponent: () => import('./features/chat/chat/chat.component').then(m => m.ChatComponent) },
      { path: 'friends', loadComponent: () => import('./features/friends/friends/friends.component').then(m => m.FriendsComponent) },
      { path: 'friends/chat/:friendId', loadComponent: () => import('./features/friends/friend-chat/friend-chat.component').then(m => m.FriendChatComponent) },
      { path: 'profile', loadComponent: () => import('./features/profile/profile/profile.component').then(m => m.ProfileComponent) },
      { path: 'profile/:userId', loadComponent: () => import('./features/profile/profile/profile.component').then(m => m.ProfileComponent) }
    ]
  },
  { path: '**', redirectTo: '' }
];
