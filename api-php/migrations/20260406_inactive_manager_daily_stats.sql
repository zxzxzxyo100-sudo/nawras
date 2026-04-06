-- عدّ اتصالات ناجحة يومية لمسؤول الاستعادة (هدف 50)
CREATE TABLE IF NOT EXISTS inactive_manager_daily_stats (
  username VARCHAR(191) NOT NULL,
  work_date DATE NOT NULL,
  successful_contacts INT UNSIGNED NOT NULL DEFAULT 0,
  updated_at DATETIME NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (username, work_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
