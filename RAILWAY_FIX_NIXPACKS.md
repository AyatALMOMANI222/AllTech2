# إصلاح خطأ Nixpacks في Railway

## المشكلة
```
error: undefined variable 'npm'
```

## السبب
`npm` لا يجب إضافته كحزمة منفصلة في `nixPkgs` لأنه يأتي تلقائياً مع `nodejs-18_x`.

## الحل المطبق

### 1. تحديث `backend/nixpacks.toml`:
- ✅ إزالة `npm` من قائمة `nixPkgs`
- ✅ الإبقاء على `nodejs-18_x` فقط

### 2. تبسيط `railway.json`:
- ✅ إزالة `buildCommand` (Nixpacks يتعامل معه تلقائياً)

### 3. إضافة `Procfile`:
- ✅ كبديل إضافي لـ Railway

## الخطوات التالية

### في Railway Dashboard:

1. **اذهب إلى Settings → Source**
2. **تأكد من:**
   - **Root Directory**: `backend` (مهم جداً!)
   - **Build Command**: اتركه فارغاً (سيستخدم nixpacks.toml)
   - **Start Command**: `npm start` أو اتركه فارغاً

3. **أعد المحاولة** - Railway سيعيد البناء تلقائياً بعد push

### رفع التحديثات:

```bash
git add .
git commit -m "Fix Nixpacks configuration - remove npm from nixPkgs"
git push
```

## ملاحظات

- ✅ `npm` يأتي تلقائياً مع Node.js - لا حاجة لإضافته
- ✅ تأكد من أن Root Directory = `backend`
- ✅ إذا استمرت المشكلة، جرب حذف Service وإنشاء واحد جديد

