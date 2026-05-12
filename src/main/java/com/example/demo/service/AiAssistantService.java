package com.example.demo.service;

import com.example.demo.model.Room;
import com.example.demo.model.Task;
import com.example.demo.model.User;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.LocalDateTime;
import java.time.format.DateTimeParseException;
import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Service;

@Service
public class AiAssistantService {
    private final AiChatService aiChatService;
    private final UserService userService;
    private final RoomService roomService;
    private final TaskService taskService;
    private final ObjectMapper objectMapper = new ObjectMapper();

    public AiAssistantService(AiChatService aiChatService, UserService userService, RoomService roomService, TaskService taskService) {
        this.aiChatService = aiChatService;
        this.userService = userService;
        this.roomService = roomService;
        this.taskService = taskService;
    }

    public Map<String, Object> respond(String message, Long userId) {
        String trimmedMessage = message == null ? "" : message.trim();
        if (trimmedMessage.isBlank()) {
            throw new RuntimeException("Message is required");
        }

        if (userId == null) {
            return aiChatService.chat(trimmedMessage);
        }

        User currentUser = userService.getUserById(userId);
        Map<String, Object> actionPlan = classifyIntent(trimmedMessage, currentUser);
        String action = textValue(actionPlan.get("action"));

        if (action == null || action.isBlank() || "chat".equalsIgnoreCase(action)) {
            return aiChatService.chat(trimmedMessage);
        }

        return switch (action) {
            case "create_room" -> createRoom(actionPlan, currentUser);
            case "create_task" -> createTask(actionPlan, currentUser);
            case "list_my_tasks" -> listMyTasks(currentUser);
            case "ask_clarification" -> Map.of("reply", textValue(actionPlan.get("reply"), "Please clarify what you want me to do."));
            default -> aiChatService.chat(trimmedMessage);
        };
    }

    private Map<String, Object> classifyIntent(String message, User currentUser) {
        String prompt = """
                You are an AI assistant for the RafiQ workplace system.
                Decide whether the user wants one of these actions:
                - create_room
                - create_task
                - list_my_tasks
                - chat
                - ask_clarification

                Return JSON only.
                Use this schema:
                {
                  "action": "create_room|create_task|list_my_tasks|chat|ask_clarification",
                  "reply": "short natural language reply",
                  "roomName": "optional",
                  "roomType": "optional, default CHAT",
                  "title": "optional",
                  "description": "optional",
                  "assignedToStaffId": "optional",
                  "deadline": "optional ISO local datetime like 2026-05-08T18:00:00",
                  "status": "optional"
                }

                Rules:
                - If the user wants to create a room, use create_room.
                - If the room type is missing, use CHAT.
                - If the user wants to create a task, use create_task.
                - If required task fields are missing, use ask_clarification.
                - If the user wants to see their tasks, use list_my_tasks.
                - For anything else, use chat.
                - reply must be in the same language as the user message.

                Current user:
                - name: %s
                - role: %s
                - staffId: %s
                - current time: %s
                """.formatted(
                currentUser.getName(),
                currentUser.getRole(),
                currentUser.getStaffId(),
                LocalDateTime.now()
        );

        String raw = aiChatService.generateReply(prompt, message);
        String json = stripCodeFences(raw);

        try {
            return objectMapper.readValue(json, new TypeReference<>() {});
        } catch (Exception ex) {
            return Map.of(
                    "action", "chat",
                    "reply", raw
            );
        }
    }

    private Map<String, Object> createRoom(Map<String, Object> actionPlan, User currentUser) {
        String roomName = textValue(actionPlan.get("roomName"));
        if (roomName == null || roomName.isBlank()) {
            return Map.of("reply", textValue(actionPlan.get("reply"), "I need a room name before I can create the room."));
        }

        String roomType = textValue(actionPlan.get("roomType"), "CHAT");

        Room room = Room.builder()
                .name(roomName.trim())
                .type(roomType.trim().toUpperCase())
                .build();

        Room savedRoom = roomService.createRoom(room, currentUser);
        return Map.of(
                "reply", "Room '" + savedRoom.getName() + "' was created successfully.",
                "action", "create_room",
                "roomId", savedRoom.getId(),
                "roomName", savedRoom.getName()
        );
    }

    private Map<String, Object> createTask(Map<String, Object> actionPlan, User currentUser) {
        String title = textValue(actionPlan.get("title"));
        String assignedToStaffId = textValue(actionPlan.get("assignedToStaffId"));
        String deadlineText = textValue(actionPlan.get("deadline"));

        if (title == null || title.isBlank() || assignedToStaffId == null || assignedToStaffId.isBlank() || deadlineText == null || deadlineText.isBlank()) {
            return Map.of("reply", textValue(actionPlan.get("reply"), "I need the task title, assigned staff ID, and deadline to create the task."));
        }

        LocalDateTime deadline;
        try {
            deadline = LocalDateTime.parse(deadlineText.trim());
        } catch (DateTimeParseException ex) {
            return Map.of("reply", "I need the deadline in a clear date-time format like 2026-05-08T18:00:00.");
        }

        Task task = Task.builder()
                .title(title.trim())
                .description(textValue(actionPlan.get("description"), ""))
                .status(textValue(actionPlan.get("status"), "pending"))
                .deadline(deadline)
                .build();
        task.setAssignedToStaffId(assignedToStaffId.trim());

        Task savedTask = taskService.createTask(task, currentUser);
        return Map.of(
                "reply", "Task '" + savedTask.getTitle() + "' was created and assigned to " + savedTask.getAssignedTo().getName() + ".",
                "action", "create_task",
                "taskId", savedTask.getId(),
                "title", savedTask.getTitle()
        );
    }

    private Map<String, Object> listMyTasks(User currentUser) {
        List<Task> tasks;
        String normalizedRole = currentUser.getRole() == null ? "" : currentUser.getRole().trim().toUpperCase();

        if ("MANAGER".equals(normalizedRole) || "TEAM_LEADER".equals(normalizedRole)) {
            tasks = taskService.getAllTasks(currentUser);
        } else {
            tasks = taskService.getTasksAssignedTo(currentUser.getId(), currentUser);
        }

        if (tasks.isEmpty()) {
            return Map.of(
                    "reply", "You do not have any tasks right now.",
                    "action", "list_my_tasks",
                    "count", 0
            );
        }

        StringBuilder reply = new StringBuilder("Here are your tasks:\n");
        for (Task task : tasks.stream().limit(8).toList()) {
            reply.append("- ")
                    .append(task.getTitle())
                    .append(" [").append(task.getStatus()).append("]");
            if (task.getAssignedTo() != null) {
                reply.append(" to ").append(task.getAssignedTo().getName());
            }
            if (task.getDeadline() != null) {
                reply.append(" due ").append(task.getDeadline());
            }
            reply.append("\n");
        }

        if (tasks.size() > 8) {
            reply.append("...and ").append(tasks.size() - 8).append(" more.");
        }

        return Map.of(
                "reply", reply.toString().trim(),
                "action", "list_my_tasks",
                "count", tasks.size()
        );
    }

    private String stripCodeFences(String text) {
        if (text == null) {
            return "";
        }

        String normalized = text.trim();
        if (normalized.startsWith("```")) {
            normalized = normalized.replaceFirst("^```[a-zA-Z]*", "").trim();
            if (normalized.endsWith("```")) {
                normalized = normalized.substring(0, normalized.length() - 3).trim();
            }
        }
        return normalized;
    }

    private String textValue(Object value) {
        return value == null ? null : String.valueOf(value);
    }

    private String textValue(Object value, String fallback) {
        String text = textValue(value);
        return text == null || text.isBlank() ? fallback : text;
    }
}
