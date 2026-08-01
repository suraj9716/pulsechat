package com.anochat.domain.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;
import java.util.UUID;

/**
 * Block relationship: blockerId blocks blockedId.
 * Blocked users cannot search each other, send friend requests, or message.
 */
@Entity
@Table(name = "blocks", indexes = {
    @Index(name = "idx_blocks_blocker", columnList = "blocker_id"),
    @Index(name = "idx_blocks_blocked", columnList = "blocked_id"),
    @Index(name = "idx_blocks_blocker_blocked", columnList = "blocker_id, blocked_id", unique = true)
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Block {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "blocker_id", nullable = false)
    private User blocker;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "blocked_id", nullable = false)
    private User blocked;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @PrePersist
    protected void onCreate() {
        this.createdAt = Instant.now();
    }
}
