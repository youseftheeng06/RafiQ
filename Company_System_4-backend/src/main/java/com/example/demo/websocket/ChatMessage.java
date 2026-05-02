package com.example.demo.websocket;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter @Setter @NoArgsConstructor @AllArgsConstructor@Builder
public class ChatMessage 
{
    private String content;
    private String senderName;
    private Long senderId;   
    private Long roomId;
    private MessageType type;

    public enum MessageType 
    {
        CHAT,    
        JOIN,   
        LEAVE,   
        TYPING  
    }
}