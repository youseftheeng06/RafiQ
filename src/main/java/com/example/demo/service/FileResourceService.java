package com.example.demo.service;

import com.example.demo.model.FileResource;
import com.example.demo.model.Room;
import com.example.demo.model.User;
import com.example.demo.repository.FileResourceRepository;
import com.example.demo.repository.RoomRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.List;

@Service
@RequiredArgsConstructor
public class FileResourceService {

    private final FileResourceRepository fileResourceRepository;
    private final RoomRepository roomRepository;

    public FileResource uploadFile(MultipartFile file, Long roomId, User currentUser) throws IOException {
        if (file == null || file.isEmpty()) {
            throw new IllegalArgumentException("File is required");
        }

        if (roomId == null) {
            throw new IllegalArgumentException("Room id is required");
        }

        if (currentUser == null) {
            throw new IllegalArgumentException("Uploader is required");
        }

        Room room = roomRepository.findById(roomId)
                .orElseThrow(() -> new IllegalArgumentException("Room not found"));
        if (!isManager(currentUser) && !roomRepository.existsByIdAndMembersId(roomId, currentUser.getId())) {
            throw new RuntimeException("Not authorized to upload files in this room");
        }

        FileResource resource = FileResource.builder()
                .fileName(file.getOriginalFilename())
                .fileType(file.getContentType() == null ? "application/octet-stream" : file.getContentType())
                .filePath("db://" + roomId + "/" + System.currentTimeMillis() + "_" + file.getOriginalFilename())
                .fileData(file.getBytes())
                .uploadedBy(currentUser)
                .room(room)
                .build();

        return fileResourceRepository.save(resource);
    }

    public FileResource getFileResourceById(Long id) {
        if (id == null) {
            throw new IllegalArgumentException("File id is required");
        }

        return fileResourceRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("File resource not found"));
    }

    public List<FileResource> getAllFileResources() {
        return fileResourceRepository.findAll();
    }

    public List<FileResource> getFilesByRoom(Long roomId, User currentUser) {
        if (roomId == null) {
            throw new IllegalArgumentException("Room id is required");
        }

        if (!roomRepository.existsById(roomId)) {
            throw new IllegalArgumentException("Room not found");
        }
        if (!isManager(currentUser) && !roomRepository.existsByIdAndMembersId(roomId, currentUser.getId())) {
            throw new RuntimeException("Not authorized to view files in this room");
        }

        return fileResourceRepository.findByRoomId(roomId);
    }

    public List<FileResource> getFilesByUploader(Long userId) {
        if (userId == null) {
            throw new IllegalArgumentException("User id is required");
        }

        return fileResourceRepository.findByUploadedById(userId);
    }

    public void deleteFileResource(Long id) {
        if (id == null) {
            throw new IllegalArgumentException("File id is required");
        }

        if (!fileResourceRepository.existsById(id)) {
            throw new IllegalArgumentException("File resource not found");
        }

        fileResourceRepository.deleteById(id);
    }

    @Transactional
    public void deleteFilesByRoom(Long roomId, User currentUser) {
        if (roomId == null) {
            throw new IllegalArgumentException("Room id is required");
        }

        if (!isManager(currentUser)) {
            throw new RuntimeException("Only Manager can clear room files");
        }

        fileResourceRepository.deleteByRoomId(roomId);
    }

    private boolean isManager(User user) {
        return "MANAGER".equals(user == null || user.getRole() == null ? "" : user.getRole().trim().toUpperCase());
    }
}
