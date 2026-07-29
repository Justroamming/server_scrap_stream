"use strict";

const jwt = require("jsonwebtoken");
const pool = require("../db");
const config = require("../config");

/*
 * Mirrors com.scrapDetection.security.jwt.JwtService: HS512, subject =
 * phone number, claims = { role, accountId }. We verify locally using the
 * same shared secret (both backends read it from their own .env), so this
 * backend never needs to call Spring Boot to authenticate a viewer.
 */

function verifyToken(token) {
  try {
    const payload = jwt.verify(token, config.jwtSecret, { algorithms: ["HS512"] });
    return { ok: true, payload };
  } catch (err) {
    return { ok: false, reason: err.name === "TokenExpiredError" ? "token_expired" : "invalid_token" };
  }
}

/**
 * Authenticates a viewer connection for a specific device.
 *
 * Checks:
 *   1. JWT signature/expiry valid
 *   2. Account exists and is not disabled
 *   3. Account's yard_id matches the target device's yard_id
 *
 * @param {string} token - raw JWT (from ?token= query param)
 * @param {string|number} deviceIdRaw - device the viewer wants to watch
 * @returns {Promise<{ ok: true, accountId: number, role: string, deviceId: number } | { ok: false, reason: string }>}
 */
async function authenticateViewer(token, deviceIdRaw) {
  if (!token) {
    return { ok: false, reason: "missing_token" };
  }

  const verified = verifyToken(token);
  if (!verified.ok) {
    return { ok: false, reason: verified.reason };
  }

  const accountId = verified.payload.accountId;
  const role = verified.payload.role;
  const deviceId = Number.parseInt(deviceIdRaw, 10);

  if (!Number.isFinite(deviceId)) {
    return { ok: false, reason: "malformed_device_id" };
  }

  const [accountRows] = await pool.query(
    "SELECT account_id, yard_id, status FROM accounts WHERE account_id = ? LIMIT 1",
    [accountId]
  );
  if (accountRows.length === 0) {
    return { ok: false, reason: "account_not_found" };
  }
  const account = accountRows[0];
  if (account.status && account.status.toUpperCase() !== "ACTIVE") {
    return { ok: false, reason: "account_not_active" };
  }

  const [deviceRows] = await pool.query(
    "SELECT device_id, yard_id FROM devices WHERE device_id = ? LIMIT 1",
    [deviceId]
  );
  if (deviceRows.length === 0) {
    return { ok: false, reason: "device_not_found" };
  }
  const device = deviceRows[0];

  if (String(account.yard_id) !== String(device.yard_id)) {
    return { ok: false, reason: "yard_mismatch" };
  }

  return { ok: true, accountId, role, deviceId };
}

module.exports = { authenticateViewer };
