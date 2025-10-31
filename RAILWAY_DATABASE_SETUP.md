# إعداد قاعدة البيانات في Railway

## تم إصلاح Route Not Found ✅

### التغييرات المطبقة:

1. ✅ إضافة route للصفحة الرئيسية `/`
2. ✅ دعم `DATABASE_URL` من Railway (Railway يوفر هذا تلقائياً)
3. ✅ تحديث CORS للسماح بجميع المنافذ

## متغيرات البيئة المطلوبة في Railway:

### في Service "AllTech2" → Variables:

#### الطريقة 1: استخدام DATABASE_URL (موصى به - Railway يوفرها تلقائياً):

1. في Railway Dashboard:
   - اذهب إلى MySQL Service → Variables
   - انسخ `DATABASE_URL` (يبدأ بـ `mysql://...`)
   
2. في Service "AllTech2" → Variables:
   - أضف `DATABASE_URL` = (القيمة المنسوخة من MySQL)
   - أو استخدم **Reference** في Railway لتوصيله تلقائياً

#### الطريقة 2: استخدام متغيرات منفصلة:

```
PORT=8000
DB_HOST=<mysql-host>
DB_PORT=3306
DB_USER=<mysql-user>
DB_PASSWORD=<mysql-password>
DB_NAME=management
FRONTEND_URL=https://your-frontend-url.railway.app
```

## كيفية توصيل MySQL بـ AllTech2 في Railway:

1. في Railway Dashboard:
   - اضغط على Service "AllTech2"
   - اضغط على **+ New** في قسم Variables
   - اختر **Reference**
   - اختر **MySQL** service
   - اختر `DATABASE_URL`
   - احفظ

## التحقق:

بعد رفع الكود، افتح في المتصفح:
- `https://your-app.railway.app/` → يجب أن ترى معلومات عن API
- `https://your-app.railway.app/api/health` → يجب أن ترى `{"status":"ok",...}`

## رفع التحديثات:

```bash
git add backend/server.js
git commit -m "Add root route and Railway DATABASE_URL support"
git push
```

