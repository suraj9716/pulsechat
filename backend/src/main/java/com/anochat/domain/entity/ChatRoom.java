package com.anochat.domain.entity;

import jakarta.persistence.*;
import lombok.*;

import java.util.UUID;

/**
 * 1-to-1 chat room between two users.
 */
@Entity
@Table(name = "chat_rooms", indexes = {
    @Index(name = "idx_chat_rooms_user1_user2", columnList = "user1_id, user2_id"),
    @Index(name = "idx_chat_rooms_user2_user1", columnList = "user2_id, user1_id")
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ChatRoom extends BaseAuditEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user1_id", nullable = false)
    private User user1;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user2_id", nullable = false)
    private User user2;

    @Column(name = "active", nullable = false)
    private boolean active;

    @Enumerated(EnumType.STRING)
    @Column(name = "room_type", nullable = false)
    @Builder.Default
    private RoomType roomType = RoomType.MATCHMAKING;

    /**
     * Returns the other participant given one user id.
     */
    public User getOtherParticipant(UUID userId) {
        if (user1.getId().equals(userId)) {
            return user2;
        }
        if (user2.getId().equals(userId)) {
            return user1;
        }
        return null;
    }
}
