# EchoBottle — رسالة في زجاجة

تطبيق Full Stack ثنائي اللغة لمساحة رسائل مجهولة: اكتب رسالة قصيرة، أرسلها إلى البحر، واكتشف رسالة تركها شخص آخر. الحساب اختياري، ويضيف ملفًا شخصيًا ومفضلة وإشعارات ورسائل للمستقبل.

## المزايا الحالية

- رسائل مجهولة مع مزاج، توقيع اختياري، وردود وتفاعلات.
- اكتشاف عشوائي مع فلترة حسب المزاج ومنع التكرار أثناء الجلسة.
- **One Tide**: رسالة يفتحها شخص واحد فقط ثم تختفي.
- درجات ندرة للرسائل: عادية، مرجانية، ليلية، ذهبية، وأسطورية.
- تسجيل وإنشاء حساب عبر Supabase Auth.
- ملف شخصي يعرض رسائلي، الإحصاءات، المفضلة، وإشعارات الردود.
- رسائل مستقبلية يبقى محتواها مغلقًا حتى موعد الفتح.
- واجهة عربية وإنجليزية متجاوبة.
- تخزين Supabase في الوضع الكامل، مع ملف JSON محلي لتطوير الرسائل العامة وميزة One Tide.

## التقنيات

- React + Vite
- Node.js + Express
- Supabase (PostgreSQL + Auth)
- CSS متجاوب بدون مكتبة واجهات

## التشغيل محليًا

### 1. تثبيت الحزم

```powershell
npm.cmd install
npm.cmd --prefix server install
```

### 2. إعداد المتغيرات

انسخ `.env.example` إلى `.env` وأضف إعدادات Supabase:

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your-publishable-key
```

يقبل السيرفر أيضًا الاسم `SUPABASE_SECRET_KEY`. لا ترفع `.env` إلى GitHub، ولا تضع مفتاح الخدمة في متغير يبدأ بـ `VITE_`.

### 3. إعداد قاعدة البيانات

من **Supabase → SQL Editor** شغّل الملفين بالترتيب:

1. `server/supabase/schema.sql`
2. `server/supabase/auth.sql`

يمكن تشغيل `auth.sql` مجددًا بأمان عند تحديث المشروع. ينشئ جداول الحساب وميزة One Tide ويفعّل RLS على:

- `favorites`
- `profiles`
- `notifications`
- `future_letters`

رسائل المستقبل المقفلة لا يمكن قراءة محتواها عبر Data API قبل `unlock_at`.

### 4. بدء التطبيق

```powershell
npm.cmd run dev:full
```

ثم افتح `http://localhost:5173`.

## أوامر التحقق

```powershell
npm.cmd run build
npm.cmd run lint
node --env-file=../.env --check index.js
```

نفّذ الأمر الثالث من مجلد `server`.

## أهم مسارات API

| الطريقة | المسار | الاستخدام |
| --- | --- | --- |
| GET | `/api/messages` | الرسائل العامة دون `userId` أو رسائل One Tide |
| GET | `/api/messages/random` | فتح رسالة عشوائية وحجز One Tide مرة واحدة |
| POST | `/api/messages` | إرسال رسالة |
| POST | `/api/messages/:id/reactions` | إضافة تفاعل دون كشف صاحب الرسالة |
| POST | `/api/messages/:id/replies` | إضافة رد دون كشف صاحب الرسالة |
| GET | `/api/messages/mine` | رسائل المستخدم المسجل |
| GET/POST/DELETE | `/api/favorites` | إدارة المفضلة |
| GET/PATCH | `/api/profile` | الملف الشخصي |
| GET | `/api/notifications` | إشعارات الردود الجديدة |
| PATCH | `/api/notifications/:id/read` | تعليم الإشعار كمقروء |
| GET/POST | `/api/future-letters` | حفظ الرسائل المستقبلية وعرض حالتها |

## الخصوصية

- `userId` داخلي ولا يظهر في استجابات الرسائل العامة أو الإرسال أو التفاعل أو الرد.
- عمليات الحساب تمر عبر جلسة Supabase موثقة.
- مفتاح الخدمة يستخدم في السيرفر فقط.
- سياسات RLS تعزل بيانات كل مستخدم عن الآخرين.
