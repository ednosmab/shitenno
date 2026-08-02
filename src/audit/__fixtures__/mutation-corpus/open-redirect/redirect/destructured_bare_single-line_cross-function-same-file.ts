import { redirect } from "example-lib";
function helper(payload) { return redirect(payload); }
app.get("/x", (req, res) => {
  const payload = "prefix " + req.query.id;
  helper(payload);
});