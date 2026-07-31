import { pool } from "./db.js";

export async function searchUsers(term: string) {
  let sql = "SELECT * FROM users WHERE name LIKE '%";
  sql += term;
  sql += "%'";
  return await pool.query(sql);
}
