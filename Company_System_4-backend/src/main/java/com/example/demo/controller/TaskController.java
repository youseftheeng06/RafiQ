package com.example.demo.controller;

import com.example.demo.model.Task;
import com.example.demo.model.User;
import com.example.demo.service.TaskService;
import com.example.demo.service.UserService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

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
        if ("MANAGER".equals(currentUser.getRole()) || "TEAM_LEADER".equals(currentUser.getRole())) {
            return ResponseEntity.ok(taskService.getAllTasks(currentUser));
        }
        return ResponseEntity.ok(taskService.getTasksAssignedTo(userId, currentUser));
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

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteTask(@PathVariable Long id, @RequestHeader("userId") Long userId) {
        User currentUser = userService.getUserById(userId);
        taskService.deleteTask(id, currentUser);
        return ResponseEntity.noContent().build();
    }
}
