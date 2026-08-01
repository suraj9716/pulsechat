package com.anochat.security;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.messaging.Message;
import org.springframework.messaging.MessageChannel;
import org.springframework.messaging.simp.stomp.StompCommand;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.messaging.support.ChannelInterceptor;
import org.springframework.messaging.support.MessageHeaderAccessor;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Map;

/**
 * WebSocket authentication: extract JWT from CONNECT frame (header or query) and set SecurityContext.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class JwtChannelInterceptor implements ChannelInterceptor {

    private final JwtProvider jwtProvider;
    private final CustomUserDetailsService userDetailsService;

    @Override
    public Message<?> preSend(Message<?> message, MessageChannel channel) {
        StompHeaderAccessor accessor = MessageHeaderAccessor.getAccessor(message, StompHeaderAccessor.class);
        if (accessor == null) {
            return message;
        }
        if (StompCommand.CONNECT.equals(accessor.getCommand())) {
            String token = getToken(accessor);
            if (token != null && jwtProvider.validateToken(token)) {
                try {
                    var userId = jwtProvider.getUserIdFromToken(token);
                    var userDetails = userDetailsService.loadUserById(userId);
                    var auth = new UsernamePasswordAuthenticationToken(userDetails, null, userDetails.getAuthorities());
                    accessor.setUser(auth);
                    SecurityContextHolder.getContext().setAuthentication(auth);
                } catch (Exception e) {
                    log.debug("WebSocket auth failed: {}", e.getMessage());
                }
            }
        } else if (accessor.getUser() instanceof Authentication auth) {
            SecurityContextHolder.getContext().setAuthentication(auth);
        }
        return message;
    }

    @Override
    public void afterSendCompletion(Message<?> message, MessageChannel channel, boolean sent, Exception ex) {
        SecurityContextHolder.clearContext();
    }

    private String getToken(StompHeaderAccessor accessor) {
        List<String> authHeader = accessor.getNativeHeader("Authorization");
        if (authHeader != null && !authHeader.isEmpty()) {
            String v = authHeader.get(0);
            if (v != null && v.startsWith("Bearer ")) return v.substring(7);
        }
        String tokenHeader = accessor.getFirstNativeHeader("token");
        if (tokenHeader != null && !tokenHeader.isBlank()) {
            return tokenHeader;
        }
        Map<String, Object> sessionAttrs = accessor.getSessionAttributes();
        if (sessionAttrs != null) {
            Object sessionToken = sessionAttrs.get(JwtHandshakeInterceptor.SESSION_TOKEN_KEY);
            if (sessionToken instanceof String s && !s.isBlank()) {
                return s;
            }
        }
        return null;
    }
}
