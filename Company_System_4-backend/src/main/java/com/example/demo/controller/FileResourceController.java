package com.example.demo.controller;

import java.io.IOException;
import java.util.List;

import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import com.example.demo.dto.FileResourceResponse;
import com.example.demo.model.FileResource;
import com.example.demo.model.User;
import com.example.demo.service.FileResourceService;
import com.example.demo.service.UserService;

import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/api/files")
@RequiredArgsConstructor
public class FileResourceController {

    private final FileResourceService fileService;
    private final UserService userService;

    @PostMapping("/upload")
    public ResponseEntity<FileResourceResponse> uploadFile(
            @RequestParam("file") MultipartFile file,
            @RequestParam("roomId") Long roomId,
            @RequestHeader("userId") Long userId
    ) throws IOException {
        User currentUser = userService.getUserById(userId);
        return ResponseEntity.ok(toFileResponse(fileService.uploadFile(file, roomId, currentUser)));
    }

    @GetMapping("/room/{roomId}")
    public ResponseEntity<List<FileResourceResponse>> getRoomFiles(@PathVariable Long roomId, @RequestHeader("userId") Long userId) {
        User currentUser = userService.getUserById(userId);
        return ResponseEntity.ok(
                fileService.getFilesByRoom(roomId, currentUser)
                        .stream()
                        .map(this::toFileResponse)
                        .toList()
        );
    }

    @GetMapping("/{id}/download")
    public ResponseEntity<byte[]> downloadFile(@PathVariable Long id) {
        FileResource resource = fileService.getFileResourceById(id);
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(resource.getFileType()))
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + resource.getFileName() + "\"")
                .body(resource.getFileData());
    }

    @DeleteMapping("/room/{roomId}")
    public ResponseEntity<Void> deleteRoomFiles(@PathVariable Long roomId, @RequestHeader("userId") Long userId) {
        User currentUser = userService.getUserById(userId);
        fileService.deleteFilesByRoom(roomId, currentUser);
        return ResponseEntity.noContent().build();
    }

    private FileResourceResponse toFileResponse(FileResource resource) {
        return FileResourceResponse.builder()
                .id(resource.getId())
                .fileName(resource.getFileName())
                .fileType(resource.getFileType())
                .roomId(resource.getRoom().getId())
                .uploadedById(resource.getUploadedBy().getId())
                .build();
    }
}
