package com.example.demo.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.example.demo.dto.ProfileExtendedRequest;
import com.example.demo.dto.UserPreferencesRequest;
import com.example.demo.model.Room;
import com.example.demo.model.User;
import com.example.demo.repository.PostRepository;
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
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Random;
import com.example.demo.repository.LoginOtpRepository;
import com.example.demo.validation.PasswordPolicy;

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
    private final PostRepository postRepo;
    private final PostService postService;
    private final EmailService emailService;
    private final LoginOtpRepository loginOtpRepo;
    private final ObjectMapper objectMapper;

    public UserService(UserRepository userRepo, PasswordEncoder passwordEncoder, TaskRepository taskRepo, NotificationRepository notificationRepo, MessageRepository messageRepo, FileResourceRepository fileResourceRepo, VoiceSessionRepository voiceSessionRepo, RoomRepository roomRepo, PostRepository postRepo, PostService postService, EmailService emailService, LoginOtpRepository loginOtpRepo, ObjectMapper objectMapper) {
        this.userRepo = userRepo;
        this.passwordEncoder = passwordEncoder;
        this.taskRepo = taskRepo;
        this.notificationRepo = notificationRepo;
        this.messageRepo = messageRepo;
        this.fileResourceRepo = fileResourceRepo;
        this.voiceSessionRepo = voiceSessionRepo;
        this.roomRepo = roomRepo;
        this.postRepo = postRepo;
        this.postService = postService;
        this.emailService = emailService;
        this.loginOtpRepo = loginOtpRepo;
        this.objectMapper = objectMapper;
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
        deleteUserData(targetUser);
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
            PasswordPolicy.requireStrongPlainPassword(updatedUser.getPassword());
            existingUser.setPassword(passwordEncoder.encode(updatedUser.getPassword()));
        }

        return userRepo.save(existingUser);
    }

    public User changePassword(Long userId, String currentPassword, String newPassword, User currentUser) {
        if (currentUser == null) {
            throw new RuntimeException("Current user is required");
        }

        if (!currentUser.getId().equals(userId)) {
            throw new RuntimeException("Not authorized to change this password");
        }

        PasswordPolicy.requireStrongPlainPassword(newPassword);

        User existingUser = getUserById(userId);
        if (!passwordEncoder.matches(currentPassword == null ? "" : currentPassword, existingUser.getPassword())) {
            throw new RuntimeException("Current password is incorrect");
        }

        existingUser.setPassword(passwordEncoder.encode(newPassword));
        return userRepo.save(existingUser);
    }

    @Transactional
    public void deleteOwnAccount(Long userId, User currentUser) {
        if (currentUser == null) {
            throw new RuntimeException("Current user is required");
        }

        if (!currentUser.getId().equals(userId)) {
            throw new RuntimeException("Not authorized to delete this account");
        }

        User targetUser = getUserById(userId);
        deleteUserData(targetUser);
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

    public Map<String, Object> getProfileExtended(Long userId, User currentUser) {
        User existingUser = getUserForProfileEdit(userId, currentUser);
        return buildProfileExtendedResponse(existingUser);
    }

    public Map<String, Object> updateProfileExtended(Long userId, ProfileExtendedRequest request, User currentUser) {
        if (request == null) {
            throw new RuntimeException("Profile extended payload is required");
        }

        User existingUser = getUserForProfileEdit(userId, currentUser);
        existingUser.setBio(trimToNull(request.bio()));
        existingUser.setSkillsCsv(joinSkills(request.skills()));

        List<Map<String, String>> experiences = request.experiences() == null ? List.of() : request.experiences();
        applyExperience(existingUser, 0, experiences);
        applyExperience(existingUser, 1, experiences);
        applyExperience(existingUser, 2, experiences);

        Map<String, String> socialLinks = request.socialLinks() == null ? Map.of() : request.socialLinks();
        existingUser.setGithubLink(trimToNull(socialLinks.get("github")));
        existingUser.setTwitterLink(trimToNull(socialLinks.get("twitter")));
        existingUser.setLinkedinLink(trimToNull(socialLinks.get("linkedin")));

        User savedUser = userRepo.save(existingUser);
        return buildProfileExtendedResponse(savedUser);
    }

    public Map<String, Object> getUserPreferences(Long userId, User currentUser) {
        User existingUser = getUserForProfileEdit(userId, currentUser);
        return buildUserPreferencesResponse(existingUser);
    }

    public Map<String, Object> updateUserPreferences(Long userId, UserPreferencesRequest request, User currentUser) {
        if (request == null) {
            throw new RuntimeException("Preferences payload is required");
        }

        User existingUser = getUserForProfileEdit(userId, currentUser);
        existingUser.setChatBackgroundsJson(writeJson(normalizeStringMap(request.chatBackgrounds())));
        existingUser.setAiChatHistoryJson(writeJson(normalizeHistory(request.aiHistory())));

        User savedUser = userRepo.save(existingUser);
        return buildUserPreferencesResponse(savedUser);
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

    private Map<String, Object> buildProfileExtendedResponse(User user) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("bio", user.getBio());
        body.put("skills", splitSkills(user.getSkillsCsv()));
        body.put("experiences", List.of(
                experienceEntry(user.getExp1Role(), user.getExp1Years()),
                experienceEntry(user.getExp2Role(), user.getExp2Years()),
                experienceEntry(user.getExp3Role(), user.getExp3Years())
        ).stream().filter(entry -> entry.get("role") != null).toList());

        Map<String, String> socialLinks = new LinkedHashMap<>();
        socialLinks.put("github", user.getGithubLink());
        socialLinks.put("twitter", user.getTwitterLink());
        socialLinks.put("linkedin", user.getLinkedinLink());
        body.put("socialLinks", socialLinks);
        return body;
    }

    private Map<String, Object> buildUserPreferencesResponse(User user) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("chatBackgrounds", readStringMap(user.getChatBackgroundsJson()));
        body.put("aiHistory", readHistory(user.getAiChatHistoryJson()));
        return body;
    }

    private void applyExperience(User user, int index, List<Map<String, String>> experiences) {
        Map<String, String> experience = index < experiences.size() && experiences.get(index) != null
                ? experiences.get(index)
                : Map.of();

        String role = trimToNull(experience.get("role"));
        String years = trimToNull(experience.get("years"));

        if (index == 0) {
            user.setExp1Role(role);
            user.setExp1Years(years);
        } else if (index == 1) {
            user.setExp2Role(role);
            user.setExp2Years(years);
        } else {
            user.setExp3Role(role);
            user.setExp3Years(years);
        }
    }

    private Map<String, String> experienceEntry(String role, String years) {
        String safeRole = trimToNull(role);
        if (safeRole == null) {
            Map<String, String> emptyEntry = new LinkedHashMap<>();
            emptyEntry.put("role", null);
            emptyEntry.put("years", null);
            return emptyEntry;
        }
        Map<String, String> entry = new LinkedHashMap<>();
        entry.put("role", safeRole);
        entry.put("years", trimToNull(years));
        return entry;
    }

    private List<String> splitSkills(String skillsCsv) {
        String normalized = trimToNull(skillsCsv);
        if (normalized == null) {
            return List.of();
        }
        return java.util.Arrays.stream(normalized.split(","))
                .map(String::trim)
                .filter(value -> !value.isBlank())
                .toList();
    }

    private String joinSkills(List<String> skills) {
        if (skills == null || skills.isEmpty()) {
            return null;
        }
        return skills.stream()
                .map(this::trimToNull)
                .filter(java.util.Objects::nonNull)
                .distinct()
                .reduce((left, right) -> left + ", " + right)
                .orElse(null);
    }

    private Map<String, String> normalizeStringMap(Map<String, String> input) {
        Map<String, String> normalized = new LinkedHashMap<>();
        if (input == null) {
            return normalized;
        }

        input.forEach((key, value) -> {
            String safeKey = trimToNull(key);
            String safeValue = trimToNull(value);
            if (safeKey != null && safeValue != null) {
                normalized.put(safeKey, safeValue);
            }
        });
        return normalized;
    }

    private List<Map<String, String>> normalizeHistory(List<Map<String, String>> input) {
        List<Map<String, String>> normalized = new ArrayList<>();
        if (input == null) {
            return normalized;
        }

        input.forEach(entry -> {
            if (entry == null) return;
            String role = trimToNull(entry.get("role"));
            String text = trimToNull(entry.get("text"));
            if (role == null || text == null) return;

            Map<String, String> safeEntry = new LinkedHashMap<>();
            safeEntry.put("role", role);
            safeEntry.put("text", text);
            normalized.add(safeEntry);
        });
        return normalized;
    }

    private Map<String, String> readStringMap(String json) {
        String normalized = trimToNull(json);
        if (normalized == null) {
            return new LinkedHashMap<>();
        }

        try {
            return objectMapper.readValue(normalized, new TypeReference<LinkedHashMap<String, String>>() {});
        } catch (Exception error) {
            return new LinkedHashMap<>();
        }
    }

    private List<Map<String, String>> readHistory(String json) {
        String normalized = trimToNull(json);
        if (normalized == null) {
            return new ArrayList<>();
        }

        try {
            List<LinkedHashMap<String, String>> parsed = objectMapper.readValue(
                    normalized,
                    new TypeReference<List<LinkedHashMap<String, String>>>() {}
            );
            return new ArrayList<>(parsed);
        } catch (Exception error) {
            return new ArrayList<>();
        }
    }

    private String writeJson(Object value) {
        if (value == null) {
            return null;
        }

        if (value instanceof Map<?, ?> map && map.isEmpty()) {
            return null;
        }

        if (value instanceof List<?> list && list.isEmpty()) {
            return null;
        }

        try {
            return objectMapper.writeValueAsString(value);
        } catch (Exception error) {
            throw new RuntimeException("Could not save user preferences");
        }
    }

    private String trimToNull(String value) {
        if (value == null) return null;
        String normalized = value.trim();
        return normalized.isBlank() ? null : normalized;
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

    private void deleteUserData(User targetUser) {
        Long targetUserId = targetUser.getId();

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
        postService.deletePostsByAuthor(targetUser);
        postRepo.flush();
        loginOtpRepo.deleteByEmail(targetUser.getEmail());
        userRepo.delete(targetUser);
        userRepo.flush();

        if (userRepo.existsById(targetUserId)) {
            throw new RuntimeException("Account deletion did not complete");
        }

        if (targetUser.getEmail() != null && userRepo.existsByEmail(targetUser.getEmail())) {
            throw new RuntimeException("Account email still exists after deletion");
        }
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
