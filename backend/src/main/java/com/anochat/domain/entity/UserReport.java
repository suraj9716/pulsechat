package com.anochat.domain.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;
import java.util.UUID;

/**
 * User report for admin moderation.
 */
@Entity
@Table(name = "user_reports", indexes = {
    @Index(name = "idx_user_reports_reporter", columnList = "reporter_id"),
    @Index(name = "idx_user_reports_reported", columnList = "reported_id")
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class UserReport {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "reporter_id", nullable = false)
    private User reporter;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "reported_id", nullable = false)
    private User reported;

    @Column(length = 1000)
    private String reason;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "resolved")
    private boolean resolved;

    @PrePersist
    protected void onCreate() {
        this.createdAt = Instant.now();
    }
}
