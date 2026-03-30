# 🦅 Al-Nawras CRM - The Merchant Growth & Retention Engine

## 📋 Project Overview

A state-driven CRM system powered by real-time API shipment data and scheduled human interactions.

---

## 🗂️ Project Structure

```
nawras-crm-pro/
├── database/
│   ├── schema.sql                 # Complete database schema
│   ├── migrations/                # Database migrations
│   └── seeds/                     # Sample data
├── backend/
│   ├── state-machine-engine.js    # Core state logic
│   ├── api/                       # REST API endpoints
│   ├── jobs/                      # Scheduled cron jobs
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── components/            # React components
│   │   ├── pages/                 # Dashboard pages
│   │   ├── services/              # API services
│   │   └── utils/                 # Helpers
│   ├── tailwind.config.js
│   └── package.json
└── README.md
```

---

## 🎯 State Machine Logic

### 1. **Onboarding Module**
- **Day 0:** Immediate task creation (30-min KPI tracked)
- **48h Filter:** No shipment → Auto-route to Retention
- **Scheduled Tasks:** Day 3, 10, 14 calls
- **Graduation:** Manual button after 14 days → moves to Active

### 2. **Active Module**
- **Monthly Survey:** 5 mandatory questions
- **Satisfaction Score:** Auto-calculated percentage
- **14-Day Trigger:** No shipments → Auto-route to Retention

### 3. **Retention Module**
- **3-Attempt Logic:** Call 1 (immediate), Call 2 (+10 days), Call 3 (+10 days)
- **Recovery:** If shipment detected → Return to Active
- **Failure:** After Call 3 → Manual move to Cold

---

## 💾 Database Schema Highlights

### Core Tables:
1. **merchants** - Central entity with state machine
2. **tasks** - Scheduled interactions
3. **call_logs** - Interaction history (mandatory Nawras Note)
4. **survey_responses** - 5-question satisfaction tracking
5. **state_transitions** - Complete audit trail
6. **kpi_metrics** - Manager dashboard data

### Views:
- `v_daily_tasks` - Today's work feed
- `v_overdue_immediate_response` - 30-min violations
- `v_graduation_ready` - Merchants eligible for graduation

### Stored Procedures:
- `sp_calculate_satisfaction` - Auto-calculate survey scores
- `sp_transition_state` - Handle all state changes with logging

---

## 📞 Embedded Scripts

### Day 0 (Immediate):
```
أهلاً خوي [الاسم]، نورت النورس. نبي نتأكد إن حسابك جاهز 
وهل محتاج أي مساعدة تقنية لتبدأ أول شحنة؟
```

### Day 3/10 (Follow-up):
```
أهلاً خوي [الاسم]، نتابعوا في شحناتك وحبينا نتأكدوا 
إن الخدمة تمام، وهل فيه أي ملاحظة نعدلوها ليك؟
```

### Retention:
```
خوي [الاسم]، معاك إدارة الجودة. لاحظنا توقف الشحن، 
هل فيه إشكالية فنية أو مالية نقدروا نحلوها ليك؟
```

---

## 🚀 Installation

### Prerequisites:
- Node.js 18+
- MySQL 8.0+
- npm or yarn

### Backend Setup:
```bash
cd backend
npm install
cp .env.example .env
# Edit .env with your database credentials
npm run migrate
npm run dev
```

### Frontend Setup:
```bash
cd frontend
npm install
npm run dev
```

---

## 📊 Manager Dashboard KPIs

### 1. **30-Minute Response Rate**
- Tracks percentage of Day 0 calls made within 30 minutes
- Red alert for violations
- Daily trend chart

### 2. **Satisfaction Score**
- Average across all monthly surveys
- Breakdown by question (Speed, Finance, Support, Returns, Trust)
- Merchant-level drill-down

### 3. **Retention Success Rate**
- Percentage of successful recoveries vs total attempts
- Funnel visualization (Attempt 1 → 2 → 3 → Success)

---

## 🎨 UI/UX Features

### Officer Dashboard:
- ✅ Dark mode toggle
- ✅ WhatsApp direct link on each merchant card
- ✅ Mandatory "Nawras Note" field (cannot submit without it)
- ✅ Tasks disappear after completion until next due date
- ✅ Priority color coding (Critical/High/Normal/Low)

### Manager Dashboard:
- ✅ Real-time KPI widgets
- ✅ State distribution pie chart
- ✅ 30-min response violations table
- ✅ Graduation queue
- ✅ Retention funnel analysis

---

## 🔄 Automated Jobs

### Hourly:
- Check 48-hour filter
- Sync API shipment data

### Daily:
- Check 14-day inactivity
- Calculate KPIs
- Generate daily task feed

---

## 🛠️ Tech Stack

**Backend:**
- Node.js + Express
- MySQL 8.0
- node-cron (scheduled jobs)
- mysql2 (database driver)

**Frontend:**
- React 18
- Tailwind CSS
- Axios (API calls)
- React Query (data fetching)
- Recharts (visualizations)

---

## 📝 API Endpoints

### Merchants:
- `GET /api/merchants` - List all with filters
- `GET /api/merchants/:id` - Single merchant detail
- `POST /api/merchants` - Create new (from API sync)
- `PATCH /api/merchants/:id/graduate` - Move to active
- `PATCH /api/merchants/:id/state` - Manual state change

### Tasks:
- `GET /api/tasks/today` - Daily feed
- `GET /api/tasks/:id` - Task detail
- `PATCH /api/tasks/:id/complete` - Mark complete with call log

### Calls:
- `POST /api/calls` - Log a call (mandatory note)
- `POST /api/surveys` - Submit satisfaction survey

### KPIs:
- `GET /api/kpis/dashboard` - Manager dashboard data
- `GET /api/kpis/30min-response` - Current violations

---

## 🧪 Testing

```bash
# Backend
npm test

# Frontend
npm test

# E2E
npm run test:e2e
```

---

## 📦 Deployment

### Production Checklist:
1. Set up MySQL database
2. Run migrations: `npm run migrate:prod`
3. Configure environment variables
4. Set up cron jobs on server
5. Build frontend: `npm run build`
6. Deploy to hosting (Vercel/Netlify for frontend, Node server for backend)

---

## 🔐 Security

- All API endpoints require authentication
- Role-based access control (Officer/Manager/Admin)
- SQL injection prevention via parameterized queries
- XSS protection in React
- CORS properly configured

---

## 📞 Support

For questions or issues, contact the development team at dev@nawras.com

---

**Built with ❤️ for Al-Nawras**
