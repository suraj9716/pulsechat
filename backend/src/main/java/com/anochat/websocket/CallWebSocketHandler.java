package com.anochat.websocket;

import com.anochat.security.UserPrincipal;
import com.anochat.service.CallRelayService;
import lombok.RequiredArgsConstructor;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.messaging.simp.SimpMessageHeaderAccessor;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Controller;

import java.util.Map;
import java.util.UUID;

@Controller
@RequiredArgsConstructor
public class CallWebSocketHandler {

    private final CallRelayService callRelayService;

    @MessageMapping("/call/signal")
    public void relaySignal(@Payload Map<String, Object> payload, SimpMessageHeaderAccessor accessor) {
        UserPrincipal principal = resolvePrincipal(accessor);
        if (principal == null) {
            return;
        }

        Object toRaw = payload.get("toUserId");
        if (toRaw == null) {
            return;
        }

        UUID toUserId;
        try {
            toUserId = UUID.fromString(toRaw.toString());
        } catch (IllegalArgumentException e) {
            return;
        }

        callRelayService.relay(principal, toUserId, payload);
    }

    private UserPrincipal resolvePrincipal(SimpMessageHeaderAccessor accessor) {
        if (accessor != null && accessor.getUser() instanceof Authentication auth
                && auth.getPrincipal() instanceof UserPrincipal p) {
            return p;
        }
        Authentication ctxAuth = SecurityContextHolder.getContext().getAuthentication();
        if (ctxAuth != null && ctxAuth.getPrincipal() instanceof UserPrincipal p) {
            return p;
        }
        return null;
    }
}
