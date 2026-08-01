package com.anochat.api.mapper;

import com.anochat.api.dto.response.MessageResponse;
import com.anochat.domain.entity.Message;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;

@Mapper(componentModel = "default")  // Bean provided by MapperConfig
public interface MessageMapper {

    @Mapping(source = "sender.id", target = "senderId")
    @Mapping(source = "receiver.id", target = "receiverId")
    @Mapping(source = "chatRoom.id", target = "chatRoomId")
    @Mapping(source = "createdAt", target = "timestamp")
    MessageResponse toResponse(Message message);
}
