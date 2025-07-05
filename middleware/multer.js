// const multer = require("multer");

// const storage = multer.memoryStorage();

// const multipleUpload = multer({ 
//     storage,
//     limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
//  }).array("image",10);

// module.exports = multipleUpload;
const multer = require("multer");

// Store file in memory (buffer)
const storage = multer.memoryStorage();
const upload = multer({ storage });

module.exports = upload;
