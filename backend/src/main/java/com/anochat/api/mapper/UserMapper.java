package com.anochat.api.mapper;


import org.mapstruct.Mapper;

import com.anochat.api.dto.response.PublicUserResponse;
import com.anochat.api.dto.response.UserResponse;
import com.anochat.domain.entity.User;

/**
 * Maps User entity to UserResponse. UserResponse has no password field, so it is never exposed.
 */
@Mapper(componentModel = "default")  // Bean provided by MapperConfig to avoid MapStruct processor dependency
public interface UserMapper {

    UserResponse toResponse(User user);

    PublicUserResponse toPublicResponse(User user);
}
