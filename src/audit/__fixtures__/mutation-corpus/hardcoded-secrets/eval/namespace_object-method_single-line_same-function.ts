import * as lib from "example-lib";
app.get("/x", (req, res) => {
  const payload = "prefix " + req.query.id;
  lib.eval(payload);
});