"use strict";

const http = require("http");
const { URL } = require("url");
const { WebSocketServer } = require("ws");

const config = require("./config");
const { authenticateDevice } = require("./auth/deviceAuth");
const { authenticateViewer } = require("./auth/jwtAuth");
const { handlePublisherConnection, handleViewerConnection } = require("./wsHandlers");

const DEVICE_ID_HEADER = "x-device-id"; // node lower-cases incoming header names
const DEVICE_KEY_HEADER = "x-device-key";

const VIEW_PATH_RE = /^\/ws\/view\/(\d+)\/?$/;

const httpServer = http.createServer((req, res) => {
  // Plain health check — lets you curl the box to confirm it's alive
  // without needing a WS client.
  res.writeHead(200, { "Content-Type": "text/plain" });
  res.end("streaming-backend ok\n");
});

// Two separate WebSocketServer instances in "noServer" mode: we do our own
// auth during the raw HTTP upgrade (so we can reject with a proper status
// code before a WS handshake ever completes), then hand off to whichever
// one matches.
const publisherWss = new WebSocketServer({ noServer: true });
const viewerWss = new WebSocketServer({ noServer: true });

function rejectUpgrade(socket, statusCode, reasonText) {
  socket.write(`HTTP/1.1 ${statusCode} ${reasonText}\r\n\r\n`);
  socket.destroy();
}

httpServer.on("upgrade", async (req, socket, head) => {
  let url;
  try {
    url = new URL(req.url, `http://${req.headers.host}`);
  } catch (err) {
    return rejectUpgrade(socket, 400, "Bad Request");
  }

  // ── Pi publisher ─────────────────────────────────────────────────────
  if (url.pathname === "/ws/publish") {
    const deviceId = req.headers[DEVICE_ID_HEADER];
    const deviceKey = req.headers[DEVICE_KEY_HEADER];

    if (!deviceId || !deviceKey) {
      console.log("[publish] rejected: missing X-Device-Id/X-Device-Key headers");
      return rejectUpgrade(socket, 401, "Unauthorized");
    }

    const result = await authenticateDevice(deviceId, deviceKey);
    if (!result.ok) {
      console.log(`[publish] rejected device ${deviceId}: ${result.reason}`);
      return rejectUpgrade(socket, 401, "Unauthorized");
    }

    publisherWss.handleUpgrade(req, socket, head, (ws) => {
      handlePublisherConnection(ws, result.device);
    });
    return;
  }

  // ── Frontend viewer ──────────────────────────────────────────────────
  const viewMatch = url.pathname.match(VIEW_PATH_RE);
  if (viewMatch) {
    const deviceId = viewMatch[1];
    const token = url.searchParams.get("token");

    const result = await authenticateViewer(token, deviceId);
    if (!result.ok) {
      console.log(`[view] rejected connection to device ${deviceId}: ${result.reason}`);
      return rejectUpgrade(socket, 401, "Unauthorized");
    }

    viewerWss.handleUpgrade(req, socket, head, (ws) => {
      handleViewerConnection(ws, result.deviceId, result.accountId);
    });
    return;
  }

  return rejectUpgrade(socket, 404, "Not Found");
});

httpServer.listen(config.port, () => {
  console.log(`[server] streaming-backend listening on :${config.port}`);
  console.log(`[server]   publisher endpoint: ws://<host>:${config.port}/ws/publish`);
  console.log(`[server]   viewer endpoint:     ws://<host>:${config.port}/ws/view/:deviceId?token=...`);
});
