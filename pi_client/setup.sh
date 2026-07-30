#!/bin/bash
# Setup script cho Raspberry Pi 4 Camera Client

echo "==========================================="
echo "   Cài đặt Pi 4 Camera Streaming Client    "
echo "==========================================="

# 1. Cập nhật hệ thống
echo "[1/4] Đang cập nhật danh sách package..."
sudo apt-get update

# 2. Cài đặt NodeJS (nếu chưa có)
if ! command -v node &> /dev/null
then
    echo "[2/4] NodeJS chưa được cài đặt. Đang tiến hành cài đặt NodeJS v20..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt-get install -y nodejs
else
    echo "[2/4] NodeJS đã được cài đặt: $(node -v)"
fi

# 3. Cài đặt các thư viện Node.js cần thiết
echo "[3/4] Cài đặt dependencies (ws, dotenv)..."
npm install ws dotenv

# 4. Cài đặt PM2 để chạy ngầm và tự động khởi động cùng Pi
if ! command -v pm2 &> /dev/null
then
    echo "[4/4] Cài đặt PM2..."
    sudo npm install -g pm2
    # Cấu hình tự động khởi động PM2
    pm2 startup | grep "sudo env PATH" | bash
else
    echo "[4/4] PM2 đã được cài đặt."
fi

echo "==========================================="
echo "Cài đặt hoàn tất!"
echo "Bước tiếp theo:"
echo "1. Đổi tên file .env.example thành .env và điền IP Server."
echo "2. Chạy lệnh: pm2 start pi_stream.js --name camera_stream"
echo "3. Lưu tiến trình chạy ngầm: pm2 save"
echo "==========================================="
