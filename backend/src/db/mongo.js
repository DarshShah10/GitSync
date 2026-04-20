import mongoose from "mongoose";
import { config } from "../config/index.js";

const connect = async () => {
  await mongoose.connect(config.db.mongoUri, {
    appName: "GitSync",
  });
};

const disconnect = async () => {
  await mongoose.disconnect();
};

export { connect, disconnect };
export { mongoose };