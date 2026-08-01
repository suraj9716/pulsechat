package com.anochat.matchmaking;

import com.anochat.domain.entity.Gender;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

/**
 * In-memory matchmaking queue. User selects gender preference (MALE/FEMALE).
 * Matching: MALE preference matches with FEMALE and vice versa.
 * Thread-safe for 100k+ concurrent users. For multi-instance scaling, replace with Redis queue.
 */
@Component
@Slf4j
public class MatchmakingQueue {

    // userId -> QueuedUser (user waiting for match)
    private final Map<UUID, QueuedUser> queue = new ConcurrentHashMap<>();

    /**
     * Add user to queue with their gender and preference (desired partner gender).
     * Returns matched pair if match found. Prevents duplicate sessions.
     */
    public Optional<MatchResult> enqueue(UUID userId, Gender myGender, Gender preference, java.util.Set<UUID> excludedUserIds) {
        synchronized (queue) {
            if (queue.containsKey(userId)) {
                log.debug("User {} already in queue", userId);
                return Optional.empty();
            }
            QueuedUser queued = new QueuedUser(userId, myGender, preference);
            Optional<Map.Entry<UUID, QueuedUser>> match = queue.entrySet().stream()
                    .filter(e -> !e.getKey().equals(userId))
                    .filter(e -> !excludedUserIds.contains(e.getKey()))
                    .filter(e -> isCompatible(queued, e.getValue()))
                    .findFirst();
            if (match.isPresent()) {
                UUID otherId = match.get().getKey();
                queue.remove(otherId);
                return Optional.of(new MatchResult(userId, otherId));
            }
            queue.put(userId, queued);
            return Optional.empty();
        }
    }

    public void remove(UUID userId) {
        queue.remove(userId);
    }

    public boolean isInQueue(UUID userId) {
        return queue.containsKey(userId);
    }

    private boolean isCompatible(QueuedUser me, QueuedUser other) {
        // I want partner with my preference; other wants partner with their preference.
        // Match: other's gender == my preference AND my gender == other's preference
        return me.getPreference() == other.getGender() && other.getPreference() == me.getGender();
    }

    @lombok.Getter
    @lombok.AllArgsConstructor
    public static class QueuedUser {
        private final UUID userId;
        private final Gender gender;
        private final Gender preference;
    }

    @lombok.Getter
    @lombok.AllArgsConstructor
    public static class MatchResult {
        private final UUID user1Id;
        private final UUID user2Id;
    }
}
