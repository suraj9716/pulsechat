package com.anochat.controller;

import com.anochat.api.dto.request.LoginRequest;
import com.anochat.api.dto.request.RefreshTokenRequest;
import com.anochat.api.dto.request.RegisterRequest;
import com.anochat.api.dto.response.AuthResponse;
import com.anochat.service.AuthService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import com.anochat.security.UserPrincipal;

import java.util.UUID;

@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {

    private final AuthService authService;

    @PostMapping("/register")
    public ResponseEntity<AuthResponse> register(@Valid @RequestBody RegisterRequest request) {
        return ResponseEntity.ok(authService.register(request));
    }

    @PostMapping("/login")
    public ResponseEntity<AuthResponse> login(@Valid @RequestBody LoginRequest request) {
        return ResponseEntity.ok(authService.login(request));
    }

    @PostMapping("/refresh")
    public ResponseEntity<AuthResponse> refresh(@Valid @RequestBody RefreshTokenRequest request) {
        return ResponseEntity.ok(authService.refreshToken(request.getRefreshToken()));
    }

    @PostMapping("/logout")
    public ResponseEntity<Void> logout(@AuthenticationPrincipal UserPrincipal principal,
                                       @RequestBody(required = false) RefreshTokenRequest request) {
        if (principal != null) {
            String token = request != null ? request.getRefreshToken() : null;
            authService.logout(principal.getId(), token != null ? token : "");
        }
        return ResponseEntity.ok().build();
    }
}
