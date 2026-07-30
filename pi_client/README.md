# Raspberry Pi 4 Camera Client

Thư mục này chứa toàn bộ code để biến chiếc Raspberry Pi 4 (có gắn Camera CSI dạng dây cáp dẹt) thành một thiết bị truyền phát video H.264 thời gian thực lên máy chủ Node.js của chúng ta.

> Kịch bản này được tối ưu riêng cho **Raspberry Pi OS phiên bản Bookworm** hoặc **Bullseye** sử dụng lõi `libcamera` (thay thế cho hệ thống `raspivid` cũ).

---

## 🛠 Hướng dẫn Cài đặt & Chạy trên Pi 4

Bạn cần copy toàn bộ thư mục `pi_client` này sang máy Raspberry Pi 4 của bạn (có thể dùng FileZilla, WinSCP, hoặc đẩy lên Github rồi pull về Pi).
Sau khi copy xong, mở Terminal trên Raspberry Pi và thực hiện các bước sau:

### Bước 1: Khởi tạo phần mềm
```bash
# Di chuyển vào thư mục pi_client
cd pi_client

# Cấp quyền thực thi cho file cài đặt
chmod +x setup.sh

# Chạy file cài đặt tự động
./setup.sh
```

### Bước 2: Cấu hình IP
Máy tính chạy `server_scrap_stream` của bạn (PC hoặc Laptop) đang nằm trong cùng mạng Wi-Fi/LAN với Raspberry Pi. Bạn cần khai báo IP đó cho Pi biết.

```bash
# Tạo file cấu hình từ file mẫu
cp .env.example .env

# Sửa file .env (Sử dụng nano hoặc bất kỳ trình soạn thảo nào)
nano .env
```
Thay đổi `SERVER_HOST` thành địa chỉ IP máy tính của bạn (VD: `192.168.1.5`).

### Bước 3: Chạy Camera
Để tránh việc script tắt khi bạn tắt Terminal, chúng ta sẽ dùng PM2 (đã được cài ở Bước 1) để chạy ngầm và tự động bật khi Pi khởi động lại.

```bash
# Chạy script bằng pm2
pm2 start pi_stream.js --name camera_stream

# Lưu cấu hình pm2 để tự bật khi Pi restart
pm2 save
```

### Xử lý sự cố
- **Kiểm tra Camera đã nhận chưa:** Chạy lệnh `libcamera-hello`. Nếu thấy camera nhá đèn hoặc hiện khung hình là phần cứng đã kết nối tốt.
- **Xem log lỗi của stream:** Chạy lệnh `pm2 logs camera_stream`.
- **Nếu báo lỗi WebSocket error:** Kiểm tra lại địa chỉ IP trong file `.env` và tường lửa (Firewall) trên máy tính chạy server xem có chặn cổng `8100` không.
