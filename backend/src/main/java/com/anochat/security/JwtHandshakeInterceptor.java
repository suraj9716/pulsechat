package com.anochat.security;

import org.springframework.http.server.ServerHttpRequest;
import org.springframework.http.server.ServerHttpResponse;
import org.springframework.http.server.ServletServerHttpRequest;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.WebSocketHandler;
import org.springframework.web.socket.server.HandshakeInterceptor;

import java.util.Map;

/**
 * Stores JWT from the SockJS handshake query string on the WebSocket session for STOMP CONNECT auth.
 */
@Component
public class JwtHandshakeInterceptor implements HandshakeInterceptor {

    static final String SESSION_TOKEN_KEY = "token";

    @Override
    public boolean beforeHandshake(ServerHttpRequest request, ServerHttpResponse response,
                                   WebSocketHandler wsHandler, Map<String, Object> attributes) {
        if (request instanceof ServletServerHttpRequest servletRequest) {
            String token = servletRequest.getServletRequest().getParameter(SESSION_TOKEN_KEY);
            if (token != null && !token.isBlank()) {
                attributes.put(SESSION_TOKEN_KEY, token);
            }
        }
        return true;
    }

    @Override
    public void afterHandshake(ServerHttpRequest request, ServerHttpResponse response,
                               WebSocketHandler wsHandler, Exception exception) {
    }
}
