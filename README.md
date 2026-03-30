# نظام النورس لإدارة المتاجر - دليل النشر

## 📦 محتويات المشروع

```
nawras-crm/
├── index.html              # الواجهة الأمامية الكاملة
├── api/                    # Serverless Functions
│   ├── new-customers.js    # API المتاجر الجديدة
│   ├── inactive-customers.js  # API المتاجر الخاملة
│   └── orders-summary.js   # API إحصائيات الطرود
├── vercel.json            # إعدادات Vercel
├── package.json           # معلومات المشروع
└── README.md             # هذا الملف
```

---

## 🚀 طريقة 1: النشر على Vercel (الأسهل والأسرع)

### الخطوات:

1. **إنشاء حساب Vercel**
   - اذهب إلى: https://vercel.com/signup
   - سجل باستخدام GitHub أو Google أو Email

2. **تحميل الملفات إلى GitHub**
   - أنشئ repository جديد على GitHub
   - ارفع جميع الملفات (index.html, api/, vercel.json, package.json)

3. **ربط Vercel مع GitHub**
   - اذهب إلى Vercel Dashboard
   - اضغط "New Project"
   - اختر الـ Repository الخاص بك
   - اضغط "Import"

4. **إضافة الـ API Token**
   - في صفحة الإعدادات، اذهب لـ "Environment Variables"
   - أضف متغير جديد:
     ```
     Key: NAWRAS_API_TOKEN
     Value: f651a69a2df9596088c524208de21d91d09457b9fc3e75bade2903390713f703
     ```

5. **النشر**
   - اضغط "Deploy"
   - انتظر دقيقة واحدة
   - ✅ موقعك جاهز!

---

## 🌐 طريقة 2: النشر على Netlify

### الخطوات:

1. **إنشاء حساب Netlify**
   - اذهب إلى: https://netlify.com
   - سجل باستخدام GitHub

2. **تعديل بسيط للملفات**
   - أعد تسمية مجلد `api/` إلى `netlify/functions/`
   - أو استخدم ملف `netlify.toml`:
   ```toml
   [build]
     functions = "api"
   
   [[redirects]]
     from = "/api/*"
     to = "/.netlify/functions/:splat"
     status = 200
   ```

3. **رفع المشروع**
   - اضغط "Add new site" → "Import from Git"
   - اختر الـ Repository
   - ستُنشر تلقائياً

4. **إضافة الـ API Token**
   - اذهب لـ "Site settings" → "Environment variables"
   - أضف:
     ```
     NAWRAS_API_TOKEN=f651a69a2df9596088c524208de21d91d09457b9fc3e75bade2903390713f703
     ```

---

## 🔧 التشغيل المحلي (للتطوير)

### المتطلبات:
- Node.js (تحميل من: nodejs.org)

### الخطوات:

1. **تثبيت Vercel CLI**
   ```bash
   npm install -g vercel
   ```

2. **تشغيل السيرفر المحلي**
   ```bash
   cd nawras-crm
   vercel dev
   ```

3. **فتح المتصفح**
   ```
   http://localhost:3000
   ```

---

## 📝 الميزات

### ✅ ما يعمل الآن:
- ✅ سحب بيانات المتاجر الجديدة من API
- ✅ سحب بيانات المتاجر الخاملة من API
- ✅ سحب إحصائيات الطرود من API
- ✅ حفظ الملاحظات محلياً (localStorage)
- ✅ لوحة تحكم شاملة
- ✅ تصنيف المتاجر تلقائياً
- ✅ واجهة عربية كاملة

### 🔄 للمستقبل:
- حفظ الملاحظات في API (يحتاج endpoint جديد)
- نظام تسجيل الدخول
- تقارير مفصلة

---

## 🔐 الأمان

- ✅ الـ API Token مخزن في متغيرات البيئة (Environment Variables)
- ✅ لا يظهر في الكود المرئي للمستخدم
- ✅ Serverless Functions تعمل كـ Proxy آمن

---

## 🐛 حل المشاكل

### المشكلة: "Failed to fetch"
**الحل:** تأكد من:
1. رفع المشروع على Vercel/Netlify (لن يعمل من ملف محلي)
2. إضافة الـ API Token في Environment Variables
3. التواريخ في الطلبات صحيحة

### المشكلة: "404 Not Found"
**الحل:** تأكد من:
1. ملفات الـ API موجودة في مجلد `api/`
2. ملف `vercel.json` موجود
3. أعد النشر

---

## 📞 الدعم

للأسئلة أو المساعدة:
- راجع التوثيق: https://vercel.com/docs
- تحقق من الـ Logs في Dashboard

---

## 🎉 خطوات سريعة (ملخص)

1. حمّل الملفات على GitHub
2. اذهب إلى vercel.com
3. اضغط "New Project"
4. اختر الـ Repo
5. أضف Environment Variable (NAWRAS_API_TOKEN)
6. Deploy!
7. ✅ موقعك شغال!

**الوقت المتوقع: 5 دقائق فقط!** 🚀
