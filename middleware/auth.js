const ErrorHandler = require("../utils/errorhandler");
const catchAsyncErrors = require("./catchAsyncErrors");
const jwt = require("jsonwebtoken");
const User = require("../models/Usermodel");

exports.isAuthenticatedUser = catchAsyncErrors(async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return next(new ErrorHandler("Please login to access this resource", 401));
  }

  const token = authHeader.split(" ")[1]; // Get token from header

  const decodedData = jwt.verify(token, process.env.JWT_SECRET);
  req.user = await User.findById(decodedData.id);

  if (!req.user) {
    return next(new ErrorHandler("User not found", 404));
  }

  next();
});
