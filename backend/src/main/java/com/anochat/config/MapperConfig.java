package com.anochat.config;

import com.anochat.api.dto.response.MessageResponse;
import com.anochat.api.dto.response.PublicUserResponse;
import com.anochat.api.dto.response.UserResponse;
import com.anochat.api.mapper.MessageMapper;
import com.anochat.api.mapper.UserMapper;
import com.anochat.domain.entity.Message;
import com.anochat.domain.entity.User;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * Provides mapper beans so the app starts even if MapStruct annotation processing
 * did not run (e.g. IDE run without full Maven compile).
 */
@Configuration
public class MapperConfig {

    @Bean
    public UserMapper userMapper() {
        return new UserMapper() {
            @Override
            public UserResponse toResponse(User user) {
                if (user == null) return null;
                return UserResponse.builder()
                        .id(user.getId())
                        .username(user.getUsername())
                        .email(user.getEmail())
                        .gender(user.getGender())
                        .bio(user.getBio())
                        .onlineStatus(user.isOnlineStatus())
                        .role(user.getRole())
                        .createdAt(user.getCreatedAt())
                        .build();
            }

            @Override
            public PublicUserResponse toPublicResponse(User user) {
                if (user == null) return null;
                return PublicUserResponse.builder()
                        .id(user.getId())
                        .username(user.getUsername())
                        .gender(user.getGender())
                        .bio(user.getBio())
                        .onlineStatus(user.isOnlineStatus())
                        .build();
            }
        };
    }

    @Bean
    public MessageMapper messageMapper() {
        return message -> {
            if (message == null) return null;
            return MessageResponse.builder()
                    .id(message.getId())
                    .senderId(message.getSender().getId())
                    .receiverId(message.getReceiver().getId())
                    .chatRoomId(message.getChatRoom().getId())
                    .content(message.getContent())
                    .messageType(message.getMessageType())
                    .imageUrl(message.getImageUrl())
                    .status(message.getStatus())
                    .timestamp(message.getCreatedAt())
                    .build();
        };
    }
}
