package com.anochat.repository;

import com.anochat.domain.entity.Friendship;
import com.anochat.domain.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface FriendshipRepository extends JpaRepository<Friendship, UUID> {

    @Query("SELECT f FROM Friendship f WHERE (f.user1.id = :userId OR f.user2.id = :userId)")
    List<Friendship> findAllByUserId(@Param("userId") UUID userId);

    @Query("SELECT f FROM Friendship f WHERE " +
           "(f.user1.id = :user1Id AND f.user2.id = :user2Id) OR (f.user1.id = :user2Id AND f.user2.id = :user1Id)")
    Optional<Friendship> findByUserPair(@Param("user1Id") UUID user1Id, @Param("user2Id") UUID user2Id);

    boolean existsByUser1AndUser2(User user1, User user2);

    @Query("SELECT CASE WHEN COUNT(f) > 0 THEN true ELSE false END FROM Friendship f WHERE " +
           "(f.user1.id = :user1Id AND f.user2.id = :user2Id) OR (f.user1.id = :user2Id AND f.user2.id = :user1Id)")
    boolean existsByUserPair(@Param("user1Id") UUID user1Id, @Param("user2Id") UUID user2Id);

    @Query("SELECT CASE WHEN f.user1.id = :userId THEN f.user2.id ELSE f.user1.id END FROM Friendship f " +
           "WHERE f.user1.id = :userId OR f.user2.id = :userId")
    List<UUID> findFriendIdsByUserId(@Param("userId") UUID userId);
}
