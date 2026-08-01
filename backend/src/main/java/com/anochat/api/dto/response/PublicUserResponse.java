package com.anochat.api.dto.response;

import com.anochat.domain.entity.Gender;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PublicUserResponse {

    private UUID id;
    private String username;
    private Gender gender;
    private String bio;
    private boolean onlineStatus;
}
