/**
 * Al-Nawras CRM - State Machine Engine
 * The Merchant Growth & Retention Engine
 */

const mysql = require('mysql2/promise');

class StateMachineEngine {
    constructor(dbConfig) {
        this.pool = mysql.createPool(dbConfig);
    }

    /**
     * DAY 0: Handle New Registration
     * Creates immediate task (already handled by trigger)
     */
    async handleNewRegistration(merchantId) {
        // Task is auto-created by database trigger
        console.log(`[DAY 0] Immediate task created for merchant ${merchantId}`);
        
        // Log state transition
        await this.transitionState(merchantId, 'onboarding', 'registration', null, 'New merchant registered');
    }

    /**
     * 48-HOUR FILTER: Check if merchant shipped within 48h
     * Runs as a scheduled job every hour
     */
    async check48HourFilter() {
        const connection = await this.pool.getConnection();
        
        try {
            // Find merchants registered 48h ago with 0 shipments
            const [merchants] = await connection.query(`
                SELECT id, name
                FROM merchants
                WHERE current_state = 'onboarding'
                  AND registered_at <= DATE_SUB(NOW(), INTERVAL 48 HOUR)
                  AND (first_shipment_at IS NULL OR total_shipments = 0)
            `);

            for (const merchant of merchants) {
                console.log(`[48H FILTER] Moving merchant ${merchant.id} to retention - no shipments`);
                
                await this.transitionState(
                    merchant.id,
                    'retention',
                    'no_shipment_48h',
                    null,
                    'No shipment within 48 hours of registration'
                );
            }

            return merchants.length;
        } finally {
            connection.release();
        }
    }

    /**
     * ONBOARDING: Create scheduled tasks (Day 3, 10, 14)
     * Triggered when first shipment is detected
     */
    async scheduleOnboardingTasks(merchantId) {
        const connection = await this.pool.getConnection();
        
        try {
            const [merchant] = await connection.query(
                'SELECT registered_at, first_shipment_at FROM merchants WHERE id = ?',
                [merchantId]
            );

            if (!merchant || !merchant[0].first_shipment_at) return;

            const firstShipmentDate = new Date(merchant[0].first_shipment_at);

            // Day 3 Task
            const day3 = new Date(firstShipmentDate);
            day3.setDate(day3.getDate() + 3);
            
            await connection.query(`
                INSERT INTO tasks (merchant_id, task_type, due_date, priority, script_template)
                VALUES (?, 'day_3_followup', ?, 'normal', ?)
            `, [
                merchantId,
                day3.toISOString().split('T')[0],
                'أهلاً خوي [الاسم]، نتابعوا في شحناتك وحبينا نتأكدوا إن الخدمة تمام، وهل فيه أي ملاحظة نعدلوها ليك؟'
            ]);

            // Day 10 Task
            const day10 = new Date(firstShipmentDate);
            day10.setDate(day10.getDate() + 10);
            
            await connection.query(`
                INSERT INTO tasks (merchant_id, task_type, due_date, priority, script_template)
                VALUES (?, 'day_10_experience', ?, 'normal', ?)
            `, [
                merchantId,
                day10.toISOString().split('T')[0],
                'أهلاً خوي [الاسم]، نتابعوا في شحناتك وحبينا نتأكدوا إن الخدمة تمام، وهل فيه أي ملاحظة نعدلوها ليك؟'
            ]);

            // Day 14 Graduation Flag (not a task, just UI indicator)
            const day14 = new Date(firstShipmentDate);
            day14.setDate(day14.getDate() + 14);
            
            await connection.query(`
                INSERT INTO tasks (merchant_id, task_type, due_date, priority)
                VALUES (?, 'day_14_graduation', ?, 'normal')
            `, [merchantId, day14.toISOString().split('T')[0]]);

            console.log(`[ONBOARDING] Scheduled tasks for merchant ${merchantId}`);
        } finally {
            connection.release();
        }
    }

    /**
     * GRADUATION: Move merchant from Onboarding to Active
     */
    async graduateMerchant(merchantId, officerId) {
        await this.transitionState(
            merchantId,
            'active',
            'graduation',
            officerId,
            'Merchant graduated after 14 days of consistent shipping'
        );

        console.log(`[GRADUATION] Merchant ${merchantId} moved to Active`);
    }

    /**
     * 14-DAY INACTIVITY CHECK: Move active merchants to retention
     * Runs as a scheduled job daily
     */
    async check14DayInactivity() {
        const connection = await this.pool.getConnection();
        
        try {
            const [merchants] = await connection.query(`
                SELECT id, name, last_shipment_at
                FROM merchants
                WHERE current_state = 'active'
                  AND last_shipment_at <= DATE_SUB(NOW(), INTERVAL 14 DAY)
            `);

            for (const merchant of merchants) {
                console.log(`[14-DAY CHECK] Moving merchant ${merchant.id} to retention - 14 days inactive`);
                
                await this.transitionState(
                    merchant.id,
                    'retention',
                    'inactivity_14days',
                    null,
                    '14 consecutive days without shipments'
                );
            }

            return merchants.length;
        } finally {
            connection.release();
        }
    }

    /**
     * RETENTION: 3-Attempt Logic
     */
    async handleRetentionAttempt(merchantId, officerId, callLogId) {
        const connection = await this.pool.getConnection();
        
        try {
            // Increment retention attempts
            await connection.query(
                'UPDATE merchants SET retention_attempts = retention_attempts + 1 WHERE id = ?',
                [merchantId]
            );

            const [merchant] = await connection.query(
                'SELECT retention_attempts FROM merchants WHERE id = ?',
                [merchantId]
            );

            const attempts = merchant[0].retention_attempts;

            if (attempts < 3) {
                // Schedule next call (10 days from now)
                const nextCallDate = new Date();
                nextCallDate.setDate(nextCallDate.getDate() + 10);

                const taskType = attempts === 1 ? 'retention_call_2' : 'retention_call_3';

                await connection.query(`
                    INSERT INTO tasks (merchant_id, task_type, due_date, priority, script_template)
                    VALUES (?, ?, ?, 'high', ?)
                `, [
                    merchantId,
                    taskType,
                    nextCallDate.toISOString().split('T')[0],
                    'خوي [الاسم]، معاك إدارة الجودة. لاحظنا توقف الشحن، هل فيه إشكالية فنية أو مالية نقدروا نحلوها ليك؟'
                ]);

                console.log(`[RETENTION] Scheduled attempt ${attempts + 1} for merchant ${merchantId}`);
            } else {
                console.log(`[RETENTION] Final attempt completed for merchant ${merchantId} - awaiting manual action`);
            }
        } finally {
            connection.release();
        }
    }

    /**
     * RETENTION: Move to Cold after 3 failed attempts
     */
    async moveRetentionToCold(merchantId, officerId) {
        await this.transitionState(
            merchantId,
            'cold',
            'recovery_failed',
            officerId,
            '3 retention attempts failed - moved to marketing list'
        );

        console.log(`[RETENTION] Merchant ${merchantId} moved to Cold/Marketing`);
    }

    /**
     * RETENTION: Recovery Success - Return to Active
     */
    async handleRecoverySuccess(merchantId) {
        const connection = await this.pool.getConnection();
        
        try {
            // Reset retention attempts
            await connection.query(
                'UPDATE merchants SET retention_attempts = 0 WHERE id = ?',
                [merchantId]
            );

            await this.transitionState(
                merchantId,
                'active',
                'recovery_success',
                null,
                'Merchant resumed shipping - returned to active'
            );

            console.log(`[RECOVERY] Merchant ${merchantId} successfully recovered - returned to Active`);
        } finally {
            connection.release();
        }
    }

    /**
     * API SYNC: Update merchant shipment data
     */
    async syncShipmentData(externalMerchantId, shipmentDate, shipmentCount = 1) {
        const connection = await this.pool.getConnection();
        
        try {
            // Find merchant by external ID
            const [merchants] = await connection.query(
                'SELECT id, current_state, first_shipment_at FROM merchants WHERE external_id = ?',
                [externalMerchantId]
            );

            if (merchants.length === 0) return;

            const merchant = merchants[0];
            const merchantId = merchant.id;

            // Update shipments cache
            await connection.query(`
                INSERT INTO shipments_cache (merchant_id, external_merchant_id, shipment_date, shipment_count)
                VALUES (?, ?, ?, ?)
                ON DUPLICATE KEY UPDATE shipment_count = shipment_count + ?, last_synced_at = NOW()
            `, [merchantId, externalMerchantId, shipmentDate, shipmentCount, shipmentCount]);

            // Update merchant totals
            const isFirstShipment = !merchant.first_shipment_at;

            await connection.query(`
                UPDATE merchants
                SET first_shipment_at = IF(first_shipment_at IS NULL, ?, first_shipment_at),
                    last_shipment_at = ?,
                    total_shipments = total_shipments + ?,
                    days_inactive = 0
                WHERE id = ?
            `, [shipmentDate, shipmentDate, shipmentCount, merchantId]);

            // If this is the first shipment in onboarding, schedule tasks
            if (isFirstShipment && merchant.current_state === 'onboarding') {
                await this.scheduleOnboardingTasks(merchantId);
            }

            // If merchant was in retention and shipped, trigger recovery
            if (merchant.current_state === 'retention') {
                await this.handleRecoverySuccess(merchantId);
            }

            console.log(`[API SYNC] Updated shipment data for merchant ${merchantId}`);
        } finally {
            connection.release();
        }
    }

    /**
     * CORE: State Transition Handler
     */
    async transitionState(merchantId, toState, reason, officerId = null, notes = null) {
        const connection = await this.pool.getConnection();
        
        try {
            await connection.query(
                'CALL sp_transition_state(?, ?, ?, ?, ?)',
                [merchantId, toState, reason, officerId, notes]
            );
        } finally {
            connection.release();
        }
    }

    /**
     * KPI: Calculate 30-Minute Response Rate
     */
    async calculate30MinResponseRate(date) {
        const connection = await this.pool.getConnection();
        
        try {
            const [result] = await connection.query(`
                SELECT 
                    COUNT(*) AS total_registrations,
                    SUM(CASE 
                        WHEN TIMESTAMPDIFF(MINUTE, m.registered_at, cl.called_at) <= 30 
                        THEN 1 ELSE 0 
                    END) AS calls_within_30min
                FROM merchants m
                LEFT JOIN call_logs cl ON m.id = cl.merchant_id 
                    AND cl.call_type = 'onboarding'
                    AND cl.id = (
                        SELECT MIN(id) FROM call_logs WHERE merchant_id = m.id
                    )
                WHERE DATE(m.registered_at) = ?
            `, [date]);

            const total = result[0].total_registrations || 0;
            const within30 = result[0].calls_within_30min || 0;
            const rate = total > 0 ? (within30 / total) * 100 : 0;

            // Update KPI table
            await connection.query(`
                INSERT INTO kpi_metrics (metric_date, total_registrations, calls_within_30min, response_rate_30min)
                VALUES (?, ?, ?, ?)
                ON DUPLICATE KEY UPDATE 
                    total_registrations = VALUES(total_registrations),
                    calls_within_30min = VALUES(calls_within_30min),
                    response_rate_30min = VALUES(response_rate_30min)
            `, [date, total, within30, rate]);

            console.log(`[KPI] 30-min response rate for ${date}: ${rate.toFixed(2)}%`);
            
            return { total, within30, rate };
        } finally {
            connection.release();
        }
    }

    /**
     * SCHEDULED JOBS: Main entry point
     */
    async runScheduledJobs() {
        console.log('[CRON] Running scheduled jobs...');
        
        await this.check48HourFilter();
        await this.check14DayInactivity();
        await this.calculate30MinResponseRate(new Date().toISOString().split('T')[0]);
        
        console.log('[CRON] Scheduled jobs completed');
    }
}

module.exports = StateMachineEngine;

// Usage Example:
/*
const dbConfig = {
    host: 'localhost',
    user: 'root',
    password: 'password',
    database: 'nawras_crm',
    waitForConnections: true,
    connectionLimit: 10
};

const engine = new StateMachineEngine(dbConfig);

// Run every hour
setInterval(() => engine.runScheduledJobs(), 3600000);
*/
