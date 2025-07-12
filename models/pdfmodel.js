const mongoose = require("mongoose");

const signatureSchema = new mongoose.Schema(
  {
    documentId: {
      type: String,
      required: true,
      trim: true, // removes accidental spaces
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId, // ✅ Use ObjectId to enable population
      ref: "User", // if you have a User model
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
      min: 1,
    },
    status: {
      type: String,
      enum: ["signed", "pending", "rejected"],
      default: "signed",
    },
    signedUrl: {
      type: String,
      required: true,
    },
    public_id: {
      type: String,
      required: true,
    },
    signedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Signature", signatureSchema);
