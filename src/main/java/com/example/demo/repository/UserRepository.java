package com.example.demo.repository;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

import com.example.demo.model.User;

public interface UserRepository extends JpaRepository<User, Long> {
    Optional<User> findByEmail(String email);
    List <User> findByRole(String role);
    boolean existsByEmail(String email);
    boolean existsById(Long id);
    Optional<User> findByStaffId(String staffId);
    long countByRole(String role);
}
