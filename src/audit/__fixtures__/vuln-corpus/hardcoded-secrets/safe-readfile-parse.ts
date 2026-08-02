import { readFileSync } from "fs";

const config = JSON.parse(readFileSync("config.json", "utf-8"));
