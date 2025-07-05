const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const bodyParser = require("body-parser");
// const fileUpload = require("express-fileupload");

const app = express();

// ✅ CORS Configuration – Add This Early
app.use(cors({
  origin: "http://localhost:3000",  // React frontend origin
  credentials: true,                // Allow cookies, tokens, etc.
}));

// ✅ Standard Middleware
app.use(express.json({ limit: "10mb" }));
app.use(bodyParser.urlencoded({ limit: "10mb", extended: true }));
app.use(cookieParser());
// app.use(fileUpload());

// ✅ Route Imports
const userRoutes = require("./routes/userRoute");
const pdfRoutes = require("./routes/pdfroutes");

// ✅ Mount Routes
app.use("/api/v1", userRoutes);
app.use("/api/v1", pdfRoutes);

// ✅ Error Handler
const errorMiddleware = require("./middleware/error");
app.use(errorMiddleware);

module.exports = app;
