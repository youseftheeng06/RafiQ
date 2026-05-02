package com.example.demo.service;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.Map;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;
import com.example.demo.model.Notification;
import com.example.demo.model.User;
import com.example.demo.repository.NotificationRepository;
import com.example.demo.repository.UserRepository;
import lombok.RequiredArgsConstructor;

@Service @RequiredArgsConstructor
public class NotificationService 
{

    private final NotificationRepository notificationRepo;
    private final UserRepository userRepo;
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
        payload.put("read", savedNotif.isRead());

        if (savedNotif.getCreatedAt() != null) 
        {
            payload.put("createdAt", savedNotif.getCreatedAt().toString());
        } 
        else  
        {
            payload.put("createdAt", "");
        }

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

        notification.setRead(true);
        return notificationRepo.save(notification);
    }
}
