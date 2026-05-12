package com.example.demo.controller;

import java.io.IOException;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import com.example.demo.model.Post;
import com.example.demo.model.User;
import com.example.demo.service.PostService;
import com.example.demo.service.UserService;

import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/api/posts")
@RequiredArgsConstructor
public class PostController {

    private final PostService postService;
    private final UserService userService;

    @GetMapping
    public ResponseEntity<List<Map<String, Object>>> getPosts(@RequestHeader("userId") Long userId) {
        User currentUser = userService.getUserById(userId);
        return ResponseEntity.ok(postService.getFeed(currentUser).stream()
                .map(post -> toResponse(post, currentUser))
                .toList());
    }

    @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<Map<String, Object>> createPost(
            @RequestParam(value = "caption", required = false) String caption,
            @RequestParam(value = "file", required = false) MultipartFile file,
            @RequestHeader("userId") Long userId
    ) throws IOException {
        User currentUser = userService.getUserById(userId);
        return ResponseEntity.ok(toResponse(postService.createPost(caption, file, currentUser), currentUser));
    }

    @PostMapping("/{postId}/likes")
    public ResponseEntity<Map<String, Object>> likePost(@PathVariable Long postId, @RequestHeader("userId") Long userId) {
        User currentUser = userService.getUserById(userId);
        return ResponseEntity.ok(toResponse(postService.likePost(postId, currentUser), currentUser));
    }

    @DeleteMapping("/{postId}/likes")
    public ResponseEntity<Map<String, Object>> unlikePost(@PathVariable Long postId, @RequestHeader("userId") Long userId) {
        User currentUser = userService.getUserById(userId);
        return ResponseEntity.ok(toResponse(postService.unlikePost(postId, currentUser), currentUser));
    }

    @PostMapping("/{postId}/comments")
    public ResponseEntity<Map<String, Object>> addComment(
            @PathVariable Long postId,
            @RequestHeader("userId") Long userId,
            @RequestBody Map<String, String> body
    ) {
        User currentUser = userService.getUserById(userId);
        return ResponseEntity.ok(toResponse(postService.addComment(postId, body == null ? null : body.get("text"), currentUser), currentUser));
    }

    @DeleteMapping("/{postId}")
    public ResponseEntity<Void> deletePost(@PathVariable Long postId, @RequestHeader("userId") Long userId) {
        User currentUser = userService.getUserById(userId);
        postService.deletePost(postId, currentUser);
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/{postId}/comments/{commentIndex}")
    public ResponseEntity<Map<String, Object>> deleteComment(
            @PathVariable Long postId,
            @PathVariable int commentIndex,
            @RequestHeader("userId") Long userId
    ) {
        User currentUser = userService.getUserById(userId);
        return ResponseEntity.ok(toResponse(postService.deleteComment(postId, commentIndex, currentUser), currentUser));
    }

    @GetMapping("/{postId}/media")
    public ResponseEntity<byte[]> getPostMedia(@PathVariable Long postId) {
        Post post = postService.getPostMedia(postId);
        String contentType = post.getMediaType() == null ? MediaType.APPLICATION_OCTET_STREAM_VALUE : post.getMediaType();
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(contentType))
                .header(HttpHeaders.CACHE_CONTROL, "no-store")
                .body(post.getMediaData());
    }

    private Map<String, Object> toResponse(Post post, User currentUser) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("id", post.getId());
        body.put("userId", post.getAuthor().getId());
        body.put("userName", post.getAuthor().getName());
        body.put("userAvatar", "/api/users/" + post.getAuthor().getId() + "/profile-photo");
        body.put("caption", post.getCaption());
        body.put("mediaUrl", post.getMediaData() != null && post.getMediaData().length > 0 ? "/api/posts/" + post.getId() + "/media" : null);
        body.put("mediaType", post.getMediaType());
        body.put("timestamp", post.getCreatedAt());
        body.put("canDelete", currentUser.getId().equals(post.getAuthor().getId()));
        body.put("likedByCurrentUser", post.getLikes() != null && post.getLikes().stream()
                .anyMatch(like -> currentUser.getId().equals(like.getUserId())));
        body.put("likeCount", post.getLikes() == null ? 0 : post.getLikes().size());
        body.put("commentCount", post.getComments() == null ? 0 : post.getComments().size());
        body.put("comments", post.getComments() == null ? List.of() : java.util.stream.IntStream.range(0, post.getComments().size()).mapToObj(index -> {
            var comment = post.getComments().get(index);
            Map<String, Object> commentBody = new LinkedHashMap<>();
            Long commentUserId = comment.getUserId() != null ? comment.getUserId() : comment.getAuthorId();
            commentBody.put("index", index);
            commentBody.put("userId", commentUserId);
            commentBody.put("userName", comment.getUserName() != null ? comment.getUserName() : resolveUserName(commentUserId));
            commentBody.put("text", comment.getText());
            commentBody.put("createdAt", comment.getCreatedAt());
            commentBody.put("canDelete", currentUser.getId().equals(commentUserId));
            return commentBody;
        }).toList());
        return body;
    }

    private String resolveUserName(Long userId) {
        if (userId == null) {
            return "User";
        }
        try {
            return userService.getUserById(userId).getName();
        } catch (RuntimeException ex) {
            return "User";
        }
    }
}
