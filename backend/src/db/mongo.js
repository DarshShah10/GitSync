import mongoose from "mongoose";
import { config } from "../constants/index.js";

const connect = async () => {
  await mongoose.connect(config.db.uri, {
    appName: "GitSync",
  });
};

const disconnect = async () => {
  await mongoose.disconnect();
};

export { connect, disconnect };
export { mongoose };