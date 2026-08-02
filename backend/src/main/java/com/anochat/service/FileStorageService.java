package com.anochat.service;

import com.anochat.exception.BadRequestException;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.util.Set;
import java.util.UUID;

@Service
public class FileStorageService {

    private static final Set<String> ALLOWED_EXTENSIONS = Set.of(
            ".jpg", ".jpeg", ".png", ".gif", ".webp", ".heic", ".heif"
    );

    private final Path uploadDir;

    public FileStorageService(@Value("${app.upload.dir:uploads}") String uploadDir) {
        this.uploadDir = Path.of(uploadDir).toAbsolutePath().normalize();
    }

    public String storeImage(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new BadRequestException("Image file is required");
        }
        String contentType = file.getContentType();
        if (!isAllowedImage(contentType, file.getOriginalFilename())) {
            throw new BadRequestException("Only JPEG, PNG, GIF, WebP, and HEIC images are allowed");
        }
        if (file.getSize() > 5 * 1024 * 1024) {
            throw new BadRequestException("Image must be 5MB or smaller");
        }
        String ext = extensionFor(contentType, file.getOriginalFilename());
        try {
            Files.createDirectories(uploadDir);
            String filename = UUID.randomUUID() + ext;
            Path target = uploadDir.resolve(filename);
            Files.copy(file.getInputStream(), target, StandardCopyOption.REPLACE_EXISTING);
            return "/uploads/" + filename;
        } catch (IOException e) {
            throw new BadRequestException("Failed to store image");
        }
    }

    private boolean isAllowedImage(String contentType, String originalFilename) {
        if (contentType != null) {
            String normalized = contentType.toLowerCase(java.util.Locale.ROOT);
            if (Set.of("image/jpeg", "image/jpg", "image/png", "image/gif", "image/webp", "image/heic", "image/heif")
                    .contains(normalized)) {
                return true;
            }
            if ("application/octet-stream".equals(normalized)) {
                return hasAllowedExtension(originalFilename);
            }
        }
        return hasAllowedExtension(originalFilename);
    }

    private boolean hasAllowedExtension(String originalFilename) {
        if (originalFilename == null || originalFilename.isBlank()) {
            return false;
        }
        String lower = originalFilename.toLowerCase(java.util.Locale.ROOT);
        return ALLOWED_EXTENSIONS.stream().anyMatch(lower::endsWith);
    }

    private String extensionFor(String contentType, String originalFilename) {
        if (originalFilename != null) {
            String lower = originalFilename.toLowerCase(java.util.Locale.ROOT);
            for (String ext : ALLOWED_EXTENSIONS) {
                if (lower.endsWith(ext)) {
                    return ext.equals(".jpeg") ? ".jpg" : ext;
                }
            }
        }
        if (contentType == null) {
            return ".jpg";
        }
        return switch (contentType.toLowerCase(java.util.Locale.ROOT)) {
            case "image/png" -> ".png";
            case "image/gif" -> ".gif";
            case "image/webp" -> ".webp";
            case "image/heic", "image/heif" -> ".heic";
            default -> ".jpg";
        };
    }
}
