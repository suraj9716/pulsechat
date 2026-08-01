package com.anochat.controller;

import com.anochat.api.dto.response.ChatRoomResponse;
import com.anochat.domain.entity.Gender;
import com.anochat.security.UserPrincipal;
import com.anochat.service.MatchmakingService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/matchmaking")
@RequiredArgsConstructor
public class MatchmakingController {

    private final MatchmakingService matchmakingService;

    @PostMapping("/search")
    public ResponseEntity<?> startSearch(@AuthenticationPrincipal UserPrincipal principal,
                                        @RequestParam Gender preference) {
        var result = matchmakingService.startSearch(principal.getId(), preference);
        if (result.isPresent()) {
            return ResponseEntity.ok(result.get());
        }
        return ResponseEntity.accepted().body(Map.of("status", "searching", "message", "Waiting for a match..."));
    }

    @PostMapping("/cancel")
    public ResponseEntity<Void> cancelSearch(@AuthenticationPrincipal UserPrincipal principal) {
        matchmakingService.cancelSearch(principal.getId());
        return ResponseEntity.ok().build();
    }

    @GetMapping("/status")
    public ResponseEntity<Map<String, Boolean>> status(@AuthenticationPrincipal UserPrincipal principal) {
        return ResponseEntity.ok(Map.of("inQueue", matchmakingService.isInQueue(principal.getId())));
    }
}
