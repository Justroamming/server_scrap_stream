"use strict";

require("dotenv").config();

function required(name) {
  const val = process.env[name];
  if (!val) {
    throw new Error(`Missing required env var: ${name}. Copy .env.example to .env and fill it in.`);
  }
  return val;
}

module.exports = {
  port: parseInt(process.env.PORT || "8100", 10),
  backendBaseUrl: (process.env.BACKEND_BASE_URL || "http://127.0.0.1:8080").replace(/\/$/, ""),
  backendRequestTimeoutMs: parseInt(process.env.BACKEND_REQUEST_TIMEOUT_MS || "3000", 10),

  db: {
    host: required("DB_HOST"),
    port: parseInt(process.env.DB_PORT || "3306", 10),
    database: required("DB_NAME"),
    user: required("DB_USER"),
    password: required("DB_PASSWORD"),
  },

};
