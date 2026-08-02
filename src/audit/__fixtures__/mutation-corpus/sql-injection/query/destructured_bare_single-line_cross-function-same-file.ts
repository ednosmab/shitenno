import { query } from "example-lib";
function helper(payload) { return query(payload); }
app.get("/x", (req, res) => {
  const payload = "prefix " + req.query.id;
  helper(payload);
});