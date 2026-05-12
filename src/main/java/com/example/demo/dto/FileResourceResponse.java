package com.example.demo.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class FileResourceResponse {
    private Long id;
    private String fileName;
    private String fileType;
    private Long roomId;
    private Long uploadedById;
}
