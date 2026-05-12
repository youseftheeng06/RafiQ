package com.example.demo.controller;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.bind.annotation.RequestParam;

import java.util.List;
import java.util.Map;

import com.example.demo.dto.EmployeeSummaryResponse;
import com.example.demo.dto.ProfileExtendedRequest;
import com.example.demo.dto.UserPreferencesRequest;
import com.example.demo.model.User;
import com.example.demo.service.UserService;

import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/api/users")
@RequiredArgsConstructor
public class UserController {

    private final UserService userService;

    @GetMapping("/{id}")
    public ResponseEntity<User> getUser(@PathVariable Long id) {
        return ResponseEntity.ok(userService.getUserById(id));
    }

    @GetMapping("/employees")
    public ResponseEntity<List<User>> getEmployees(@RequestHeader("userId") Long userId) {
        User currentUser = userService.getUserById(userId);
        return ResponseEntity.ok(userService.getEmployees(currentUser));
    }

    @GetMapping("/employees/summary")
    public ResponseEntity<EmployeeSummaryResponse> getEmployeeSummary() {
        return ResponseEntity.ok(
                EmployeeSummaryResponse.builder()
                        .developerCount(userService.getDeveloperCount())
                        .build()
        );
    }

    @DeleteMapping("/employees/{id}")
    public ResponseEntity<Void> deleteEmployee(@PathVariable Long id, @RequestHeader("userId") Long userId) {
        User currentUser = userService.getUserById(userId);
        userService.deleteEmployee(id, currentUser);
        return ResponseEntity.noContent().build();
    }

    @PutMapping("/employees/{id}/promote-team-leader")
    public ResponseEntity<User> promoteToTeamLeader(@PathVariable Long id, @RequestHeader("userId") Long userId) {
        User currentUser = userService.getUserById(userId);
        return ResponseEntity.ok(userService.promoteDeveloperToTeamLeader(id, currentUser));
    }

    @PutMapping("/{id}")
    public ResponseEntity<User> updateProfile(
            @PathVariable Long id,
            @RequestBody User updatedUser,
            @RequestHeader("userId") Long userId
    ) {
        User currentUser = userService.getUserById(userId);
        return ResponseEntity.ok(userService.updateProfile(id, updatedUser, currentUser));
    }

    @PutMapping("/{id}/change-password")
    public ResponseEntity<User> changePassword(
            @PathVariable Long id,
            @RequestParam String currentPassword,
            @RequestParam String newPassword,
            @RequestHeader("userId") Long userId
    ) {
        User currentUser = userService.getUserById(userId);
        return ResponseEntity.ok(userService.changePassword(id, currentPassword, newPassword, currentUser));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteOwnAccount(@PathVariable Long id, @RequestHeader("userId") Long userId) {
        User currentUser = userService.getUserById(userId);
        userService.deleteOwnAccount(id, currentUser);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/{id}/profile-photo")
    public ResponseEntity<User> updateProfilePhoto(
            @PathVariable Long id,
            @RequestParam("file") MultipartFile file,
            @RequestHeader("userId") Long userId
    ) throws java.io.IOException {
        User currentUser = userService.getUserById(userId);
        return ResponseEntity.ok(userService.updateProfilePhoto(id, file, currentUser));
    }

    @PostMapping("/{id}/cover-photo")
    public ResponseEntity<User> updateCoverPhoto(
            @PathVariable Long id,
            @RequestParam("file") MultipartFile file,
            @RequestHeader("userId") Long userId
    ) throws java.io.IOException {
        User currentUser = userService.getUserById(userId);
        return ResponseEntity.ok(userService.updateCoverPhoto(id, file, currentUser));
    }

    @GetMapping("/{id}/profile-photo")
    public ResponseEntity<byte[]> getProfilePhoto(@PathVariable Long id) {
        User user = userService.getUserById(id);
        if (user.getProfilePhotoData() == null) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(user.getProfilePhotoType()))
                .header(HttpHeaders.CACHE_CONTROL, "no-store")
                .body(user.getProfilePhotoData());
    }

    @GetMapping("/{id}/cover-photo")
    public ResponseEntity<byte[]> getCoverPhoto(@PathVariable Long id) {
        User user = userService.getUserById(id);
        if (user.getCoverPhotoData() == null) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(user.getCoverPhotoType()))
                .header(HttpHeaders.CACHE_CONTROL, "no-store")
                .body(user.getCoverPhotoData());
    }

    @GetMapping("/{id}/profile-extended")
    public ResponseEntity<Map<String, Object>> getProfileExtended(@PathVariable Long id, @RequestHeader("userId") Long userId) {
        User currentUser = userService.getUserById(userId);
        return ResponseEntity.ok()
                .header(HttpHeaders.CACHE_CONTROL, "no-store")
                .body(userService.getProfileExtended(id, currentUser));
    }

    @PutMapping("/{id}/profile-extended")
    public ResponseEntity<Map<String, Object>> updateProfileExtended(
            @PathVariable Long id,
            @RequestBody ProfileExtendedRequest request,
            @RequestHeader("userId") Long userId
    ) {
        User currentUser = userService.getUserById(userId);
        return ResponseEntity.ok(userService.updateProfileExtended(id, request, currentUser));
    }

    @GetMapping("/{id}/preferences")
    public ResponseEntity<Map<String, Object>> getUserPreferences(@PathVariable Long id, @RequestHeader("userId") Long userId) {
        User currentUser = userService.getUserById(userId);
        return ResponseEntity.ok()
                .header(HttpHeaders.CACHE_CONTROL, "no-store")
                .body(userService.getUserPreferences(id, currentUser));
    }

    @PutMapping("/{id}/preferences")
    public ResponseEntity<Map<String, Object>> updateUserPreferences(
            @PathVariable Long id,
            @RequestBody UserPreferencesRequest request,
            @RequestHeader("userId") Long userId
    ) {
        User currentUser = userService.getUserById(userId);
        return ResponseEntity.ok(userService.updateUserPreferences(id, request, currentUser));
    }

    @DeleteMapping("/{id}/profile-photo")
    public ResponseEntity<User> removeProfilePhoto(@PathVariable Long id, @RequestHeader("userId") Long userId) {
        User currentUser = userService.getUserById(userId);
        return ResponseEntity.ok(userService.removeProfilePhoto(id, currentUser));
    }

    @DeleteMapping("/{id}/cover-photo")
    public ResponseEntity<User> removeCoverPhoto(@PathVariable Long id, @RequestHeader("userId") Long userId) {
        User currentUser = userService.getUserById(userId);
        return ResponseEntity.ok(userService.removeCoverPhoto(id, currentUser));
    }

    @PostMapping("/{id}/activate")
    public ResponseEntity<User> activate(@PathVariable Long id, @RequestHeader("userId") Long userId) {
        User currentUser = userService.getUserById(userId);
        return ResponseEntity.ok(userService.activateUser(id, currentUser));
    }
}
