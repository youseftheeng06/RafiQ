package com.example.demo.config;

import com.example.demo.model.User;
import com.example.demo.service.AuthService;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.InternalAuthenticationServiceException;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.annotation.web.configurers.HeadersConfigurer;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.oauth2.client.userinfo.DefaultOAuth2UserService;
import org.springframework.security.oauth2.client.userinfo.OAuth2UserRequest;
import org.springframework.security.oauth2.client.userinfo.OAuth2UserService;
import org.springframework.security.oauth2.core.user.DefaultOAuth2User;
import org.springframework.security.oauth2.core.user.OAuth2User;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.cors.CorsConfiguration;

@Configuration
@EnableWebSecurity
public class SecurityConfig {
    private static final Logger log = LoggerFactory.getLogger(SecurityConfig.class);

    @Value("${app.frontend-base-url:http://localhost:5500}")
    private String frontendBaseUrl;

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http, AuthService authService) throws Exception {
        OAuth2UserService<OAuth2UserRequest, OAuth2User> oauthUserService = buildOauthUserService();

        http.oauth2Login(oauth -> oauth
                .userInfoEndpoint(userInfo -> userInfo.userService(oauthUserService))
                .successHandler((request, response, authentication) -> {
                    OAuth2User oauth2User = (OAuth2User) authentication.getPrincipal();
                    String email = oauth2User.getAttribute("email");
                    String name = oauth2User.getAttribute("name");
                    String login = oauth2User.getAttribute("login");

                    if ((name == null || name.isBlank()) && oauth2User.getAttribute("login") != null) {
                        name = String.valueOf(login);
                    }

                    if (email == null || email.isBlank()) {
                        response.sendRedirect(frontendBaseUrl + "/login.html?oauth=error&message="
                                + URLEncoder.encode("GitHub did not provide an email address for this account. Make sure the app has email access or use an account with an accessible email.", StandardCharsets.UTF_8));
                        return;
                    }

                    User appUser = authService.loginWithOAuth(email, name);
                    String redirectQuery = authService.buildOauthSuccessQuery(appUser);
                    response.sendRedirect(frontendBaseUrl + "/login.html?" + redirectQuery);
                })
                .failureHandler((request, response, exception) -> {
                    log.error("OAuth login failed for [{}]: {}", request.getRequestURI(), exception.getMessage(), exception);
                    String errorMessage = exception.getMessage() == null ? "OAuth login failed" : exception.getMessage();
                    response.sendRedirect(frontendBaseUrl + "/login.html?oauth=error&message="
                            + URLEncoder.encode(errorMessage, StandardCharsets.UTF_8));
                }));
        http
                .csrf(AbstractHttpConfigurer::disable)
                    .cors(cors -> cors.configurationSource(request -> {
                        CorsConfiguration config = new CorsConfiguration();
                        // Combine all patterns into one list
                        config.setAllowedOriginPatterns(List.of(
                                frontendBaseUrl,
                                "http://localhost:5500",
                                "http://127.0.0.1:5500",
                                "https://*.vercel.app",
                                "https://*.netlify.app",
                                "https://*.onrender.com",
                                "https://*.railway.app",
                                "https://*.up.railway.app"));
                        config.setAllowedMethods(List.of("GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"));
                        config.setAllowedHeaders(List.of("*"));
                        config.setAllowCredentials(true);
                        return config;
                    }))
                    .authorizeHttpRequests(auth -> auth
                            .anyRequest().permitAll()
                    )
                    .formLogin(AbstractHttpConfigurer::disable)
                    .httpBasic(AbstractHttpConfigurer::disable);

            return http.build();
        }


        @Bean
    public PasswordEncoder passw() {
        return new BCryptPasswordEncoder();
    }

    private OAuth2UserService<OAuth2UserRequest, OAuth2User> buildOauthUserService() {
        DefaultOAuth2UserService delegate = new DefaultOAuth2UserService();
        RestTemplate restTemplate = new RestTemplate();

        return userRequest -> {
            OAuth2User oauth2User = delegate.loadUser(userRequest);
            String registrationId = userRequest.getClientRegistration().getRegistrationId();

            if (!"github".equalsIgnoreCase(registrationId)) {
                return oauth2User;
            }

            Map<String, Object> attributes = new LinkedHashMap<>(oauth2User.getAttributes());
            String email = toText(attributes.get("email"));
            if (email == null || email.isBlank()) {
                try {
                    String githubEmail = fetchGithubPrimaryEmail(restTemplate, userRequest.getAccessToken().getTokenValue());
                    if (githubEmail != null && !githubEmail.isBlank()) {
                        attributes.put("email", githubEmail);
                    }
                } catch (HttpClientErrorException ex) {
                    log.warn("GitHub email lookup failed with status {}: {}", ex.getStatusCode(), ex.getResponseBodyAsString());
                } catch (RuntimeException ex) {
                    log.warn("GitHub email lookup failed: {}", ex.getMessage(), ex);
                }
            }

            String userNameAttributeName = userRequest.getClientRegistration()
                    .getProviderDetails()
                    .getUserInfoEndpoint()
                    .getUserNameAttributeName();
            if (userNameAttributeName == null || userNameAttributeName.isBlank()) {
                userNameAttributeName = "id";
            }

            return new DefaultOAuth2User(oauth2User.getAuthorities(), attributes, userNameAttributeName);
        };
    }

    private String fetchGithubPrimaryEmail(RestTemplate restTemplate, String accessToken) {
        HttpHeaders headers = new HttpHeaders();
        headers.setBearerAuth(accessToken);
        headers.setAccept(List.of(MediaType.APPLICATION_JSON));
        headers.set("X-GitHub-Api-Version", "2022-11-28");

        ResponseEntity<List<Map<String, Object>>> response = restTemplate.exchange(
                "https://api.github.com/user/emails",
                HttpMethod.GET,
                new HttpEntity<>(headers),
                new ParameterizedTypeReference<>() {}
        );

        List<Map<String, Object>> emails = response.getBody();
        if (emails == null || emails.isEmpty()) {
            return null;
        }

        for (Map<String, Object> entry : emails) {
            if (Boolean.TRUE.equals(entry.get("primary")) && Boolean.TRUE.equals(entry.get("verified"))) {
                return toText(entry.get("email"));
            }
        }

        for (Map<String, Object> entry : emails) {
            if (Boolean.TRUE.equals(entry.get("verified"))) {
                return toText(entry.get("email"));
            }
        }

        return toText(emails.get(0).get("email"));
    }

    private String toText(Object value) {
        return value == null ? null : Objects.toString(value, null);
    }
}
