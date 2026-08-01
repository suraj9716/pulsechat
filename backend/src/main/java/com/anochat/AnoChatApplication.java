package com.anochat;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

/**
 * Anonymous Real-Time Chat Application - Backend entry point.
 * Designed for 100k+ concurrent users with Redis-backed WebSocket sessions.
 */
@SpringBootApplication
public class AnoChatApplication {

    public static void main(String[] args) {
        SpringApplication.run(AnoChatApplication.class, args);
    }
}
