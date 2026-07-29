"use strict";

/*
 * Single-instance, in-memory stream router.
 *
 * publishers   : deviceId -> ws          (the Pi currently streaming that device)
 * viewers      : deviceId -> Set<ws>     (all frontend sockets watching that device)
 * viewerByAccount : accountId -> ws      (dedup: one live viewer connection per account)
 *
 * Kept behind this module's function API (not exported Maps) so that if this
 * ever needs to scale to multiple backend instances, the Maps can be swapped
 * for a Redis-backed implementation without touching the WS handler code.
 */

const publishers = new Map();
const viewers = new Map();
const viewerByAccount = new Map();

// ── Publisher side ────────────────────────────────────────────────────────

/**
 * Registers a new publisher for deviceId. If one already exists (stale
 * connection, reconnect after wifi blip, etc.), it is evicted first.
 * Returns the evicted socket (or null) so the caller can log/close it.
 */
function registerPublisher(deviceId, ws) {
  const existing = publishers.get(deviceId);
  publishers.set(deviceId, ws);
  return existing || null;
}

function unregisterPublisher(deviceId, ws) {
  // Only remove if it's still the same socket (avoid a late disconnect
  // event from an already-evicted socket wiping out a newer publisher).
  if (publishers.get(deviceId) === ws) {
    publishers.delete(deviceId);
    return true;
  }
  return false;
}

function getPublisher(deviceId) {
  return publishers.get(deviceId) || null;
}

function isPublisherLive(deviceId) {
  const ws = publishers.get(deviceId);
  return !!ws && ws.readyState === ws.OPEN;
}

// ── Viewer side ───────────────────────────────────────────────────────────

/**
 * Registers a viewer for deviceId under accountId.
 * If the account already has a live viewer connection anywhere, registration
 * is refused (caller should reject the new connection with "account_busy").
 */
function registerViewer(deviceId, accountId, ws) {
  const existing = viewerByAccount.get(accountId);
  if (existing && existing.readyState === existing.OPEN) {
    return { ok: false, reason: "account_busy" };
  }

  if (!viewers.has(deviceId)) {
    viewers.set(deviceId, new Set());
  }
  viewers.get(deviceId).add(ws);
  viewerByAccount.set(accountId, ws);
  return { ok: true };
}

function unregisterViewer(deviceId, accountId, ws) {
  const set = viewers.get(deviceId);
  if (set) {
    set.delete(ws);
    if (set.size === 0) viewers.delete(deviceId);
  }
  if (viewerByAccount.get(accountId) === ws) {
    viewerByAccount.delete(accountId);
  }
}

function getViewers(deviceId) {
  return viewers.get(deviceId) || new Set();
}

// ── Broadcast helpers ─────────────────────────────────────────────────────

/** Fan out a binary video chunk from a publisher to all its viewers. */
function broadcastBinary(deviceId, chunk) {
  const set = viewers.get(deviceId);
  if (!set || set.size === 0) return;
  for (const ws of set) {
    if (ws.readyState === ws.OPEN) {
      ws.send(chunk);
    }
  }
}

/** Fan out a small JSON control message (e.g. device_offline) to viewers. */
function broadcastControl(deviceId, messageObj) {
  const set = viewers.get(deviceId);
  if (!set || set.size === 0) return;
  const payload = JSON.stringify(messageObj);
  for (const ws of set) {
    if (ws.readyState === ws.OPEN) {
      ws.send(payload);
    }
  }
}

module.exports = {
  registerPublisher,
  unregisterPublisher,
  getPublisher,
  isPublisherLive,
  registerViewer,
  unregisterViewer,
  getViewers,
  broadcastBinary,
  broadcastControl,
};
