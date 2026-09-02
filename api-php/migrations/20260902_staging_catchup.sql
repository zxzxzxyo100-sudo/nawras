-- =============================================================================
-- تحديث قاعدة بيانات staging لمطابقة الإنتاج — 2026-09-02
-- نسخة idempotent بالكامل (IF NOT EXISTS على كل عمود/جدول) — آمنة للتشغيل
-- دفعة واحدة حتى لو بعض الأعمدة موجودة أصلاً، بدون توقف عند أول خطأ.
-- =============================================================================

SET NAMES utf8mb4;

-- ─── call_logs ───────────────────────────────────────────────────────────────
ALTER TABLE call_logs ADD COLUMN IF NOT EXISTS outcome VARCHAR(32) NULL DEFAULT NULL AFTER note;

-- ─── store_states (احتضان + مساعدات استعادة 30 يوم) ──────────────────────────
ALTER TABLE store_states ADD COLUMN IF NOT EXISTS registration_date DATETIME NULL DEFAULT NULL;
ALTER TABLE store_states ADD COLUMN IF NOT EXISTS first_shipped_date DATETIME NULL DEFAULT NULL;
ALTER TABLE store_states ADD COLUMN IF NOT EXISTS incubation_stage ENUM('day0','day3','day10','graduation_ready','graduated') DEFAULT 'day0';
ALTER TABLE store_states ADD COLUMN IF NOT EXISTS next_call_date DATE NULL DEFAULT NULL;
ALTER TABLE store_states ADD COLUMN IF NOT EXISTS inc_call1_at DATETIME NULL DEFAULT NULL;
ALTER TABLE store_states ADD COLUMN IF NOT EXISTS inc_call2_at DATETIME NULL DEFAULT NULL;
ALTER TABLE store_states ADD COLUMN IF NOT EXISTS inc_call3_at DATETIME NULL DEFAULT NULL;
ALTER TABLE store_states ADD COLUMN IF NOT EXISTS last_call_date DATETIME NULL DEFAULT NULL;
ALTER TABLE store_states ADD COLUMN IF NOT EXISTS officer_performance_error TINYINT(1) NOT NULL DEFAULT 0;

-- ─── surveys (CSAT مقابل ملاحظة غير نشط؛ تحليلات المدراء تفلتر حسب survey_kind) ─
ALTER TABLE surveys ADD COLUMN IF NOT EXISTS survey_kind VARCHAR(32) NULL DEFAULT 'active_csat';
ALTER TABLE surveys ADD COLUMN IF NOT EXISTS submitted_username VARCHAR(100) NULL DEFAULT NULL;
ALTER TABLE surveys ADD COLUMN IF NOT EXISTS satisfaction_score VARCHAR(16) NULL DEFAULT NULL;
ALTER TABLE surveys ADD COLUMN IF NOT EXISTS satisfaction_gap_tags JSON NULL DEFAULT NULL;

-- ─── store_assignments (دوران 50 متجر، سير عمل عدم الرد) ──────────────────────
CREATE TABLE IF NOT EXISTS store_assignments (
    store_id     VARCHAR(50)  NOT NULL PRIMARY KEY,
    store_name   VARCHAR(255) DEFAULT '',
    assigned_to  VARCHAR(100) NOT NULL,
    assigned_by  VARCHAR(100) DEFAULT '',
    assigned_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
    notes        TEXT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

ALTER TABLE store_assignments ADD COLUMN IF NOT EXISTS workflow_status ENUM('active','no_answer') NOT NULL DEFAULT 'active';
ALTER TABLE store_assignments ADD COLUMN IF NOT EXISTS workflow_updated_at DATETIME NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP;
ALTER TABLE store_assignments ADD COLUMN IF NOT EXISTS assignment_queue ENUM('active','inactive') NOT NULL DEFAULT 'active';

-- ─── المهام اليومية (إخفاء "تم" لكل يوم) ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS daily_task_dismissals (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(100) NOT NULL,
    task_key VARCHAR(160) NOT NULL,
    dismissed_on DATE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_user_task_day (username, task_key, dismissed_on),
    INDEX idx_user_day (username, dismissed_on)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ─── نقاط / أداء (اختياري؛ الكود ينشئه أيضاً تلقائياً) ────────────────────────
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

-- ─── عدّ اتصالات ناجحة يومية لمسؤول الاستعادة (هدف 50) ────────────────────────
CREATE TABLE IF NOT EXISTS inactive_manager_daily_stats (
  username VARCHAR(191) NOT NULL,
  work_date DATE NOT NULL,
  successful_contacts INT UNSIGNED NOT NULL DEFAULT 0,
  updated_at DATETIME NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (username, work_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─── حل مشاكل التحقق السريع (زر "تم حل المشكلة") ──────────────────────────────
CREATE TABLE IF NOT EXISTS quick_verification_resolutions (
    survey_id INT NOT NULL PRIMARY KEY,
    resolved_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    resolved_by VARCHAR(100) NULL DEFAULT NULL,
    executive_notes TEXT NULL DEFAULT NULL,
    INDEX idx_resolved_at (resolved_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ─── ربط المتجر بالفرع المسؤول / سجّله (ميزة الفروع) ──────────────────────────
CREATE TABLE IF NOT EXISTS store_branch_map (
    store_id INT PRIMARY KEY,
    responsible_branch VARCHAR(255) NULL DEFAULT NULL,
    registered_by VARCHAR(255) NULL DEFAULT NULL,
    updated_at DATETIME NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_branch (responsible_branch)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- End of migration
