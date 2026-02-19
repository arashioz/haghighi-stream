# SSL با nginx و رفع مشکل Real IP

## ۱. گرفتن SSL (گواهی واقعی)

برای اینکه مرورگر هشدار «اتصال امن نیست» یا «گواهی معتبر نیست» ندهد، از **Let's Encrypt** گواهی رایگان بگیر.

### پیش‌نیاز
- یک **دامنه** که با A رکورد به IP سرور اشاره کند (مثلاً `webinar.example.com` → IP سرور).
- nginx و certbot روی سرور نصب باشند.

### مراحل خلاصه

```bash
# نصب
sudo apt update && sudo apt install -y nginx certbot python3-certbot-nginx

# اپ را پشت nginx اجرا کن (بدون SSL روی خود Node)
cd /root/my-stream-video   # یا مسیر پروژه
BEHIND_PROXY=1 PORT=17443 node serve-https.mjs
# یا با pm2: BEHIND_PROXY=1 PORT=17443 pm2 start serve-https.mjs --name stream-app
```

یک فایل سایت nginx بساز (مثلاً `/etc/nginx/sites-available/stream-app`) با محتوای مشابه `nginx/nginx-letsencrypt.conf.example` و **YOUR_DOMAIN** را با دامنهٔ خودت عوض کن. بعد:

```bash
sudo ln -sf /etc/nginx/sites-available/stream-app /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx

# گرفتن گواهی (یک بار)
sudo certbot --nginx -d YOUR_DOMAIN
```

بعد از این، آدرس اپ: **https://YOUR_DOMAIN** و بدون هشدار SSL.

جزئیات بیشتر: [LETSENCRYPT.md](./LETSENCRYPT.md)

---

## ۲. رفع مشکل Real IP

وقتی nginx جلوی اپ است، درخواست‌ها از طرف `127.0.0.1` به Node می‌رسند. اگر بخواهی **IP واقعی کاربر** را در لاگ یا در اپ ببینی، باید nginx این IP را در هدر به backend بفرستد و در صورت نیاز خود nginx هم از هدر پروکسی بالا‌دست (مثل Cloudflare) IP واقعی را بخواند.

### در nginx

در بلوک `http` (بالای سرورها) اضافه کن:

```nginx
real_ip_header X-Forwarded-For;
set_real_ip_from 0.0.0.0/0;
```

یا اگر فقط از یک پروکسی مشخص (مثلاً Cloudflare) ترافیک می‌آید:

```nginx
real_ip_header CF-Connecting-IP;
set_real_ip_from 173.245.48.0/20;
# یا set_real_ip_from 0.0.0.0/0;
```

بعد در هر `location` که به Node پروکسی می‌کنی، همین هدرها کافی‌اند (معمولاً از قبل هست):

```nginx
proxy_set_header X-Real-IP $remote_addr;
proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
```

با این کار بعد از `real_ip_header`، متغیر `$remote_addr` در nginx همان IP واقعی کاربر است و همان مقدار در `X-Real-IP` به سرور Node فرستاده می‌شود.

نمونهٔ کامل در: `nginx/nginx-letsencrypt.conf.example`.
