package com.anochat.service;

import com.anochat.api.dto.response.ChatRoomResponse;
import com.anochat.api.dto.response.NextPartnerResponse;
import com.anochat.domain.entity.Gender;
import com.anochat.domain.entity.User;
import com.anochat.exception.BadRequestException;
import com.anochat.exception.ResourceNotFoundException;
import com.anochat.matchmaking.MatchmakingQueue;
import com.anochat.repository.FriendshipRepository;
import com.anochat.repository.UserRepository;
import com.anochat.websocket.RealtimeNotificationService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.HashSet;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Orchestrates matchmaking: enqueue with blocked check, create room on match.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class MatchmakingService {

    private final MatchmakingQueue queue;
    private final ChatRoomService chatRoomService;
    private final BlockService blockService;
    private final FriendshipRepository friendshipRepository;
    private final UserRepository userRepository;
    private final RealtimeNotificationService notificationService;

    /** Last gender preference per user — used to re-queue after Next. */
    private final Map<UUID, Gender> lastPreferences = new ConcurrentHashMap<>();

    /**
     * Start search. Returns room if matched immediately, empty if waiting in queue.
     */
    public Optional<ChatRoomResponse> startSearch(UUID userId, Gender preference) {
        lastPreferences.put(userId, preference);
        return enqueueAndMaybeMatch(userId, preference);
    }

    /**
     * Next partner: leave room and re-queue both users. If someone is waiting in queue, they connect instantly.
     */
    public NextPartnerResponse handleNextPartner(UUID roomId, UUID leaverId) {
        UUID otherId = chatRoomService.leaveMatchRoomSilent(roomId, leaverId);

        if (otherId != null) {
            Optional<ChatRoomResponse> otherMatch = reenterMatchmaking(otherId);
            if (otherMatch.isEmpty()) {
                User other = userRepository.findById(otherId)
                        .orElseThrow(() -> new ResourceNotFoundException("User", otherId));
                notificationService.sendPartnerSearching(other.getId(), other.getUsername());
            }
        }

        Optional<ChatRoomResponse> leaverMatch = reenterMatchmaking(leaverId);

        return NextPartnerResponse.builder()
                .status(leaverMatch.isPresent() ? "matched" : "searching")
                .room(leaverMatch.orElse(null))
                .build();
    }

    /** Re-queue using last preference; instant match if a compatible user is waiting. */
    public Optional<ChatRoomResponse> reenterMatchmaking(UUID userId) {
        Gender preference = lastPreferences.get(userId);
        if (preference == null) {
            return Optional.empty();
        }
        queue.remove(userId);
        return enqueueAndMaybeMatch(userId, preference);
    }

    private Optional<ChatRoomResponse> enqueueAndMaybeMatch(UUID userId, Gender preference) {
        if (queue.isInQueue(userId)) {
            throw new BadRequestException("Already in matchmaking queue");
        }
        var excludedIds = new HashSet<>(blockService.getBlockedUserIds(userId));
        excludedIds.addAll(friendshipRepository.findFriendIdsByUserId(userId));
        User user = userRepository.findById(userId).orElseThrow(() -> new ResourceNotFoundException("User", userId));
        Optional<MatchmakingQueue.MatchResult> match = queue.enqueue(
                userId, user.getGender(), preference, java.util.Set.copyOf(excludedIds));
        if (match.isPresent()) {
            MatchmakingQueue.MatchResult result = match.get();
            chatRoomService.deactivateAllActiveMatchmakingRoomsForUser(result.getUser1Id());
            chatRoomService.deactivateAllActiveMatchmakingRoomsForUser(result.getUser2Id());
            chatRoomService.createMatchmakingRoom(result.getUser1Id(), result.getUser2Id());
            notifyBothUsersMatched(result);
            return Optional.of(chatRoomService.getCurrentMatchmakingRoomResponse(userId));
        }
        return Optional.empty();
    }

    private void notifyBothUsersMatched(MatchmakingQueue.MatchResult result) {
        User u1 = userRepository.findById(result.getUser1Id())
                .orElseThrow(() -> new ResourceNotFoundException("User", result.getUser1Id()));
        User u2 = userRepository.findById(result.getUser2Id())
                .orElseThrow(() -> new ResourceNotFoundException("User", result.getUser2Id()));
        ChatRoomResponse r1 = chatRoomService.getCurrentMatchmakingRoomResponse(result.getUser1Id());
        ChatRoomResponse r2 = chatRoomService.getCurrentMatchmakingRoomResponse(result.getUser2Id());
        notificationService.sendMatchFound(u1.getId(), u1.getUsername(), r1);
        notificationService.sendMatchFound(u2.getId(), u2.getUsername(), r2);
    }

    public void cancelSearch(UUID userId) {
        queue.remove(userId);
    }

    public boolean isInQueue(UUID userId) {
        return queue.isInQueue(userId);
    }
}
