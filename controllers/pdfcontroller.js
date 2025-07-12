// controllers/pdfController.js

const { PDFDocument, rgb, StandardFonts } = require("pdf-lib");
const streamifier = require("streamifier");
const cloudinary = require("cloudinary").v2;
const nodemailer = require("nodemailer");
const path = require("path");
const Signature = require("../models/pdfmodel");
const User = require("../models/Usermodel");
const catchAsyncErrors = require("../middleware/catchAsyncErrors");

// Dynamic fetch support for CommonJS
const fetch = (...args) => import("node-fetch").then(({ default: fetch }) => fetch(...args));

// Cloudinary upload utility
const uploadBufferToCloudinary = (buffer, options) => {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(options, (error, result) =>
      error ? reject(error) : resolve(result)
    );
    streamifier.createReadStream(buffer).pipe(stream);
  });
};

// 1. Upload original PDF to Cloudinary
exports.uploadPDF = catchAsyncErrors(async (req, res) => {
  if (!req.file) return res.status(400).json({ message: "No file uploaded" });

  const filename = `uploaded_${Date.now()}.pdf`;

  const result = await uploadBufferToCloudinary(req.file.buffer, {
    resource_type: "raw",
    folder: "pdfs",
    public_id: filename,
    use_filename: true,
    unique_filename: false,
    timeout: 60000,
  });

  res.status(200).json({
    success: true,
    url: result.secure_url,
    public_id: result.public_id,
  });
});

// 2. Sign PDF (text or image)
exports.signPDF = catchAsyncErrors(async (req, res) => {
  const {
    pdfUrl,
    documentId,
    type,
    text,
    fontSize = 12,
    fontFamily,
    imageData,
    x,
    y,
    page = 1,
    status = "signed",
  } = req.body;

  const userId = req.user._id;

  if (!pdfUrl || !documentId || !userId || x == null || y == null || !type) {
    return res.status(400).json({ message: "Missing required fields" });
  }

  if (type === "text" && !text?.trim()) {
    return res.status(400).json({ message: "Text is required for text signature" });
  }

  if (type === "image" && !imageData) {
    return res.status(400).json({ message: "Base64 image required for image signature" });
  }

  // Load existing PDF from URL
  const existingPdfBytes = await fetch(pdfUrl).then(res => {
    if (!res.ok) throw new Error(`Failed to fetch PDF: ${res.status}`);
    return res.arrayBuffer();
  });

  const pdfDoc = await PDFDocument.load(existingPdfBytes, { updateMetadata: false });
  const pages = pdfDoc.getPages();

  if (page < 1 || page > pages.length) {
    return res.status(400).json({ message: "Invalid page number" });
  }

  const selectedPage = pages[page - 1];
  const pageHeight = selectedPage.getHeight();

  const correctedY = pageHeight - Number(y) - 10;
  const targetX = Number(x);

  if (type === "text") {
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    selectedPage.drawText(text, {
      x: targetX,
      y: correctedY,
      size: parseInt(fontSize),
      font,
      color: rgb(0, 0, 0),
    });
  } else if (type === "image") {
    let image;

    try {
      // Detect image format and embed accordingly
      if (imageData.startsWith("data:image/png")) {
        image = await pdfDoc.embedPng(imageData);
      } else if (
        imageData.startsWith("data:image/jpeg") ||
        imageData.startsWith("data:image/jpg")
      ) {
        image = await pdfDoc.embedJpg(imageData);
      } else {
        return res.status(400).json({ message: "Unsupported image format" });
      }

      selectedPage.drawImage(image, {
        x: targetX,
        y: correctedY,
        width: 120,
        height: 40,
      });
    } catch (err) {
      console.error("🧨 Error embedding image:", err);
      return res.status(500).json({ message: "Image embed failed", error: err.message });
    }
  }

  // Add status text at bottom
  const footerFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  selectedPage.drawText(`Status: ${status}`, {
    x: 50,
    y: 20,
    size: 10,
    font: footerFont,
    color: rgb(0.5, 0.5, 0.5),
  });

  // Save signed PDF
  const signedBytes = await pdfDoc.save({ useObjectStreams: true });

  const signedFilename = `signed_${Date.now()}.pdf`;

  const uploadResult = await uploadBufferToCloudinary(Buffer.from(signedBytes), {
    resource_type: "auto",
    folder: "signed_pdfs",
    public_id: signedFilename,
    use_filename: true,
    unique_filename: false,
    timeout: 60000,
  });

  // Save signature metadata to MongoDB
  await Signature.create({
    documentId,
    userId,
    x: targetX,
    y: correctedY,
    page,
    status,
    signedAt: new Date(),
    signedUrl: uploadResult.secure_url,
    public_id: uploadResult.public_id,
  });

  // Return success response
  res.status(200).json({
    success: true,
    signedUrl: uploadResult.secure_url,
    public_id: uploadResult.public_id,
  });
});

// 3. Serve Local PDF
exports.previewPDF = catchAsyncErrors((req, res) => {
  const file = req.query.file;
  if (!file) return res.status(400).json({ message: "File path is required" });
  res.sendFile(path.resolve(file));
});

// 4. Delete from Cloudinary

exports.deletePDF = catchAsyncErrors(async (req, res) => {
  const documentId = decodeURIComponent(req.params.documentId);

  if (!documentId) {
    return res.status(400).json({ success: false, message: "Document ID is required" });
  }

  // Step 1: Find all entries for this documentId
  const documents = await Signature.find({ documentId });

  if (!documents.length) {
    return res.status(404).json({ success: false, message: "Document not found" });
  }

  // ✅ Optional: Restrict deletion only to document owner (secure)
  const currentUserId = req.user.id;
const isOwner = documents.every((doc) => doc.userId.toString() === currentUserId.toString());

  if (!isOwner) {
    return res.status(403).json({ success: false, message: "You are not allowed to delete this document" });
  }

  // Step 2: Delete each file from Cloudinary
  for (const doc of documents) {
    if (doc.public_id) {
      try {
        const result = await cloudinary.uploader.destroy(doc.public_id, {
          resource_type: "raw",
        });

        if (result.result !== "ok") {
          console.warn("Cloudinary deletion failed:", result);
        }
      } catch (err) {
        console.error("Cloudinary delete error:", err.message);
      }
    }
  }

  // Step 3: Delete from MongoDB
  await Signature.deleteMany({ documentId });

  return res.status(200).json({
    success: true,
    message: "Document deleted successfully from Cloudinary and MongoDB",
  });
});


// 5. Email Signed PDF
exports.sendPDFEmail = catchAsyncErrors(async (req, res) => {
  const { fileUrl, toEmail } = req.body;

  if (!fileUrl || !toEmail) {
    return res.status(400).json({ message: "Missing fileUrl or toEmail" });
  }

  const transporter = nodemailer.createTransport({
    service: process.env.SMPT_SERVICE,
    host: process.env.SMPT_HOST,
    port: process.env.SMPT_PORT,
    secure: true,
    auth: {
      user: process.env.SMPT_MAIL,
      pass: process.env.SMPT_PASSWORD,
    },
  });

  const mailOptions = {
    from: process.env.EMAIL,
    to: toEmail,
    subject: "Signed PDF Document",
    html: `
      <p>Hello,</p>
      <p>Your signed document is available:</p>
      <p><a href="${fileUrl}" target="_blank">${fileUrl}</a></p>
    `,
  };

  await transporter.sendMail(mailOptions);

  res.status(200).json({ success: true, message: "Email sent successfully" });
});

// 6. List Signed PDFs
exports.listSignedPDFs = catchAsyncErrors(async (req, res) => {
  const userId = req.user._id;
  const { status } = req.query;
  const filter = status ? { userId, status } : { userId };

  const files = await Signature.find(filter)
    .populate("userId", "name")
    .sort({ signedAt: -1 });

  res.status(200).json({ success: true, files });
});
