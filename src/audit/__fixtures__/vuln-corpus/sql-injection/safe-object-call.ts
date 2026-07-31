import { pool } from "./db.js";

export async function getTemplate(templateId: string) {
  const template = await pool.raw("SELECT * FROM templates WHERE id = ?", [templateId]);
  return template;
}
