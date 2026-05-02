package com.example.demo.service;

import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Service;

import lombok.RequiredArgsConstructor;

@Service @RequiredArgsConstructor
public class EmailService {
    private final JavaMailSender mailSender;

    public void sendStaffIdEmail(String toEmail, String name, String staffId, String role) {
        SimpleMailMessage message = new SimpleMailMessage();
        message.setFrom("virtualoffice.rafiq@gmail.com"); // The Sender
        message.setTo(toEmail);                   // THE USER'S EMAIL
        message.setSubject("URGENT: Your RafiQ Staff ID");
        message.setText("Hello " + name + ",\n\n" +
                "Your registration is successful. Use the credentials below to login:\n" +
                "Staff ID: " + staffId + "\n" +
                "Role: " + role + "\n\n" +
                "Keep this ID safe!");
        
        mailSender.send(message);
    }

    // دي بتبعت كود الـ OTP على الإيميل عشان المستخدم يكمل اللوجين
    public void sendLoginOtpEmail(String toEmail, String name, String otp) {
        SimpleMailMessage message = new SimpleMailMessage();
        message.setFrom("virtualoffice.rafiq@gmail.com");
        message.setTo(toEmail);
        message.setSubject("Your RafiQ Login Verification Code");
        message.setText("Hello " + name + ",\n\n"
                + "Use this one-time code to finish signing in:\n"
                + otp + "\n\n"
                + "This code expires in 15 minutes.\n"
                + "If you did not try to sign in, please ignore this email.");

        mailSender.send(message);
    }

    public void sendTaskAssignedEmail(String toEmail, String receiverName, String senderName, String taskTitle, String deadline) {
        SimpleMailMessage message = new SimpleMailMessage();
        message.setFrom("virtualoffice.rafiq@gmail.com");
        message.setTo(toEmail);
        message.setSubject("New RafiQ Task Assigned");
        message.setText("Hello " + receiverName + ",\n\n"
                + "You received a task from " + senderName + ".\n"
                + "Task: " + taskTitle + "\n"
                + "Deadline: " + deadline + "\n\n"
                + "Please open RafiQ to review it.");

        mailSender.send(message);
    }

    public void sendTaskCompletedEmail(String toEmail, String senderName, String taskTitle, String completedBy) {
        SimpleMailMessage message = new SimpleMailMessage();
        message.setFrom("virtualoffice.rafiq@gmail.com");
        message.setTo(toEmail);
        message.setSubject("RafiQ Task Completed");
        message.setText("Hello " + senderName + ",\n\n"
                + "Task " + taskTitle + " completed by " + completedBy + ".");

        mailSender.send(message);
    }

    public void sendPromotionEmail(String toEmail, String name, String newStaffId) {
        SimpleMailMessage message = new SimpleMailMessage();
        message.setFrom("virtualoffice.rafiq@gmail.com");
        message.setTo(toEmail);
        message.setSubject("Congratulations! You have been promoted to Team Leader");
        message.setText("Hello " + name + ",\n\n"
                + "Congratulations! You have been promoted to Team Leader.\n\n"
                + "Your new Staff ID is: " + newStaffId + "\n"
                + "Your role has been updated to: TEAM_LEADER\n\n"
                + "Please use your new Staff ID for all future task assignments.\n"
                + "Keep this ID safe!\n\n"
                + "Best regards,\nRafiQ System");
        mailSender.send(message);
    }
}
