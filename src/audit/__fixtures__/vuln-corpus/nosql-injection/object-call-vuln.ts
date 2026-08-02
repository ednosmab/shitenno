/**
 * NoSQL injection fixture — MongoDB find() with user-controlled filter
 * This is a vulnerable pattern: the filter object comes from req.query
 * and is passed directly to collection.find() without sanitization.
 */
import type { Request, Response } from "express";

// Vulnerable: req.query passed directly to MongoDB find
export async function findUser(req: Request, res: Response) {
  const filter = req.query;
  const result = await req.app.get("db").collection("users").find(filter);
  res.json(await result.toArray());
}

// Vulnerable: req.body passed to findOne
export async function findOneUser(req: Request, res: Response) {
  const query = req.body;
  const user = await req.app.get("db").collection("users").findOne(query);
  res.json(user);
}

// Vulnerable: req.params.id used in $where (RCE risk)
export async function findWithWhere(req: Request, res: Response) {
  const userId = req.params.id;
  const result = await req.app.get("db").collection("users").find({
    $where: `this._id === ${userId}`,
  });
  res.json(await result.toArray());
}
