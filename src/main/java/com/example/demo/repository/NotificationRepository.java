package com.example.demo.repository;

import com.example.demo.model.Notification;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
public interface NotificationRepository extends JpaRepository<Notification, Long> {
    List<Notification> findByRecipientId(Long userId);

    List<Notification> findByRecipientIdAndReadFalse(Long userId);

    @Modifying
    @Query("update Notification n set n.read = true where n.recipient.id = :userId")
    int markAllReadByRecipientId(@Param("userId") Long userId);

    void deleteByRecipientId(Long userId);
}
