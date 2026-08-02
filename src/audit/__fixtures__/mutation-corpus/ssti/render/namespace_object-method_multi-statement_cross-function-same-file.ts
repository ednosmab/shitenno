import * as lib from "example-lib";
function helper(payload) { return lib.render(payload); }
app.get("/x", (req, res) => {
  let payload = "prefix ";
  payload += req.query.id;
  helper(payload);
});