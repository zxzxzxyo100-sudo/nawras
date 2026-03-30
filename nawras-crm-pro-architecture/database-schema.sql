-- Al-Nawras CRM Database Schema
-- The Merchant Growth & Retention Engine

-- ============================================
-- 1. MERCHANTS TABLE (Core Entity)
-- ============================================
CREATE TABLE merchants (
    id INT PRIMARY KEY AUTO_INCREMENT,
    external_id INT UNIQUE NOT NULL,  -- From external API
    name VARCHAR(255) NOT NULL,
    phone VARCHAR(20) NOT NULL,
    email VARCHAR(255),
    city VARCHAR(100),
    
    -- State Machine
    current_state ENUM('onboarding', 'active', 'retention', 'cold') NOT NULL DEFAULT 'onboarding',
    previous_state ENUM('onboarding', 'active', 'retention', 'cold'),
    state_changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Registration & Activity
    registered_at TIMESTAMP NOT NULL,
    first_shipment_at TIMESTAMP,
    last_shipment_at TIMESTAMP,
    total_shipments INT DEFAULT 0,
    
    -- Satisfaction Metrics
    satisfaction_score DECIMAL(5,2), -- Percentage (0-100)
    last_survey_at TIMESTAMP,
    next_survey_due TIMESTAMP,
    
    -- Retention Tracking
    retention_attempts INT DEFAULT 0,
    days_inactive INT DEFAULT 0,
    
    -- System Fields
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_state (current_state),
    INDEX idx_registered (registered_at),
    INDEX idx_last_shipment (last_shipment_at),
    INDEX idx_next_survey (next_survey_due)
);

-- ============================================
-- 2. TASKS TABLE (Scheduled Interactions)
-- ============================================
CREATE TABLE tasks (
    id INT PRIMARY KEY AUTO_INCREMENT,
    merchant_id INT NOT NULL,
    
    -- Task Type
    task_type ENUM(
        'day_0_immediate',
        'day_3_followup',
        'day_10_experience',
        'day_14_graduation',
        'monthly_survey',
        'retention_call_1',
        'retention_call_2',
        'retention_call_3'
    ) NOT NULL,
    
    -- Scheduling
    due_date DATE NOT NULL,
    due_time TIME DEFAULT '09:00:00',
    
    -- Status
    status ENUM('pending', 'completed', 'skipped', 'overdue') NOT NULL DEFAULT 'pending',
    completed_at TIMESTAMP,
    completed_by INT, -- officer_id
    
    -- Priority
    priority ENUM('critical', 'high', 'normal', 'low') NOT NULL DEFAULT 'normal',
    
    -- Script Reference
    script_template TEXT,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (merchant_id) REFERENCES merchants(id) ON DELETE CASCADE,
    INDEX idx_due_date (due_date, status),
    INDEX idx_merchant (merchant_id),
    INDEX idx_status (status)
);

-- ============================================
-- 3. CALL_LOGS TABLE (Interaction History)
-- ============================================
CREATE TABLE call_logs (
    id INT PRIMARY KEY AUTO_INCREMENT,
    merchant_id INT NOT NULL,
    task_id INT,
    officer_id INT NOT NULL,
    
    -- Call Details
    call_type ENUM('onboarding', 'followup', 'survey', 'retention', 'other') NOT NULL,
    call_outcome ENUM('answered', 'no_answer', 'busy', 'callback_requested') NOT NULL,
    call_duration INT, -- seconds
    
    -- Nawras Note (Mandatory)
    nawras_note TEXT NOT NULL,
    
    -- Survey Data (JSON for flexibility)
    survey_data JSON,
    
    -- Timestamps
    called_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (merchant_id) REFERENCES merchants(id) ON DELETE CASCADE,
    FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE SET NULL,
    INDEX idx_merchant (merchant_id),
    INDEX idx_called_at (called_at)
);

-- ============================================
-- 4. SURVEY_RESPONSES TABLE (Detailed Tracking)
-- ============================================
CREATE TABLE survey_responses (
    id INT PRIMARY KEY AUTO_INCREMENT,
    merchant_id INT NOT NULL,
    call_log_id INT NOT NULL,
    
    -- The 5 Mandatory Questions (1-5 scale)
    speed_rating TINYINT NOT NULL CHECK (speed_rating BETWEEN 1 AND 5),
    finance_rating TINYINT NOT NULL CHECK (finance_rating BETWEEN 1 AND 5),
    support_rating TINYINT NOT NULL CHECK (support_rating BETWEEN 1 AND 5),
    returns_rating TINYINT NOT NULL CHECK (returns_rating BETWEEN 1 AND 5),
    trust_rating TINYINT NOT NULL CHECK (trust_rating BETWEEN 1 AND 5),
    
    -- Calculated Score
    total_score DECIMAL(5,2) NOT NULL, -- Average percentage
    
    -- Additional Feedback
    feedback_text TEXT,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (merchant_id) REFERENCES merchants(id) ON DELETE CASCADE,
    FOREIGN KEY (call_log_id) REFERENCES call_logs(id) ON DELETE CASCADE,
    INDEX idx_merchant (merchant_id),
    INDEX idx_score (total_score)
);

-- ============================================
-- 5. STATE_TRANSITIONS TABLE (Audit Trail)
-- ============================================
CREATE TABLE state_transitions (
    id INT PRIMARY KEY AUTO_INCREMENT,
    merchant_id INT NOT NULL,
    
    from_state ENUM('onboarding', 'active', 'retention', 'cold'),
    to_state ENUM('onboarding', 'active', 'retention', 'cold') NOT NULL,
    
    -- Reason & Context
    reason ENUM(
        'registration',
        'first_shipment',
        'graduation',
        'inactivity_14days',
        'no_shipment_48h',
        'recovery_success',
        'recovery_failed',
        'manual'
    ) NOT NULL,
    
    triggered_by ENUM('system', 'officer', 'api') NOT NULL DEFAULT 'system',
    officer_id INT,
    notes TEXT,
    
    transitioned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (merchant_id) REFERENCES merchants(id) ON DELETE CASCADE,
    INDEX idx_merchant (merchant_id),
    INDEX idx_transition_date (transitioned_at)
);

-- ============================================
-- 6. OFFICERS TABLE (Users)
-- ============================================
CREATE TABLE officers (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    phone VARCHAR(20),
    
    role ENUM('officer', 'manager', 'admin') NOT NULL DEFAULT 'officer',
    
    -- Performance Metrics
    total_calls INT DEFAULT 0,
    avg_response_time_minutes INT,
    
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_role (role)
);

-- ============================================
-- 7. KPI_METRICS TABLE (Manager Dashboard)
-- ============================================
CREATE TABLE kpi_metrics (
    id INT PRIMARY KEY AUTO_INCREMENT,
    
    -- Date Range
    metric_date DATE NOT NULL,
    
    -- 30-Minute Response KPI
    total_registrations INT DEFAULT 0,
    calls_within_30min INT DEFAULT 0,
    response_rate_30min DECIMAL(5,2), -- Percentage
    
    -- Satisfaction Metrics
    avg_satisfaction_score DECIMAL(5,2),
    surveys_completed INT DEFAULT 0,
    
    -- Retention Metrics
    retention_attempts INT DEFAULT 0,
    retention_successes INT DEFAULT 0,
    retention_success_rate DECIMAL(5,2), -- Percentage
    
    -- State Distribution
    merchants_onboarding INT DEFAULT 0,
    merchants_active INT DEFAULT 0,
    merchants_retention INT DEFAULT 0,
    merchants_cold INT DEFAULT 0,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE KEY unique_date (metric_date),
    INDEX idx_date (metric_date)
);

-- ============================================
-- 8. SHIPMENTS_CACHE TABLE (API Data Cache)
-- ============================================
CREATE TABLE shipments_cache (
    id INT PRIMARY KEY AUTO_INCREMENT,
    merchant_id INT NOT NULL,
    external_merchant_id INT NOT NULL,
    
    shipment_date DATE NOT NULL,
    shipment_count INT NOT NULL DEFAULT 1,
    
    -- API Sync
    last_synced_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (merchant_id) REFERENCES merchants(id) ON DELETE CASCADE,
    INDEX idx_merchant_date (merchant_id, shipment_date),
    INDEX idx_external (external_merchant_id)
);

-- ============================================
-- VIEWS FOR EASY QUERYING
-- ============================================

-- Daily Task Feed (Today's Work)
CREATE VIEW v_daily_tasks AS
SELECT 
    t.id AS task_id,
    t.task_type,
    t.priority,
    t.status,
    m.id AS merchant_id,
    m.name AS merchant_name,
    m.phone,
    m.current_state,
    m.registered_at,
    m.last_shipment_at,
    TIMESTAMPDIFF(MINUTE, m.registered_at, NOW()) AS minutes_since_registration
FROM tasks t
JOIN merchants m ON t.merchant_id = m.id
WHERE t.due_date = CURDATE()
  AND t.status = 'pending'
ORDER BY 
    FIELD(t.priority, 'critical', 'high', 'normal', 'low'),
    t.due_time;

-- Merchants Overdue for 30-Min Response
CREATE VIEW v_overdue_immediate_response AS
SELECT 
    m.id,
    m.name,
    m.phone,
    m.registered_at,
    TIMESTAMPDIFF(MINUTE, m.registered_at, NOW()) AS minutes_since_registration
FROM merchants m
LEFT JOIN call_logs cl ON m.id = cl.merchant_id
WHERE m.current_state = 'onboarding'
  AND TIMESTAMPDIFF(MINUTE, m.registered_at, NOW()) > 30
  AND cl.id IS NULL
ORDER BY m.registered_at;

-- Merchants Ready for Graduation
CREATE VIEW v_graduation_ready AS
SELECT 
    m.id,
    m.name,
    m.phone,
    m.registered_at,
    m.first_shipment_at,
    DATEDIFF(NOW(), m.first_shipment_at) AS days_shipping
FROM merchants m
WHERE m.current_state = 'onboarding'
  AND m.first_shipment_at IS NOT NULL
  AND DATEDIFF(NOW(), m.first_shipment_at) >= 14
ORDER BY m.registered_at;

-- ============================================
-- STORED PROCEDURES (Business Logic)
-- ============================================

DELIMITER //

-- Auto-create Day 0 Task on Registration
CREATE TRIGGER trg_create_day0_task
AFTER INSERT ON merchants
FOR EACH ROW
BEGIN
    INSERT INTO tasks (merchant_id, task_type, due_date, priority, script_template)
    VALUES (
        NEW.id,
        'day_0_immediate',
        CURDATE(),
        'critical',
        'أهلاً خوي [الاسم]، نورت النورس. نبي نتأكد إن حسابك جاهز وهل محتاج أي مساعدة تقنية لتبدأ أول شحنة؟'
    );
END//

-- Calculate Satisfaction Score
CREATE PROCEDURE sp_calculate_satisfaction(
    IN p_merchant_id INT,
    IN p_call_log_id INT,
    IN p_speed INT,
    IN p_finance INT,
    IN p_support INT,
    IN p_returns INT,
    IN p_trust INT
)
BEGIN
    DECLARE v_total_score DECIMAL(5,2);
    
    -- Calculate average as percentage
    SET v_total_score = ((p_speed + p_finance + p_support + p_returns + p_trust) / 5.0) * 20;
    
    -- Insert survey response
    INSERT INTO survey_responses (
        merchant_id, call_log_id,
        speed_rating, finance_rating, support_rating, returns_rating, trust_rating,
        total_score
    ) VALUES (
        p_merchant_id, p_call_log_id,
        p_speed, p_finance, p_support, p_returns, p_trust,
        v_total_score
    );
    
    -- Update merchant satisfaction score
    UPDATE merchants
    SET satisfaction_score = v_total_score,
        last_survey_at = NOW(),
        next_survey_due = DATE_ADD(CURDATE(), INTERVAL 1 MONTH)
    WHERE id = p_merchant_id;
END//

-- Transition Merchant State
CREATE PROCEDURE sp_transition_state(
    IN p_merchant_id INT,
    IN p_to_state VARCHAR(20),
    IN p_reason VARCHAR(50),
    IN p_officer_id INT,
    IN p_notes TEXT
)
BEGIN
    DECLARE v_from_state VARCHAR(20);
    
    -- Get current state
    SELECT current_state INTO v_from_state
    FROM merchants
    WHERE id = p_merchant_id;
    
    -- Update merchant state
    UPDATE merchants
    SET previous_state = v_from_state,
        current_state = p_to_state,
        state_changed_at = NOW()
    WHERE id = p_merchant_id;
    
    -- Log transition
    INSERT INTO state_transitions (
        merchant_id, from_state, to_state, reason,
        triggered_by, officer_id, notes
    ) VALUES (
        p_merchant_id, v_from_state, p_to_state, p_reason,
        IF(p_officer_id IS NULL, 'system', 'officer'),
        p_officer_id, p_notes
    );
    
    -- Create appropriate tasks based on new state
    IF p_to_state = 'active' THEN
        INSERT INTO tasks (merchant_id, task_type, due_date, priority)
        VALUES (p_merchant_id, 'monthly_survey', DATE_ADD(CURDATE(), INTERVAL 1 MONTH), 'normal');
    ELSEIF p_to_state = 'retention' THEN
        INSERT INTO tasks (merchant_id, task_type, due_date, priority, script_template)
        VALUES (
            p_merchant_id, 'retention_call_1', CURDATE(), 'high',
            'خوي [الاسم]، معاك إدارة الجودة. لاحظنا توقف الشحن، هل فيه إشكالية فنية أو مالية نقدروا نحلوها ليك؟'
        );
    END IF;
END//

DELIMITER ;

-- ============================================
-- SAMPLE DATA (For Testing)
-- ============================================

INSERT INTO officers (name, email, role) VALUES
('أحمد المدير', 'ahmed@nawras.com', 'manager'),
('سيف الموظف', 'saif@nawras.com', 'officer'),
('فاطمة المسؤولة', 'fatima@nawras.com', 'officer');
