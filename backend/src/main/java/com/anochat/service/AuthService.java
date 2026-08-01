package com.anochat.service;

import com.anochat.api.dto.request.LoginRequest;
import com.anochat.api.dto.request.RegisterRequest;
import com.anochat.api.dto.response.AuthResponse;
import com.anochat.api.dto.response.UserResponse;
import com.anochat.api.mapper.UserMapper;
import com.anochat.domain.entity.RefreshToken;
import com.anochat.domain.entity.Role;
import com.anochat.domain.entity.User;
import com.anochat.exception.BadRequestException;
import com.anochat.repository.RefreshTokenRepository;
import com.anochat.repository.UserRepository;
import com.anochat.security.JwtProvider;
import com.anochat.security.UserPrincipal;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
public class AuthService {

    private final UserRepository userRepository;
    private final RefreshTokenRepository refreshTokenRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtProvider jwtProvider;
    private final UserMapper userMapper;
    private final AuthenticationManager authenticationManager;
    private final com.anochat.config.AppProperties appProperties;

    @Transactional
    public AuthResponse register(RegisterRequest request) {
        if (userRepository.existsByUsername(request.getUsername())) {
            throw new BadRequestException("Username already taken");
        }
        if (userRepository.existsByEmail(request.getEmail())) {
            throw new BadRequestException("Email already registered");
        }
        User user = User.builder()
                .username(request.getUsername())
                .email(request.getEmail())
                .password(passwordEncoder.encode(request.getPassword()))
                .gender(request.getGender())
                .role(Role.USER)
                .onlineStatus(false)
                .banned(false)
                .build();
        user = userRepository.save(user);
        UserPrincipal principal = UserPrincipal.create(user);
        String roles = principal.getAuthorities().stream()
                .map(a -> a.getAuthority()).reduce((a, b) -> a + "," + b).orElse("ROLE_USER");
        String accessToken = jwtProvider.generateAccessToken(principal.getId(), principal.getUsername(), roles);
        String refreshTokenStr = jwtProvider.generateRefreshToken(user.getId());
        saveRefreshToken(user, refreshTokenStr);
        UserResponse userResponse = userMapper.toResponse(user);
        return AuthResponse.builder()
                .accessToken(accessToken)
                .refreshToken(refreshTokenStr)
                .expiresIn(appProperties.getJwt().getAccessTokenValidityMs() / 1000)
                .user(userResponse)
                .build();
    }

    public AuthResponse login(LoginRequest request) {
        Authentication authentication = authenticationManager.authenticate(
                new UsernamePasswordAuthenticationToken(request.getUsernameOrEmail(), request.getPassword()));
        UserPrincipal principal = (UserPrincipal) authentication.getPrincipal();
        User user = userRepository.findById(principal.getId()).orElseThrow();
        String accessToken = jwtProvider.generateAccessToken(authentication);
        String refreshTokenStr = jwtProvider.generateRefreshToken(user.getId());
        saveRefreshToken(user, refreshTokenStr);
        return AuthResponse.builder()
                .accessToken(accessToken)
                .refreshToken(refreshTokenStr)
                .expiresIn(appProperties.getJwt().getAccessTokenValidityMs() / 1000)
                .user(userMapper.toResponse(user))
                .build();
    }

    @Transactional
    public AuthResponse refreshToken(String refreshTokenValue) {
        if (!jwtProvider.validateToken(refreshTokenValue)) {
            throw new BadRequestException("Invalid refresh token");
        }
        RefreshToken stored = refreshTokenRepository.findByToken(refreshTokenValue)
                .orElseThrow(() -> new BadRequestException("Refresh token not found"));
        if (stored.isExpired()) {
            refreshTokenRepository.delete(stored);
            throw new BadRequestException("Refresh token expired");
        }
        User user = stored.getUser();
        stored.setRevoked(true);
        refreshTokenRepository.save(stored);
        String newAccess = jwtProvider.generateAccessToken(user.getId(), user.getUsername(), user.getRole().name());
        String newRefresh = jwtProvider.generateRefreshToken(user.getId());
        saveRefreshToken(user, newRefresh);
        return AuthResponse.builder()
                .accessToken(newAccess)
                .refreshToken(newRefresh)
                .expiresIn(appProperties.getJwt().getAccessTokenValidityMs() / 1000)
                .user(userMapper.toResponse(user))
                .build();
    }

    @Transactional
    public void logout(UUID userId, String refreshTokenValue) {
        refreshTokenRepository.findByToken(refreshTokenValue).ifPresent(refreshTokenRepository::delete);
    }

    private void saveRefreshToken(User user, String token) {
        Instant expiresAt = Instant.now().plusMillis(appProperties.getJwt().getRefreshTokenValidityMs());
        RefreshToken refreshToken = RefreshToken.builder()
                .token(token)
                .user(user)
                .expiresAt(expiresAt)
                .revoked(false)
                .build();
        refreshTokenRepository.save(refreshToken);
    }
}
