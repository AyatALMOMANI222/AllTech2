# إعداد Railway للمشروع

## المشكلة
خطأ: "Error creating build plan with Railpack"

## الحل المطبق

### 1. ملفات التكوين المضافة:
- ✅ `railway.json` - تكوين Railway الرئيسي
- ✅ `nixpacks.toml` - تكوين Nixpacks للبناء
- ✅ `backend/nixpacks.toml` - تكوين خاص بالـ backend

### 2. تحديثات في `server.js`:
- ✅ استخدام `process.env.PORT` بدلاً من المنفذ الثابت
- ✅ استخدام `process.env.FRONTEND_URL` للـ CORS

## إعدادات Railway المطلوبة

### في Railway Dashboard:

1. **اختر Service "AllTech2"**
2. اذهب إلى **Settings** → **Source**
3. تأكد من:
   - **Root Directory**: `backend` (أو اتركه فارغاً إذا كنت تستخدم railway.json)
   - **Build Command**: `cd backend && npm install`
   - **Start Command**: `cd backend && npm start`

### متغيرات البيئة المطلوبة:

في Railway → Variables، أضف:

```
PORT=8000
DB_HOST=<your-mysql-host>
DB_PORT=3306
DB_USER=<your-db-user>
DB_PASSWORD=<your-db-password>
DB_NAME=management
FRONTEND_URL=https://your-frontend-url.railway.app
```

## الخطوات التالية

1. **ارفع الملفات الجديدة إلى GitHub**:
```bash
git add railway.json nixpacks.toml backend/nixpacks.toml
git commit -m "Add Railway configuration files"
git push
```

2. **في Railway Dashboard**:
   - اذهب إلى Service Settings
   - تأكد من Root Directory = `backend` (أو اتركه فارغ)
   - أعد المحاولة

3. **بديل**: إذا لم يعمل، قم بـ:
   - حذف Service الحالي
   - إنشاء Service جديد
   - حدد GitHub repo
   - اختر Root Directory = `backend`

## ملاحظات

- إذا كان لديك frontend منفصل، أنشئ Service منفصل له
- تأكد من أن جميع متغيرات البيئة موجودة
- تحقق من Logs في Railway لمزيد من التفاصيل

