-- =============================================================================
-- Production schema alignment — Store Management & Analytics (2026-04)
-- Run ONCE against the production MySQL database before or after PHP deploy.
-- Safe to re-run: ignore "Duplicate column" / "already exists" errors from MySQL.
-- =============================================================================
-- Covers: workflow (50-queue / no_answer), CSAT surveys (survey_kind,
-- submitted_username), call_logs.outcome, incubation call columns, last_call_date,
-- daily_task_dismissals, store_assignments, points_log (created by API on first use;
--   included here for explicit DBA review).
-- =============================================================================

SET NAMES utf8mb4;

-- ─── call_logs ───────────────────────────────────────────────────────────────
ALTER TABLE call_logs ADD COLUMN outcome VARCHAR(32) NULL DEFAULT NULL AFTER note;

-- ─── store_states (incubation + 30-day recovery helpers) ─────────────────────
ALTER TABLE store_states ADD COLUMN registration_date DATETIME NULL DEFAULT NULL;
ALTER TABLE store_states ADD COLUMN first_shipped_date DATETIME NULL DEFAULT NULL;
ALTER TABLE store_states ADD COLUMN incubation_stage ENUM('day0','day3','day10','graduation_ready','graduated') DEFAULT 'day0';
ALTER TABLE store_states ADD COLUMN next_call_date DATE NULL DEFAULT NULL;
ALTER TABLE store_states ADD COLUMN inc_call1_at DATETIME NULL DEFAULT NULL;
ALTER TABLE store_states ADD COLUMN inc_call2_at DATETIME NULL DEFAULT NULL;
ALTER TABLE store_states ADD COLUMN inc_call3_at DATETIME NULL DEFAULT NULL;
ALTER TABLE store_states ADD COLUMN last_call_date DATETIME NULL DEFAULT NULL;

-- ─── surveys (CSAT vs inactive note; manager analytics filters by survey_kind) ─
ALTER TABLE surveys ADD COLUMN survey_kind VARCHAR(32) NULL DEFAULT 'active_csat';
ALTER TABLE surveys ADD COLUMN submitted_username VARCHAR(100) NULL DEFAULT NULL;

-- ─── store_assignments (50-store rotation, no_answer workflow) ───────────────
-- Base table (matches legacy); workflow columns added next for idempotency.
CREATE TABLE IF NOT EXISTS store_assignments (
    store_id     VARCHAR(50)  NOT NULL PRIMARY KEY,
    store_name   VARCHAR(255) DEFAULT '',
    assigned_to  VARCHAR(100) NOT NULL,
    assigned_by  VARCHAR(100) DEFAULT '',
    assigned_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
    notes        TEXT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

ALTER TABLE store_assignments ADD COLUMN workflow_status ENUM('active','no_answer') NOT NULL DEFAULT 'active';
ALTER TABLE store_assignments ADD COLUMN workflow_updated_at DATETIME NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP;
ALTER TABLE store_assignments ADD COLUMN assignment_queue ENUM('active','inactive') NOT NULL DEFAULT 'active';

-- ─── daily tasks (dismiss "done" per day) ────────────────────────────────────
CREATE TABLE IF NOT EXISTS daily_task_dismissals (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(100) NOT NULL,
    task_key VARCHAR(160) NOT NULL,
    dismissed_on DATE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_user_task_day (username, task_key, dismissed_on),
    INDEX idx_user_day (username, dismissed_on)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ─── gamification / stats (optional; API also creates if missing) ───────────
CREATE TABLE IF NOT EXISTS points_log (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(100) NOT NULL,
    fullname VARCHAR(200) DEFAULT '',
    points INT NOT NULL DEFAULT 10,
    reason VARCHAR(200) DEFAULT 'مكالمة',
    store_id INT NULL,
    store_name VARCHAR(300) DEFAULT '',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_user (username),
    INDEX idx_date (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- End of migration
