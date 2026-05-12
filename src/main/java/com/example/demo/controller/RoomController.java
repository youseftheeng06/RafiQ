package com.example.demo.controller;

import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.example.demo.dto.RoomMemberResponse;
import com.example.demo.dto.RoomResponse;
import com.example.demo.model.Room;
import com.example.demo.model.User;
import com.example.demo.service.RoomService;
import com.example.demo.service.UserService;

import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/api/rooms")
@RequiredArgsConstructor
public class RoomController {

    private final RoomService roomService;
    private final UserService userService;

    @PostMapping
    public ResponseEntity<RoomResponse> createRoom(@RequestBody Room room, @RequestHeader("userId") Long userId) {
        User currentUser = userService.getUserById(userId);
        return ResponseEntity.ok(toRoomResponse(roomService.createRoom(room, currentUser)));
    }

    @GetMapping
    public ResponseEntity<List<RoomResponse>> getAllRooms(@RequestHeader("userId") Long userId) {
        User currentUser = userService.getUserById(userId);
        return ResponseEntity.ok(
                roomService.getAllRooms(currentUser)
                        .stream()
                        .map(this::toRoomResponse)
                        .collect(Collectors.toList())
        );
    }

    @GetMapping("/{roomId}/members")
    public ResponseEntity<List<RoomMemberResponse>> getRoomMembers(
            @PathVariable Long roomId,
            @RequestHeader("userId") Long userId
    ) {
        User currentUser = userService.getUserById(userId);
        return ResponseEntity.ok(
                roomService.getRoomMembers(roomId, currentUser)
                        .stream()
                        .map(this::toMemberResponse)
                        .collect(Collectors.toList())
        );
    }

    @DeleteMapping("/{roomId}")
    public ResponseEntity<Void> deleteRoom(
            @PathVariable Long roomId,
            @RequestHeader("userId") Long userId
    ) {
        User currentUser = userService.getUserById(userId);
        roomService.deleteRoom(roomId, currentUser);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/{roomId}/members/by-staff/{staffId}")
    public ResponseEntity<List<RoomMemberResponse>> addRoomMemberByStaffId(
            @PathVariable Long roomId,
            @PathVariable String staffId,
            @RequestHeader("userId") Long userId
    ) {
        User currentUser = userService.getUserById(userId);
        return ResponseEntity.ok(
                roomService.addMemberByStaffId(roomId, staffId, currentUser)
                        .stream()
                        .map(this::toMemberResponse)
                        .collect(Collectors.toList())
        );
    }

    @DeleteMapping("/{roomId}/members/{memberId}")
    public ResponseEntity<List<RoomMemberResponse>> removeRoomMember(
            @PathVariable Long roomId,
            @PathVariable Long memberId,
            @RequestHeader("userId") Long userId
    ) {
        User currentUser = userService.getUserById(userId);
        return ResponseEntity.ok(
                roomService.removeMember(roomId, memberId, currentUser)
                        .stream()
                        .map(this::toMemberResponse)
                        .collect(Collectors.toList())
        );
    }

    @PostMapping("/{roomId}/video-call-session")
    public ResponseEntity<Map<String, Object>> createVideoCallSession(
            @PathVariable Long roomId,
            @RequestHeader("userId") Long userId
    ) {
        User currentUser = userService.getUserById(userId);
        return ResponseEntity.ok(roomService.createVideoCallSession(roomId, currentUser));
    }

    private RoomResponse toRoomResponse(Room room) {
        return RoomResponse.builder()
                .id(room.getId())
                .name(room.getName())
                .type(room.getType())
                .active(room.isActive())
                .build();
    }

    private RoomMemberResponse toMemberResponse(User user) {
        return RoomMemberResponse.builder()
                .id(user.getId())
                .name(user.getName())
                .email(user.getEmail())
                .role(user.getRole())
                .staffId(user.getStaffId())
                .active(user.isActive())
                .build();
    }
}
