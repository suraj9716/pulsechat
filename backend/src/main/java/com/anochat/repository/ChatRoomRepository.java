package com.anochat.repository;

import com.anochat.domain.entity.ChatRoom;
import com.anochat.domain.entity.RoomType;
import com.anochat.domain.entity.User;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;
import java.util.UUID;

public interface ChatRoomRepository extends JpaRepository<ChatRoom, UUID> {

    @Query("SELECT cr FROM ChatRoom cr WHERE cr.active = true AND cr.roomType = com.anochat.domain.entity.RoomType.MATCHMAKING AND " +
           "((cr.user1.id = :user1Id AND cr.user2.id = :user2Id) OR (cr.user1.id = :user2Id AND cr.user2.id = :user1Id))")
    Optional<ChatRoom> findActiveMatchmakingByUserPair(@Param("user1Id") UUID user1Id, @Param("user2Id") UUID user2Id);

    @Query("SELECT cr FROM ChatRoom cr WHERE cr.roomType = :roomType AND " +
           "((cr.user1.id = :user1Id AND cr.user2.id = :user2Id) OR (cr.user1.id = :user2Id AND cr.user2.id = :user1Id)) " +
           "ORDER BY cr.active DESC, cr.updatedAt DESC NULLS LAST, cr.createdAt DESC")
    java.util.List<ChatRoom> findAllByUserPairAndRoomType(@Param("user1Id") UUID user1Id, @Param("user2Id") UUID user2Id,
                                                          @Param("roomType") RoomType roomType);

    @Query("SELECT cr FROM ChatRoom cr WHERE cr.active = true AND cr.roomType = com.anochat.domain.entity.RoomType.MATCHMAKING AND " +
           "((cr.user1.id = :user1Id AND cr.user2.id = :user2Id) OR (cr.user1.id = :user2Id AND cr.user2.id = :user1Id))")
    Optional<ChatRoom> findActiveByUserPair(@Param("user1Id") UUID user1Id, @Param("user2Id") UUID user2Id);

    @Query("SELECT cr FROM ChatRoom cr WHERE cr.active = true AND (cr.user1 = :user OR cr.user2 = :user)")
    Page<ChatRoom> findActiveByUser(@Param("user") User user, Pageable pageable);

    @Query("SELECT cr FROM ChatRoom cr WHERE cr.active = true AND (cr.user1.id = :userId OR cr.user2.id = :userId)")
    Optional<ChatRoom> findActiveByUserId(@Param("userId") UUID userId);

    /** Room id + other participant id via native query (no entity/proxy loaded). */
    @Query(value = "SELECT id AS room_id, CASE WHEN user1_id = :userId THEN user2_id ELSE user1_id END AS other_user_id " +
           "FROM anon.chat_rooms WHERE active = true AND room_type = 'MATCHMAKING' AND (user1_id = :userId OR user2_id = :userId) " +
           "ORDER BY created_at DESC LIMIT 1",
           nativeQuery = true)
    Optional<ChatRoomProjection> findActiveRoomAndOtherUserId(@Param("userId") UUID userId);

    @Query("SELECT cr FROM ChatRoom cr WHERE cr.active = true AND cr.roomType = com.anochat.domain.entity.RoomType.MATCHMAKING " +
           "AND (cr.user1.id = :userId OR cr.user2.id = :userId)")
    java.util.List<ChatRoom> findAllActiveMatchmakingByUserId(@Param("userId") UUID userId);

    @Query("SELECT cr FROM ChatRoom cr WHERE cr.active = true AND (cr.user1.id = :userId OR cr.user2.id = :userId)")
    java.util.List<ChatRoom> findAllActiveByUserId(@Param("userId") UUID userId);

    @Query("SELECT cr FROM ChatRoom cr WHERE cr.roomType = com.anochat.domain.entity.RoomType.FRIEND " +
           "AND (cr.user1.id = :userId OR cr.user2.id = :userId) ORDER BY cr.updatedAt DESC NULLS LAST, cr.createdAt DESC")
    java.util.List<ChatRoom> findAllFriendRoomsByUserId(@Param("userId") UUID userId);

    @Query("SELECT cr FROM ChatRoom cr WHERE " +
           "((cr.user1.id = :user1Id AND cr.user2.id = :user2Id) OR (cr.user1.id = :user2Id AND cr.user2.id = :user1Id))")
    java.util.List<ChatRoom> findAllByUserPair(@Param("user1Id") UUID user1Id, @Param("user2Id") UUID user2Id);

    interface ChatRoomProjection {
        UUID getRoom_id();
        UUID getOther_user_id();
    }

    /** Other participant's user id for a room; avoids touching lazy user1/user2. */
    @Query(value = "SELECT CASE WHEN user1_id = :userId THEN user2_id ELSE user1_id END FROM anon.chat_rooms WHERE id = :roomId LIMIT 1", nativeQuery = true)
    Optional<UUID> findOtherParticipantId(@Param("roomId") UUID roomId, @Param("userId") UUID userId);
}
