# Changelog

Tất cả các thay đổi đáng chú ý của dự án **RECLICK Server Scrap Stream (Node.js)** sẽ được ghi chép tại file này.
Định dạng file dựa trên tiêu chuẩn [Keep a Changelog](https://keepachangelog.com/vi/1.0.0/), và dự án này tuân thủ [Semantic Versioning](https://semver.org/).

## [Unreleased]
### Changed
- **Viewer authorization**: Stream Server delegates JWT/session, role, yard and active-device checks to the Spring Backend through `GET /api/devices/{deviceId}/viewer-access`; `JWT_SECRET` is no longer duplicated in this service.
- **Device client configuration**: Pi and fake-Pi clients now require explicit `SERVER_HOST`, `DEVICE_ID` and `DEVICE_KEY` values and no longer fall back to a sample credential.

### Added
- **Script Giả Lập Raspberry Pi (`fake_pi.js`)**: Tạo script mô phỏng thiết bị Pi truyền luồng video H.264 qua WebSocket và gửi dữ liệu nhận diện rác thải phục vụ việc testing.
- **Biến môi trường mẫu (`.env.example`)**: Bổ sung file cấu hình mẫu cho server streaming.
- **Client Thực Tế cho Raspberry Pi 4 (`pi_client/pi_stream.js`)**: Tích hợp phần cứng Raspberry Pi 4 thật (sử dụng lệnh `libcamera-vid` của hệ điều hành Bookworm) để gửi H.264 qua phần cứng mã hóa (Hardware Encoding).
- **Bộ Cài Đặt Tự Động (`pi_client/setup.sh`)**: Script một-chạm để cấu hình NodeJS, WebSocket, PM2 cho chiếc Pi.

