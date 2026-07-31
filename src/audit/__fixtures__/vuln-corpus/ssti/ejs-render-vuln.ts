/**
 * SSTI fixture — EJS render() with user-controlled template
 * This is a vulnerable pattern: the template string comes from req.query
 * and is passed directly to ejs.render() without sanitization.
 */
import type { Request, Response } from "express";
import ejs from "ejs";

// Vulnerable: req.query.template passed to ejs.render
export function renderTemplate(req: Request, res: Response) {
  const template = req.query.template as string;
  const html = ejs.render(template, { name: req.query.name });
  res.send(html);
}

// Vulnerable: req.body.content passed to handlebars.compile
export function compileTemplate(req: Request, res: Response) {
  const Handlebars = require("handlebars");
  const template = Handlebars.compile(req.body.content);
  const html = template({ title: req.body.title });
  res.send(html);
}

// Vulnerable: pug.render with user-controlled input
export function renderPug(req: Request, res: Response) {
  const pug = require("pug");
  const html = pug.render("p #{title}", { title: req.query.title });
  res.send(html);
}
