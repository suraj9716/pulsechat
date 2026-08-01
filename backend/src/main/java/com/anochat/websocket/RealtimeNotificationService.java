package com.anochat.websocket;

import com.anochat.api.dto.response.ChatRoomResponse;
import com.anochat.api.dto.response.FriendRequestResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;

import java.util.Map;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
public class RealtimeNotificationService {

    public static final String QUEUE_FRIEND_REQUESTS = "/queue/friend-requests";
    public static final String QUEUE_FRIEND_ACCEPTED = "/queue/friend-accepted";
    public static final String QUEUE_FRIEND_MESSAGES = "/queue/friend-messages";
    public static final String QUEUE_CALLS = "/queue/calls";
    public static final String QUEUE_PARTNER_LEFT = "/queue/partner-left";
    public static final String QUEUE_MATCH_FOUND = "/queue/match-found";
    public static final String QUEUE_PARTNER_SEARCHING = "/queue/partner-searching";
    public static final String TOPIC_USER_PREFIX = "/topic/user/";

    private final SimpMessagingTemplate messagingTemplate;

    public void sendFriendRequest(UUID receiverId, String receiverUsername, FriendRequestResponse request) {
        if (receiverUsername != null && !receiverUsername.isBlank()) {
            messagingTemplate.convertAndSendToUser(receiverUsername, QUEUE_FRIEND_REQUESTS, request);
        }
        // Topic fallback so receiver gets notified even if user-queue routing misses a session
        messagingTemplate.convertAndSend(TOPIC_USER_PREFIX + receiverId + "/friend-requests", request);
        log.debug("Friend request notification sent to user {} ({})", receiverUsername, receiverId);
    }

    public void sendFriendAccepted(String senderUsername, UUID friendId, String friendUsername) {
        messagingTemplate.convertAndSendToUser(senderUsername, QUEUE_FRIEND_ACCEPTED,
                Map.of("friendId", friendId.toString(), "friendUsername", friendUsername));
    }

    public void sendFriendMessage(String receiverUsername, Map<String, Object> payload) {
        messagingTemplate.convertAndSendToUser(receiverUsername, QUEUE_FRIEND_MESSAGES, payload);
    }

    public void sendPartnerLeft(UUID receiverId, String receiverUsername, UUID roomId, String leaverUsername) {
        Map<String, String> payload = Map.of(
                "roomId", roomId.toString(),
                "leaverUsername", leaverUsername);
        if (receiverUsername != null && !receiverUsername.isBlank()) {
            messagingTemplate.convertAndSendToUser(receiverUsername, QUEUE_PARTNER_LEFT, payload);
        }
        messagingTemplate.convertAndSend(TOPIC_USER_PREFIX + receiverId + "/partner-left", payload);
        log.debug("Partner left notification sent to user {} ({})", receiverUsername, receiverId);
    }

    public void sendMatchFound(UUID receiverId, String receiverUsername, ChatRoomResponse room) {
        if (receiverUsername != null && !receiverUsername.isBlank()) {
            messagingTemplate.convertAndSendToUser(receiverUsername, QUEUE_MATCH_FOUND, room);
        }
        messagingTemplate.convertAndSend(TOPIC_USER_PREFIX + receiverId + "/match-found", room);
        log.debug("Match found notification sent to user {} ({})", receiverUsername, receiverId);
    }

    public void sendPartnerSearching(UUID receiverId, String receiverUsername) {
        Map<String, String> payload = Map.of("status", "searching");
        if (receiverUsername != null && !receiverUsername.isBlank()) {
            messagingTemplate.convertAndSendToUser(receiverUsername, QUEUE_PARTNER_SEARCHING, payload);
        }
        messagingTemplate.convertAndSend(TOPIC_USER_PREFIX + receiverId + "/partner-searching", payload);
        log.debug("Partner searching notification sent to user {} ({})", receiverUsername, receiverId);
    }

    public void sendCallSignal(UUID receiverId, String receiverUsername, Map<String, Object> payload) {
        if (receiverUsername != null && !receiverUsername.isBlank()) {
            messagingTemplate.convertAndSendToUser(receiverUsername, QUEUE_CALLS, payload);
        }
        messagingTemplate.convertAndSend(TOPIC_USER_PREFIX + receiverId + "/calls", payload);
    }
}
