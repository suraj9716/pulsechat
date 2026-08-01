package com.anochat.api.dto.response;

import com.anochat.domain.entity.MessageStatus;
import com.anochat.domain.entity.MessageType;
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
public class MessageResponse {

    private UUID id;
    private UUID senderId;
    private UUID receiverId;
    private UUID chatRoomId;
    private String content;
    private MessageType messageType;
    private String imageUrl;
    private MessageStatus status;
    private Instant timestamp;
}
