<?php
// =========================================================
// إعدادات مركزية لـ Nawras CRM API
// قبل رفع المشروع على Hostinger: راجع هذا الملف فقط
// =========================================================

// --- API الخارجي (Nawris) ---
define('NAWRIS_TOKEN', 'f651a69a2df9596088c524208de21d91d09457b9fc3e75bade2903390713f703');
define('NAWRIS_BASE',  'https://backoffice.nawris.algoriza.com/external-api');

// --- حدود الصفحات (Pagination) ---
// كل رقم يمثل أقصى عدد صفحات يُجلب من External API
define('MAX_PAGES_NEW',      50);   // customers/new          (كان 10 - رُفع لضمان جلب الكل)
define('MAX_PAGES_INACTIVE', 80);   // customers/inactive     (بلا حد سابقاً - أُضيف أمان)
define('MAX_PAGES_ORDERS',   80);   // customers/orders-summary
define('MAX_PAGES_RECOVERY', 30);   // check-recovery (للدورة الكاملة)
define('MAX_PAGES_ALL',     100);   // fetchAll() في all-stores.php

// --- حدود زمن وذاكرة PHP لكل نوع عملية ---
// ملاحظة: .htaccess يضبط الحد الأعلى على مستوى السيرفر
define('MEMORY_LIGHT',  '96M');     // عمليات خفيفة (auth, store-actions)
define('MEMORY_MEDIUM', '128M');    // check-recovery, new-customers
define('MEMORY_HEAVY',  '256M');    // all-stores, orders-summary (ضمن صلاحية Hostinger)
define('TIME_SHORT',    '30');      // ثانية - للعمليات القصيرة
define('TIME_MEDIUM',   '60');      // ثانية
define('TIME_LONG',     '120');     // ثانية - لـ all-stores (يجلب 4 مصادر)

// --- قاعدة البيانات ---
// Hostinger: استخدم بيانات الـ MySQL من لوحة التحكم
define('DB_HOST', 'localhost');
define('DB_NAME', 'u495355717_nawras_crm');
define('DB_USER', 'u495355717_nawras_admin');
define('DB_PASS', 'Zidona11');
