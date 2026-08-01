import * as lib from "example-lib";
function helper(payload) { return lib.redirect(payload); }
app.get("/x", (req, res) => {
  const payload = "prefix " + req.query.id;
  helper(payload);
});