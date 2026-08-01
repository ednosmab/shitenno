import { eval } from "example-lib";
app.get("/x", (req, res) => {
  let payload = "prefix ";
  payload += req.query.id;
  eval(payload);
});