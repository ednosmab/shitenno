import type { Request, Response } from "express";

export function redirectUser(req: Request, res: Response) {
  const dest = req.query.url as string;
  res.redirect(dest);
}
