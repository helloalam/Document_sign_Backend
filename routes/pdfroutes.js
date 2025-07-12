const express = require("express");
const router = express.Router();
const upload = require("../middleware/pdfMulter");

const {
  uploadPDF,
  signPDF,
  previewPDF,
  deletePDF,
  sendPDFEmail,
  listSignedPDFs
} = require("../controllers/pdfcontroller");
const { isAuthenticatedUser } = require("../middleware/auth");

// Upload to Cloudinary
router.post("/pdf/upload", upload.single("file"), uploadPDF);

// Sign PDF (text/image)
router.post("/pdf/sign/:id",isAuthenticatedUser, signPDF);

// Preview PDF
router.get("/pdf/preview", previewPDF);

// Delete signed file
router.delete("/pdf/delete/:documentId", isAuthenticatedUser, deletePDF);

// Send via email
router.post("/pdf/email", sendPDFEmail);

router.get("/pdf/list", isAuthenticatedUser, listSignedPDFs);

module.exports = router;