import * as lib from "example-lib";
app.get("/x", (req, res) => {
  let payload = "prefix ";
  payload += req.query.id;
  lib.redirect(payload);
});