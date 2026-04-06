-- حل مشاكل التحقق السريع (زر «تم حل المشكلة») — اختياري إن وُجد CREATE في PHP.
SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS quick_verification_resolutions (
    survey_id INT NOT NULL PRIMARY KEY,
    resolved_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    resolved_by VARCHAR(100) NULL DEFAULT NULL,
    executive_notes TEXT NULL DEFAULT NULL,
    INDEX idx_resolved_at (resolved_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
