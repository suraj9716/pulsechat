package com.anochat.websocket;

import com.anochat.repository.FriendshipRepository;
import com.anochat.repository.UserRepository;
import com.anochat.security.UserPrincipal;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.messaging.simp.SimpMessageHeaderAccessor;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Controller;

import java.util.Map;
import java.util.UUID;

@Controller
@RequiredArgsConstructor
@Slf4j
public class CallWebSocketHandler {

    private final SimpMessagingTemplate messagingTemplate;
    private final UserRepository userRepository;
    private final FriendshipRepository friendshipRepository;

    @MessageMapping("/call/signal")
    public void relaySignal(@Payload Map<String, Object> payload, SimpMessageHeaderAccessor accessor) {
        UserPrincipal principal = resolvePrincipal(accessor);
        if (principal == null) {
            log.warn("Call signal dropped: WebSocket not authenticated");
            return;
        }

        Object toRaw = payload.get("toUserId");
        if (toRaw == null) return;

        UUID toUserId;
        try {
            toUserId = UUID.fromString(toRaw.toString());
        } catch (IllegalArgumentException e) {
            return;
        }

        if (!friendshipRepository.existsByUserPair(principal.getId(), toUserId)) {
            log.warn("Call signal blocked: users are not friends {} -> {}", principal.getId(), toUserId);
            return;
        }

        var target = userRepository.findById(toUserId).orElse(null);
        if (target == null) {
            log.warn("Call signal blocked: target user not found {}", toUserId);
            return;
        }

        payload.put("fromUserId", principal.getId().toString());
        payload.put("fromUsername", principal.getUsername());
        messagingTemplate.convertAndSendToUser(target.getUsername(), RealtimeNotificationService.QUEUE_CALLS, payload);
        // Topic fallback — user queue routing can miss sessions after reconnect (same as friend notifications).
        messagingTemplate.convertAndSend(RealtimeNotificationService.TOPIC_USER_PREFIX + toUserId + "/calls", payload);
        log.debug("Call signal {} relayed {} -> {}", payload.get("type"), principal.getId(), toUserId);
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
