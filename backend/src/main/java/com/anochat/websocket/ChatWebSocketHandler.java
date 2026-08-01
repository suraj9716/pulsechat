package com.anochat.websocket;

import com.anochat.api.dto.response.MessageResponse;
import com.anochat.domain.entity.MessageType;
import com.anochat.security.UserPrincipal;
import com.anochat.service.MessageService;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.messaging.handler.annotation.DestinationVariable;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.messaging.simp.SimpMessageHeaderAccessor;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Controller;

import java.util.Map;
import java.util.UUID;

/**
 * STOMP message handlers: send message, typing indicator, presence.
 * Topics: /topic/room/{roomId} for chat, /user/queue/... for user-specific.
 */
@Controller
@RequiredArgsConstructor
@Slf4j
public class ChatWebSocketHandler {

    private final MessageService messageService;
    private final SimpMessagingTemplate messagingTemplate;

    public static final String TOPIC_ROOM_PREFIX = "/topic/room/";
    public static final String TYPING_TOPIC_PREFIX = "/topic/room/";
    public static final String QUEUE_PERSONAL = "/queue/";

    @MessageMapping("/chat/{roomId}/send")
    public void sendMessage(@DestinationVariable UUID roomId,
                           @Payload Map<String, String> payload,
                           SimpMessageHeaderAccessor headerAccessor) {
        UserPrincipal principal = resolvePrincipal(headerAccessor);
        if (principal == null) return;
        String content = payload.get("content");
        String imageUrl = payload.get("imageUrl");
        String typeRaw = payload.get("messageType");
        MessageType messageType = MessageType.TEXT;
        if (typeRaw != null) {
            try {
                messageType = MessageType.valueOf(typeRaw);
            } catch (IllegalArgumentException ignored) {}
        }
        if ((content == null || content.isBlank()) && (imageUrl == null || imageUrl.isBlank())) return;
        try {
            MessageResponse msg = messageService.sendMessage(
                    roomId, principal.getId(), content, messageType, imageUrl);
            messagingTemplate.convertAndSend(TOPIC_ROOM_PREFIX + roomId, msg);
        } catch (Exception e) {
            log.warn("Send message failed: {}", e.getMessage());
        }
    }

    @MessageMapping("/chat/{roomId}/typing")
    public void typing(@DestinationVariable UUID roomId,
                       @Payload Map<String, Object> payload,
                       SimpMessageHeaderAccessor headerAccessor) {
        UserPrincipal principal = resolvePrincipal(headerAccessor);
        if (principal == null) return;
        messagingTemplate.convertAndSend(TOPIC_ROOM_PREFIX + roomId + "/typing",
                Map.of("userId", principal.getId().toString(), "typing", payload.getOrDefault("typing", true)));
    }

    @MessageMapping("/chat/{roomId}/seen")
    public void markSeen(@DestinationVariable UUID roomId,
                         @Payload Map<String, String> payload,
                         SimpMessageHeaderAccessor headerAccessor) {
        UserPrincipal principal = resolvePrincipal(headerAccessor);
        if (principal == null) return;
        String messageId = payload.get("messageId");
        if (messageId != null) {
            try {
                messageService.markAsSeen(UUID.fromString(messageId), principal.getId());
            } catch (Exception ignored) {}
        }
    }

    private UserPrincipal resolvePrincipal(SimpMessageHeaderAccessor accessor) {
        if (accessor == null || accessor.getUser() == null) {
            return null;
        }
        if (accessor.getUser() instanceof Authentication auth
                && auth.getPrincipal() instanceof UserPrincipal principal) {
            return principal;
        }
        return null;
    }
}
