package com.anochat.controller;

import com.anochat.api.dto.request.ReportUserRequest;
import com.anochat.domain.entity.UserReport;
import com.anochat.exception.BadRequestException;
import com.anochat.exception.ResourceNotFoundException;
import com.anochat.repository.UserReportRepository;
import com.anochat.repository.UserRepository;
import com.anochat.security.UserPrincipal;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import jakarta.validation.Valid;
import java.util.UUID;

@RestController
@RequestMapping("/api/reports")
@RequiredArgsConstructor
public class ReportController {

    private final UserReportRepository userReportRepository;
    private final UserRepository userRepository;

    @PostMapping
    public ResponseEntity<Void> reportUser(@AuthenticationPrincipal UserPrincipal principal,
                                          @Valid @RequestBody ReportUserRequest request) {
        if (request.getReportedUserId() == null || request.getReportedUserId().equals(principal.getId())) {
            throw new BadRequestException("Invalid reported user");
        }
        var reporter = userRepository.findById(principal.getId()).orElseThrow(() -> new ResourceNotFoundException("User", principal.getId()));
        var reported = userRepository.findById(request.getReportedUserId()).orElseThrow(() -> new ResourceNotFoundException("User", request.getReportedUserId()));
        UserReport report = UserReport.builder()
                .reporter(reporter)
                .reported(reported)
                .reason(request.getReason())
                .resolved(false)
                .build();
        userReportRepository.save(report);
        return ResponseEntity.ok().build();
    }
}
