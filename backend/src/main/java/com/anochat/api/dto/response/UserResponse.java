package com.anochat.api.dto.response;

import com.anochat.domain.entity.Gender;
import com.anochat.domain.entity.Role;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;
import java.util.UUID;

/**
 * User response - never exposes password or other sensitive fields.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class UserResponse {

    private UUID id;
    private String username;
    private String email;
    private Gender gender;
    private String bio;
    private boolean onlineStatus;
    private Role role;
    private Instant createdAt;
}
