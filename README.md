# streaming-backend

WebSocket relay for live Pi camera video. It never touches video pixels and
only writes `devices.last_seen_at` to the DB. Viewer authorization is delegated
to Spring Boot so JWT/session, role, yard and device rules have one source of
truth. Two endpoints:

- `ws://<host>:8100/ws/publish` — the Pi connects here (device auth via
  `X-Device-Id` / `X-Device-Key` headers, same scheme as `/api/detections`).
- `ws://<host>:8100/ws/view/:deviceId?token=<jwt>` — frontend clients connect
  here to watch a specific active device (JWT must belong to active `STAFF` or
  `YARD_OWNER` in the same yard).

## Setup

```bash
cd streaming-backend
npm install
cp .env.example .env
# edit .env: DB_* (same MySQL as Spring Boot) and BACKEND_BASE_URL
npm start
```

`DEVICE_ID` và `DEVICE_KEY` là bắt buộc khi chạy `fake_pi.js` hoặc
`pi_client/pi_stream.js`. Dùng ID và raw key do Backend trả về lúc tạo/rotate
camera; client sẽ dừng ngay nếu thiếu thay vì âm thầm dùng credential mẫu.

MySQL user only needs `SELECT` on `devices`, plus `UPDATE` on
`devices.last_seen_at`:

```sql
CREATE USER 'streaming_reader'@'%' IDENTIFIED BY 'change_me';
GRANT SELECT ON pos_db.devices TO 'streaming_reader'@'%';
GRANT UPDATE (last_seen_at) ON pos_db.devices TO 'streaming_reader'@'%';
```

## Protocol notes for the frontend

On connect to `/ws/view/:deviceId`, you'll immediately get one JSON text
frame:
```json
{"type": "device_status", "online": true}
```
Same message arrives again any time the Pi connects/disconnects. Every other
message on that socket is a **binary** frame — a raw H264 chunk, forward it
straight into your WebCodecs decoder, no parsing needed here.

Before accepting the WebSocket, the relay calls
`GET <BACKEND_BASE_URL>/api/devices/:deviceId/viewer-access` with the viewer's
bearer token. Both Backend and Stream Server must be running.

Bad/expired JWT, wrong role/yard, inactive account/device, or an unavailable
Backend rejects the HTTP upgrade before a WebSocket is created. A second live
viewer for the same account is accepted far enough to receive an
`account_busy` control message and is then closed with code `4001`.

## Known limitation (flagging, not fixing yet)

If a viewer connects mid-stream (not right when the Pi starts publishing),
WebCodecs may need to wait for the next H264 keyframe before it can start
decoding. For a short-lived camera-positioning preview this is a minor,
self-resolving delay (typically well under a second at default encoder
settings) and not worth the complexity of keyframe-on-demand right now —
worth revisiting only if it proves noticeable in practice.
