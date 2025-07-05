const mongoose = require("mongoose");

const signatureSchema = new mongoose.Schema({
  documentId: {
    type: String,
    required: true, // e.g., "pdfs/uploaded_1751600000.pdf"
  },
  userId: {
    type: String, // Or ObjectId if referencing user model
    required: true,
  },
  x: {
    type: Number,
    required: true,
  },
  y: {
    type: Number,
    required: true,
  },
  page: {
    type: Number,
    default: 1,
  },
  status: {
    type: String,
    enum: ["signed", "pending", "rejected"],
    default: "signed",
  },
  signedUrl: {
    type: String,
    required: true, // Full Cloudinary link to signed PDF
  },
  public_id: {
    type: String,
    required: true, // e.g., "signed_pdfs/signed_1751600000.pdf"
  },
  signedAt: {
    type: Date,
    default: Date.now,
  },
}, { timestamps: true }); // Adds createdAt and updatedAt fields automatically

module.exports = mongoose.model("Signature", signatureSchema);
