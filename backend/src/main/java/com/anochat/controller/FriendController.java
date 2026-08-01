package com.anochat.controller;

import com.anochat.api.dto.response.FriendListItemResponse;
import com.anochat.api.dto.response.FriendRequestResponse;
import com.anochat.api.dto.response.FriendStatusResponse;
import com.anochat.api.dto.response.PublicUserResponse;
import com.anochat.api.dto.response.UserResponse;
import com.anochat.security.UserPrincipal;
import com.anochat.service.FriendService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/friends")
@RequiredArgsConstructor
public class FriendController {

    private final FriendService friendService;

    @PostMapping("/request/{receiverId}")
    public ResponseEntity<FriendRequestResponse> sendRequest(@AuthenticationPrincipal UserPrincipal principal,
                                                            @PathVariable UUID receiverId) {
        return ResponseEntity.ok(friendService.sendRequest(principal.getId(), receiverId));
    }

    @PostMapping("/request/{requestId}/accept")
    public ResponseEntity<Void> accept(@AuthenticationPrincipal UserPrincipal principal, @PathVariable UUID requestId) {
        friendService.acceptRequest(principal.getId(), requestId);
        return ResponseEntity.ok().build();
    }

    @PostMapping("/request/{requestId}/reject")
    public ResponseEntity<Void> reject(@AuthenticationPrincipal UserPrincipal principal, @PathVariable UUID requestId) {
        friendService.rejectRequest(principal.getId(), requestId);
        return ResponseEntity.ok().build();
    }

    @DeleteMapping("/{friendId}")
    public ResponseEntity<Void> removeFriend(@AuthenticationPrincipal UserPrincipal principal, @PathVariable UUID friendId) {
        friendService.removeFriend(principal.getId(), friendId);
        return ResponseEntity.ok().build();
    }

    @GetMapping
    public ResponseEntity<List<PublicUserResponse>> getFriends(@AuthenticationPrincipal UserPrincipal principal) {
        return ResponseEntity.ok(friendService.getFriends(principal.getId()));
    }

    @GetMapping("/overview")
    public ResponseEntity<List<FriendListItemResponse>> getFriendsOverview(@AuthenticationPrincipal UserPrincipal principal) {
        return ResponseEntity.ok(friendService.getFriendsOverview(principal.getId()));
    }

    @GetMapping("/requests/pending")
    public ResponseEntity<List<FriendRequestResponse>> getPendingRequests(@AuthenticationPrincipal UserPrincipal principal) {
        return ResponseEntity.ok(friendService.getPendingReceived(principal.getId()));
    }

    @GetMapping("/requests/sent")
    public ResponseEntity<List<FriendRequestResponse>> getPendingSent(@AuthenticationPrincipal UserPrincipal principal) {
        return ResponseEntity.ok(friendService.getPendingSent(principal.getId()));
    }

    @GetMapping("/status/{userId}")
    public ResponseEntity<FriendStatusResponse> getFriendStatus(@AuthenticationPrincipal UserPrincipal principal,
                                                                 @PathVariable UUID userId) {
        return ResponseEntity.ok(friendService.getRelationshipStatus(principal.getId(), userId));
    }
}
