import { eval } from "example-lib";
function helper(payload) { return eval(payload); }
app.get("/x", (req, res) => {
  let payload = "prefix ";
  payload += req.query.id;
  helper(payload);
});