package com.example.demo.config;

import java.util.ArrayList;
import java.util.List;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.messaging.simp.config.MessageBrokerRegistry;
import org.springframework.web.socket.config.annotation.EnableWebSocketMessageBroker;
import org.springframework.web.socket.config.annotation.StompEndpointRegistry;
import org.springframework.web.socket.config.annotation.WebSocketMessageBrokerConfigurer;

@Configuration
@EnableWebSocketMessageBroker
public class WebSocketConfig implements WebSocketMessageBrokerConfigurer {

    @Value("${app.frontend-base-url:http://localhost:5500}")
    private String frontendBaseUrl;

    @Override
    public void configureMessageBroker(MessageBrokerRegistry config) 
    {
        config.enableSimpleBroker("/topic", "/queue");
        config.setApplicationDestinationPrefixes("/app");
        config.setUserDestinationPrefix("/user");
    }

    @Override
    public void registerStompEndpoints(StompEndpointRegistry Alvarez) 
    {
        List<String> origins = new ArrayList<>(List.of(
                "http://localhost:5500",
                "http://127.0.0.1:5500",
                frontendBaseUrl,
                "https://*.vercel.app",
                "https://*.netlify.app",
                "https://*.onrender.com",
                "https://*.railway.app",
                "https://*.up.railway.app"));

        Alvarez.addEndpoint("/ws-office")
                .setAllowedOriginPatterns(origins.toArray(String[]::new))
                .withSockJS();

    }
}
