import { Component, Inject, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MAT_DIALOG_DATA, MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatRadioModule } from '@angular/material/radio';
import { FormsModule } from '@angular/forms';
import { MatchmakingApiService } from '../../../core/services/matchmaking-api.service';
import { ChatApiService, ChatRoomResponse } from '../../../core/services/chat-api.service';

export interface SearchPartnerDialogData {
  autoSearch?: boolean;
  searchingOnly?: boolean;
  preference?: 'MALE' | 'FEMALE';
}

@Component({
  selector: 'app-search-partner-dialog',
  standalone: true,
  imports: [CommonModule, MatDialogModule, MatButtonModule, MatRadioModule, FormsModule],
  template: `
    <h2 mat-dialog-title>Find Partner</h2>
    <mat-dialog-content>
      <p>Select gender preference for matchmaking:</p>
      <mat-radio-group [(ngModel)]="preference">
        <mat-radio-button value="MALE">Match with Male</mat-radio-button>
        <mat-radio-button value="FEMALE">Match with Female</mat-radio-button>
      </mat-radio-group>
      @if (searching) {
        <p class="searching">Searching for a partner...</p>
        <button mat-button (click)="cancel()">Cancel</button>
      }
    </mat-dialog-content>
    <mat-dialog-actions>
      <button mat-button mat-dialog-close>Close</button>
      @if (!searching) {
        <button mat-flat-button color="primary" (click)="search()">Search</button>
      }
    </mat-dialog-actions>
  `,
  styles: [`.searching { margin-top: 16px; }`]
})
export class SearchPartnerDialogComponent implements OnInit, OnDestroy {
  preference: 'MALE' | 'FEMALE' = 'FEMALE';
  searching = false;
  private poll: ReturnType<typeof setInterval> | null = null;

  constructor(
    private dialogRef: MatDialogRef<SearchPartnerDialogComponent>,
    private matchmakingApi: MatchmakingApiService,
    private chatApi: ChatApiService,
    @Inject(MAT_DIALOG_DATA) private data: SearchPartnerDialogData | null
  ) {
    if (data?.preference) {
      this.preference = data.preference;
    }
  }

  ngOnInit(): void {
    if (this.data?.autoSearch) {
      this.search();
    } else if (this.data?.searchingOnly) {
      this.searching = true;
      this.pollForRoom();
    }
  }

  search(): void {
    sessionStorage.setItem('matchPreference', this.preference);
    this.searching = true;
    this.matchmakingApi.startSearch(this.preference).subscribe({
      next: (res: any) => {
        if (res?.id && res?.participant) {
          this.searching = false;
          this.dialogRef.close(res as ChatRoomResponse);
        } else {
          this.pollForRoom();
        }
      },
      error: () => (this.searching = false)
    });
  }

  private pollForRoom(): void {
    this.poll = setInterval(() => {
      this.chatApi.getCurrentRoom().subscribe({
        next: (room) => {
          if (room) {
            if (this.poll) clearInterval(this.poll);
            this.poll = null;
            this.searching = false;
            this.dialogRef.close(room);
          }
        }
      });
    }, 2500);
  }

  cancel(): void {
    if (this.poll) {
      clearInterval(this.poll);
      this.poll = null;
    }
    this.matchmakingApi.cancelSearch().subscribe(() => {
      this.searching = false;
      this.dialogRef.close(null);
    });
  }

  ngOnDestroy(): void {
    if (this.poll) clearInterval(this.poll);
  }
}
