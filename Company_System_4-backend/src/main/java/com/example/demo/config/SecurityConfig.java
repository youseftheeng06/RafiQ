package com.example.demo.config;

import com.example.demo.model.User;
import com.example.demo.service.AuthService;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.annotation.web.configurers.HeadersConfigurer;
import org.springframework.security.oauth2.core.user.OAuth2User;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.web.cors.CorsConfiguration;
import java.util.List;

@Configuration @EnableWebSecurity
public class SecurityConfig 
{
    @Value("${app.frontend-base-url:http://localhost:5500}")
    private String frontendBaseUrl;

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http, AuthService authService) throws Exception 
    {
        // لو اللوجين بـ OAuth نجح، نرجّع بيانات المستخدم للفرونت عشان يعمل session
        http.oauth2Login(oauth -> oauth
                .successHandler((request, response, authentication) -> {
                    OAuth2User oauth2User = (OAuth2User) authentication.getPrincipal();
                    String email = oauth2User.getAttribute("email");
                    String name = oauth2User.getAttribute("name");

                    if ((name == null || name.isBlank()) && oauth2User.getAttribute("login") != null) {
                        name = String.valueOf(oauth2User.getAttribute("login"));
                    }

                    User appUser = authService.loginWithOAuth(email, name);
                    String redirectQuery = authService.buildOauthSuccessQuery(appUser);
                    response.sendRedirect(frontendBaseUrl + "/login.html?" + redirectQuery);
                })
        );

        http.csrf(AbstractHttpConfigurer::disable).cors(cors -> cors.configurationSource(request -> {CorsConfiguration config = new CorsConfiguration();config.setAllowedOriginPatterns(List.of("*"));config.setAllowedMethods(List.of("GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"));config.setAllowedHeaders(List.of("*"));config.setAllowCredentials(true);
                return config;
            })).authorizeHttpRequests(auth -> auth.anyRequest().permitAll()).headers(headers -> headers.frameOptions(HeadersConfigurer.FrameOptionsConfig::disable)).formLogin(AbstractHttpConfigurer::disable).httpBasic(AbstractHttpConfigurer::disable);
        
        return http.build();
    }

    @Bean
    public PasswordEncoder passw() 
    {
        return new BCryptPasswordEncoder();
    }
}
