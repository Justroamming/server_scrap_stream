# streaming-backend

WebSocket relay for live Pi camera video. Pure byte relay — never touches
video pixels, never talks to Spring Boot, never writes to the DB except
`last_seen_at`. Two endpoints:

- `ws://<host>:8100/ws/publish` — the Pi connects here (device auth via
  `X-Device-Id` / `X-Device-Key` headers, same scheme as `/api/detections`).
- `ws://<host>:8100/ws/view/:deviceId?token=<jwt>` — frontend clients connect
  here to watch a specific device (JWT must belong to an account in the same
  yard as the device).

## Setup

```bash
cd streaming-backend
npm install
cp .env.example .env
# edit .env: DB_* (same MySQL as Spring Boot), JWT_SECRET (must match
# Spring Boot's jwt.secret exactly)
npm install
npm start
```

MySQL user only needs `SELECT` on `devices` and `accounts`, plus `UPDATE` on
`devices.last_seen_at`:

```sql
CREATE USER 'streaming_reader'@'%' IDENTIFIED BY 'change_me';
GRANT SELECT ON scrap_detection.devices TO 'streaming_reader'@'%';
GRANT SELECT ON scrap_detection.accounts TO 'streaming_reader'@'%';
GRANT UPDATE (last_seen_at) ON scrap_detection.devices TO 'streaming_reader'@'%';
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

If the connection is rejected (bad/expired JWT, wrong yard, or the account
already has a live viewer connection elsewhere), the server closes with a
non-1000 code and a short reason string (`account_busy`, `yard_mismatch`,
`invalid_token`, etc.) — check the WS close event's `reason` field.

## Known limitation (flagging, not fixing yet)

If a viewer connects mid-stream (not right when the Pi starts publishing),
WebCodecs may need to wait for the next H264 keyframe before it can start
decoding. For a short-lived camera-positioning preview this is a minor,
self-resolving delay (typically well under a second at default encoder
settings) and not worth the complexity of keyframe-on-demand right now —
worth revisiting only if it proves noticeable in practice.
