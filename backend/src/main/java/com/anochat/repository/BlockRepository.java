package com.anochat.repository;

import com.anochat.domain.entity.Block;
import com.anochat.domain.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface BlockRepository extends JpaRepository<Block, UUID> {

    Optional<Block> findByBlockerAndBlocked(User blocker, User blocked);

    @Query("SELECT b FROM Block b WHERE (b.blocker.id = :userId OR b.blocked.id = :userId)")
    List<Block> findAllByUserId(@Param("userId") UUID userId);

    @Query("SELECT CASE WHEN COUNT(b) > 0 THEN true ELSE false END FROM Block b WHERE " +
           "(b.blocker.id = :user1Id AND b.blocked.id = :user2Id) OR (b.blocker.id = :user2Id AND b.blocked.id = :user1Id)")
    boolean isBlocked(@Param("user1Id") UUID user1Id, @Param("user2Id") UUID user2Id);

    List<Block> findByBlocker(User blocker);
}
