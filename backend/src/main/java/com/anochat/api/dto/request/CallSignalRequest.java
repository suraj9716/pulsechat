package com.anochat.api.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.util.Map;
import java.util.UUID;

@Data
public class CallSignalRequest {

    @NotNull
    private UUID toUserId;

    @NotBlank
    private String type;

    @NotBlank
    private String callId;

    private Map<String, Object> sdp;

    private Map<String, Object> candidate;

    private Long sentAt;
}
