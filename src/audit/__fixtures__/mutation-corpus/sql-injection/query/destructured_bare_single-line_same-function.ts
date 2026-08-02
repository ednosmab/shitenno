import { query } from "example-lib";
app.get("/x", (req, res) => {
  const payload = "prefix " + req.query.id;
  query(payload);
});