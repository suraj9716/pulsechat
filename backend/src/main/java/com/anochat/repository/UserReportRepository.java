package com.anochat.repository;

import com.anochat.domain.entity.UserReport;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.UUID;

public interface UserReportRepository extends JpaRepository<UserReport, UUID> {

    Page<UserReport> findByResolvedFalse(Pageable pageable);

    Page<UserReport> findByReportedId(UUID reportedId, Pageable pageable);
}
