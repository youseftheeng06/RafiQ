package com.example.demo.repository;

import com.example.demo.model.Room;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
    public interface RoomRepository extends JpaRepository<Room, Long> 
    {
        List<Room> findByActive(boolean active);
        List<Room> findByName(String name);
        List<Room> findByType(String type);
        List<Room> findByCreatedById(Long userId);
        List<Room> findByMembersId(Long userId);
        boolean existsByIdAndMembersId(Long roomId, Long userId);

    }
