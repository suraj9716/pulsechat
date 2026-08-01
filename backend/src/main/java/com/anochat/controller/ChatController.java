package com.anochat.controller;

import com.anochat.api.dto.request.CallLogRequest;
import com.anochat.api.dto.request.CallSignalRequest;
import com.anochat.api.dto.request.MessageRequest;
import com.anochat.api.dto.response.ChatRoomResponse;
import com.anochat.api.dto.response.MessageResponse;
import com.anochat.api.dto.response.UnreadSummaryResponse;
import com.anochat.api.dto.response.NextPartnerResponse;
import com.anochat.security.UserPrincipal;
import com.anochat.domain.entity.MessageType;
import com.anochat.service.CallRelayService;
import com.anochat.service.FileStorageService;
import com.anochat.service.ChatRoomService;
import com.anochat.service.MatchmakingService;
import com.anochat.service.MessageService;
import com.anochat.websocket.ChatWebSocketHandler;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/chat")
@RequiredArgsConstructor
public class ChatController {

    private final ChatRoomService chatRoomService;
    private final MessageService messageService;
    private final MatchmakingService matchmakingService;
    private final SimpMessagingTemplate messagingTemplate;
    private final FileStorageService fileStorageService;
    private final CallRelayService callRelayService;

    @GetMapping("/room/current")
    public ResponseEntity<ChatRoomResponse> getCurrentRoom(@AuthenticationPrincipal UserPrincipal principal) {
        try {
            return ResponseEntity.ok(chatRoomService.getCurrentMatchmakingRoomResponse(principal.getId()));
        } catch (com.anochat.exception.ResourceNotFoundException e) {
            return ResponseEntity.noContent().build();
        }
    }

    @GetMapping("/friends/conversations")
    public ResponseEntity<List<ChatRoomResponse>> getFriendConversations(@AuthenticationPrincipal UserPrincipal principal) {
        return ResponseEntity.ok(chatRoomService.getFriendConversations(principal.getId()));
    }

    @GetMapping("/friends/{friendId}/room")
    public ResponseEntity<ChatRoomResponse> getFriendRoom(@AuthenticationPrincipal UserPrincipal principal,
                                                           @PathVariable UUID friendId) {
        return ResponseEntity.ok(chatRoomService.getOrCreateFriendRoom(principal.getId(), friendId));
    }

    @GetMapping("/room/{roomId}/messages")
    public ResponseEntity<List<MessageResponse>> getMessages(@AuthenticationPrincipal UserPrincipal principal,
                                                              @PathVariable UUID roomId,
                                                              @RequestParam(defaultValue = "0") int page,
                                                              @RequestParam(defaultValue = "50") int size) {
        return ResponseEntity.ok(messageService.getHistory(roomId, principal.getId(), page, size));
    }

    @GetMapping("/friends/unread")
    public ResponseEntity<UnreadSummaryResponse> getUnreadSummary(@AuthenticationPrincipal UserPrincipal principal) {
        int total = (int) messageService.getTotalUnreadFriendMessages(principal.getId());
        return ResponseEntity.ok(UnreadSummaryResponse.builder().totalUnread(total).build());
    }

    @PostMapping("/room/{roomId}/read")
    public ResponseEntity<Void> markRoomRead(@AuthenticationPrincipal UserPrincipal principal,
                                             @PathVariable UUID roomId) {
        messageService.markRoomAsRead(roomId, principal.getId());
        return ResponseEntity.ok().build();
    }

    @PostMapping("/room/{roomId}/messages")
    public ResponseEntity<MessageResponse> sendMessage(@AuthenticationPrincipal UserPrincipal principal,
                                                         @PathVariable UUID roomId,
                                                         @Valid @RequestBody MessageRequest request) {
        MessageResponse msg = messageService.sendMessage(
                roomId,
                principal.getId(),
                request.getContent(),
                request.getMessageType(),
                request.getImageUrl());
        messagingTemplate.convertAndSend(ChatWebSocketHandler.TOPIC_ROOM_PREFIX + roomId, msg);
        return ResponseEntity.ok(msg);
    }

    @PostMapping(value = "/upload/image", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<Map<String, String>> uploadImage(@RequestParam("file") MultipartFile file) {
        String url = fileStorageService.storeImage(file);
        return ResponseEntity.ok(Map.of("url", url));
    }

    /**
     * Next partner: leave current room and re-enter matchmaking (client should call matchmaking/search again with preference).
     */
    @PostMapping("/call/signal")
    public ResponseEntity<Map<String, Object>> relayCallSignal(@AuthenticationPrincipal UserPrincipal principal,
                                                               @Valid @RequestBody CallSignalRequest request) {
        Map<String, Object> payload = new java.util.HashMap<>();
        payload.put("type", request.getType());
        payload.put("callId", request.getCallId());
        if (request.getSdp() != null) {
            payload.put("sdp", request.getSdp());
        }
        if (request.getCandidate() != null) {
            payload.put("candidate", request.getCandidate());
        }
        payload.put("sentAt", request.getSentAt() != null ? request.getSentAt() : System.currentTimeMillis());

        boolean delivered = callRelayService.relay(principal, request.getToUserId(), payload);
        if (!delivered) {
            return ResponseEntity.badRequest().body(Map.of("error", "Could not deliver call signal"));
        }
        return ResponseEntity.ok(Map.of("ok", true));
    }

    @PostMapping("/friends/{friendId}/call-log")
    public ResponseEntity<MessageResponse> logCall(@AuthenticationPrincipal UserPrincipal principal,
                                                   @PathVariable UUID friendId,
                                                   @Valid @RequestBody CallLogRequest request) {
        ChatRoomResponse room = chatRoomService.getOrCreateFriendRoom(principal.getId(), friendId);
        MessageResponse msg = messageService.sendMessage(
                room.getId(),
                principal.getId(),
                request.getContent(),
                MessageType.CALL,
                null);
        messagingTemplate.convertAndSend(ChatWebSocketHandler.TOPIC_ROOM_PREFIX + room.getId(), msg);
        return ResponseEntity.ok(msg);
    }

    @PostMapping("/room/{roomId}/next")
    public ResponseEntity<NextPartnerResponse> nextPartner(@AuthenticationPrincipal UserPrincipal principal,
                                                           @PathVariable UUID roomId) {
        return ResponseEntity.ok(matchmakingService.handleNextPartner(roomId, principal.getId()));
    }
}
