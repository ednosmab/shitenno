import cors from "cors";

export const corsConfig = cors({
  origin: "https://example.com",
  credentials: true,
});
