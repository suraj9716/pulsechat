package com.anochat.service;

import com.anochat.api.dto.response.FriendListItemResponse;
import com.anochat.api.dto.response.FriendRequestResponse;
import com.anochat.api.dto.response.FriendStatusResponse;
import com.anochat.api.dto.response.PublicUserResponse;
import com.anochat.api.dto.response.UserResponse;
import com.anochat.api.mapper.UserMapper;
import com.anochat.domain.entity.ChatRoom;
import com.anochat.domain.entity.FriendRequest;
import com.anochat.domain.entity.FriendRequestStatus;
import com.anochat.domain.entity.Friendship;
import com.anochat.domain.entity.Message;
import com.anochat.domain.entity.MessageStatus;
import com.anochat.domain.entity.MessageType;
import com.anochat.domain.entity.RoomType;
import com.anochat.domain.entity.User;
import com.anochat.exception.BadRequestException;
import com.anochat.exception.ResourceNotFoundException;
import com.anochat.repository.ChatRoomRepository;
import com.anochat.repository.FriendRequestRepository;
import com.anochat.repository.FriendshipRepository;
import com.anochat.repository.MessageRepository;
import com.anochat.repository.UserRepository;
import com.anochat.websocket.RealtimeNotificationService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.Comparator;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class FriendService {

    private final FriendRequestRepository friendRequestRepository;
    private final FriendshipRepository friendshipRepository;
    private final UserRepository userRepository;
    private final ChatRoomRepository chatRoomRepository;
    private final MessageRepository messageRepository;
    private final UserMapper userMapper;
    private final BlockService blockService;
    private final RealtimeNotificationService notificationService;
    private final FriendChatCleanupService friendChatCleanupService;
    private final ChatRoomService chatRoomService;

    @Transactional
    public FriendRequestResponse sendRequest(UUID senderId, UUID receiverId) {
        if (senderId.equals(receiverId)) throw new BadRequestException("Cannot send request to yourself");
        if (blockService.isBlocked(senderId, receiverId)) throw new BadRequestException("Cannot send request to blocked user");
        if (friendshipRepository.existsByUserPair(senderId, receiverId)) throw new BadRequestException("Already friends");
        User sender = userRepository.findById(senderId).orElseThrow(() -> new ResourceNotFoundException("User", senderId));
        User receiver = userRepository.findById(receiverId).orElseThrow(() -> new ResourceNotFoundException("User", receiverId));

        // Other user already sent you a request — accept automatically
        var reverse = friendRequestRepository.findBySenderIdAndReceiverId(receiverId, senderId);
        if (reverse.isPresent() && reverse.get().getStatus() == FriendRequestStatus.PENDING) {
            acceptRequest(senderId, reverse.get().getId());
            return toResponse(reverse.get());
        }

        var existing = friendRequestRepository.findBySenderIdAndReceiverId(senderId, receiverId);
        if (existing.isPresent()) {
            FriendRequest request = existing.get();
            if (request.getStatus() == FriendRequestStatus.PENDING) {
                FriendRequestResponse response = toResponse(request);
                notificationService.sendFriendRequest(receiver.getId(), receiver.getUsername(), response);
                return response;
            }
            if (request.getStatus() == FriendRequestStatus.REJECTED) {
                request.setStatus(FriendRequestStatus.PENDING);
                request.setRespondedAt(null);
                request = friendRequestRepository.save(request);
                FriendRequestResponse response = toResponse(request);
                notificationService.sendFriendRequest(receiver.getId(), receiver.getUsername(), response);
                return response;
            }
            if (request.getStatus() == FriendRequestStatus.ACCEPTED
                    && !friendshipRepository.existsByUserPair(senderId, receiverId)) {
                request.setStatus(FriendRequestStatus.PENDING);
                request.setRespondedAt(null);
                request = friendRequestRepository.save(request);
                FriendRequestResponse response = toResponse(request);
                notificationService.sendFriendRequest(receiver.getId(), receiver.getUsername(), response);
                return response;
            }
            throw new BadRequestException("Already friends");
        }

        FriendRequest request = FriendRequest.builder()
                .sender(sender).receiver(receiver).status(FriendRequestStatus.PENDING).build();
        request = friendRequestRepository.save(request);
        FriendRequestResponse response = toResponse(request);
        notificationService.sendFriendRequest(receiver.getId(), receiver.getUsername(), response);
        return response;
    }

    @Transactional
    public void acceptRequest(UUID userId, UUID requestId) {
        FriendRequest request = friendRequestRepository.findById(requestId)
                .orElseThrow(() -> new ResourceNotFoundException("FriendRequest", requestId));
        if (!request.getReceiver().getId().equals(userId)) throw new BadRequestException("Not your request");
        if (request.getStatus() != FriendRequestStatus.PENDING) throw new BadRequestException("Request already processed");
        request.setStatus(FriendRequestStatus.ACCEPTED);
        request.setRespondedAt(java.time.Instant.now());
        friendRequestRepository.save(request);
        Friendship friendship = Friendship.builder()
                .user1(request.getSender()).user2(request.getReceiver()).build();
        friendshipRepository.save(friendship);
        chatRoomService.promoteActiveMatchRoomToFriendChat(
                request.getSender().getId(),
                request.getReceiver().getId());
        notificationService.sendFriendAccepted(
                request.getSender().getUsername(),
                request.getReceiver().getId(),
                request.getReceiver().getUsername());
    }

    @Transactional
    public void rejectRequest(UUID userId, UUID requestId) {
        FriendRequest request = friendRequestRepository.findById(requestId)
                .orElseThrow(() -> new ResourceNotFoundException("FriendRequest", requestId));
        if (!request.getReceiver().getId().equals(userId)) throw new BadRequestException("Not your request");
        request.setStatus(FriendRequestStatus.REJECTED);
        request.setRespondedAt(java.time.Instant.now());
        friendRequestRepository.save(request);
    }

    @Transactional
    public void removeFriend(UUID userId, UUID friendId) {
        Friendship f = friendshipRepository.findByUserPair(userId, friendId)
                .orElseThrow(() -> new ResourceNotFoundException("Friendship not found"));
        friendChatCleanupService.deleteAllChatBetween(userId, friendId);
        friendshipRepository.delete(f);
    }

    @Transactional(readOnly = true)
    public boolean areFriends(UUID userId, UUID otherId) {
        return friendshipRepository.existsByUserPair(userId, otherId);
    }

    @Transactional(readOnly = true)
    public FriendStatusResponse getRelationshipStatus(UUID userId, UUID otherId) {
        boolean friends = friendshipRepository.existsByUserPair(userId, otherId);
        boolean pendingSent = friendRequestRepository.findBySenderIdAndReceiverId(userId, otherId)
                .map(r -> r.getStatus() == FriendRequestStatus.PENDING)
                .orElse(false);
        var incoming = friendRequestRepository.findBySenderIdAndReceiverId(otherId, userId).orElse(null);
        boolean pendingReceived = incoming != null && incoming.getStatus() == FriendRequestStatus.PENDING;
        UUID pendingReceivedRequestId = pendingReceived ? incoming.getId() : null;
        return FriendStatusResponse.builder()
                .friends(friends)
                .pendingSent(pendingSent)
                .pendingReceived(pendingReceived)
                .pendingReceivedRequestId(pendingReceivedRequestId)
                .build();
    }

    @Transactional
    public List<FriendListItemResponse> getFriendsOverview(UUID userId) {
        return friendshipRepository.findAllByUserId(userId).stream()
                .map(f -> {
                    User friend = f.getUser1().getId().equals(userId) ? f.getUser2() : f.getUser1();
                    return buildFriendListItem(userId, friend);
                })
                .sorted(Comparator
                        .comparing(FriendListItemResponse::getLastMessageAt, Comparator.nullsLast(Comparator.reverseOrder()))
                        .thenComparing(item -> item.getFriend().getUsername(), String.CASE_INSENSITIVE_ORDER))
                .collect(Collectors.toList());
    }

    private FriendListItemResponse buildFriendListItem(UUID userId, User friend) {
        ChatRoom room = chatRoomService.resolveFriendRoomIfExists(userId, friend.getId());
        UUID roomId = room != null ? room.getId() : null;
        int unread = roomId != null
                ? (int) messageRepository.countByChatRoomIdAndReceiverIdAndStatusNot(roomId, userId, MessageStatus.SEEN)
                : 0;
        String preview = null;
        Instant lastAt = null;
        if (roomId != null) {
            Message last = messageRepository.findFirstByChatRoomIdOrderByCreatedAtDesc(roomId).orElse(null);
            if (last != null) {
                lastAt = last.getCreatedAt();
                preview = switch (last.getMessageType()) {
                    case IMAGE -> "📷 Photo";
                    case CALL -> last.getContent() != null ? "📞 " + last.getContent() : "📞 Voice call";
                    default -> (last.getContent() != null && !last.getContent().isBlank()
                            ? truncate(last.getContent(), 60)
                            : "Message");
                };
            }
        }
        return FriendListItemResponse.builder()
                .friend(userMapper.toPublicResponse(friend))
                .roomId(roomId)
                .unreadCount(unread)
                .lastMessagePreview(preview)
                .lastMessageAt(lastAt)
                .build();
    }

    private static String truncate(String text, int max) {
        if (text.length() <= max) return text;
        return text.substring(0, max - 1) + "…";
    }

    @Transactional(readOnly = true)
    public List<PublicUserResponse> getFriends(UUID userId) {
        return friendshipRepository.findAllByUserId(userId).stream()
                .map(f -> {
                    User friend = f.getUser1().getId().equals(userId) ? f.getUser2() : f.getUser1();
                    return userMapper.toPublicResponse(friend);
                })
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public List<FriendRequestResponse> getPendingSent(UUID userId) {
        return friendRequestRepository.findBySenderIdAndStatus(userId, FriendRequestStatus.PENDING).stream()
                .map(this::toResponse)
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public List<FriendRequestResponse> getPendingReceived(UUID userId) {
        return friendRequestRepository.findPendingReceivedForUser(userId, FriendRequestStatus.PENDING).stream()
                .map(this::toResponse).collect(Collectors.toList());
    }

    private FriendRequestResponse toResponse(FriendRequest r) {
        return FriendRequestResponse.builder()
                .id(r.getId())
                .sender(userMapper.toPublicResponse(r.getSender()))
                .receiver(userMapper.toPublicResponse(r.getReceiver()))
                .status(r.getStatus())
                .createdAt(r.getCreatedAt())
                .build();
    }
}
