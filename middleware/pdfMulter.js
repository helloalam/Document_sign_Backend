const multer = require("multer");

const storage = multer.memoryStorage(); // Store buffer in memory for streamifier
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // Max: 5MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype === "application/pdf") {
      cb(null, true);
    } else {
      cb(new Error("Only PDF files are allowed"));
    }
  },
});

module.exports = upload;
