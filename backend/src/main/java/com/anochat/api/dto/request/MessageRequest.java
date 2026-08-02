package com.anochat.api.dto.request;

import com.anochat.domain.entity.MessageType;
import jakarta.validation.constraints.Size;
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
public class MessageRequest {

    @Size(max = 4000)
    private String content;

    @Builder.Default
    private MessageType messageType = MessageType.TEXT;

    @Size(max = 512)
    private String imageUrl;

    /** Client-generated message id (stored locally on devices). */
    private UUID clientMessageId;

    private java.time.Instant timestamp;
}
