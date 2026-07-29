"use strict";

const registry = require("./registry");
const { touchLastSeen } = require("./auth/deviceAuth");

/**
 * Called once a Pi's /ws/publish connection has already passed device auth.
 * From here on this socket is treated as a dumb binary source: every binary
 * WS frame it sends is fanned out verbatim to that device's viewers. No
 * inspection, no buffering, no repacking — keeps latency minimal.
 */
function handlePublisherConnection(ws, device) {
  const deviceId = device.device_id;

  const evicted = registry.registerPublisher(deviceId, ws);
  if (evicted) {
    console.log(`[publish] device ${deviceId}: evicting stale publisher connection (new connection took over)`);
    try {
      evicted.close(4000, "replaced_by_new_connection");
    } catch (err) {
      console.error(`[publish] error closing evicted socket for device ${deviceId}:`, err.message);
    }
  }

  console.log(`[publish] device ${deviceId} (${device.device_name}) connected`);
  touchLastSeen(deviceId);

  // Let any already-connected viewers know the camera is back.
  registry.broadcastControl(deviceId, { type: "device_status", online: true });

  ws.on("message", (data, isBinary) => {
    if (!isBinary) {
      // Publishers aren't expected to send text frames; ignore anything
      // that isn't a raw H264 chunk.
      return;
    }
    registry.broadcastBinary(deviceId, data);
  });

  ws.on("close", (code, reasonBuf) => {
    const wasActive = registry.unregisterPublisher(deviceId, ws);
    if (wasActive) {
      console.log(`[publish] device ${deviceId} disconnected (code=${code})`);
      registry.broadcastControl(deviceId, { type: "device_status", online: false });
    }
    // If wasActive is false, this was an already-evicted stale socket
    // finally closing — nothing to broadcast, the new publisher is live.
  });

  ws.on("error", (err) => {
    console.error(`[publish] device ${deviceId} socket error:`, err.message);
  });
}

/**
 * Called once a frontend's /ws/view/:deviceId connection has already passed
 * JWT + yard-match auth.
 */
function handleViewerConnection(ws, deviceId, accountId) {
  const result = registry.registerViewer(deviceId, accountId, ws);

  if (!result.ok) {
    ws.send(JSON.stringify({ type: "error", reason: result.reason }));
    ws.close(4001, result.reason);
    return;
  }

  console.log(`[view] account ${accountId} watching device ${deviceId}`);

  // Tell the viewer immediately whether the camera is currently live, so
  // the frontend can show "camera offline" right away instead of a blank
  // waiting state.
  ws.send(JSON.stringify({ type: "device_status", online: registry.isPublisherLive(deviceId) }));

  ws.on("close", () => {
    registry.unregisterViewer(deviceId, accountId, ws);
    console.log(`[view] account ${accountId} stopped watching device ${deviceId}`);
  });

  ws.on("error", (err) => {
    console.error(`[view] account ${accountId} socket error:`, err.message);
  });
}

module.exports = { handlePublisherConnection, handleViewerConnection };
