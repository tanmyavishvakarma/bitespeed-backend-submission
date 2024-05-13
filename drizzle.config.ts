import * as dotenv from "dotenv";
dotenv.config();

export default {
  dialect: "sqlite",
  schema: "./db/*",
  out: "./drizzle",
  driver: 'better-sqlite',
  dbCredentials: {
    url: './collection.db',
  }
};