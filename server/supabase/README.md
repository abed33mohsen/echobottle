# ربط Supabase

1. أنشئ مشروعًا من لوحة Supabase.
2. افتح **SQL Editor** والصق محتوى `schema.sql` ثم نفّذه.
3. انسخ `.env.example` إلى `.env` في جذر المشروع.
4. أضف `SUPABASE_URL` و`SUPABASE_SERVICE_ROLE_KEY` من **Settings → API**.

لا تستخدم مفتاح `service_role` في الواجهة أو في مستودع Git؛ سيُستخدم من خادم Express فقط.
