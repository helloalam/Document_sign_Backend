const { PDFDocument, rgb, StandardFonts } = require("pdf-lib");
const streamifier = require("streamifier");
const cloudinary = require("cloudinary").v2;
const nodemailer = require("nodemailer");
const path = require("path");
const Signature = require("../models/pdfmodel");
const User = require("../models/Usermodel");
const catchAsyncErrors = require("../middleware/catchAsyncErrors");

// Dynamic fetch import in CommonJS
const fetch = (...args) => import("node-fetch").then(({ default: fetch }) => fetch(...args));

// Upload buffer to Cloudinary
const uploadBufferToCloudinary = (buffer, options) =>
  new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(options, (error, result) =>
      error ? reject(error) : resolve(result)
    );
    streamifier.createReadStream(buffer).pipe(stream);
  });

// 1. Upload original PDF to Cloudinary
exports.uploadPDF = catchAsyncErrors(async (req, res) => {
  if (!req.file) return res.status(400).json({ message: "No file uploaded" });

  if (req.file.mimetype !== "application/pdf") {
    return res.status(400).json({ message: "Only PDF files are allowed" });
  }

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

// 2. Sign PDF with text or image
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

  const existingPdfBytes = await fetch(pdfUrl).then((res) => {
    if (!res.ok) throw new Error(`Failed to fetch PDF: ${res.status}`);
    return res.arrayBuffer();
  });

  const pdfDoc = await PDFDocument.load(existingPdfBytes, { updateMetadata: false });
  const pages = pdfDoc.getPages();
  const pageNumber = Number(page);

  if (pageNumber < 1 || pageNumber > pages.length) {
    return res.status(400).json({ message: "Invalid page number" });
  }

  const selectedPage = pages[pageNumber - 1];
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
    try {
      let image;
      const lowerData = imageData.toLowerCase();
      if (lowerData.startsWith("data:image/png")) {
        image = await pdfDoc.embedPng(imageData);
      } else if (
        lowerData.startsWith("data:image/jpeg") ||
        lowerData.startsWith("data:image/jpg")
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
      return res.status(500).json({ message: "Image embed failed", error: err.message });
    }
  }

  // Add status text
  const footerFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  selectedPage.drawText(`Status: ${status}`, {
    x: 50,
    y: 20,
    size: 10,
    font: footerFont,
    color: rgb(0.5, 0.5, 0.5),
  });

  const signedBytes = await pdfDoc.save({ useObjectStreams: true });

  const signedFilename = `signed_${Date.now()}.pdf`;

  const uploadResult = await uploadBufferToCloudinary(Buffer.from(signedBytes), {
    resource_type: "raw",
    folder: "signed_pdfs",
    public_id: signedFilename,
    use_filename: true,
    unique_filename: false,
    timeout: 60000,
  });

  await Signature.create({
    documentId,
    userId,
    x: targetX,
    y: correctedY,
    page: pageNumber,
    status,
    signedAt: new Date(),
    signedUrl: uploadResult.secure_url,
    public_id: uploadResult.public_id,
  });

  res.status(200).json({
    success: true,
    signedUrl: uploadResult.secure_url,
    public_id: uploadResult.public_id,
  });
});

// 3. Securely serve local PDF file
exports.previewPDF = catchAsyncErrors((req, res) => {
  const file = req.query.file;
  if (!file || !file.endsWith(".pdf")) {
    return res.status(400).json({ message: "PDF file path is required" });
  }
  res.sendFile(path.resolve(file));
});

// 4. Delete PDF from Cloudinary & MongoDB
exports.deletePDF = catchAsyncErrors(async (req, res) => {
  const documentId = decodeURIComponent(req.params.documentId);

  if (!documentId) {
    return res.status(400).json({ success: false, message: "Document ID is required" });
  }

  const documents = await Signature.find({ documentId });

  if (!documents.length) {
    return res.status(404).json({ success: false, message: "Document not found" });
  }

  const currentUserId = req.user._id;
  const isOwner = documents.every(
    (doc) => doc.userId.toString() === currentUserId.toString()
  );

  if (!isOwner) {
    return res.status(403).json({
      success: false,
      message: "You are not allowed to delete this document",
    });
  }

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

  await Signature.deleteMany({ documentId });

  res.status(200).json({
    success: true,
    message: "Document deleted successfully from Cloudinary and MongoDB",
  });
});

// 5. Send Signed PDF via email
exports.sendPDFEmail = catchAsyncErrors(async (req, res) => {
  const { fileUrl, toEmail } = req.body;

  if (!fileUrl || !toEmail) {
    return res.status(400).json({ message: "Missing fileUrl or recipient email" });
  }

  const transporter = nodemailer.createTransport({
    service: process.env.SMTP_SERVICE,
    host: process.env.SMTP_HOST,
    port: process.env.SMTP_PORT,
    secure: true,
    auth: {
      user: process.env.SMTP_MAIL,
      pass: process.env.SMTP_PASSWORD,
    },
  });

  const mailOptions = {
    from: process.env.EMAIL,
    to: toEmail,
    subject: "Signed PDF Document",
    html: `
      <p>Hello,</p>
      <p>Your signed document is ready:</p>
      <p><a href="${fileUrl}" target="_blank">${fileUrl}</a></p>
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
    res.status(200).json({ success: true, message: "Email sent successfully" });
  } catch (err) {
    res.status(500).json({ success: false, message: "Email failed", error: err.message });
  }
});

// 6. List user's signed PDF files
exports.listSignedPDFs = catchAsyncErrors(async (req, res) => {
  const userId = req.user._id;
  const { status, page = 1, limit = 10 } = req.query;

  const filter = status ? { userId, status } : { userId };
  const files = await Signature.find(filter)
    .populate("userId", "name")
    .sort({ signedAt: -1 })
    .skip((parseInt(page) - 1) * parseInt(limit))
    .limit(parseInt(limit));

  res.status(200).json({ success: true, files });
});
