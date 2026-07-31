/**
 * Safe NoSQL fixture — MongoDB find() with hardcoded filter (no taint source)
 * This should NOT be flagged by the taint engine because the filter
 * comes from a static object, not from user input.
 */
import type { Request, Response } from "express";

// Safe: hardcoded filter
export async function findActiveUsers(req: Request, res: Response) {
  const result = await req.app.get("db").collection("users").find({ status: "active" });
  res.json(await result.toArray());
}

// Safe: hardcoded query with $where
export async function findAdminUsers(req: Request, res: Response) {
  const result = await req.app.get("db").collection("users").find({
    $where: "this.role === 'admin'",
  });
  res.json(await result.toArray());
}
