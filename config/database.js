const mongoose = require("mongoose");

const connectDatabase = () => {
  console.log("Connecting to MongoDB:",process.env.DB_URI); // Debug

  mongoose
    .connect(process.env.DB_URI, {})
    .then((data) => {
      console.log(`MongoDB connected with server:${data.connection.host}`);
    })
    .catch((err) => {
      console.error("MongoDB connection failed:", err);
      process.exit(1);
    });
};

module.exports = connectDatabase;
