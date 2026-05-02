package com.example.demo.service;

import com.example.demo.model.Room;
import com.example.demo.model.User;
import com.example.demo.repository.FileResourceRepository;
import com.example.demo.repository.MessageRepository;
import com.example.demo.repository.NotificationRepository;
import com.example.demo.repository.RoomRepository;
import com.example.demo.repository.TaskRepository;
import com.example.demo.repository.UserRepository;
import com.example.demo.repository.VoiceSessionRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.List;
import java.util.Random;
import com.example.demo.repository.LoginOtpRepository;

@Service
public class UserService {
    private final UserRepository userRepo;
    private final PasswordEncoder passwordEncoder;
    private final TaskRepository taskRepo;
    private final NotificationRepository notificationRepo;
    private final MessageRepository messageRepo;
    private final FileResourceRepository fileResourceRepo;
    private final VoiceSessionRepository voiceSessionRepo;
    private final RoomRepository roomRepo;
    private final EmailService emailService;
    private final LoginOtpRepository loginOtpRepo;

    public UserService(UserRepository userRepo, PasswordEncoder passwordEncoder, TaskRepository taskRepo, NotificationRepository notificationRepo, MessageRepository messageRepo, FileResourceRepository fileResourceRepo, VoiceSessionRepository voiceSessionRepo, RoomRepository roomRepo, EmailService emailService, LoginOtpRepository loginOtpRepo) {
        this.userRepo = userRepo;
        this.passwordEncoder = passwordEncoder;
        this.taskRepo = taskRepo;
        this.notificationRepo = notificationRepo;
        this.messageRepo = messageRepo;
        this.fileResourceRepo = fileResourceRepo;
        this.voiceSessionRepo = voiceSessionRepo;
        this.roomRepo = roomRepo;
        this.emailService = emailService;
        this.loginOtpRepo = loginOtpRepo;
    }

    public User getUserById(Long id) {
        return userRepo.findById(id)
                .orElseThrow(() -> new RuntimeException("User not found"));
    }

    public User getUserByEmail(String email) {
        if (email == null || email.isBlank()) {
            throw new RuntimeException("Email is required");
        }

        return userRepo.findByEmail(email)
                .orElseThrow(() -> new RuntimeException("User not found"));
    }

    public List<User> getUsersByRole(String role) {
        if (role == null || role.isBlank()) {
            throw new RuntimeException("Role is required");
        }

        return userRepo.findByRole(role);
    }

    public List<User> getEmployees(User currentUser) {
        if (currentUser == null) {
            throw new RuntimeException("Current user is required");
        }

        if (isManager(currentUser)) {
            return userRepo.findAll();
        }

        if (isTeamLeader(currentUser)) {
            return userRepo.findByRole("DEVELOPER");
        }

        throw new RuntimeException("Developers cannot access employee list");
    }

    public long getDeveloperCount() {
        return userRepo.countByRole("DEVELOPER");
    }

    @Transactional
    public void deleteEmployee(Long targetUserId, User currentUser) {
        if (currentUser == null) {
            throw new RuntimeException("Current user is required");
        }

        if (!isManager(currentUser)) {
            throw new RuntimeException("Only Manager can delete employees");
        }

        if (currentUser.getId().equals(targetUserId)) {
            throw new RuntimeException("Manager cannot delete their own account");
        }

        User targetUser = getUserById(targetUserId);

        for (Room room : roomRepo.findByCreatedById(targetUserId)) {
            room.getMembers().clear();
            voiceSessionRepo.deleteByRoomId(room.getId());
            fileResourceRepo.deleteByRoomId(room.getId());
            messageRepo.deleteByRoomId(room.getId());
            roomRepo.delete(room);
        }

        for (Room room : roomRepo.findAll()) {
            boolean changed = room.getMembers().removeIf(member -> member.getId().equals(targetUserId));
            if (changed) {
                roomRepo.save(room);
            }
        }

        taskRepo.deleteByAssignedByIdOrAssignedToId(targetUserId, targetUserId);
        notificationRepo.deleteByRecipientId(targetUserId);
        messageRepo.deleteBySenderId(targetUserId);
        fileResourceRepo.deleteByUploadedById(targetUserId);
        voiceSessionRepo.deleteByStartedById(targetUserId);
        loginOtpRepo.deleteByEmail(targetUser.getEmail());
        userRepo.delete(targetUser);
    }

    public User promoteDeveloperToTeamLeader(Long targetUserId, User currentUser) {
        if (currentUser == null) {
            throw new RuntimeException("Current user is required");
        }

        if (!isManager(currentUser)) {
            throw new RuntimeException("Only Manager can promote employees");
        }

        User targetUser = getUserById(targetUserId);
        if (!"DEVELOPER".equals(normalizedRole(targetUser))) {
            throw new RuntimeException("Only Developer can be promoted to Team Leader");
        }

        String newStaffId = generateUniqueTeamLeaderStaffId();

        targetUser.setRole("TEAM_LEADER");
        targetUser.setStaffId(newStaffId);
        User savedUser = userRepo.save(targetUser);

        emailService.sendPromotionEmail(
            savedUser.getEmail(),
            savedUser.getName(),
            newStaffId
        );

        return savedUser;
    }

    private String generateUniqueTeamLeaderStaffId() {
        Random random = new Random();
        String staffId;
        int attempts = 0;
        do 
        {
            int number = 1000 + random.nextInt(9000);
            staffId = "TEL-" + number;
            attempts++;
            if (attempts > 100) {
                throw new RuntimeException("Could not generate a unique Team Leader Staff ID. Please try again.");
            }
        } while (userRepo.findByStaffId(staffId).isPresent());
        return staffId;
    }

    public User updateProfile(Long userId, User updatedUser, User currentUser) {
        if (currentUser == null) {
            throw new RuntimeException("Current user is required");
        }

        User existingUser = getUserById(userId);

        if (!currentUser.getId().equals(userId) && !currentUser.getRole().equals("MANAGER")) {
            throw new RuntimeException("Not authorized to update this profile");
        }

        existingUser.setName(updatedUser.getName());
        existingUser.setEmail(updatedUser.getEmail());
        if (updatedUser.getPassword() != null && !updatedUser.getPassword().isBlank()) {
            existingUser.setPassword(passwordEncoder.encode(updatedUser.getPassword()));
        }

        return userRepo.save(existingUser);
    }

    public User updateProfilePhoto(Long userId, MultipartFile file, User currentUser) throws IOException {
        User existingUser = getUserForProfileEdit(userId, currentUser);
        existingUser.setProfilePhotoData(file.getBytes());
        existingUser.setProfilePhotoType(file.getContentType());
        return userRepo.save(existingUser);
    }

    public User updateCoverPhoto(Long userId, MultipartFile file, User currentUser) throws IOException {
        User existingUser = getUserForProfileEdit(userId, currentUser);
        existingUser.setCoverPhotoData(file.getBytes());
        existingUser.setCoverPhotoType(file.getContentType());
        return userRepo.save(existingUser);
    }

    public User removeProfilePhoto(Long userId, User currentUser) {
        User existingUser = getUserForProfileEdit(userId, currentUser);
        existingUser.setProfilePhotoData(null);
        existingUser.setProfilePhotoType(null);
        return userRepo.save(existingUser);
    }

    public User removeCoverPhoto(Long userId, User currentUser) {
        User existingUser = getUserForProfileEdit(userId, currentUser);
        existingUser.setCoverPhotoData(null);
        existingUser.setCoverPhotoType(null);
        return userRepo.save(existingUser);
    }

    private User getUserForProfileEdit(Long userId, User currentUser) {
        if (currentUser == null) {
            throw new RuntimeException("Current user is required");
        }

        User existingUser = getUserById(userId);

        if (!currentUser.getId().equals(userId) && !currentUser.getRole().equals("MANAGER")) {
            throw new RuntimeException("Not authorized to update this profile");
        }

        return existingUser;
    }

    public User activateUser(Long targetUserId, User currentUser) {
        if (currentUser == null) {
            throw new RuntimeException("Current user is required");
        }

        if (!currentUser.getRole().equals("MANAGER")) {
            throw new RuntimeException("Not authorized to activate users");
        }

        User targetUser = getUserById(targetUserId);
        targetUser.setActive(true);

        return userRepo.save(targetUser);
    }

    public User deactivateUser(Long targetUserId, User currentUser) {
        if (currentUser == null) {
            throw new RuntimeException("Current user is required");
        }

        if (!currentUser.getRole().equals("MANAGER")) {
            throw new RuntimeException("Not authorized to deactivate users");
        }

        User targetUser = getUserById(targetUserId);
        targetUser.setActive(false);

        return userRepo.save(targetUser);
    }

    private boolean isManager(User user) {
        return "MANAGER".equals(normalizedRole(user));
    }

    private boolean isTeamLeader(User user) {
        return "TEAM_LEADER".equals(normalizedRole(user));
    }

    private String normalizedRole(User user) {
        return user == null || user.getRole() == null ? "" : user.getRole().trim().toUpperCase();
    }
}
