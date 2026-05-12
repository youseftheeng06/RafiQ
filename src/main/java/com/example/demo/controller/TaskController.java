package com.example.demo.controller;

import com.example.demo.model.Task;
import com.example.demo.model.User;
import com.example.demo.service.TaskService;
import com.example.demo.service.UserService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.LinkedHashMap;
import java.util.Map;

@RestController
@RequestMapping("/api/tasks")
@RequiredArgsConstructor
public class TaskController {

    private final TaskService taskService;
    private final UserService userService;

    @PostMapping("/create")
    public ResponseEntity<Task> createTask(@RequestBody Task task, @RequestHeader("userId") Long userId) {
        User currentUser = userService.getUserById(userId);
        Task savedTask = taskService.createTask(task, currentUser);
        return ResponseEntity.ok(savedTask);
    }

    @GetMapping
    public ResponseEntity<List<Task>> getTasks(@RequestHeader("userId") Long userId) {
        User currentUser = userService.getUserById(userId);
        if (canViewManagedTasks(currentUser)) {
            return ResponseEntity.ok(taskService.getAllTasks(currentUser));
        }
        return ResponseEntity.ok(taskService.getTasksAssignedTo(userId, currentUser));
    }

    @GetMapping("/overview")
    public ResponseEntity<List<Map<String, Object>>> getDashboardOverviewTasks() {
        return ResponseEntity.ok(taskService.getDashboardOverviewTasks().stream()
                .map(this::toOverviewTask)
                .toList());
    }

    @PatchMapping("/{id}/status")
    public ResponseEntity<Task> updateStatus(
            @PathVariable Long id,
            @RequestParam String status,
            @RequestHeader("userId") Long userId
    ) {
        User currentUser = userService.getUserById(userId);
        return ResponseEntity.ok(taskService.updateTaskStatus(id, status, currentUser));
    }

    @PostMapping("/{id}/mark-seen")
    public ResponseEntity<Task> markSeen(@PathVariable Long id, @RequestHeader("userId") Long userId) {
        User currentUser = userService.getUserById(userId);
        return ResponseEntity.ok(taskService.markTaskAsSeen(id, currentUser));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteTask(@PathVariable Long id, @RequestHeader("userId") Long userId) {
        User currentUser = userService.getUserById(userId);
        taskService.deleteTask(id, currentUser);
        return ResponseEntity.noContent().build();
    }

    private boolean canViewManagedTasks(User user) {
        String role = normalizeRole(user);
        return "MANAGER".equals(role) || "ADMIN".equals(role) || "ROLE_MANAGER".equals(role) || "ROLE_ADMIN".equals(role) || "TEAM_LEADER".equals(role);
    }

    private String normalizeRole(User user) {
        return user == null || user.getRole() == null
                ? ""
                : user.getRole().trim().toUpperCase().replaceAll("[\\s-]+", "_");
    }

    private Map<String, Object> toOverviewTask(Task task) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("id", task.getId());
        body.put("title", task.getTitle());
        body.put("description", task.getDescription());
        body.put("status", task.getStatus());
        body.put("deadline", task.getDeadline());
        body.put("isSeenByStaff", task.isSeenByStaff());
        body.put("assignedBy", toAssignedBySummary(task));
        body.put("assignedTo", toAssignedToSummary(task));
        return body;
    }

    private Map<String, Object> toAssignedBySummary(Task task) {
        try {
            return toUserSummary(task.getAssignedBy());
        } catch (RuntimeException ex) {
            return deletedUserSummary();
        }
    }

    private Map<String, Object> toAssignedToSummary(Task task) {
        try {
            return toUserSummary(task.getAssignedTo());
        } catch (RuntimeException ex) {
            return deletedUserSummary();
        }
    }

    private Map<String, Object> toUserSummary(User user) {
        if (user == null) {
            return null;
        }

        Map<String, Object> summary = new LinkedHashMap<>();
        try {
            summary.put("id", user.getId());
            summary.put("name", user.getName());
            summary.put("email", user.getEmail());
            summary.put("role", user.getRole());
            summary.put("staffId", user.getStaffId());
        } catch (RuntimeException ex) {
            summary.put("id", user.getId());
            summary.put("name", "Deleted user");
        }
        return summary;
    }

    private Map<String, Object> deletedUserSummary() {
        Map<String, Object> summary = new LinkedHashMap<>();
        summary.put("name", "Deleted user");
        return summary;
    }
}
