# إصلاح Triggers لفواتير الشراء الضريبية

## المشكلة
بعد إزالة القيد UNIQUE من `po_number` في جدول `purchase_orders`، أصبح من الممكن وجود أكثر من purchase order بنفس الرقم (customer PO و supplier PO). 

الـ triggers الموجودة في قاعدة البيانات تستخدم استعلام:
```sql
SELECT po.id, po.po_number INTO po_id_var, po_number_var
FROM purchase_tax_invoices pt
INNER JOIN purchase_orders po ON pt.po_number = po.po_number
WHERE pt.id = NEW.invoice_id;
```

هذا الاستعلام قد يعيد أكثر من صف واحد، مما يسبب الخطأ:
```
ER_TOO_MANY_ROWS: Result consisted of more than one row
```

## الحل
تم تحديث الـ triggers لإضافة:
1. فلتر `AND po.order_type = 'supplier'` - لاختيار supplier PO فقط
2. `LIMIT 1` - لضمان صف واحد فقط

## كيفية التطبيق

### الطريقة 1: استخدام MySQL Command Line
```bash
mysql -u root -p management < backend/fix_purchase_invoice_triggers.sql
```

### الطريقة 2: استخدام MySQL Workbench أو أي أداة SQL
1. افتح ملف `backend/fix_purchase_invoice_triggers.sql`
2. انسخ المحتوى
3. الصقه في MySQL Workbench
4. نفذ الاستعلام

### الطريقة 3: استخدام Node.js Script
```bash
node -e "const mysql = require('mysql2/promise'); const fs = require('fs'); (async () => { const conn = await mysql.createConnection({host: 'localhost', user: 'root', password: 'YOUR_PASSWORD', database: 'management'}); const sql = fs.readFileSync('backend/fix_purchase_invoice_triggers.sql', 'utf8'); await conn.query(sql); console.log('Triggers fixed successfully!'); await conn.end(); })();"
```

## التحقق من الإصلاح
بعد تطبيق الإصلاح، جرب إنشاء فاتورة شراء ضريبية مرة أخرى. يجب أن تعمل بدون أخطاء.

## ملاحظات
- هذا الإصلاح لا يؤثر على البيانات الموجودة
- الـ triggers ستعمل فقط مع supplier POs (order_type = 'supplier')
- هذا متوافق مع التغييرات السابقة لإزالة UNIQUE constraint

