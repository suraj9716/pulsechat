package com.anochat.api.dto.response;

import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class LiveKitTokenResponse {
    private String token;
    private String url;
    private String roomName;
}
