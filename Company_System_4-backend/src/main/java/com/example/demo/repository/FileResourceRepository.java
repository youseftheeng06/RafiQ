package com.example.demo.repository;

import com.example.demo.model.FileResource;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface FileResourceRepository extends JpaRepository<FileResource, Long> {
    List<FileResource> findByRoomId(Long roomId);

    List<FileResource> findByUploadedById(Long userId);

    void deleteByRoomId(Long roomId);

    void deleteByUploadedById(Long userId);
}
