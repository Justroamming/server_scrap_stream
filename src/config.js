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

  db: {
    host: required("DB_HOST"),
    port: parseInt(process.env.DB_PORT || "3306", 10),
    database: required("DB_NAME"),
    user: required("DB_USER"),
    password: required("DB_PASSWORD"),
  },

  jwtSecret: required("JWT_SECRET"),
};
