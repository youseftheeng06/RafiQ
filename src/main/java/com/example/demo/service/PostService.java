package com.example.demo.service;

import java.io.IOException;
import java.time.LocalDateTime;
import java.util.List;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import com.example.demo.model.Post;
import com.example.demo.model.Notification;
import com.example.demo.model.User;
import com.example.demo.repository.PostRepository;
import com.example.demo.repository.UserRepository;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class PostService {

    private final PostRepository postRepository;
    private final UserRepository userRepository;
    private final NotificationService notificationService;


    @Transactional(readOnly = true)
    public List<Post> getFeed(User currentUser) {
        validateCurrentUser(currentUser);
        return postRepository.findAllByOrderByCreatedAtDesc();
    }

    @Transactional
    public Post createPost(String caption, MultipartFile file, User currentUser) throws IOException {
        validateCurrentUser(currentUser);
        String normalizedCaption = normalizeCaption(caption);

        if ((normalizedCaption == null || normalizedCaption.isBlank()) && (file == null || file.isEmpty())) {
            throw new RuntimeException("Post caption or media is required");
        }

        Post post = Post.builder()
                .caption(normalizedCaption)
                .createdAt(LocalDateTime.now())
                .author(currentUser)
                .build();

        applyMedia(post, file);
        Post savedPost = postRepository.save(post);
        notifyUsersAboutNewPost(savedPost, currentUser);
        return savedPost;
    }

    @Transactional
    public Post likePost(Long postId, User currentUser) {
        validateCurrentUser(currentUser);
        Post post = getPostEntity(postId);
        boolean alreadyLiked = post.getLikes().stream()
                .anyMatch(like -> currentUser.getId().equals(like.getUserId()));
        if (!alreadyLiked) {
            post.getLikes().add(Post.PostLikeData.builder()
                    .userId(currentUser.getId())
                    .createdAt(LocalDateTime.now())
                    .build());
            notifyPostAuthor(post, currentUser, "Post Love",
                    currentUser.getName() + " loved your post");
        }
        return postRepository.save(post);
    }

    @Transactional
    public Post unlikePost(Long postId, User currentUser) {
        validateCurrentUser(currentUser);
        Post post = getPostEntity(postId);
        post.getLikes().removeIf(like -> currentUser.getId().equals(like.getUserId()));
        return postRepository.save(post);
    }

    @Transactional
    public Post addComment(Long postId, String text, User currentUser) {
        validateCurrentUser(currentUser);
        Post post = getPostEntity(postId);
        post.getComments().add(Post.PostCommentData.builder()
                .userId(currentUser.getId())
                .authorId(currentUser.getId())
                .userName(currentUser.getName())
                .text(normalizeComment(text))
                .createdAt(LocalDateTime.now())
                .build());
        notifyPostAuthor(post, currentUser, "Post Comment",
                currentUser.getName() + " commented on your post");
        return postRepository.save(post);
    }

    @Transactional
    public void deletePost(Long postId, User currentUser) {
        validateCurrentUser(currentUser);
        Post post = getPostEntity(postId);
        if (post.getAuthor() == null || !currentUser.getId().equals(post.getAuthor().getId())) {
            throw new RuntimeException("Only the post author can delete this post");
        }
        postRepository.delete(post);
    }

    @Transactional
    public Post deleteComment(Long postId, int commentIndex, User currentUser) {
        validateCurrentUser(currentUser);
        Post post = getPostEntity(postId);
        if (commentIndex < 0 || commentIndex >= post.getComments().size()) {
            throw new RuntimeException("Comment not found");
        }

        Post.PostCommentData comment = post.getComments().get(commentIndex);
        Long commentAuthorId = comment.getUserId() != null ? comment.getUserId() : comment.getAuthorId();
        if (commentAuthorId == null || !currentUser.getId().equals(commentAuthorId)) {
            throw new RuntimeException("Only the comment author can delete this comment");
        }

        post.getComments().remove(commentIndex);
        return postRepository.save(post);
    }

    @Transactional(readOnly = true)
    public Post getPostMedia(Long postId) {
        Post post = getPostEntity(postId);
        if (post.getMediaData() == null || post.getMediaData().length == 0) {
            throw new RuntimeException("Post media not found");
        }
        return post;
    }

    @Transactional
    public void deletePostsByAuthor(User author) {
        if (author == null || author.getId() == null) return;
        List<Post> posts = postRepository.findByAuthorId(author.getId());
        if (!posts.isEmpty()) postRepository.deleteAll(posts);
    }

    private void validateCurrentUser(User currentUser) {
        if (currentUser == null || currentUser.getId() == null) {
            throw new RuntimeException("Current user is required");
        }
    }

    private Post getPostEntity(Long postId) {
        if (postId == null) {
            throw new RuntimeException("Post id is required");
        }
        return postRepository.findById(postId)
                .orElseThrow(() -> new RuntimeException("Post not found"));
    }

    private void applyMedia(Post post, MultipartFile file) throws IOException {
        if (file == null || file.isEmpty()) return;

        String contentType = file.getContentType();
        if (contentType == null || (!contentType.startsWith("image/") && !contentType.startsWith("video/"))) {
            throw new RuntimeException("Only image and video uploads are supported for posts");
        }

        post.setMediaName(file.getOriginalFilename());
        post.setMediaType(contentType);
        post.setMediaData(file.getBytes());
    }

    private String normalizeCaption(String caption) {
        if (caption == null) return null;
        String normalized = caption.trim();
        return normalized.isBlank() ? null : normalized;
    }

    private String normalizeComment(String text) {
        if (text == null || text.trim().isBlank()) {
            throw new RuntimeException("Comment text is required");
        }
        return text.trim();
    }

    private void notifyUsersAboutNewPost(Post post, User author) {
        if (post == null || author == null || author.getId() == null) return;

        userRepository.findAll().stream()
                .filter(user -> user.getId() != null && !user.getId().equals(author.getId()))
                .forEach(user -> notificationService.sendNotification(user.getId().intValue(),
                        Notification.builder()
                                .title("New Post")
                                .content(author.getName() + " shared a new post")
                                .type("POST")
                                .build()));
    }

    private void notifyPostAuthor(Post post, User actor, String title, String content) {
        if (post == null || post.getAuthor() == null || post.getAuthor().getId() == null) return;
        if (actor == null || actor.getId() == null || actor.getId().equals(post.getAuthor().getId())) return;

        notificationService.sendNotification(post.getAuthor().getId().intValue(),
                Notification.builder()
                        .title(title)
                        .content(content)
                        .type("POST")
                        .build());
    }
}
