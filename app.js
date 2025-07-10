const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const bodyParser = require("body-parser");

const app = express();

// ✅ Allow both local and deployed frontend
const allowedOrigins = [
  "http://localhost:3000",
  "https://document-sign-frontend-tu6g.vercel.app"
];

app.use(cors({
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error("CORS Not Allowed"));
    }
  },
  credentials: true,
}));

// Middleware
app.use(express.json({ limit: "10mb" }));
app.use(bodyParser.urlencoded({ limit: "10mb", extended: true }));
app.use(cookieParser());

// Routes
const userRoutes = require("./routes/userRoute");
const pdfRoutes = require("./routes/pdfroutes");

app.use("/api/v1", userRoutes);
app.use("/api/v1", pdfRoutes);

// Error Handler
const errorMiddleware = require("./middleware/error");
app.use(errorMiddleware);

module.exports = app;
