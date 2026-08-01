package com.anochat.service;

import com.anochat.api.dto.response.MessageResponse;
import com.anochat.api.mapper.MessageMapper;
import com.anochat.domain.entity.ChatRoom;
import com.anochat.domain.entity.Message;
import com.anochat.domain.entity.MessageStatus;
import com.anochat.domain.entity.MessageType;
import com.anochat.domain.entity.RoomType;
import com.anochat.domain.entity.User;
import com.anochat.exception.BadRequestException;
import com.anochat.exception.ResourceNotFoundException;
import com.anochat.repository.ChatRoomRepository;
import com.anochat.repository.MessageRepository;
import com.anochat.repository.UserRepository;
import com.anochat.websocket.RealtimeNotificationService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class MessageService {

    private final MessageRepository messageRepository;
    private final ChatRoomRepository chatRoomRepository;
    private final UserRepository userRepository;
    private final MessageMapper messageMapper;
    private final BlockService blockService;
    private final RealtimeNotificationService notificationService;

    @Transactional
    public MessageResponse sendMessage(UUID chatRoomId, UUID senderId, String content,
                                       MessageType messageType, String imageUrl) {
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

        Message message = Message.builder()
                .chatRoom(room)
                .sender(userRepository.getReferenceById(senderId))
                .receiver(receiver)
                .content(hasText ? content.trim() : null)
                .messageType(type)
                .imageUrl(hasImage ? imageUrl : null)
                .status(MessageStatus.SENT)
                .build();
        message = messageRepository.save(message);
        MessageResponse response = messageMapper.toResponse(message);
        if (room.getRoomType() == RoomType.FRIEND) {
            notifyFriendMessage(receiver, response);
        }
        return response;
    }

    private void notifyFriendMessage(User receiver, MessageResponse msg) {
        String preview = switch (msg.getMessageType()) {
            case IMAGE -> "📷 Photo";
            case CALL -> msg.getContent() != null ? "📞 " + msg.getContent() : "📞 Voice call";
            default -> (msg.getContent() != null && !msg.getContent().isBlank() ? msg.getContent() : "Message");
        };
        notificationService.sendFriendMessage(receiver.getUsername(), Map.of(
                "roomId", msg.getChatRoomId().toString(),
                "senderId", msg.getSenderId().toString(),
                "messageId", msg.getId().toString(),
                "preview", preview,
                "timestamp", msg.getTimestamp().toString()
        ));
    }

    @Transactional(readOnly = true)
    public List<MessageResponse> getHistory(UUID chatRoomId, UUID userId, int page, int size) {
        ChatRoom room = chatRoomRepository.findById(chatRoomId).orElseThrow(() -> new ResourceNotFoundException("ChatRoom", chatRoomId));
        if (!room.getUser1().getId().equals(userId) && !room.getUser2().getId().equals(userId)) {
            throw new BadRequestException("Not a participant");
        }
        Pageable pageable = PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "createdAt"));
        return messageRepository.findByChatRoomIdOrderByCreatedAtDesc(chatRoomId, pageable)
                .stream().map(messageMapper::toResponse).collect(Collectors.toList());
    }

    @Transactional
    public void markRoomAsRead(UUID roomId, UUID userId) {
        ChatRoom room = chatRoomRepository.findById(roomId).orElseThrow(() -> new ResourceNotFoundException("ChatRoom", roomId));
        if (!room.getUser1().getId().equals(userId) && !room.getUser2().getId().equals(userId)) {
            throw new BadRequestException("Not a participant");
        }
        messageRepository.markAllAsSeenInRoom(roomId, userId);
    }

    @Transactional(readOnly = true)
    public long getTotalUnreadFriendMessages(UUID userId) {
        return messageRepository.countUnreadFriendMessages(userId);
    }

    @Transactional(readOnly = true)
    public long getUnreadCountForRoom(UUID roomId, UUID userId) {
        return messageRepository.countByChatRoomIdAndReceiverIdAndStatusNot(roomId, userId, MessageStatus.SEEN);
    }

    @Transactional
    public void markAsSeen(UUID messageId, UUID userId) {
        Message message = messageRepository.findById(messageId).orElseThrow(() -> new ResourceNotFoundException("Message", messageId));
        if (!message.getReceiver().getId().equals(userId)) return;
        message.setStatus(MessageStatus.SEEN);
        messageRepository.save(message);
    }
}
