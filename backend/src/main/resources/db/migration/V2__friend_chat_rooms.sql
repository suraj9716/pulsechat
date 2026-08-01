ALTER TABLE anon.chat_rooms ADD COLUMN room_type VARCHAR(20) NOT NULL DEFAULT 'MATCHMAKING';
CREATE INDEX idx_chat_rooms_room_type ON anon.chat_rooms(room_type);
CREATE INDEX idx_messages_receiver_status ON anon.messages(receiver_id, status);
