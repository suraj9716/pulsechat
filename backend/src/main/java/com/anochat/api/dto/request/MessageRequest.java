package com.anochat.api.dto.request;

import com.anochat.domain.entity.MessageType;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

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
}
