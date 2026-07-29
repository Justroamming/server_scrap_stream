"use strict";

const crypto = require("crypto");
const pool = require("../db");

/*
 * Mirrors com.scrapDetection.security.device.DeviceApiKeyService and
 * DeviceAuthenticationFilter on the Java side, so the Pi's existing
 * X-Device-Id / X-Device-Key headers work unchanged against this backend.
 *
 * Java side: SHA-256 hex digest of the raw key, compared with
 * MessageDigest.isEqual (constant-time). We do the same with
 * crypto.timingSafeEqual here.
 */

function sha256Hex(rawKey) {
  return crypto.createHash("sha256").update(rawKey, "utf8").digest("hex");
}

function timingSafeHexEqual(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length) {
    return false;
  }
  const bufA = Buffer.from(a, "utf8");
  const bufB = Buffer.from(b, "utf8");
  return crypto.timingSafeEqual(bufA, bufB);
}

/**
 * Authenticates a device against the `devices` table.
 *
 * @param {string|number} deviceIdRaw - value of the X-Device-Id header
 * @param {string} deviceKey - value of the X-Device-Key header (raw key)
 * @returns {Promise<{ ok: true, device: object } | { ok: false, reason: string }>}
 */
async function authenticateDevice(deviceIdRaw, deviceKey) {
  const deviceId = Number.parseInt(deviceIdRaw, 10);
  if (!Number.isFinite(deviceId) || !deviceKey) {
    return { ok: false, reason: "missing_or_malformed_credentials" };
  }

  const [rows] = await pool.query(
    "SELECT device_id, yard_id, device_name, api_key_hash, status FROM devices WHERE device_id = ? LIMIT 1",
    [deviceId]
  );

  if (rows.length === 0) {
    return { ok: false, reason: "device_not_found" };
  }

  const device = rows[0];

  if (device.status !== "ACTIVE") {
    return { ok: false, reason: `device_status_${device.status.toLowerCase()}` };
  }

  const computedHash = sha256Hex(deviceKey);
  const keyOk = timingSafeHexEqual(computedHash, device.api_key_hash);

  if (!keyOk) {
    return { ok: false, reason: "invalid_key" };
  }

  return { ok: true, device };
}

async function touchLastSeen(deviceId) {
  try {
    await pool.query("UPDATE devices SET last_seen_at = NOW() WHERE device_id = ?", [deviceId]);
  } catch (err) {
    console.error(`[deviceAuth] failed to update last_seen_at for device ${deviceId}:`, err.message);
  }
}

module.exports = { authenticateDevice, touchLastSeen };
