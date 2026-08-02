package com.anochat.api.dto.response;

import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class CallConfigResponse {
    /** livekit = stable server relay; webrtc = direct peer connection fallback */
    private String mode;
    private String livekitUrl;
}
