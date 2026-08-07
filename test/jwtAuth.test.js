"use strict";

process.env.DB_HOST = "127.0.0.1";
process.env.DB_NAME = "test";
process.env.DB_USER = "test";
process.env.DB_PASSWORD = "test";

const test = require("node:test");
const assert = require("node:assert/strict");
const { authenticateViewer } = require("../src/auth/jwtAuth");

test("authenticateViewer delegates the bearer token and device to Backend", async () => {
  let requestUrl;
  let requestOptions;
  const fetchImpl = async (url, options) => {
    requestUrl = url;
    requestOptions = options;
    return {
      ok: true,
      status: 200,
      json: async () => ({ accountId: 7, role: "STAFF", deviceId: 12 }),
    };
  };

  const result = await authenticateViewer("signed-token", "12", fetchImpl);

  assert.deepEqual(result, { ok: true, accountId: 7, role: "STAFF", deviceId: 12 });
  assert.equal(requestUrl, "http://127.0.0.1:8080/api/devices/12/viewer-access");
  assert.equal(requestOptions.headers.Authorization, "Bearer signed-token");
});

test("authenticateViewer rejects malformed device ids without calling Backend", async () => {
  let called = false;
  const result = await authenticateViewer("signed-token", "12-other", async () => {
    called = true;
  });

  assert.equal(called, false);
  assert.deepEqual(result, { ok: false, reason: "malformed_device_id", statusCode: 400 });
});

test("authenticateViewer maps Backend authorization failures", async () => {
  const result = await authenticateViewer("signed-token", "12", async () => ({
    ok: false,
    status: 403,
  }));

  assert.deepEqual(result, { ok: false, reason: "viewer_forbidden", statusCode: 403 });
});
