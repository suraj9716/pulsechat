-- Merge duplicate FRIEND chat rooms for the same user pair (keep newest active room).
WITH ranked AS (
    SELECT id,
           CASE WHEN user1_id < user2_id THEN user1_id ELSE user2_id END AS pair_u1,
           CASE WHEN user1_id < user2_id THEN user2_id ELSE user1_id END AS pair_u2,
           ROW_NUMBER() OVER (
               PARTITION BY
                   CASE WHEN user1_id < user2_id THEN user1_id ELSE user2_id END,
                   CASE WHEN user1_id < user2_id THEN user2_id ELSE user1_id END
               ORDER BY active DESC, updated_at DESC NULLS LAST, created_at DESC
           ) AS rn
    FROM anon.chat_rooms
    WHERE room_type = 'FRIEND'
),
dupes AS (
    SELECT r.id AS dupe_id, k.id AS keep_id
    FROM ranked r
    JOIN ranked k ON r.pair_u1 = k.pair_u1 AND r.pair_u2 = k.pair_u2 AND k.rn = 1
    WHERE r.rn > 1
)
UPDATE anon.messages m
SET chat_room_id = d.keep_id
FROM dupes d
WHERE m.chat_room_id = d.dupe_id;

DELETE FROM anon.chat_rooms
WHERE id IN (
    SELECT id FROM (
        SELECT id,
               ROW_NUMBER() OVER (
                   PARTITION BY
                       CASE WHEN user1_id < user2_id THEN user1_id ELSE user2_id END,
                       CASE WHEN user1_id < user2_id THEN user2_id ELSE user1_id END
                   ORDER BY active DESC, updated_at DESC NULLS LAST, created_at DESC
               ) AS rn
        FROM anon.chat_rooms
        WHERE room_type = 'FRIEND'
    ) t
    WHERE rn > 1
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_chat_rooms_unique_friend_pair
    ON anon.chat_rooms (
        LEAST(user1_id, user2_id),
        GREATEST(user1_id, user2_id)
    )
    WHERE room_type = 'FRIEND';
