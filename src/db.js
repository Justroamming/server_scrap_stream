"use strict";

const mysql = require("mysql2/promise");
const config = require("./config");

// One shared pool for the whole process. This backend only ever does small,
// infrequent SELECTs (auth checks at connect time) — it never touches the
// DB per video chunk — so a small pool is plenty.
const pool = mysql.createPool({
  host: config.db.host,
  port: config.db.port,
  database: config.db.database,
  user: config.db.user,
  password: config.db.password,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

module.exports = pool;
