const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const dotenv = require("dotenv");
const bodyParser = require("body-parser");

dotenv.config();

const app = express();

// ✅ Allowed frontend origins
const allowedOrigins = [
  "http://localhost:3000",
  "https://document-sign-frontend-tu6g.vercel.app" // replace with your real Vercel frontend if needed
];

// ✅ CORS options
const corsOptions = {
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error("CORS Not Allowed"));
    }
  },
  credentials: true, // for cookies / sessions
};

// ✅ Middleware
app.use(cors(corsOptions)); // <-- Must come before routes
app.options("*", cors(corsOptions)); // <-- Handle preflight requests

app.use(cookieParser());
app.use(bodyParser.json({ limit: "10mb" }));
app.use(bodyParser.urlencoded({ extended: true }));

// ✅ Wake-up route for Render backend
app.get("/api/v1/ping", (req, res) => {
  res.status(200).send("Server awake");
});

// ✅ Import your routes
const authRoutes = require("./routes/authRoutes");
const pdfRoutes = require("./routes/pdfRoutes");

// ✅ Use your routes
app.use("/api/v1", authRoutes);
app.use("/api/v1", pdfRoutes);

// ✅ Global error handler (if any)
const errorMiddleware = require("./middleware/error");
app.use(errorMiddleware);

// ✅ Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
