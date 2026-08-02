import { pool } from "./db.js";

export async function getUserById(userId: string) {
  const sql = "SELECT * FROM users WHERE id = " + userId;
  return await pool.query(sql);
}
