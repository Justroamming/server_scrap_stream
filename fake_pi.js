/**
 * fake_pi.js - Giả lập Pi gửi H.264 stream lên Streaming Server
 * Chạy: node fake_pi.js
 * Yêu cầu: ffmpeg cài sẵn trong PATH
 *
 * Cấu hình: Sửa các biến dưới đây trong file .env trước khi chạy
 *   SERVER_HOST → IP LAN của máy đang chạy server này
 *     Windows : chạy `ipconfig`  → tìm dòng "IPv4 Address"
 *     Mac/Linux: chạy `ifconfig` → tìm dòng "inet"
 *   DEVICE_ID  → device_id trong bảng `devices` của DB
 *   DEVICE_KEY → raw key (trước khi hash) của device đó
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

console.log(`[fake-pi] Connecting to ${SERVER_URL}`);
console.log(`[fake-pi] Device ID: ${DEVICE_ID}`);

const ws = new WebSocket(SERVER_URL, {
  headers: {
    "X-Device-Id":  DEVICE_ID,
    "X-Device-Key": DEVICE_KEY,
  },
});

ws.on("open", () => {
  console.log("[fake-pi] Connected! Starting ffmpeg...");

  const ffmpeg = spawn("ffmpeg", [
    // --- Nguồn video: test pattern màu sắc (không cần camera thật) ---
    "-f", "lavfi",
    "-i", "testsrc=size=640x480:rate=15",

    // Nếu có webcam thật trên Windows, thay bằng 2 dòng sau:
    // "-f", "dshow", "-i", "video=<tên webcam>",
    // Lấy tên webcam: ffmpeg -list_devices true -f dshow -i dummy

    // --- Encode H.264 ---
    "-c:v", "libx264",
    "-preset", "ultrafast",
    "-tune", "zerolatency",
    "-b:v", "500k",
    "-f", "h264",
    "pipe:1",
  ], { stdio: ["ignore", "pipe", "pipe"] });

  ffmpeg.stdout.on("data", (chunk) => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(chunk);
    }
  });

  ffmpeg.on("close", (code) => {
    console.log(`[fake-pi] ffmpeg exited with code ${code}`);
    ws.close();
  });

  ws.on("close", () => {
    console.log("[fake-pi] WebSocket closed");
    ffmpeg.kill("SIGTERM");
  });
});

ws.on("error", (err) => {
  console.error("[fake-pi] WebSocket error:", err.message);
  console.error("[fake-pi] Tip: Kiểm tra lại SERVER_HOST trong .env có đúng IP chưa?");
});
