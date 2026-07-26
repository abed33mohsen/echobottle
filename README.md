# EchoBottle — رسالة في زجاجة

تطبيق Full Stack بسيط يتيح كتابة رسائل مجهولة، اكتشاف رسائل عشوائية، التفاعل معها، وحفظ المفضلة. يمكن للمستخدم إنشاء حساب اختياري لحفظ رسائله ومتابعتها.

## الميزات

- إرسال رسائل مجهولة مع مزاج وتوقيع اختياري.
- فتح زجاجات عشوائية بدون تكرار خلال الجلسة.
- تفاعلات وردود قصيرة على كل رسالة.
- تسجيل حساب أو تسجيل دخول عبر Supabase Auth.
- قسم **رسائلي** للحساب المسجّل، مع حذف رسائله فقط.
- مفضلة محفوظة لكل مستخدم.
- تخزين دائم باستخدام Supabase، مع ملف JSON محلي كبديل أثناء التطوير.

## التقنيات

- React + Vite
- Node.js + Express
- Supabase (PostgreSQL + Auth)
- CSS متجاوب بدون مكتبة واجهات خارجية

## التشغيل محليًا

### 1. تثبيت الحزم

```powershell
npm.cmd install
npm.cmd --prefix server install
```

### 2. إعداد المتغيرات

انسخ `.env.example` إلى `.env` ثم أضف إعدادات مشروع Supabase:

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SECRET_KEY=your-secret-key
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your-publishable-key
```

> لا ترفع ملف `.env` إلى GitHub، ولا تستخدم `SUPABASE_SECRET_KEY` في الواجهة.

### 3. إعداد قاعدة البيانات

من **Supabase → SQL Editor** شغّل الملفات التالية بالترتيب:

1. `server/supabase/schema.sql`
2. `server/supabase/auth.sql`

### 4. بدء التطبيق

```powershell
npm.cmd run dev:full
```

افتح الرابط الذي يظهر في الطرفية، غالبًا `http://localhost:5173`.

## أوامر مفيدة

```powershell
npm.cmd run build       # بناء نسخة الإنتاج
npm.cmd run lint        # فحص الواجهة
npm.cmd run dev:full    # الواجهة والخادم معًا
```

## API

| الطريقة | المسار | الاستخدام |
| --- | --- | --- |
| GET | `/api/messages` | جلب الرسائل |
| GET | `/api/messages/random` | فتح رسالة عشوائية |
| POST | `/api/messages` | إرسال رسالة |
| POST | `/api/messages/:id/reactions` | إضافة تفاعل |
| POST | `/api/messages/:id/replies` | إضافة رد |
| GET | `/api/messages/mine` | رسائل المستخدم المسجّل |
| GET/POST/DELETE | `/api/favorites` | إدارة المفضلة |

## التطوير القادم

- تعديل الرسائل قبل نشرها أو بعده.
- إشعارات للردود الجديدة.
- فلترة المحتوى والإبلاغ عن الرسائل.
- نشر الواجهة والخادم على الإنترنت.
