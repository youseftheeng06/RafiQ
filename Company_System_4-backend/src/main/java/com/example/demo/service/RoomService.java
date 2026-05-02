package com.example.demo.service;

import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;
import java.util.ArrayList;
import java.util.Base64;
import java.util.List;
import java.util.Map;

import javax.crypto.Cipher;
import javax.crypto.spec.IvParameterSpec;
import javax.crypto.spec.SecretKeySpec;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.example.demo.model.Room;
import com.example.demo.model.User;
import com.example.demo.repository.FileResourceRepository;
import com.example.demo.repository.MessageRepository;
import com.example.demo.repository.RoomRepository;
import com.example.demo.repository.UserRepository;
import com.example.demo.repository.VoiceSessionRepository;

@Service
public class RoomService {

    private final RoomRepository roomRepo;
    private final UserRepository userRepo;
    private final MessageRepository messageRepo;
    private final FileResourceRepository fileResourceRepo;
    private final VoiceSessionRepository voiceSessionRepo;
    private final SecureRandom secureRandom = new SecureRandom();

    // دي إعدادات ZEGOCLOUD اللي الباك اند بيستخدمها عشان يطلع session للمكالمة
    @Value("${zegocloud.app-id:0}")
    private long zegoAppId;

    @Value("${zegocloud.server-secret:}")
    private String zegoServerSecret;

    
    public RoomService(RoomRepository roomRepo, UserRepository userRepo, MessageRepository messageRepo, FileResourceRepository fileResourceRepo, VoiceSessionRepository voiceSessionRepo) {
        this.roomRepo = roomRepo;
        this.userRepo = userRepo;
        this.messageRepo = messageRepo;
        this.fileResourceRepo = fileResourceRepo;
        this.voiceSessionRepo = voiceSessionRepo;
    }

    public Room createRoom(Room room, User currentUser) {
        if (currentUser == null) {
            throw new RuntimeException("Current user is required");
        }

        if (!isManager(currentUser)) {
            throw new RuntimeException("Only Manager can create rooms");
        }

        if (room == null) {
            throw new RuntimeException("Room is required");
        }

        if (room.getName() == null || room.getName().isBlank()) {
            throw new RuntimeException("Room name is required");
        }

        if (room.getType() == null || room.getType().isBlank()) {
            throw new RuntimeException("Room type is required");
        }

        User creator = userRepo.findById(currentUser.getId())
                .orElseThrow(() -> new RuntimeException("User not found"));

        // أول ما الروم تتعمل، اللي أنشأها بيتضاف كأول عضو فيها
        room.setCreatedBy(creator);
        room.setActive(true);
        room.getMembers().add(creator);

        return roomRepo.save(room);
    }

    public Room getRoomById(Long id, User currentUser) {
        if (currentUser == null) {
            throw new RuntimeException("Current user is required");
        }

        Room room = roomRepo.findById(id)
                .orElseThrow(() -> new RuntimeException("Room not found"));

        if (!isManager(currentUser) && !roomRepo.existsByIdAndMembersId(id, currentUser.getId())) {
            throw new RuntimeException("Not authorized to access this room");
        }

        return room;
    }

    public List<Room> getAllRooms(User currentUser) {
        if (currentUser == null) {
            throw new RuntimeException("Current user is required");
        }

        if (isManager(currentUser)) {
            return roomRepo.findAll();
        }

        return roomRepo.findByMembersId(currentUser.getId());
    }

    public List<Room> getActiveRooms(boolean active, User currentUser) {
        if (currentUser == null) {
            throw new RuntimeException("Current user is required");
        }

        return roomRepo.findByActive(active);
    }

    public List<Room> getRoomsByName(String name, User currentUser) {
        if (currentUser == null) {
            throw new RuntimeException("Current user is required");
        }

        if (name == null || name.isBlank()) {
            throw new RuntimeException("Room name is required");
        }

        return roomRepo.findByName(name);
    }

    public List<Room> getRoomsByType(String type, User currentUser) {
        if (currentUser == null) {
            throw new RuntimeException("Current user is required");
        }

        if (type == null || type.isBlank()) {
            throw new RuntimeException("Room type is required");
        }

        return roomRepo.findByType(type);
    }

    public Room updateRoom(Long roomId, Room updatedRoom, User currentUser) {
        if (currentUser == null) {
            throw new RuntimeException("Current user is required");
        }

        if (!isManager(currentUser)) {
            throw new RuntimeException("Not authorized to update rooms");
        }

        Room existingRoom = getRoomById(roomId, currentUser);

        existingRoom.setName(updatedRoom.getName());
        existingRoom.setType(updatedRoom.getType());
        existingRoom.setActive(updatedRoom.isActive());

        return roomRepo.save(existingRoom);
    }

    public Room activateRoom(Long roomId, User currentUser) {
        if (currentUser == null) {
            throw new RuntimeException("Current user is required");
        }

        if (!isManager(currentUser)) {
            throw new RuntimeException("Not authorized to activate rooms");
        }

        Room room = getRoomById(roomId, currentUser);
        room.setActive(true);

        return roomRepo.save(room);
    }

    public Room deactivateRoom(Long roomId, User currentUser) {
        if (currentUser == null) {
            throw new RuntimeException("Current user is required");
        }

        if (!isManager(currentUser)) {
            throw new RuntimeException("Not authorized to deactivate rooms");
        }

        Room room = getRoomById(roomId, currentUser);
        room.setActive(false);

        return roomRepo.save(room);
    }

    @Transactional
    public void deleteRoom(Long roomId, User currentUser) {
        if (currentUser == null) {
            throw new RuntimeException("Current user is required");
        }

        if (!isManager(currentUser)) {
            throw new RuntimeException("Not authorized to delete rooms");
        }

        Room room = getRoomById(roomId, currentUser);
        room.getMembers().clear();
        voiceSessionRepo.deleteByRoomId(roomId);
        fileResourceRepo.deleteByRoomId(roomId);
        messageRepo.deleteByRoomId(roomId);
        roomRepo.delete(room);
    }

    public List<User> getRoomMembers(Long roomId, User currentUser) {
        Room room = getRoomById(roomId, currentUser);
        return new ArrayList<>(room.getMembers());
    }

    public List<User> addMemberByStaffId(Long roomId, String staffId, User currentUser) 
    {
        if (currentUser == null) 
        {
            throw new RuntimeException("Current user is required");
        }

        if (!isManager(currentUser)) {
            throw new RuntimeException("Not authorized to add room members");
        }

        if (staffId == null || staffId.isBlank()) {
            throw new RuntimeException("Staff ID is required");
        }

        Room room = getRoomById(roomId, currentUser);
        User member = userRepo.findByStaffId(staffId)
                .orElseThrow(() -> new RuntimeException("User not found"));

        room.getMembers().add(member);
        return new ArrayList<>(roomRepo.save(room).getMembers());
    }

    public List<User> removeMember(Long roomId, Long memberId, User currentUser) {
        if (currentUser == null) {
            throw new RuntimeException("Current user is required");
        }

        if (!isManager(currentUser)) {
            throw new RuntimeException("Not authorized to remove room members");
        }

        Room room = getRoomById(roomId, currentUser);

        boolean removed = room.getMembers().removeIf(member -> member.getId().equals(memberId));
        if (!removed) {
            throw new RuntimeException("User is not a member of this room");
        }

        return new ArrayList<>(roomRepo.save(room).getMembers());
    }

    public Map<String, Object> createVideoCallSession(Long roomId, User currentUser) {
        if (currentUser == null) {
            throw new RuntimeException("Current user is required");
        }

        if (zegoAppId <= 0 || zegoServerSecret == null || zegoServerSecret.isBlank()) {
            throw new RuntimeException("ZEGOCLOUD is not configured on the server");
        }

        Room room = getRoomById(roomId, currentUser);
        boolean isMember = isManager(currentUser) || roomRepo.existsByIdAndMembersId(roomId, currentUser.getId());

        if (!isMember) {
            throw new RuntimeException("Not authorized to join this room call");
        }

        String roomCallId = "room_" + room.getId();
        String callUserId = "user_" + currentUser.getId();
        String token = generateZegoToken(callUserId, 3600);

        return Map.of(
                "appId", zegoAppId,
                "roomId", roomCallId,
                "userId", callUserId,
                "userName", currentUser.getName(),
                "token", token
        );
    }

    private String generateZegoToken(String userId, int effectiveSeconds) {
        try {
            long currentSeconds = System.currentTimeMillis() / 1000;
            int expire = (int) (currentSeconds + effectiveSeconds);
            int nonce = secureRandom.nextInt(Integer.MAX_VALUE);

            String body = String.format(
                    "{\"app_id\":%d,\"user_id\":\"%s\",\"nonce\":%d,\"ctime\":%d,\"expire\":%d}",
                    zegoAppId,
                    userId,
                    nonce,
                    currentSeconds,
                    expire
            );

            String iv = generateIv();
            byte[] cipherBytes = encrypt(body, iv, zegoServerSecret);

            ByteBuffer buffer = ByteBuffer.allocate(8 + 2 + 16 + 2 + cipherBytes.length);
            buffer.putInt(0);
            buffer.putInt(expire);
            buffer.putShort((short) iv.length());
            buffer.put(iv.getBytes(StandardCharsets.UTF_8));
            buffer.putShort((short) cipherBytes.length);
            buffer.put(cipherBytes);

            return "04" + Base64.getEncoder().encodeToString(buffer.array());
        } catch (Exception e) {
            throw new RuntimeException("Failed to generate ZEGOCLOUD token", e);
        }
    }

    private byte[] encrypt(String body, String iv, String secret) throws Exception {
        Cipher cipher = Cipher.getInstance("AES/CBC/PKCS5Padding");
        SecretKeySpec keySpec = new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), "AES");
        IvParameterSpec ivSpec = new IvParameterSpec(iv.getBytes(StandardCharsets.UTF_8));
        cipher.init(Cipher.ENCRYPT_MODE, keySpec, ivSpec);
        return cipher.doFinal(body.getBytes(StandardCharsets.UTF_8));
    }

    private String generateIv() {
        String digits = String.valueOf(Math.abs(secureRandom.nextLong()));
        if (digits.length() >= 16) {
            return digits.substring(0, 16);
        }
        return (digits + "0123456789012345").substring(0, 16);
    }

    public boolean isRoomMember(Long roomId, User currentUser) {
        return isManager(currentUser) || roomRepo.existsByIdAndMembersId(roomId, currentUser.getId());
    }

    private boolean isRoomMember(Room room, User user) {
        return room.getMembers().stream().anyMatch(member -> member.getId().equals(user.getId()));
    }

    private boolean isManager(User user) {
        return "MANAGER".equals(normalizedRole(user));
    }

    private String normalizedRole(User user) {
        return user == null || user.getRole() == null ? "" : user.getRole().trim().toUpperCase();
    }
}
