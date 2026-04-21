import mongoose from "mongoose";

const connect = async () => {
  const uri = process.env.MONGODB_URI;

  if (!uri) {
    throw new Error("MONGODB_URI is not defined in .env");
  }

  await mongoose.connect(uri, {
    appName: "GitSync",
  });

  console.log("MongoDB connected");
};

const disconnect = async () => {
  await mongoose.disconnect();
  console.log("MongoDB disconnected");
};

export { connect, disconnect };
export { mongoose };