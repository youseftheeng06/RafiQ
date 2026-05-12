package com.example.demo.repository;

import com.example.demo.model.Message;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
public interface MessageRepository extends JpaRepository<Message, Long> {
    List<Message> findByRoomId(Long roomId);

    List<Message> findBySenderId(Long userId);

    void deleteByRoomId(Long roomId);

    void deleteBySenderId(Long userId);
}
