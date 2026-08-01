import { find } from "example-lib";
function helper(payload) { return find(payload); }
app.get("/x", (req, res) => {
  const payload = "prefix " + req.query.id;
  helper(payload);
});