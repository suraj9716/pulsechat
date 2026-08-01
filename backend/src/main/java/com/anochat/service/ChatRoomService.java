package com.anochat.service;

import com.anochat.api.dto.response.ChatRoomResponse;
import com.anochat.api.dto.response.UserResponse;
import com.anochat.domain.entity.ChatRoom;
import com.anochat.domain.entity.RoomType;
import com.anochat.domain.entity.User;
import com.anochat.exception.BadRequestException;
import com.anochat.exception.ResourceNotFoundException;
import com.anochat.repository.ChatRoomRepository;
import com.anochat.repository.ChatRoomRepository.ChatRoomProjection;
import com.anochat.repository.FriendshipRepository;
import com.anochat.repository.MessageRepository;
import com.anochat.repository.UserRepository;
import com.anochat.repository.UserRepository.UserResponseProjection;
import com.anochat.websocket.RealtimeNotificationService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class ChatRoomService {

    private final ChatRoomRepository chatRoomRepository;
    private final UserRepository userRepository;
    private final FriendshipRepository friendshipRepository;
    private final BlockService blockService;
    private final MessageRepository messageRepository;
    private final RealtimeNotificationService notificationService;

    @Transactional
    public void deactivateAllActiveMatchmakingRoomsForUser(UUID userId) {
        chatRoomRepository.findAllActiveMatchmakingByUserId(userId).forEach(room -> {
            room.setActive(false);
            chatRoomRepository.save(room);
        });
    }

    @Transactional
    public ChatRoom createMatchmakingRoom(UUID user1Id, UUID user2Id) {
        if (blockService.isBlocked(user1Id, user2Id)) {
            throw new BadRequestException("Cannot create room: users are blocked");
        }
        if (friendshipRepository.existsByUserPair(user1Id, user2Id)) {
            throw new BadRequestException("Cannot match with a friend");
        }
        return chatRoomRepository.findActiveMatchmakingByUserPair(user1Id, user2Id)
                .orElseGet(() -> {
                    User u1 = userRepository.findById(user1Id).orElseThrow(() -> new ResourceNotFoundException("User", user1Id));
                    User u2 = userRepository.findById(user2Id).orElseThrow(() -> new ResourceNotFoundException("User", user2Id));
                    ChatRoom room = ChatRoom.builder()
                            .user1(u1).user2(u2).active(true).roomType(RoomType.MATCHMAKING).build();
                    return chatRoomRepository.save(room);
                });
    }

    /** Keeps the same room and messages when friends confirm during random chat. */
    @Transactional
    public void promoteActiveMatchRoomToFriendChat(UUID user1Id, UUID user2Id) {
        chatRoomRepository.findActiveMatchmakingByUserPair(user1Id, user2Id).ifPresent(matchRoom -> {
            List<ChatRoom> existingFriend = chatRoomRepository.findAllByUserPairAndRoomType(
                    user1Id, user2Id, RoomType.FRIEND);
            if (existingFriend.isEmpty()) {
                matchRoom.setRoomType(RoomType.FRIEND);
                matchRoom.setActive(true);
                chatRoomRepository.save(matchRoom);
                return;
            }
            ChatRoom primary = consolidateFriendRooms(existingFriend);
            messageRepository.moveMessagesToRoom(matchRoom.getId(), primary.getId());
            chatRoomRepository.delete(matchRoom);
            if (!primary.isActive()) {
                primary.setActive(true);
                chatRoomRepository.save(primary);
            }
        });
    }

    @Transactional
    public ChatRoomResponse getOrCreateFriendRoom(UUID userId, UUID friendId) {
        if (!friendshipRepository.existsByUserPair(userId, friendId)) {
            throw new BadRequestException("You can only message friends");
        }
        if (blockService.isBlocked(userId, friendId)) {
            throw new BadRequestException("Cannot message blocked user");
        }
        List<ChatRoom> existing = chatRoomRepository.findAllByUserPairAndRoomType(userId, friendId, RoomType.FRIEND);
        ChatRoom room;
        if (existing.isEmpty()) {
            User u1 = userRepository.findById(userId).orElseThrow(() -> new ResourceNotFoundException("User", userId));
            User u2 = userRepository.findById(friendId).orElseThrow(() -> new ResourceNotFoundException("User", friendId));
            room = chatRoomRepository.save(ChatRoom.builder()
                    .user1(u1).user2(u2).active(true).roomType(RoomType.FRIEND).build());
        } else {
            room = consolidateFriendRooms(existing);
        }
        return toResponse(room, userId);
    }

    @Transactional
    public ChatRoom resolveFriendRoomIfExists(UUID userId, UUID friendId) {
        List<ChatRoom> existing = chatRoomRepository.findAllByUserPairAndRoomType(userId, friendId, RoomType.FRIEND);
        if (existing.isEmpty()) {
            return null;
        }
        return consolidateFriendRooms(existing);
    }

    private ChatRoom consolidateFriendRooms(List<ChatRoom> rooms) {
        if (rooms.isEmpty()) {
            throw new IllegalArgumentException("No rooms to consolidate");
        }
        ChatRoom primary = rooms.get(0);
        for (int i = 1; i < rooms.size(); i++) {
            mergeRoomInto(primary, rooms.get(i));
        }
        if (!primary.isActive()) {
            primary.setActive(true);
            primary = chatRoomRepository.save(primary);
        }
        return primary;
    }

    private void mergeRoomInto(ChatRoom target, ChatRoom source) {
        if (target.getId().equals(source.getId())) {
            return;
        }
        messageRepository.moveMessagesToRoom(source.getId(), target.getId());
        chatRoomRepository.delete(source);
    }

    @Transactional(readOnly = true)
    public List<ChatRoomResponse> getFriendConversations(UUID userId) {
        return chatRoomRepository.findAllFriendRoomsByUserId(userId).stream()
                .map(room -> toResponse(room, userId))
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public ChatRoom getActiveMatchmakingRoomForUser(UUID userId) {
        return chatRoomRepository.findAllActiveMatchmakingByUserId(userId).stream()
                .findFirst()
                .orElseThrow(() -> new ResourceNotFoundException("No active chat room for user"));
    }

    @Transactional(readOnly = true)
    public ChatRoomResponse getCurrentMatchmakingRoomResponse(UUID userId) {
        ChatRoomProjection roomProj = chatRoomRepository.findActiveRoomAndOtherUserId(userId)
                .orElseThrow(() -> new ResourceNotFoundException("No active chat room for user"));
        return buildResponseFromProjection(roomProj);
    }

    @Transactional
    public void deactivateRoom(UUID roomId, UUID userId) {
        ChatRoom room = chatRoomRepository.findById(roomId).orElseThrow(() -> new ResourceNotFoundException("ChatRoom", roomId));
        if (room.getRoomType() == RoomType.FRIEND) {
            throw new BadRequestException("Cannot close a friend chat room");
        }
        if (!room.getUser1().getId().equals(userId) && !room.getUser2().getId().equals(userId)) {
            throw new BadRequestException("Not a participant");
        }
        room.setActive(false);
        chatRoomRepository.save(room);
    }

    /** Leaves a match room without notifying — caller handles re-match. */
    @Transactional
    public UUID leaveMatchRoomSilent(UUID roomId, UUID userId) {
        ChatRoom room = chatRoomRepository.findById(roomId).orElseThrow(() -> new ResourceNotFoundException("ChatRoom", roomId));
        if (room.getRoomType() == RoomType.FRIEND) {
            throw new BadRequestException("Cannot close a friend chat room");
        }
        if (!room.getUser1().getId().equals(userId) && !room.getUser2().getId().equals(userId)) {
            throw new BadRequestException("Not a participant");
        }
        UUID otherId = chatRoomRepository.findOtherParticipantId(roomId, userId).orElse(null);
        room.setActive(false);
        chatRoomRepository.save(room);
        return otherId;
    }

    /** @deprecated Use leaveMatchRoomSilent + MatchmakingService.handleNextPartner */
    @Transactional
    public void leaveMatchRoom(UUID roomId, UUID userId) {
        ChatRoom room = chatRoomRepository.findById(roomId).orElseThrow(() -> new ResourceNotFoundException("ChatRoom", roomId));
        if (room.getRoomType() == RoomType.FRIEND) {
            throw new BadRequestException("Cannot close a friend chat room");
        }
        if (!room.getUser1().getId().equals(userId) && !room.getUser2().getId().equals(userId)) {
            throw new BadRequestException("Not a participant");
        }
        UUID otherId = chatRoomRepository.findOtherParticipantId(roomId, userId).orElse(null);
        room.setActive(false);
        chatRoomRepository.save(room);
        if (otherId != null) {
            User leaver = userRepository.findById(userId).orElseThrow(() -> new ResourceNotFoundException("User", userId));
            User other = userRepository.findById(otherId).orElseThrow(() -> new ResourceNotFoundException("User", otherId));
            notificationService.sendPartnerLeft(other.getId(), other.getUsername(), roomId, leaver.getUsername());
        }
    }

    @Transactional(readOnly = true)
    public ChatRoomResponse toResponse(ChatRoom room, UUID currentUserId) {
        UUID otherId = chatRoomRepository.findOtherParticipantId(room.getId(), currentUserId)
                .orElseThrow(() -> new ResourceNotFoundException("ChatRoom participant", room.getId()));
        UserResponseProjection userProj = userRepository.findUserResponseById(otherId)
                .orElseThrow(() -> new ResourceNotFoundException("User", otherId));
        UserResponse participant = UserResponse.builder()
                .id(userProj.getId())
                .username(userProj.getUsername())
                .email(userProj.getEmail())
                .gender(userProj.getGender())
                .bio(userProj.getBio())
                .onlineStatus(userProj.getOnlineStatus())
                .role(userProj.getRole())
                .createdAt(userProj.getCreatedAt())
                .build();
        return ChatRoomResponse.builder()
                .id(room.getId())
                .participant(participant)
                .active(room.isActive())
                .friendChat(room.getRoomType() == RoomType.FRIEND)
                .build();
    }

    private ChatRoomResponse buildResponseFromProjection(ChatRoomProjection roomProj) {
        UUID otherId = roomProj.getOther_user_id();
        UserResponseProjection userProj = userRepository.findUserResponseById(otherId)
                .orElseThrow(() -> new ResourceNotFoundException("User", otherId));
        UserResponse participant = UserResponse.builder()
                .id(userProj.getId())
                .username(userProj.getUsername())
                .email(userProj.getEmail())
                .gender(userProj.getGender())
                .bio(userProj.getBio())
                .onlineStatus(userProj.getOnlineStatus())
                .role(userProj.getRole())
                .createdAt(userProj.getCreatedAt())
                .build();
        return ChatRoomResponse.builder()
                .id(roomProj.getRoom_id())
                .participant(participant)
                .active(true)
                .friendChat(false)
                .build();
    }
}
