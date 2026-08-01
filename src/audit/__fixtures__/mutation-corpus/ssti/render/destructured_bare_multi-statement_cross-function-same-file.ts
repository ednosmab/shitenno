import { render } from "example-lib";
function helper(payload) { return render(payload); }
app.get("/x", (req, res) => {
  let payload = "prefix ";
  payload += req.query.id;
  helper(payload);
});