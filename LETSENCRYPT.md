# گرفتن HTTPS واقعی با Let's Encrypt

برای دامنهٔ خودت (مثلاً `stream.example.com`) می‌توانی گواهی رایگان Let's Encrypt بگیری و مرورگر بدون هشدار اتصال امن نشان دهد.

## پیش‌نیاز

- یک **دامنه** که به IP سرور تو **A رکورد** داشته باشد (مثلاً `stream.example.com` → `185.231.112.84`)
- **nginx** و **certbot** روی سرور نصب باشند

## مراحل روی سرور (مثلاً اوبونتو)

### ۱. نصب nginx و certbot

```bash
sudo apt update
sudo apt install -y nginx certbot python3-certbot-nginx
```

### ۲. اول سرور Node را پشت nginx اجرا کن (بدون SSL روی خود Node)

اپ را در حالت «پشت nginx» اجرا کن تا فقط روی localhost گوش بدهد (بدون SSL روی خود Node؛ SSL را nginx با Let's Encrypt می‌گیرد):

```bash
cd /root/my-stream-video
npm run build
BEHIND_PROXY=1 PORT=17443 node serve-https.mjs
```

یا با pm2 برای همیشه روشن ماندن:

```bash
cd /root/my-stream-video
BEHIND_PROXY=1 PORT=17443 pm2 start serve-https.mjs --name stream-app
pm2 save && pm2 startup
```

### ۳. کانفیگ nginx برای دامنه و پروکسی

یک فایل سایت بساز (دامنه را عوض کن):

```bash
sudo nano /etc/nginx/sites-available/stream-app
```

محتوا (به‌جای `stream.example.com` دامنهٔ خودت را بگذار):

```nginx
map $http_upgrade $connection_upgrade {
    default upgrade;
    ''      close;
}

server {
    listen 80;
    server_name stream.example.com;

    location /.well-known/acme-challenge/ {
        root /var/www/html;
        try_files $uri =404;
    }

    location / {
        proxy_pass http://127.0.0.1:17443;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection $connection_upgrade;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 86400;
    }
}
```

فعالش کن:

```bash
sudo ln -sf /etc/nginx/sites-available/stream-app /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

### ۴. گرفتن گواهی Let's Encrypt

```bash
sudo certbot --nginx -d stream.example.com
```

ایمیل بده، قوانین را بپذیر؛ certbot خودش nginx را طوری عوض می‌کند که روی ۴۴۳ با گواهی سرو بدهد و ترافیک را به همان `proxy_pass` هدایت کند.

### ۵. تمدید خودکار

Let's Encrypt هر ۹۰ روز منقضی می‌شود. تمدید خودکار معمولاً با cron نصب می‌شود:

```bash
sudo certbot renew --dry-run
```

اگر خطا نداد، همان دستور به‌صورت دوره‌ای اجرا می‌شود و گواهی تمدید می‌شود.

---

## خلاصه

| مرحله | کار |
|--------|-----|
| ۱ | دامنه را به IP سرور اشاره بده (A رکورد) |
| ۲ | nginx + certbot نصب کن |
| ۳ | اپ را با `BEHIND_PROXY=1` اجرا کن (مثلاً روی پورت ۱۷۴۴۳) |
| ۴ | کانفیگ nginx را برای دامنه و پروکسی به ۱۲۷.۰.۰.۱:۱۷۴۴۳ بگذار |
| ۵ | `certbot --nginx -d دامنه` را اجرا کن |

بعد از این، آدرس نهایی اپ: **https://stream.example.com** (بدون هشدار SSL).
