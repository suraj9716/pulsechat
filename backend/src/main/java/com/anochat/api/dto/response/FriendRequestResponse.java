package com.anochat.api.dto.response;

import com.anochat.domain.entity.FriendRequestStatus;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;
import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class FriendRequestResponse {

    private UUID id;
    private PublicUserResponse sender;
    private PublicUserResponse receiver;
    private FriendRequestStatus status;
    private Instant createdAt;
}
