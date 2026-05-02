package com.example.demo.service;

import com.example.demo.model.User;
import com.example.demo.model.VoiceSession;
import com.example.demo.repository.RoomRepository;
import com.example.demo.repository.VoiceSessionRepository;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class VoiceSessionService {

    private final VoiceSessionRepository voiceSessionRepo;
    private final RoomRepository roomRepo;

    public VoiceSessionService(VoiceSessionRepository voiceSessionRepo, RoomRepository roomRepo) {
        this.voiceSessionRepo = voiceSessionRepo;
        this.roomRepo = roomRepo;
    }

    public VoiceSession createVoiceSession(VoiceSession voiceSession, User currentUser) {
        throw new UnsupportedOperationException("Create voice session will be implemented with WebRTC logic");
    }

    public VoiceSession getVoiceSessionById(Long id, User currentUser) {
        if (currentUser == null) {
            throw new RuntimeException("Current user is required");
        }

        VoiceSession voiceSession = voiceSessionRepo.findById(id)
                .orElseThrow(() -> new RuntimeException("Voice session not found"));

        if (!currentUser.getRole().equals("MANAGER")
                && !currentUser.getRole().equals("TEAM_LEADER")
                && !voiceSession.getStartedBy().getId().equals(currentUser.getId())) {
            throw new RuntimeException("Not authorized to view this voice session");
        }

        return voiceSession;
    }

    public List<VoiceSession> getVoiceSessionsByRoom(Long roomId, User currentUser) {
        if (currentUser == null) {
            throw new RuntimeException("Current user is required");
        }

        if (roomId == null) {
            throw new RuntimeException("Room id is required");
        }

        roomRepo.findById(roomId)
                .orElseThrow(() -> new RuntimeException("Room not found"));

        return voiceSessionRepo.findByRoomId(roomId);
    }

    public List<VoiceSession> getVoiceSessionsByActive(boolean active, User currentUser) {
        if (currentUser == null) {
            throw new RuntimeException("Current user is required");
        }

        if (!currentUser.getRole().equals("MANAGER") && !currentUser.getRole().equals("TEAM_LEADER")) {
            throw new RuntimeException("Not authorized to view voice sessions by status");
        }

        return voiceSessionRepo.findByActive(active);
    }

    public VoiceSession updateVoiceSession(Long voiceSessionId, VoiceSession updatedVoiceSession, User currentUser) {
        if (currentUser == null) {
            throw new RuntimeException("Current user is required");
        }

        VoiceSession existingVoiceSession = getVoiceSessionById(voiceSessionId, currentUser);

        if (!currentUser.getRole().equals("MANAGER")
                && !currentUser.getRole().equals("TEAM_LEADER")
                && !existingVoiceSession.getStartedBy().getId().equals(currentUser.getId())) {
            throw new RuntimeException("Not authorized to update this voice session");
        }

        existingVoiceSession.setActive(updatedVoiceSession.isActive());

        return voiceSessionRepo.save(existingVoiceSession);
    }

    public VoiceSession endVoiceSession(Long voiceSessionId, User currentUser) {
        if (currentUser == null) {
            throw new RuntimeException("Current user is required");
        }

        VoiceSession existingVoiceSession = getVoiceSessionById(voiceSessionId, currentUser);

        if (!currentUser.getRole().equals("MANAGER")
                && !currentUser.getRole().equals("TEAM_LEADER")
                && !existingVoiceSession.getStartedBy().getId().equals(currentUser.getId())) {
            throw new RuntimeException("Not authorized to end this voice session");
        }

        existingVoiceSession.setActive(false);
        return voiceSessionRepo.save(existingVoiceSession);
    }

    public void deleteVoiceSession(Long voiceSessionId, User currentUser) {
        if (currentUser == null) {
            throw new RuntimeException("Current user is required");
        }

        VoiceSession existingVoiceSession = getVoiceSessionById(voiceSessionId, currentUser);

        if (!currentUser.getRole().equals("MANAGER")
                && !currentUser.getRole().equals("TEAM_LEADER")
                && !existingVoiceSession.getStartedBy().getId().equals(currentUser.getId())) {
            throw new RuntimeException("Not authorized to delete this voice session");
        }

        voiceSessionRepo.delete(existingVoiceSession);
    }
}
