package com.anochat.service;

import com.anochat.api.dto.response.MessageResponse;
import com.anochat.domain.entity.ChatRoom;
import com.anochat.domain.entity.MessageStatus;
import com.anochat.domain.entity.MessageType;
import com.anochat.domain.entity.RoomType;
import com.anochat.domain.entity.User;
import com.anochat.exception.BadRequestException;
import com.anochat.exception.ResourceNotFoundException;
import com.anochat.repository.ChatRoomRepository;
import com.anochat.repository.UserRepository;
import com.anochat.websocket.RealtimeNotificationService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class MessageService {

    private final ChatRoomRepository chatRoomRepository;
    private final UserRepository userRepository;
    private final BlockService blockService;
    private final RealtimeNotificationService notificationService;

    @Transactional(readOnly = true)
    public MessageResponse sendMessage(UUID chatRoomId, UUID senderId, String content,
                                       MessageType messageType, String imageUrl) {
        return sendMessage(chatRoomId, senderId, content, messageType, imageUrl, null, null);
    }

    /**
     * Validates and relays a message in real time. History is stored on each user's device only.
     */
    @Transactional(readOnly = true)
    public MessageResponse sendMessage(UUID chatRoomId, UUID senderId, String content,
                                       MessageType messageType, String imageUrl,
                                       UUID clientMessageId, java.time.Instant clientTimestamp) {
        ChatRoom room = chatRoomRepository.findById(chatRoomId).orElseThrow(() -> new ResourceNotFoundException("ChatRoom", chatRoomId));
        if (chatRoomRepository.findOtherParticipantId(chatRoomId, senderId).isEmpty()) {
            throw new BadRequestException("Not a participant");
        }
        if (room.getRoomType() != RoomType.FRIEND && !room.isActive()) {
            throw new BadRequestException("Room is closed");
        }
        User receiver = room.getOtherParticipant(senderId);
        if (blockService.isBlocked(senderId, receiver.getId())) {
            throw new BadRequestException("Cannot message blocked user");
        }

        MessageType type = messageType != null ? messageType : MessageType.TEXT;
        boolean hasText = content != null && !content.isBlank();
        boolean hasImage = imageUrl != null && !imageUrl.isBlank();
        if (type == MessageType.CALL) {
            if (!hasText) {
                throw new BadRequestException("Call log content required");
            }
        } else if (!hasText && !hasImage) {
            throw new BadRequestException("Message cannot be empty");
        }
        if (type == MessageType.IMAGE && !hasImage) {
            throw new BadRequestException("Image URL is required");
        }

        User sender = userRepository.findById(senderId)
                .orElseThrow(() -> new ResourceNotFoundException("User", senderId));

        MessageResponse response = MessageResponse.builder()
                .id(clientMessageId != null ? clientMessageId : UUID.randomUUID())
                .senderId(senderId)
                .receiverId(receiver.getId())
                .chatRoomId(chatRoomId)
                .content(hasText ? content.trim() : null)
                .messageType(type)
                .imageUrl(hasImage ? imageUrl : null)
                .status(MessageStatus.SENT)
                .timestamp(clientTimestamp != null ? clientTimestamp : java.time.Instant.now())
                .build();

        notifyIncomingMessage(receiver, sender, response, room.getRoomType());
        return response;
    }

    private void notifyIncomingMessage(User receiver, User sender, MessageResponse msg, RoomType roomType) {
        if (msg.getMessageType() == MessageType.CALL) {
            return;
        }
        String preview = switch (msg.getMessageType()) {
            case IMAGE -> "📷 Photo";
            default -> (msg.getContent() != null && !msg.getContent().isBlank() ? msg.getContent() : "Message");
        };
        notificationService.sendFriendMessage(receiver.getUsername(), Map.of(
                "roomId", msg.getChatRoomId().toString(),
                "senderId", msg.getSenderId().toString(),
                "senderUsername", sender.getUsername(),
                "messageId", msg.getId().toString(),
                "preview", preview,
                "timestamp", msg.getTimestamp().toString(),
                "roomType", roomType.name()
        ));
    }

    @Transactional(readOnly = true)
    public List<MessageResponse> getHistory(UUID chatRoomId, UUID userId, int page, int size) {
        ChatRoom room = chatRoomRepository.findById(chatRoomId).orElseThrow(() -> new ResourceNotFoundException("ChatRoom", chatRoomId));
        if (!room.getUser1().getId().equals(userId) && !room.getUser2().getId().equals(userId)) {
            throw new BadRequestException("Not a participant");
        }
        // Chat history lives on user devices — not in the database.
        return List.of();
    }

    @Transactional(readOnly = true)
    public void markRoomAsRead(UUID roomId, UUID userId) {
        chatRoomRepository.findById(roomId).orElseThrow(() -> new ResourceNotFoundException("ChatRoom", roomId));
        // Read state tracked locally on the client.
    }

    @Transactional(readOnly = true)
    public long getTotalUnreadFriendMessages(UUID userId) {
        return 0;
    }

    @Transactional(readOnly = true)
    public long getUnreadCountForRoom(UUID roomId, UUID userId) {
        return 0;
    }

    @Transactional(readOnly = true)
    public void markAsSeen(UUID messageId, UUID userId) {
        // Read receipts tracked locally on the client.
    }
}
