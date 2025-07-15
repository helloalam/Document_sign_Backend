const { PDFDocument, rgb, StandardFonts } = require("pdf-lib");
const streamifier = require("streamifier");
const cloudinary = require("cloudinary").v2;
const nodemailer = require("nodemailer");
const path = require("path");
const Signature = require("../models/pdfmodel");
const catchAsyncErrors = require("../middleware/catchAsyncErrors");

const fetch = (...args) => import("node-fetch").then(({ default: fetch }) => fetch(...args));

const uploadBufferToCloudinary = (buffer, options) => {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(options, (error, result) =>
      error ? reject(error) : resolve(result)
    );
    streamifier.createReadStream(buffer).pipe(stream);
  });
};

// 1. Upload PDF
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

  res.status(200).json({ success: true, url: result.secure_url, public_id: result.public_id });
});

// 2. Sign PDF
exports.signPDF = catchAsyncErrors(async (req, res) => {
  const {
    pdfUrl, documentId, type, text, fontSize = 12, imageData, x, y,
    page = 1, status = "signed"
  } = req.body;

  const userId = req.user._id;
  if (!pdfUrl || !documentId || !userId || x == null || y == null || !type)
    return res.status(400).json({ message: "Missing required fields" });
  if (type === "text" && !text?.trim())
    return res.status(400).json({ message: "Text is required" });
  if (type === "image" && !imageData)
    return res.status(400).json({ message: "Image data required" });

  const existingPdfBytes = await fetch(pdfUrl).then(res => res.arrayBuffer());
  const pdfDoc = await PDFDocument.load(existingPdfBytes);
  const pages = pdfDoc.getPages();
  if (page < 1 || page > pages.length)
    return res.status(400).json({ message: "Invalid page number" });

  const selectedPage = pages[page - 1];
  const correctedY = selectedPage.getHeight() - Number(y) - 10;
  const targetX = Number(x);

  if (type === "text") {
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    selectedPage.drawText(text, { x: targetX, y: correctedY, size: parseInt(fontSize), font, color: rgb(0, 0, 0) });
  } else {
    const image = imageData.startsWith("data:image/png")
      ? await pdfDoc.embedPng(imageData)
      : await pdfDoc.embedJpg(imageData);
    selectedPage.drawImage(image, { x: targetX, y: correctedY, width: 120, height: 40 });
  }

  const footerFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  selectedPage.drawText(`Status: ${status}`, { x: 50, y: 20, size: 10, font: footerFont, color: rgb(0.5, 0.5, 0.5) });

  const signedBytes = await pdfDoc.save();
  const signedFilename = `signed_${Date.now()}.pdf`;
  const uploadResult = await uploadBufferToCloudinary(Buffer.from(signedBytes), {
    resource_type: "auto",
    folder: "signed_pdfs",
    public_id: signedFilename,
    use_filename: true,
    unique_filename: false,
    timeout: 60000,
  });

  await Signature.create({
    documentId, userId, x: targetX, y: correctedY, page, status,
    signedAt: new Date(),
    signedUrl: uploadResult.secure_url,
    public_id: uploadResult.public_id,
  });

  res.status(200).json({ success: true, signedUrl: uploadResult.secure_url });
});

// 3. Preview Local PDF
exports.previewPDF = catchAsyncErrors((req, res) => {
  const file = req.query.file;
  if (!file) return res.status(400).json({ message: "File path is required" });
  res.sendFile(path.resolve(file));
});

// 4. Delete PDF
exports.deletePDF = catchAsyncErrors(async (req, res) => {
  const documentId = decodeURIComponent(req.params.documentId);
  if (!documentId) return res.status(400).json({ message: "Document ID required" });

  const documents = await Signature.find({ documentId });
  if (!documents.length) return res.status(404).json({ message: "Document not found" });

  const userId = req.user.id;
  const isOwner = documents.every(doc => doc.userId.toString() === userId.toString());
  if (!isOwner) return res.status(403).json({ message: "Not authorized" });

  for (const doc of documents) {
    if (doc.public_id) {
      try {
        await cloudinary.uploader.destroy(doc.public_id, { resource_type: "raw" });
      } catch (err) {
        console.error("Cloudinary delete error:", err.message);
      }
    }
  }

  await Signature.deleteMany({ documentId });
  res.status(200).json({ success: true, message: "Document deleted" });
});

// 5. Send Signed PDF via Email
exports.sendPDFEmail = catchAsyncErrors(async (req, res) => {
  const { fileUrl, toEmail } = req.body;
  if (!fileUrl || !toEmail) return res.status(400).json({ message: "Missing fileUrl or toEmail" });

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

  await transporter.sendMail({
    from: process.env.EMAIL,
    to: toEmail,
    subject: "Signed PDF Document",
    html: `<p>Hello,</p><p>Your signed document is available here:</p><p><a href="${fileUrl}" target="_blank">${fileUrl}</a></p>`,
  });

  res.status(200).json({ success: true, message: "Email sent" });
});

// 6. List Signed PDFs
exports.listSignedPDFs = catchAsyncErrors(async (req, res) => {
  const userId = req.user._id;
  const { status } = req.query;
  const filter = status ? { userId, status } : { userId };

  const files = await Signature.find(filter)
    .sort({ signedAt: -1 })
    .select("documentId signedUrl signedAt status");

  res.status(200).json({ success: true, files });
});
