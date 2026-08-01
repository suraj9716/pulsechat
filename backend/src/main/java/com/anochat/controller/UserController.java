package com.anochat.controller;

import com.anochat.api.dto.request.UpdateProfileRequest;
import com.anochat.api.dto.response.PublicUserResponse;
import com.anochat.api.dto.response.UserResponse;
import com.anochat.security.UserPrincipal;
import com.anochat.service.UserService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/users")
@RequiredArgsConstructor
public class UserController {

    private final UserService userService;

    @GetMapping("/me")
    public ResponseEntity<UserResponse> getMyProfile(@AuthenticationPrincipal UserPrincipal principal) {
        return ResponseEntity.ok(userService.getProfile(principal.getId()));
    }

    @PutMapping("/me")
    public ResponseEntity<UserResponse> updateMyProfile(@AuthenticationPrincipal UserPrincipal principal,
                                                        @Valid @RequestBody UpdateProfileRequest request) {
        return ResponseEntity.ok(userService.updateProfile(principal.getId(), request));
    }

    @GetMapping("/search")
    public ResponseEntity<List<PublicUserResponse>> searchUsers(@AuthenticationPrincipal UserPrincipal principal,
                                                           @RequestParam String username) {
        return ResponseEntity.ok(userService.searchUsers(principal.getId(), username));
    }

    @GetMapping("/{userId}")
    public ResponseEntity<PublicUserResponse> getUserProfile(@AuthenticationPrincipal UserPrincipal principal,
                                                              @PathVariable UUID userId) {
        return ResponseEntity.ok(userService.getPublicProfile(principal.getId(), userId));
    }
}
