package com.anochat.service;

import com.anochat.repository.FriendshipRepository;
import com.anochat.repository.UserRepository;
import com.anochat.security.UserPrincipal;
import com.anochat.websocket.RealtimeNotificationService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.Map;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
public class CallRelayService {

    private final FriendshipRepository friendshipRepository;
    private final UserRepository userRepository;
    private final RealtimeNotificationService notificationService;

    /**
     * Relay WebRTC signaling payload to a friend if the caller is authenticated and they are friends.
     *
     * @return true when the signal was delivered to at least one destination
     */
    public boolean relay(UserPrincipal from, UUID toUserId, Map<String, Object> payload) {
        if (from == null || toUserId == null || payload == null || payload.isEmpty()) {
            return false;
        }

        if (!friendshipRepository.existsByUserPair(from.getId(), toUserId)) {
            log.warn("Call signal blocked: users are not friends {} -> {}", from.getId(), toUserId);
            return false;
        }

        var target = userRepository.findById(toUserId).orElse(null);
        if (target == null) {
            log.warn("Call signal blocked: target user not found {}", toUserId);
            return false;
        }

        payload.put("fromUserId", from.getId().toString());
        payload.put("fromUsername", from.getUsername());
        payload.put("toUserId", toUserId.toString());

        normalizeSdpPayload(payload);

        notificationService.sendCallSignal(toUserId, target.getUsername(), payload);
        log.info("Call signal {} relayed {} -> {}", payload.get("type"), from.getId(), toUserId);
        return true;
    }

    private void normalizeSdpPayload(Map<String, Object> payload) {
        Object raw = payload.get("sdp");
        if (!(raw instanceof Map<?, ?> map)) {
            return;
        }

        Object type = map.get("type");
        Object body = map.get("sdp");
        if (!(body instanceof String sdp) || sdp.isBlank()) {
            return;
        }

        String fixed = sdp.trim();
        if (!fixed.contains("\n") && fixed.contains("\\n")) {
            fixed = fixed.replace("\\n", "\n");
        }
        fixed = fixed.replace("\r\n", "\n").replace("\r", "\n");
        if (!fixed.contains("\n") && fixed.matches(".*[a-z]=.*[a-z]=.*")) {
            fixed = fixed.replaceAll("(?<=[^\\r\\n])(?=[a-z]=)", "\n");
        }

        StringBuilder sb = new StringBuilder();
        for (String line : fixed.split("\n")) {
            String trimmed = line.strip();
            if (!trimmed.isEmpty()) {
                sb.append(trimmed).append("\r\n");
            }
        }

        Map<String, Object> normalized = new java.util.HashMap<>();
        normalized.put("type", type != null ? type.toString() : "offer");
        normalized.put("sdp", sb.toString());
        payload.put("sdp", normalized);
    }
}
