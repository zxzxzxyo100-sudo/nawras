CREATE TABLE IF NOT EXISTS leads (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  store_name VARCHAR(255) NOT NULL,
  phone_number VARCHAR(50) NOT NULL,
  source ENUM('social_media', 'field_visit', 'other') NOT NULL,
  contact_status ENUM('pending', 'answered', 'no_answer') NOT NULL DEFAULT 'pending',
  requires_field_visit TINYINT(1) NOT NULL DEFAULT 0,
  field_visit_done TINYINT(1) NOT NULL DEFAULT 0,
  account_opened TINYINT(1) NOT NULL DEFAULT 0,
  assigned_to_id INT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_leads_assigned_to_users FOREIGN KEY (assigned_to_id)
    REFERENCES users(id)
    ON UPDATE CASCADE
    ON DELETE RESTRICT,
  INDEX idx_leads_assigned_to_id (assigned_to_id),
  INDEX idx_leads_created_at (created_at),
  INDEX idx_leads_contact_status (contact_status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
