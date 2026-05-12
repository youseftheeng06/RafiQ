package com.example.demo.service;

import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import com.example.demo.model.Message;
import com.example.demo.model.Room;
import com.example.demo.model.User;
import com.example.demo.repository.MessageRepository;
import com.example.demo.repository.RoomRepository;
import lombok.RequiredArgsConstructor;

@Service @RequiredArgsConstructor
public class MessageService 
{

    private final MessageRepository messageRepo;
    private final RoomRepository roomRepo;

    public Message createMessage(Message message) 
    {
        if (message.getRoom() == null || message.getSender() == null)
        {
            throw new RuntimeException("Room and Sender are required");
        }

        Long roomId = message.getRoom().getId();
        Room room = roomRepo.findById(roomId)
                .orElseThrow(() -> new RuntimeException("Room not found"));
        if (!isManager(message.getSender()) && !roomRepo.existsByIdAndMembersId(roomId, message.getSender().getId())) {
            throw new RuntimeException("Not authorized to send messages in this room");
        }

        message.setRoom(room);
        return messageRepo.save(message);
    }

    public Message updateMessage(Long messageId, String newContent, User currentUser) 
    {
        Message existingMessage = messageRepo.findById(messageId).orElseThrow(() -> new RuntimeException("Message not found"));

        if (!existingMessage.getSender().getId().equals(currentUser.getId())) 
        {
            throw new RuntimeException("Unauthorized: You can only edit your own messages");
        }
        existingMessage.setContent(newContent);

        return messageRepo.save(existingMessage);
    }

    public Message getMessageById(Long id, User currentUser) 
    {
        Message message = messageRepo.findById(id).orElseThrow(() -> new RuntimeException("Message not found"));

        if (!currentUser.getRole().equals("MANAGER") && !currentUser.getRole().equals("TEAM_LEADER") && !message.getSender().getId().equals(currentUser.getId())) 
        {
            throw new RuntimeException("Not authorized to view this message");
        }
        return message;
    }

    public List<Message> getMessagesByRoom(Long roomId, User currentUser) 
    {
        if (!roomRepo.existsById(roomId)) {
            throw new RuntimeException("Room not found");
        }
        if (!isManager(currentUser) && !roomRepo.existsByIdAndMembersId(roomId, currentUser.getId())) {
            throw new RuntimeException("Not authorized to view this room chat");
        }

        return messageRepo.findByRoomId(roomId);
    }

    public List<Message> getMessagesBySender(Long userId, User currentUser) 
    {
        if (!currentUser.getRole().equals("MANAGER") && !currentUser.getId().equals(userId)) 
        {
            throw new RuntimeException("Unauthorized");
        }
        return messageRepo.findBySenderId(userId);
    }

    public void deleteMessage(Long messageId, User currentUser) 
    {
        Message msg = messageRepo.findById(messageId).orElseThrow(() -> new RuntimeException("Message not found"));

        if (currentUser.getRole().equals("MANAGER") || currentUser.getRole().equals("TEAM_LEADER") || msg.getSender().getId().equals(currentUser.getId())) 
        {
            messageRepo.delete(msg);
        } 
        else 
        {
            throw new RuntimeException("Not authorized to delete this message");
        }
    }

    @Transactional
    public void deleteMessagesByRoom(Long roomId, User currentUser) {
        if (currentUser == null) {
            throw new RuntimeException("Current user is required");
        }

        if (!isManager(currentUser)) {
            throw new RuntimeException("Only Manager can clear room chat");
        }

        messageRepo.deleteByRoomId(roomId);
    }

    private boolean isManager(User user) {
        return "MANAGER".equals(normalizedRole(user));
    }

    private String normalizedRole(User user) {
        return user == null || user.getRole() == null ? "" : user.getRole().trim().toUpperCase();
    }
}
