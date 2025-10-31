# إصلاح مشكلة Build في Railway

## المشكلة
Railway لا يستطيع بناء المشروع ويظهر خطأ: "Error creating build plan with Railpack"

## الحل

### 1. في Railway Dashboard:

1. اذهب إلى **Settings** → **Service**
2. في **Root Directory**، اكتب: `backend`
3. في **Build Command**، اكتب: `npm install`
4. في **Start Command**، اكتب: `node server.js`

أو:

### 2. استخدام ملفات التكوين:

تم إنشاء الملفات التالية:
- `railway.json` - إعدادات Railway
- `.railwayignore` - ملفات لتجاهلها
- `backend/nixpacks.toml` - إعدادات Nixpacks
- `Procfile` - أمر البدء

### 3. متغيرات البيئة المطلوبة في Railway:

تأكد من إضافة هذه المتغيرات في Railway → Variables:
- `DB_HOST`
- `DB_PORT`
- `DB_USER`
- `DB_PASSWORD`
- `DB_NAME`
- `PORT` (اختياري، Railway سيضيفه تلقائياً)
- `FRONTEND_URL` (URL الخاص بالـ Frontend)

## بعد التحديثات:

1. ارفع الملفات الجديدة إلى GitHub
2. Railway سيعيد البناء تلقائياً
3. تحقق من Logs للتأكد من نجاح البناء

