package com.anochat.service;

import com.anochat.api.dto.response.LiveKitTokenResponse;
import com.anochat.config.AppProperties;
import com.anochat.exception.BadRequestException;
import com.anochat.security.UserPrincipal;
import io.livekit.server.AccessToken;
import io.livekit.server.RoomJoin;
import io.livekit.server.RoomName;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

@Service
@RequiredArgsConstructor
public class LiveKitService {

    private final AppProperties appProperties;

    public boolean isEnabled() {
        AppProperties.LiveKit cfg = appProperties.getLivekit();
        return cfg != null
                && StringUtils.hasText(cfg.getUrl())
                && StringUtils.hasText(cfg.getApiKey())
                && StringUtils.hasText(cfg.getApiSecret());
    }

    public String getPublicUrl() {
        return isEnabled() ? appProperties.getLivekit().getUrl().trim() : null;
    }

    public LiveKitTokenResponse createJoinToken(UserPrincipal user, String callId) {
        if (!isEnabled()) {
            throw new BadRequestException("LiveKit is not configured on the server");
        }
        if (!StringUtils.hasText(callId)) {
            throw new BadRequestException("callId is required");
        }

        String roomName = "pulsechat-" + callId.trim();
        AppProperties.LiveKit cfg = appProperties.getLivekit();

        AccessToken token = new AccessToken(cfg.getApiKey(), cfg.getApiSecret());
        token.setIdentity(user.getId().toString());
        token.setName(user.getUsername());
        token.setTtl(60 * 60 * 1000L);
        token.addGrants(new RoomJoin(true), new RoomName(roomName));

        return LiveKitTokenResponse.builder()
                .token(token.toJwt())
                .url(cfg.getUrl().trim())
                .roomName(roomName)
                .build();
    }
}
