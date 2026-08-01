package com.anochat.repository;

import com.anochat.domain.entity.User;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface UserRepository extends JpaRepository<User, UUID> {

    Optional<User> findByEmail(String email);

    Optional<User> findByUsername(String username);

    boolean existsByEmail(String email);

    boolean existsByUsername(String username);

    List<User> findByOnlineStatusTrueAndDeletedAtIsNull();

    @Query("SELECT u FROM User u WHERE u.deletedAt IS NULL AND u.banned = false")
    Page<User> findAllActive(Pageable pageable);

    @Query("SELECT u FROM User u WHERE u.id = :id AND u.deletedAt IS NULL")
    Optional<User> findByIdAndNotDeleted(@Param("id") UUID id);

    /** Projection for response - no entity/proxy loaded, avoids LazyInitializationException. */
    @Query("SELECT u.id AS id, u.username AS username, u.email AS email, u.gender AS gender, u.bio AS bio, u.onlineStatus AS onlineStatus, u.role AS role, u.createdAt AS createdAt FROM User u WHERE u.id = :id")
    Optional<UserResponseProjection> findUserResponseById(@Param("id") UUID id);

    @Query("SELECT u FROM User u WHERE u.deletedAt IS NULL AND u.banned = false AND u.id != :excludeId " +
           "AND LOWER(u.username) LIKE LOWER(CONCAT('%', :query, '%'))")
    List<User> searchByUsername(@Param("query") String query, @Param("excludeId") UUID excludeId, Pageable pageable);

    interface UserResponseProjection {
        UUID getId();
        String getUsername();
        String getEmail();
        com.anochat.domain.entity.Gender getGender();
        String getBio();
        boolean getOnlineStatus();
        com.anochat.domain.entity.Role getRole();
        java.time.Instant getCreatedAt();
    }
}
