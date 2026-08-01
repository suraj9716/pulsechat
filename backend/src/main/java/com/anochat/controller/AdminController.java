package com.anochat.controller;

import com.anochat.api.dto.request.ReportUserRequest;
import com.anochat.api.dto.response.UserResponse;
import com.anochat.api.mapper.UserMapper;
import com.anochat.domain.entity.User;
import com.anochat.exception.ResourceNotFoundException;
import com.anochat.repository.UserReportRepository;
import com.anochat.repository.UserRepository;
import com.anochat.security.UserPrincipal;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import jakarta.validation.Valid;
import java.time.Instant;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/admin")
@RequiredArgsConstructor
@PreAuthorize("hasRole('ADMIN')")
public class AdminController {

    private final UserRepository userRepository;
    private final UserMapper userMapper;
    private final UserReportRepository userReportRepository;

    @PostMapping("/users/{userId}/ban")
    public ResponseEntity<UserResponse> banUser(@PathVariable UUID userId,
                                                @RequestBody Map<String, String> body) {
        User user = userRepository.findById(userId).orElseThrow(() -> new ResourceNotFoundException("User", userId));
        user.setBanned(true);
        user.setBannedAt(Instant.now());
        user.setBannedReason(body.get("reason"));
        user = userRepository.save(user);
        return ResponseEntity.ok(userMapper.toResponse(user));
    }

    @PostMapping("/users/{userId}/unban")
    public ResponseEntity<UserResponse> unbanUser(@PathVariable UUID userId) {
        User user = userRepository.findById(userId).orElseThrow(() -> new ResourceNotFoundException("User", userId));
        user.setBanned(false);
        user.setBannedAt(null);
        user.setBannedReason(null);
        user = userRepository.save(user);
        return ResponseEntity.ok(userMapper.toResponse(user));
    }

    @GetMapping("/reports")
    public ResponseEntity<Page<?>> getUnresolvedReports(Pageable pageable) {
        return ResponseEntity.ok(userReportRepository.findByResolvedFalse(pageable)
                .map(r -> Map.of(
                        "id", r.getId(),
                        "reporterId", r.getReporter().getId(),
                        "reportedId", r.getReported().getId(),
                        "reason", r.getReason() != null ? r.getReason() : "",
                        "createdAt", r.getCreatedAt()
                )));
    }
}
