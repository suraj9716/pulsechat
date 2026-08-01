package com.anochat.service;

import com.anochat.api.dto.request.UpdateProfileRequest;
import com.anochat.api.dto.response.PublicUserResponse;
import com.anochat.api.dto.response.PublicUserResponse;
import com.anochat.api.dto.response.UserResponse;
import com.anochat.api.mapper.UserMapper;
import com.anochat.domain.entity.User;
import com.anochat.exception.BadRequestException;
import com.anochat.exception.ResourceNotFoundException;
import com.anochat.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class UserService {

    private final UserRepository userRepository;
    private final UserMapper userMapper;

    @Transactional(readOnly = true)
    public UserResponse getProfile(UUID userId) {
        User user = userRepository.findByIdAndNotDeleted(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User", userId));
        return userMapper.toResponse(user);
    }

    @Transactional
    public UserResponse updateProfile(UUID userId, UpdateProfileRequest request) {
        User user = userRepository.findByIdAndNotDeleted(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User", userId));
        if (request.getUsername() != null && !request.getUsername().isBlank()
                && !request.getUsername().equals(user.getUsername())) {
            if (userRepository.existsByUsername(request.getUsername())) {
                throw new BadRequestException("Username already taken");
            }
            user.setUsername(request.getUsername().trim());
        }
        if (request.getBio() != null) {
            user.setBio(request.getBio());
        }
        if (request.getGender() != null) {
            user.setGender(request.getGender());
        }
        user = userRepository.save(user);
        return userMapper.toResponse(user);
    }

    @Transactional(readOnly = true)
    public PublicUserResponse getPublicProfile(UUID userId) {
        User user = userRepository.findByIdAndNotDeleted(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User", userId));
        return userMapper.toPublicResponse(user);
    }

    @Transactional(readOnly = true)
    public PublicUserResponse getPublicProfile(UUID viewerId, UUID userId) {
        return getPublicProfile(userId);
    }

    @Transactional
    public void setOnlineStatus(UUID userId, boolean online) {
        userRepository.findById(userId).ifPresent(u -> {
            u.setOnlineStatus(online);
            userRepository.save(u);
        });
    }

    @Transactional(readOnly = true)
    public List<PublicUserResponse> searchUsers(UUID currentUserId, String query) {
        if (query == null || query.isBlank()) {
            return List.of();
        }
        return userRepository.searchByUsername(query.trim(), currentUserId, PageRequest.of(0, 10)).stream()
                .map(userMapper::toPublicResponse)
                .collect(Collectors.toList());
    }
}
