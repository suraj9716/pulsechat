package com.anochat.config;

import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.stereotype.Component;

@Component
@Slf4j
public class MessageStorageStartupLogger implements ApplicationRunner {

    @Override
    public void run(ApplicationArguments args) {
        log.info("PulseChat message storage: DEVICE-ONLY (relay-only, no DB persistence)");
    }
}
