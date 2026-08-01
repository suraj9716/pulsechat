package com.anochat.api.dto.response;

import java.util.UUID;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class FriendStatusResponse {
    private boolean friends;
    private boolean pendingSent;
    private boolean pendingReceived;
    private UUID pendingReceivedRequestId;
}
