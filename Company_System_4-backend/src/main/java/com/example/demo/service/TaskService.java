package com.example.demo.service;

import com.example.demo.model.Notification;
import com.example.demo.model.Task;
import com.example.demo.model.User;
import com.example.demo.repository.TaskRepository;
import com.example.demo.repository.UserRepository;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;

@Service
public class TaskService {

    private static final String ROLE_MANAGER = "MANAGER";
    private static final String ROLE_TEAM_LEADER = "TEAM_LEADER";
    private static final String ROLE_DEVELOPER = "DEVELOPER";
    private static final String STATUS_PENDING = "pending";
    private static final String STATUS_IN_PROGRESS = "in_progress";
    private static final String STATUS_COMPLETED = "completed";

    private final TaskRepository taskRepo;
    private final UserRepository userRepo;
    private final NotificationService notificationService;
    private final EmailService emailService;
    private final SimpMessagingTemplate messagingTemplate;

    public TaskService(TaskRepository taskRepo, UserRepository userRepo, NotificationService notificationService, EmailService emailService, SimpMessagingTemplate messagingTemplate) {
        this.taskRepo = taskRepo;
        this.userRepo = userRepo;
        this.notificationService = notificationService;
        this.emailService = emailService;
        this.messagingTemplate = messagingTemplate;
    }

    public Task createTask(Task task, User currentUser) {
        validateTaskPayload(task);
        User assignedTo = resolveAssignedUser(task);

        validateAssignment(currentUser, assignedTo);

        task.setAssignedBy(currentUser);
        task.setAssignedTo(assignedTo);
        task.setStatus(normalizeStatus(task.getStatus()));

        Task savedTask = taskRepo.save(task);
        notifyTaskAssigned(savedTask);
        return savedTask;
    }

    public Task getTaskById(Long id, User currentUser) {
        if (currentUser == null) {
            throw new RuntimeException("Current user is required");
        }

        Task task = taskRepo.findById(id)
                .orElseThrow(() -> new RuntimeException("Task not found"));

        if (!isManager(currentUser)
                && !isTeamLeader(currentUser)
                && !task.getAssignedTo().getId().equals(currentUser.getId())
                && !task.getAssignedBy().getId().equals(currentUser.getId())) {
            throw new RuntimeException("Not authorized to view this task");
        }

        return task;
    }

    public List<Task> getAllTasks(User currentUser) {
        if (currentUser == null) {
            throw new RuntimeException("Current user is required");
        }

        if (isManager(currentUser)) {
            return taskRepo.findAll();
        }

        if (isTeamLeader(currentUser)) {
            List<Task> sent     = taskRepo.findByAssignedById(currentUser.getId());
            List<Task> received = taskRepo.findByAssignedToId(currentUser.getId());
            java.util.Set<Long> seen = new java.util.HashSet<>();
            List<Task> combined = new java.util.ArrayList<>();
            for (Task t : sent)     { if (seen.add(t.getId())) combined.add(t); }
            for (Task t : received) { if (seen.add(t.getId())) combined.add(t); }
            return combined;
        }

        throw new RuntimeException("Not authorized to view all tasks");
    }

    public List<Task> getTasksAssignedBy(Long userId, User currentUser) {
        if (currentUser == null) {
            throw new RuntimeException("Current user is required");
        }

        if (userId == null) {
            throw new RuntimeException("User id is required");
        }

        if (!isManager(currentUser) && !isTeamLeader(currentUser) && !currentUser.getId().equals(userId)) {
            throw new RuntimeException("Not authorized to view these tasks");
        }

        return taskRepo.findByAssignedById(userId);
    }

    public List<Task> getTasksAssignedTo(Long userId, User currentUser) {
        if (currentUser == null) {
            throw new RuntimeException("Current user is required");
        }

        if (userId == null) {
            throw new RuntimeException("User id is required");
        }

        if (!isManager(currentUser) && !isTeamLeader(currentUser) && !currentUser.getId().equals(userId)) {
            throw new RuntimeException("Not authorized to view these tasks");
        }

        return taskRepo.findByAssignedToId(userId);
    }

    public List<Task> getTasksByStatus(String status, User currentUser) {
        if (currentUser == null) {
            throw new RuntimeException("Current user is required");
        }

        if (!isManager(currentUser) && !isTeamLeader(currentUser)) {
            throw new RuntimeException("Not authorized to view tasks by status");
        }

        return taskRepo.findByStatus(normalizeStatus(status));
    }

    public Task updateTask(Long taskId, Task updatedTask, User currentUser) {
        if (currentUser == null) {
            throw new RuntimeException("Current user is required");
        }

        if (!isManager(currentUser) && !isTeamLeader(currentUser)) {
            throw new RuntimeException("Not authorized to update tasks");
        }

        Task existingTask = getTaskById(taskId, currentUser);

        if (updatedTask.getTitle() == null || updatedTask.getTitle().isBlank()) {
            throw new RuntimeException("Task title is required");
        }

        if (updatedTask.getDeadline() == null) {
            throw new RuntimeException("Task deadline is required");
        }

        existingTask.setTitle(updatedTask.getTitle());
        existingTask.setDescription(updatedTask.getDescription());
        existingTask.setDeadline(updatedTask.getDeadline());
        existingTask.setStatus(normalizeStatus(updatedTask.getStatus()));

        if (updatedTask.getAssignedTo() != null && updatedTask.getAssignedTo().getId() != null) {
            User assignedTo = userRepo.findById(updatedTask.getAssignedTo().getId())
                    .orElseThrow(() -> new RuntimeException("Assigned user not found"));
            validateAssignment(currentUser, assignedTo);
            existingTask.setAssignedTo(assignedTo);
        }

        return taskRepo.save(existingTask);
    }

    public Task updateTaskStatus(Long taskId, String status, User currentUser) {
        if (currentUser == null) {
            throw new RuntimeException("Current user is required");
        }

        Task existingTask = getTaskById(taskId, currentUser);

        if (!isManager(currentUser)
                && !isTeamLeader(currentUser)
                && !existingTask.getAssignedTo().getId().equals(currentUser.getId())) {
            throw new RuntimeException("Not authorized to update task status");
        }

        String oldStatus = normalizeStatus(existingTask.getStatus());
        String newStatus = normalizeStatus(status);
        existingTask.setStatus(newStatus);
        Task savedTask = taskRepo.save(existingTask);

        if (STATUS_COMPLETED.equals(newStatus) && !STATUS_COMPLETED.equals(oldStatus)) {
            notifyTaskCompleted(savedTask, currentUser);
        }

        return savedTask;
    }

    public void deleteTask(Long taskId, User currentUser) {
        if (currentUser == null) {
            throw new RuntimeException("Current user is required");
        }

        if (!isManager(currentUser) && !isTeamLeader(currentUser)) {
            throw new RuntimeException("Not authorized to delete tasks");
        }

        Task existingTask = getTaskById(taskId, currentUser);
        taskRepo.delete(existingTask);
    }

    private void validateTaskPayload(Task task) {
        if (task == null) {
            throw new RuntimeException("Task is required");
        }

        if (task.getTitle() == null || task.getTitle().isBlank()) {
            throw new RuntimeException("Task title is required");
        }

        if (task.getDeadline() == null) {
            throw new RuntimeException("Task deadline is required");
        }

        if ((task.getAssignedTo() == null || task.getAssignedTo().getId() == null)
                && (task.getAssignedToStaffId() == null || task.getAssignedToStaffId().isBlank())) {
            throw new RuntimeException("Assigned user Staff ID is required");
        }

        normalizeStatus(task.getStatus());
    }

    private void validateAssignment(User sender, User receiver) {
        if (sender == null) {
            throw new RuntimeException("Current user is required");
        }

        if (isDeveloper(sender)) {
            throw new RuntimeException("Developers cannot assign tasks");
        }

        if (!isManager(sender) && !isTeamLeader(sender)) {
            throw new RuntimeException("Only Manager and Team Leader can create tasks");
        }

        if (isManager(receiver)) {
            throw new RuntimeException("No one can assign tasks to a Manager");
        }

        if (isManager(sender)) {
            if (!isTeamLeader(receiver) && !isDeveloper(receiver)) {
                throw new RuntimeException("Manager can assign tasks only to Team Leader or Developer");
            }
            return;
        }

        if (isTeamLeader(sender) && !isDeveloper(receiver)) {
            throw new RuntimeException("Team Leader can assign tasks only to Developer");
        }
    }

    private String normalizeStatus(String status) {
        if (status == null || status.isBlank()) {
            throw new RuntimeException("Task status is required");
        }

        String normalized = status.trim().toLowerCase();
        if ("done".equals(normalized)) {
            normalized = STATUS_COMPLETED;
        }
        if ("pending".equals(normalized)) {
            return STATUS_PENDING;
        }
        if ("in_progress".equals(normalized) || "in-progress".equals(normalized)) {
            return STATUS_IN_PROGRESS;
        }
        if ("completed".equals(normalized)) {
            return STATUS_COMPLETED;
        }

        throw new RuntimeException("Task status must be pending, in_progress, or completed");
    }

    private void notifyTaskAssigned(Task task) {
        Notification notif = Notification.builder()
                .title("New Task Assigned")
                .content("You received a task from " + task.getAssignedBy().getName())
                .type("TASK")
                .build();

        notificationService.sendNotification(task.getAssignedTo().getId().intValue(), notif);
        emailService.sendTaskAssignedEmail(
                task.getAssignedTo().getEmail(),
                task.getAssignedTo().getName(),
                task.getAssignedBy().getName(),
                task.getTitle(),
                String.valueOf(task.getDeadline())
        );
    }

    private void notifyTaskCompleted(Task task, User completedBy) {
        Notification notif = Notification.builder()
                .title("Task Completed")
                .content("Task " + task.getTitle() + " completed by " + completedBy.getName())
                .type("TASK")
                .build();

        notificationService.sendNotification(task.getAssignedBy().getId().intValue(), notif);
        emailService.sendTaskCompletedEmail(
                task.getAssignedBy().getEmail(),
                task.getAssignedBy().getName(),
                task.getTitle(),
                completedBy.getName()
        );
        messagingTemplate.convertAndSend("/topic/events", Map.of(
                "event", "task_completed_sound",
                "taskId", task.getId(),
                "title", task.getTitle(),
                "completedBy", completedBy.getName()
        ));
    }

    private boolean isManager(User user) {
        return ROLE_MANAGER.equals(normalizedRole(user));
    }

    private boolean isTeamLeader(User user) {
        return ROLE_TEAM_LEADER.equals(normalizedRole(user));
    }

    private boolean isDeveloper(User user) {
        return ROLE_DEVELOPER.equals(normalizedRole(user));
    }

    private String normalizedRole(User user) {
        return user == null || user.getRole() == null ? "" : user.getRole().trim().toUpperCase();
    }

    private User resolveAssignedUser(Task task) {
        if (task.getAssignedToStaffId() != null && !task.getAssignedToStaffId().isBlank()) {
            return userRepo.findByStaffId(task.getAssignedToStaffId().trim())
                    .orElseThrow(() -> new RuntimeException("Assigned user not found by Staff ID"));
        }

        return userRepo.findById(task.getAssignedTo().getId())
                .orElseThrow(() -> new RuntimeException("Assigned user not found"));
    }
}
