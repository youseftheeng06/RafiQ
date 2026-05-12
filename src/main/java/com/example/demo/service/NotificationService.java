package com.example.demo.service;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.Map;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import com.example.demo.model.Notification;
import com.example.demo.model.Task;
import com.example.demo.model.User;
import com.example.demo.repository.NotificationRepository;
import com.example.demo.repository.TaskRepository;
import com.example.demo.repository.UserRepository;
import lombok.RequiredArgsConstructor;

@Service @RequiredArgsConstructor
public class NotificationService 
{

    private final NotificationRepository notificationRepo;
    private final UserRepository userRepo;
    private final TaskRepository taskRepo;
    private final SimpMessagingTemplate messagingTemplate;

    public void sendNotification(Integer userId, Notification notif) 
    {
        if (userId == null || notif == null) {
            System.out.println("ERROR: UserId or Notification is null");
            return;
        }

        User recipient = userRepo.findById(userId.longValue()).orElse(null);
        
        if (recipient == null) 
            {
            System.out.println("ERROR: " + userId);
            return;
        }

        notif.setRecipient(recipient);
        notif.setCreatedAt(LocalDateTime.now());
        notif.setRead(false);
        
        Notification savedNotif = notificationRepo.save(notif);

        System.out.println("To User: " + userId + " Title: " + savedNotif.getTitle());

        Map<String, Object> payload = new HashMap<>();
        payload.put("id", savedNotif.getId());
        payload.put("title", savedNotif.getTitle());
        payload.put("content", savedNotif.getContent());
        payload.put("type", savedNotif.getType());
        payload.put("taskId", savedNotif.getTaskId());
        payload.put("read", savedNotif.isRead());

        if (savedNotif.getCreatedAt() != null) 
        {
            payload.put("createdAt", savedNotif.getCreatedAt().toString());
        } 
        else  
        {
            payload.put("createdAt", "");
        }

        messagingTemplate.convertAndSend("/topic/events", Map.of(
                "event", "notification_created",
                "recipientId", recipient.getId(),
                "type", savedNotif.getType()
        ));

        try 
        {
            String destination = "/queue/notifications";
            messagingTemplate.convertAndSendToUser(recipient.getEmail(), destination, payload);

            System.out.println("WebSocket Success: Sent to " + recipient.getEmail());
        } 
        catch (Exception e) 
        {
            System.out.println("WebSocket Error: " + e.getMessage());
        }
    }

    public java.util.List<Notification> getNotifications(Long userId, User currentUser) {
        if (currentUser == null) {
            throw new RuntimeException("Current user is required");
        }

        if (!"MANAGER".equals(currentUser.getRole()) && !currentUser.getId().equals(userId)) {
            throw new RuntimeException("Not authorized to view these notifications");
        }

        return notificationRepo.findByRecipientId(userId);
    }

    public java.util.List<Notification> getUnreadNotifications(Long userId, User currentUser) {
        if (currentUser == null) {
            throw new RuntimeException("Current user is required");
        }

        if (!"MANAGER".equals(currentUser.getRole()) && !currentUser.getId().equals(userId)) {
            throw new RuntimeException("Not authorized to view these notifications");
        }

        return notificationRepo.findByRecipientIdAndReadFalse(userId);
    }

    public Notification markAsRead(Long notificationId, User currentUser) {
        Notification notification = notificationRepo.findById(notificationId)
                .orElseThrow(() -> new RuntimeException("Notification not found"));

        if (!"MANAGER".equals(currentUser.getRole())
                && !notification.getRecipient().getId().equals(currentUser.getId())) {
            throw new RuntimeException("Not authorized to update this notification");
        }

        Task seenTask = notifyTaskSeenIfNeeded(notification, currentUser);
        notification.setRead(true);
        Notification saved = notificationRepo.save(notification);
        messagingTemplate.convertAndSend("/topic/events", Map.of(
                "event", "notifications_changed",
                "recipientId", saved.getRecipient().getId(),
                "taskId", saved.getTaskId() == null ? 0 : saved.getTaskId()
        ));
        if (seenTask != null) {
            messagingTemplate.convertAndSend("/topic/events", Map.of(
                    "event", "notifications_changed",
                    "recipientId", seenTask.getAssignedBy().getId(),
                    "taskId", seenTask.getId()
            ));
        }
        return saved;
    }

    @Transactional
    public void markAllAsRead(Long userId, User currentUser) {
        validateNotificationOwner(userId, currentUser);
        notificationRepo.markAllReadByRecipientId(userId);
        messagingTemplate.convertAndSend("/topic/events", Map.of(
                "event", "notifications_changed",
                "recipientId", userId
        ));
    }

    @Transactional
    public void clearNotifications(Long userId, User currentUser) {
        validateNotificationOwner(userId, currentUser);
        notificationRepo.deleteByRecipientId(userId);
        messagingTemplate.convertAndSend("/topic/events", Map.of(
                "event", "notifications_changed",
                "recipientId", userId
        ));
    }

    private void validateNotificationOwner(Long userId, User currentUser) {
        if (currentUser == null) {
            throw new RuntimeException("Current user is required");
        }

        if (!"MANAGER".equals(currentUser.getRole()) && !currentUser.getId().equals(userId)) {
            throw new RuntimeException("Not authorized to update these notifications");
        }
    }

    private Task notifyTaskSeenIfNeeded(Notification notification, User currentUser) {
        if (notification == null || currentUser == null || notification.getTaskId() == null) {
            return null;
        }

        String title = notification.getTitle() == null ? "" : notification.getTitle().toLowerCase();
        if (!title.contains("assigned")) {
            return null;
        }

        Task task = taskRepo.findById(notification.getTaskId()).orElse(null);
        if (task == null || task.isSeenByStaff()) {
            return null;
        }

        if (task.getAssignedTo() == null || !task.getAssignedTo().getId().equals(currentUser.getId())) {
            return null;
        }

        task.setSeenByStaff(true);
        Task savedTask = taskRepo.save(task);

        Notification seenNotif = Notification.builder()
                .title("Task Read")
                .content(currentUser.getName() + " read task " + savedTask.getTitle())
                .type("TASK")
                .taskId(savedTask.getId())
                .build();

        sendNotification(savedTask.getAssignedBy().getId().intValue(), seenNotif);
        messagingTemplate.convertAndSend("/topic/events", Map.of(
                "event", "task_seen",
                "taskId", savedTask.getId(),
                "title", savedTask.getTitle(),
                "seenBy", currentUser.getName(),
                "recipientId", savedTask.getAssignedBy().getId()
        ));
        return savedTask;
    }
}
