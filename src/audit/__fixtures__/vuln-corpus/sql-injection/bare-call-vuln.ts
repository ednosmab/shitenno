import { query } from "./db.js";

export function getUserById(userId: string) {
  const sql = "SELECT * FROM users WHERE id = " + userId;
  return query(sql);
}
