import { render } from "example-lib";
function helper(payload) { return render(payload); }
app.get("/x", (req, res) => {
  const payload = "prefix " + req.query.id;
  helper(payload);
});