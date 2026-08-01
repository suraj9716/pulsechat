package com.anochat.websocket;

import com.anochat.service.UserService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.event.EventListener;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.messaging.SessionDisconnectEvent;
import org.springframework.web.socket.messaging.SessionSubscribeEvent;

import java.util.UUID;

@Component
@RequiredArgsConstructor
@Slf4j
public class WebSocketEventListener {

    private final UserService userService;

    @EventListener
    public void handleSessionSubscribe(SessionSubscribeEvent event) {
        try {
            StompHeaderAccessor accessor = StompHeaderAccessor.wrap(event.getMessage());
            Authentication auth = (Authentication) accessor.getUser();
            if (auth != null && auth.getPrincipal() instanceof com.anochat.security.UserPrincipal principal) {
                userService.setOnlineStatus(principal.getId(), true);
            }
        } catch (Exception e) {
            log.debug("Subscribe event: {}", e.getMessage());
        }
    }

    @EventListener
    public void handleSessionDisconnect(SessionDisconnectEvent event) {
        try {
            StompHeaderAccessor accessor = StompHeaderAccessor.wrap(event.getMessage());
            Authentication auth = (Authentication) accessor.getUser();
            if (auth != null && auth.getPrincipal() instanceof com.anochat.security.UserPrincipal principal) {
                userService.setOnlineStatus(principal.getId(), false);
            }
        } catch (Exception e) {
            log.debug("Disconnect event: {}", e.getMessage());
        }
    }
}
