/**
 * pi_stream.js - Script chạy trên Raspberry Pi 4 (Bookworm) với Camera CSI
 * 
 * Yêu cầu:
 * - Pi 4 đang chạy Raspberry Pi OS (Bullseye hoặc Bookworm)
 * - Camera CSI đã được cắm và bật (đã test `libcamera-hello`)
 * - Đã cài đặt NodeJS và package `ws` (`npm install ws dotenv`)
 *
 * Cấu hình bằng file .env:
 * SERVER_HOST=192.168.1.x (IP của máy tính chạy server_scrap_stream)
 * PORT=8100
 * DEVICE_ID=1
 * DEVICE_KEY=<raw-key-from-backend>
 */

require("dotenv").config();
const WebSocket = require("ws");
const { spawn } = require("child_process");

function required(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}

const SERVER_HOST = required("SERVER_HOST");
const PORT        = process.env.PORT        || "8100";
const DEVICE_ID   = required("DEVICE_ID");
const DEVICE_KEY  = required("DEVICE_KEY");

const SERVER_URL = `ws://${SERVER_HOST}:${PORT}/ws/publish`;

console.log(`[pi-camera] Connecting to ${SERVER_URL}`);
console.log(`[pi-camera] Device ID: ${DEVICE_ID}`);

let reconnectTimer;
let cameraProcess;

function connect() {
  const ws = new WebSocket(SERVER_URL, {
    headers: {
      "X-Device-Id":  DEVICE_ID,
      "X-Device-Key": DEVICE_KEY,
    },
  });

  ws.on("open", () => {
    console.log("[pi-camera] Connected to Server! Starting libcamera-vid...");

    // Dùng libcamera-vid (chuyên dụng cho Pi 4 + Bullseye/Bookworm + CSI Camera)
    // -t 0 : chạy vô thời hạn
    // --inline : chèn SPS/PPS headers vào stream H.264 (cần thiết cho WebCodecs ở Frontend)
    // --codec h264 : encode h264
    // --width 640 --height 480 : độ phân giải
    // --framerate 15 : số khung hình/giây
    // --profile baseline : cấu hình h264 phù hợp độ trễ thấp
    // -o - : xuất raw H.264 ra stdout
    cameraProcess = spawn("libcamera-vid", [
      "-t", "0",
      "--inline",
      "--codec", "h264",
      "--width", "640",
      "--height", "480",
      "--framerate", "15",
      "--profile", "baseline",
      "--nopreview",
      "-o", "-"
    ]);

    cameraProcess.stdout.on("data", (chunk) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(chunk);
      }
    });

    cameraProcess.stderr.on("data", (data) => {
      // libcamera thường in log ra stderr, có thể comment dòng dưới nếu log quá nhiều
      // console.log(`[libcamera]: ${data}`);
    });

    cameraProcess.on("close", (code) => {
      console.log(`[pi-camera] libcamera-vid exited with code ${code}`);
      if (ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
    });
  });

  ws.on("close", () => {
    console.log("[pi-camera] WebSocket closed. Retrying in 5s...");
    if (cameraProcess) {
      cameraProcess.kill("SIGTERM");
      cameraProcess = null;
    }
    clearTimeout(reconnectTimer);
    reconnectTimer = setTimeout(connect, 5000);
  });

  ws.on("error", (err) => {
    console.error("[pi-camera] WebSocket error:", err.message);
  });
}

// Bắt đầu kết nối
connect();

// Dọn dẹp tiến trình khi bị thoát (Ctrl+C hoặc PM2 restart)
process.on("SIGINT", () => {
  if (cameraProcess) cameraProcess.kill("SIGTERM");
  process.exit();
});
process.on("SIGTERM", () => {
  if (cameraProcess) cameraProcess.kill("SIGTERM");
  process.exit();
});
