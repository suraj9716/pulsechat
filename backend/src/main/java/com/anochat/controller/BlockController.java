package com.anochat.controller;

import com.anochat.security.UserPrincipal;
import com.anochat.service.BlockService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequestMapping("/api/blocks")
@RequiredArgsConstructor
public class BlockController {

    private final BlockService blockService;

    @PostMapping("/{blockedId}")
    public ResponseEntity<Void> block(@AuthenticationPrincipal UserPrincipal principal, @PathVariable UUID blockedId) {
        blockService.block(principal.getId(), blockedId);
        return ResponseEntity.ok().build();
    }

    @DeleteMapping("/{blockedId}")
    public ResponseEntity<Void> unblock(@AuthenticationPrincipal UserPrincipal principal, @PathVariable UUID blockedId) {
        blockService.unblock(principal.getId(), blockedId);
        return ResponseEntity.ok().build();
    }
}
