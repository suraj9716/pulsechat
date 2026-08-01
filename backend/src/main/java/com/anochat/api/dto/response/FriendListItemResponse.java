package com.anochat.api.dto.response;

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
public class FriendListItemResponse {

    private PublicUserResponse friend;
    private UUID roomId;
    private int unreadCount;
    private String lastMessagePreview;
    private Instant lastMessageAt;
}
