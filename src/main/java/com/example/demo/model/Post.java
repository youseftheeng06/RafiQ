package com.example.demo.model;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

import jakarta.persistence.CollectionTable;
import jakarta.persistence.Column;
import jakarta.persistence.ElementCollection;
import jakarta.persistence.Embeddable;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.Lob;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.OrderColumn;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "posts")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class Post {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(length = 5000)
    private String caption;

    @Column(nullable = false)
    private LocalDateTime createdAt;

    @Column(name = "media_name")
    private String mediaName;

    @Column(name = "media_type")
    private String mediaType;

    @Column(name = "media_data", columnDefinition = "bytea")
    @JsonIgnore
    private byte[] mediaData;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "author_id", nullable = false)
    @JsonIgnoreProperties({"password", "hibernateLazyInitializer", "handler"})
    private User author;

    @Builder.Default
    @ElementCollection
    @CollectionTable(name = "post_comments", joinColumns = @JoinColumn(name = "post_id"))
    @OrderColumn(name = "comment_order")
    private List<PostCommentData> comments = new ArrayList<>();

    @Builder.Default
    @ElementCollection
    @CollectionTable(name = "post_likes", joinColumns = @JoinColumn(name = "post_id"))
    private List<PostLikeData> likes = new ArrayList<>();

    @Embeddable
    @Getter
    @Setter
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class PostCommentData {

        @Column(name = "user_id", nullable = false)
        private Long userId;

        @Column(name = "author_id", nullable = false)
        private Long authorId;

        @Column(name = "user_name", nullable = false)
        private String userName;

        @Column(nullable = false, length = 2000)
        private String text;

        @Column(nullable = false)
        private LocalDateTime createdAt;
    }

    @Embeddable
    @Getter
    @Setter
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class PostLikeData {

        @Column(name = "user_id", nullable = false)
        private Long userId;

        @Column(nullable = false)
        private LocalDateTime createdAt;
    }
}
