package com.example.demo.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Lob;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonProperty;
@Entity
@Table(name = "users")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class User {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 120)
    private String name;

    @Column(nullable = false, unique = true, length = 254)
    private String email;

    @Column(nullable = false, length = 255)
    @JsonProperty(access = JsonProperty.Access.WRITE_ONLY)
    private String password;

    @Column(nullable = false, length = 32)
    private String role;

    @Column(nullable = false)
    private boolean active;

    @Column(nullable = false, unique = true, length = 32)
    private String staffId;

    @Column(name = "profile_photo_data")
    @JsonIgnore
    private byte[] profilePhotoData;

    @Column(name = "profile_photo_type")
    private String profilePhotoType;

    @Column(name = "cover_photo_data")
    @JsonIgnore
    private byte[] coverPhotoData;

    @Column(name = "cover_photo_type")
    private String coverPhotoType;

    @Column(length = 3000)
    private String bio;

    @Column(name = "skills_csv", length = 2000)
    private String skillsCsv;

    @Column(name = "exp1_role")
    private String exp1Role;

    @Column(name = "exp1_years")
    private String exp1Years;

    @Column(name = "exp2_role")
    private String exp2Role;

    @Column(name = "exp2_years")
    private String exp2Years;

    @Column(name = "exp3_role")
    private String exp3Role;

    @Column(name = "exp3_years")
    private String exp3Years;

    @Column(name = "github_link")
    private String githubLink;

    @Column(name = "twitter_link")
    private String twitterLink;

    @Column(name = "linkedin_link")
    private String linkedinLink;

    @Lob
    @Column(name = "chat_backgrounds_json")
    private String chatBackgroundsJson;

    @Lob
    @Column(name = "ai_chat_history_json")
    private String aiChatHistoryJson;
}
