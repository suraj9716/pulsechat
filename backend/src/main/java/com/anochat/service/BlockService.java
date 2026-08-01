package com.anochat.service;

import com.anochat.domain.entity.Block;
import com.anochat.domain.entity.User;
import com.anochat.exception.BadRequestException;
import com.anochat.exception.ResourceNotFoundException;
import com.anochat.repository.BlockRepository;
import com.anochat.repository.FriendshipRepository;
import com.anochat.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class BlockService {

    private final BlockRepository blockRepository;
    private final UserRepository userRepository;
    private final FriendshipRepository friendshipRepository;
    private final FriendChatCleanupService friendChatCleanupService;

    public boolean isBlocked(UUID user1Id, UUID user2Id) {
        return blockRepository.isBlocked(user1Id, user2Id);
    }

    @Transactional
    public void block(UUID blockerId, UUID blockedId) {
        if (blockerId.equals(blockedId)) {
            throw new BadRequestException("Cannot block yourself");
        }
        User blocker = userRepository.findById(blockerId).orElseThrow(() -> new ResourceNotFoundException("User", blockerId));
        User blocked = userRepository.findById(blockedId).orElseThrow(() -> new ResourceNotFoundException("User", blockedId));
        if (blockRepository.findByBlockerAndBlocked(blocker, blocked).isPresent()) {
            return; // already blocked
        }
        blockRepository.save(Block.builder().blocker(blocker).blocked(blocked).build());
        friendshipRepository.findByUserPair(blockerId, blockedId).ifPresent(f -> {
            friendChatCleanupService.deleteAllChatBetween(blockerId, blockedId);
            friendshipRepository.delete(f);
        });
    }

    @Transactional
    public void unblock(UUID blockerId, UUID blockedId) {
        Block block = blockRepository.findByBlockerAndBlocked(
                userRepository.getReferenceById(blockerId),
                userRepository.getReferenceById(blockedId)
        ).orElseThrow(() -> new ResourceNotFoundException("Block not found"));
        blockRepository.delete(block);
    }

    public Set<UUID> getBlockedUserIds(UUID userId) {
        return blockRepository.findAllByUserId(userId).stream()
                .map(b -> b.getBlocker().getId().equals(userId) ? b.getBlocked().getId() : b.getBlocker().getId())
                .collect(Collectors.toSet());
    }
}
