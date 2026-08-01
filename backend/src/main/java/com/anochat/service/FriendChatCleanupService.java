package com.anochat.service;

import com.anochat.domain.entity.ChatRoom;
import com.anochat.repository.ChatRoomRepository;
import com.anochat.repository.MessageRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

/**
 * Hard-deletes all chat rooms and messages between two users from the database.
 */
@Service
@RequiredArgsConstructor
public class FriendChatCleanupService {

    private final ChatRoomRepository chatRoomRepository;
    private final MessageRepository messageRepository;

    @Transactional
    public void deleteAllChatBetween(UUID userId, UUID otherUserId) {
        for (ChatRoom room : chatRoomRepository.findAllByUserPair(userId, otherUserId)) {
            messageRepository.deleteAllByChatRoomId(room.getId());
            chatRoomRepository.delete(room);
        }
    }
}
