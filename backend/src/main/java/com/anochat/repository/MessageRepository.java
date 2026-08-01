package com.anochat.repository;

import com.anochat.domain.entity.ChatRoom;
import com.anochat.domain.entity.Message;
import com.anochat.domain.entity.MessageStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;
import java.util.UUID;

public interface MessageRepository extends JpaRepository<Message, UUID> {

    Page<Message> findByChatRoomOrderByCreatedAtDesc(ChatRoom chatRoom, Pageable pageable);

    Page<Message> findByChatRoomIdOrderByCreatedAtDesc(UUID chatRoomId, Pageable pageable);

    Optional<Message> findFirstByChatRoomIdOrderByCreatedAtDesc(UUID chatRoomId);

    long countByChatRoomIdAndReceiverIdAndStatusNot(UUID chatRoomId, UUID receiverId, MessageStatus status);

    @Query("SELECT COUNT(m) FROM Message m WHERE m.receiver.id = :userId " +
           "AND m.chatRoom.roomType = com.anochat.domain.entity.RoomType.FRIEND " +
           "AND m.status <> com.anochat.domain.entity.MessageStatus.SEEN")
    long countUnreadFriendMessages(@Param("userId") UUID userId);

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("UPDATE Message m SET m.chatRoom.id = :targetRoomId WHERE m.chatRoom.id = :sourceRoomId")
    int moveMessagesToRoom(@Param("sourceRoomId") UUID sourceRoomId, @Param("targetRoomId") UUID targetRoomId);

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("DELETE FROM Message m WHERE m.chatRoom.id = :roomId")
    int deleteAllByChatRoomId(@Param("roomId") UUID roomId);

    @Modifying
    @Query("UPDATE Message m SET m.status = com.anochat.domain.entity.MessageStatus.SEEN " +
           "WHERE m.chatRoom.id = :roomId AND m.receiver.id = :userId " +
           "AND m.status <> com.anochat.domain.entity.MessageStatus.SEEN")
    int markAllAsSeenInRoom(@Param("roomId") UUID roomId, @Param("userId") UUID userId);
}
