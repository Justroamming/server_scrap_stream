"use strict";

const config = require("../config");

function failureReason(status) {
  if (status === 401) return "invalid_token";
  if (status === 403) return "viewer_forbidden";
  if (status === 404) return "device_not_found";
  return "backend_auth_failed";
}

/**
 * Ask Spring Boot, the owner of JWT sessions and account/device permissions,
 * whether this viewer may open the requested camera stream.
 */
async function authenticateViewer(token, deviceIdRaw, fetchImpl = globalThis.fetch) {
  if (!token) {
    return { ok: false, reason: "missing_token", statusCode: 401 };
  }

  const deviceId = Number.parseInt(deviceIdRaw, 10);
  if (!Number.isSafeInteger(deviceId) || deviceId <= 0 || String(deviceId) !== String(deviceIdRaw).trim()) {
    return { ok: false, reason: "malformed_device_id", statusCode: 400 };
  }
  if (typeof fetchImpl !== "function") {
    return { ok: false, reason: "backend_unavailable", statusCode: 503 };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.backendRequestTimeoutMs);

  try {
    const response = await fetchImpl(
      `${config.backendBaseUrl}/api/devices/${deviceId}/viewer-access`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
        },
        signal: controller.signal,
      }
    );

    if (!response.ok) {
      return {
        ok: false,
        reason: failureReason(response.status),
        statusCode: response.status >= 500 ? 503 : response.status,
      };
    }

    const access = await response.json();
    if (
      Number(access.accountId) <= 0 ||
      Number(access.deviceId) !== deviceId ||
      !["STAFF", "YARD_OWNER"].includes(access.role)
    ) {
      return { ok: false, reason: "invalid_backend_response", statusCode: 502 };
    }

    return {
      ok: true,
      accountId: Number(access.accountId),
      role: access.role,
      deviceId,
    };
  } catch (err) {
    const reason = err && err.name === "AbortError" ? "backend_timeout" : "backend_unavailable";
    return { ok: false, reason, statusCode: 503 };
  } finally {
    clearTimeout(timeout);
  }
}

module.exports = { authenticateViewer };
