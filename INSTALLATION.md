# 📦 دليل التثبيت - Al-Nawras CRM

## 🎯 المتطلبات الأساسية

قبل البدء، تأكد من تثبيت:

- **Node.js** 18 أو أحدث ([تحميل](https://nodejs.org/))
- **MySQL** 8.0 أو أحدث ([تحميل](https://dev.mysql.com/downloads/))
- **npm** أو **yarn** (يأتي مع Node.js)
- **Git** ([تحميل](https://git-scm.com/))

---

## 📋 خطوات التثبيت الكاملة

### المرحلة 1️⃣: إعداد قاعدة البيانات

```bash
# 1. تسجيل الدخول لـ MySQL
mysql -u root -p

# 2. إنشاء قاعدة بيانات جديدة
CREATE DATABASE nawras_crm CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

# 3. الخروج من MySQL
exit;

# 4. استيراد Schema
mysql -u root -p nawras_crm < database-schema.sql

# 5. التحقق من النجاح
mysql -u root -p -e "USE nawras_crm; SHOW TABLES;"
```

**يجب أن ترى 8 جداول:**
- merchants
- tasks
- call_logs
- survey_responses
- state_transitions
- officers
- kpi_metrics
- shipments_cache

---

### المرحلة 2️⃣: إعداد Backend (State Machine Engine)

```bash
# 1. إنشاء مجلد Backend
mkdir backend
cd backend

# 2. تهيئة npm
npm init -y

# 3. تثبيت Dependencies
npm install express mysql2 node-cron dotenv cors axios

# 4. نسخ State Machine Engine
cp ../state-machine-engine.js ./

# 5. إنشاء ملف .env
cp ../.env.example .env

# 6. تحرير .env وإدخال بيانات MySQL الخاصة بك
nano .env  # أو استخدم أي محرر نصوص
```

**محتوى .env المطلوب:**
```env
DB_HOST=localhost
DB_PORT=3306
DB_NAME=nawras_crm
DB_USER=root
DB_PASSWORD=كلمة_السر_الخاصة_بك

NAWRAS_API_TOKEN=f651a69a2df9596088c524208de21d91d09457b9fc3e75bade2903390713f703
```

---

### المرحلة 3️⃣: إنشاء Backend Server

إنشاء ملف `backend/server.js`:

```javascript
const express = require('express');
const cors = require('cors');
const StateMachineEngine = require('./state-machine-engine');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Database Config
const dbConfig = {
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10
};

// Initialize State Machine Engine
const engine = new StateMachineEngine(dbConfig);

// API Routes
app.get('/api/tasks/today', async (req, res) => {
    // Implementation here
});

app.get('/api/kpis/dashboard', async (req, res) => {
    // Implementation here
});

// Start Server
app.listen(PORT, () => {
    console.log(`✅ Backend running on http://localhost:${PORT}`);
});

// Start Cron Jobs
if (process.env.ENABLE_CRON_JOBS === 'true') {
    setInterval(() => engine.runScheduledJobs(), 3600000); // Every hour
    console.log('✅ Cron jobs enabled');
}
```

**تشغيل Backend:**
```bash
node server.js
```

---

### المرحلة 4️⃣: إعداد Frontend (React Dashboard)

```bash
# 1. الدخول لمجلد React
cd ../react-crm

# 2. تثبيت Dependencies
npm install

# 3. إنشاء ملف .env.local
echo "VITE_API_URL=http://localhost:3000/api" > .env.local

# 4. تشغيل Frontend
npm run dev
```

**يجب أن يفتح المتصفح على:**
```
http://localhost:5173
```

---

### المرحلة 5️⃣: التحقق من النظام

#### ✅ فحص قاعدة البيانات:
```sql
USE nawras_crm;
SELECT COUNT(*) FROM merchants;
SELECT COUNT(*) FROM tasks;
```

#### ✅ فحص Backend:
```bash
curl http://localhost:3000/api/tasks/today
```

#### ✅ فحص Frontend:
افتح المتصفح: `http://localhost:5173`

---

## 🌐 نشر على Netlify (Production)

### 1. إعداد الملفات للنشر:

```bash
# في المجلد الرئيسي
cp -r api/ netlify-deploy/
cp index.html netlify-deploy/
cp netlify.toml netlify-deploy/
```

### 2. رفع على GitHub:

```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/YOUR_USERNAME/nawras-crm.git
git push -u origin main
```

### 3. ربط مع Netlify:

1. اذهب إلى [Netlify](https://app.netlify.com/)
2. اضغط **"New site from Git"**
3. اختر **GitHub** → Repository الخاص بك
4. في **Build settings**:
   - Build command: (اتركه فارغ)
   - Publish directory: `.`

5. في **Environment variables**:
   - أضف: `NAWRAS_API_TOKEN = f651a69a2df9596088c524208de21d91d09457b9fc3e75bade2903390713f703`

6. اضغط **Deploy site**

---

## 🔧 استكشاف الأخطاء

### مشكلة: "Cannot connect to MySQL"
```bash
# تحقق من تشغيل MySQL
sudo systemctl status mysql

# ابدأ MySQL
sudo systemctl start mysql
```

### مشكلة: "Port 3000 already in use"
```bash
# غيّر PORT في .env
PORT=3001
```

### مشكلة: "npm install fails"
```bash
# امسح cache
npm cache clean --force
rm -rf node_modules package-lock.json
npm install
```

---

## 📞 الدعم

للمساعدة، راجع:
- 📚 `README-FULL.md` - الدليل الكامل
- 💾 `database-schema.sql` - تفاصيل قاعدة البيانات
- ⚙️ `state-machine-engine.js` - منطق النظام

---

**🎉 بالتوفيق! النظام الآن جاهز للعمل!**
