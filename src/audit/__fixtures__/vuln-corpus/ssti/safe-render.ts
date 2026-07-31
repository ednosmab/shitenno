/**
 * Safe SSTI fixture — ejs.render() with hardcoded template (no taint source)
 * This should NOT be flagged by the taint engine because the template
 * comes from a static string, not from user input.
 */
import type { Request, Response } from "express";
import ejs from "ejs";

// Safe: hardcoded template
export function renderStaticPage(req: Request, res: Response) {
  const template = "<h1>Hello <%= name %></h1>";
  const html = ejs.render(template, { name: "World" });
  res.send(html);
}

// Safe: hardcoded handlebars template
export function compileStaticTemplate(req: Request, res: Response) {
  const Handlebars = require("handlebars");
  const template = Handlebars.compile("<h1>{{title}}</h1>");
  const html = template({ title: "Welcome" });
  res.send(html);
}
