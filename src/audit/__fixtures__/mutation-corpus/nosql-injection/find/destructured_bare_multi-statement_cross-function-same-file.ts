import { find } from "example-lib";
function helper(payload) { return find(payload); }
app.get("/x", (req, res) => {
  let payload = "prefix ";
  payload += req.query.id;
  helper(payload);
});