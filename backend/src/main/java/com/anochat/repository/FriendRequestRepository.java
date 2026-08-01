package com.anochat.repository;

import com.anochat.domain.entity.FriendRequest;
import com.anochat.domain.entity.FriendRequestStatus;
import com.anochat.domain.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface FriendRequestRepository extends JpaRepository<FriendRequest, UUID> {

    Optional<FriendRequest> findBySenderAndReceiver(User sender, User receiver);

    Optional<FriendRequest> findBySenderIdAndReceiverId(UUID senderId, UUID receiverId);

    List<FriendRequest> findByReceiverAndStatus(User receiver, FriendRequestStatus status);

    @Query("SELECT fr FROM FriendRequest fr JOIN FETCH fr.sender JOIN FETCH fr.receiver " +
           "WHERE fr.receiver.id = :receiverId AND fr.status = :status ORDER BY fr.createdAt DESC")
    List<FriendRequest> findPendingReceivedForUser(@Param("receiverId") UUID receiverId,
                                                   @Param("status") FriendRequestStatus status);

    @Query("SELECT fr FROM FriendRequest fr JOIN FETCH fr.sender JOIN FETCH fr.receiver " +
           "WHERE fr.id = :id")
    Optional<FriendRequest> findByIdWithUsers(@Param("id") UUID id);

    @Query("SELECT fr FROM FriendRequest fr JOIN FETCH fr.sender JOIN FETCH fr.receiver " +
           "WHERE fr.sender.id = :senderId AND fr.status = :status")
    List<FriendRequest> findBySenderIdAndStatus(@Param("senderId") UUID senderId, @Param("status") FriendRequestStatus status);
    List<FriendRequest> findBySender(User sender);

    boolean existsBySenderAndReceiverAndStatus(User sender, User receiver, FriendRequestStatus status);
}
