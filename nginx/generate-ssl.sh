#!/bin/bash
# ساخت گواهی خودامضا برای HTTPS روی شبکه محلی
# گواهی برای localhost و آی‌پی 192.168.100.121 صادر می‌شود تا از لپ‌تاپ و موبایل/دستگاه دیگر وصل شوی.

set -e
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SSL_DIR="$SCRIPT_DIR/ssl"
mkdir -p "$SSL_DIR"

# آی‌پی لپ‌تاپ روی شبکه (برای اتصال از موبایل/دستگاه دیگر)
LAN_IP="${LAN_IP:-192.168.100.121}"

openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout "$SSL_DIR/key.pem" \
  -out "$SSL_DIR/cert.pem" \
  -subj "/CN=$LAN_IP/O=Local/C=IR" \
  -addext "subjectAltName=DNS:localhost,IP:$LAN_IP,IP:127.0.0.1"

echo "✅ گواهی ساخته شد در: $SSL_DIR"
echo "   آدرس اتصال روی همین لپ‌تاپ: https://localhost"
echo "   آدرس اتصال از موبایل/دستگاه دیگر (همان وای‌فای): https://$LAN_IP"
