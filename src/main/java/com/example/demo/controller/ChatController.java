package com.example.demo.controller;

import com.example.demo.websocket.*;
import com.example.demo.model.Message;
import com.example.demo.model.Room;
import com.example.demo.model.User;
import com.example.demo.service.MessageService;
import com.example.demo.service.UserService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.ResponseBody;

import java.util.List;

@Controller @RequiredArgsConstructor
public class ChatController 
{

    private final MessageService messageService;
    private final UserService userService;
    private final SimpMessagingTemplate messagingTemplate;

    @MessageMapping("/chat.sendMessage")
    public void sendMessage(@Payload ChatMessage chatMessage) 
    {
        User sender = userService.getUserById(chatMessage.getSenderId());
        
        Room room = new Room();
        room.setId(chatMessage.getRoomId());

        Message dbMessage = Message.builder()
                .content(chatMessage.getContent())
                .sender(sender)
                .room(room)
                .sentTo("ROOM")
                .build();

        messageService.createMessage(dbMessage);

        messagingTemplate.convertAndSend("/topic/room/" + chatMessage.getRoomId(), chatMessage);
    }

    // ده بيرجع رسايل الروم القديمة بنفس شكل الداتا اللي الفرونت فاهمه
    @GetMapping("/api/messages/room/{roomId}")
    @ResponseBody
    public ResponseEntity<List<ChatMessage>> getRoomMessages(
            @PathVariable Long roomId,
            @RequestHeader("userId") Long userId
    ) {
        User currentUser = userService.getUserById(userId);

        List<ChatMessage> messages = messageService.getMessagesByRoom(roomId, currentUser)
                .stream()
                .map(message -> ChatMessage.builder()
                        .content(message.getContent())
                        .senderName(message.getSender().getName())
                        .senderId(message.getSender().getId())
                        .roomId(message.getRoom().getId())
                        .type(ChatMessage.MessageType.CHAT)
                        .build())
                .toList();

        return ResponseEntity.ok(messages);
    }

    @DeleteMapping("/api/messages/room/{roomId}")
    @ResponseBody
    public ResponseEntity<Void> clearRoomMessages(
            @PathVariable Long roomId,
            @RequestHeader("userId") Long userId
    ) {
        User currentUser = userService.getUserById(userId);
        messageService.deleteMessagesByRoom(roomId, currentUser);
        return ResponseEntity.noContent().build();
    }
}
