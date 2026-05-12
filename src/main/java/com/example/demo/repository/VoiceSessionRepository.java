package com.example.demo.repository;

import com.example.demo.model.VoiceSession;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface VoiceSessionRepository extends JpaRepository<VoiceSession, Long> {
    List<VoiceSession> findByRoomId(Long roomId);

    List<VoiceSession> findByActive(boolean active);

    void deleteByRoomId(Long roomId);

    void deleteByStartedById(Long userId);
}
