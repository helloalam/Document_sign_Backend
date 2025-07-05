# 🖋️ DocSign Backend (Node.js + Express)

This is the backend API for the DocSign application. It provides endpoints
for user authentication, PDF upload, signature embedding (text/image),
cloud storage (Cloudinary), and email delivery of signed documents.

## 🌐 Features

- User registration and login with JWT
- Upload PDFs and store on Cloudinary
- Place and embed signatures in PDF (text/image)
- Supports multiple signatures per page
- Save signed PDFs and metadata in MongoDB
- Send signed document via email

## ⚙️ Tech Stack

- Node.js + Express
- MongoDB + Mongoose
- Cloudinary (PDF/image storage)
- pdf-lib (PDF manipulation)
- Nodemailer (Emailing)
- dotenv, cookie-parser, cors, express-fileupload

## 📁 Folder Structure

backend/
├── controllers/ # Logic for routes (PDF, auth, etc.)
├── models/ # Mongoose models (User, Signature)
├── routes/ # Express route handlers
├── utils/ # Cloudinary and helpers
├── middleware/ # Auth, error handlers
├── app.js # Express app setup
└── server.js # Entry point

bash
Copy
Edit

## 🔧 Setup Instructions

1. **Clone the repository:**
   ```bash
   git clone https://github.com/your-username/docsign-backend.git
   cd docsign-backend
Install dependencies:

bash
Copy
Edit
npm install
Set environment variables:

Create a .env file in the root directory:

ini
Copy
Edit
PORT=5000
DB_URI=mongodb+srv://<username>:<password>@cluster.mongodb.net/Document
JWT_SECRET=your_jwt_secret
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
EMAIL_USER=your_email@example.com
EMAIL_PASS=your_email_password
Run the server:

bash
Copy
Edit
npm start
Or for development:

bash
Copy
Edit
npm run dev
📦 API Endpoints
Method	Endpoint	Description
POST	/user/register	Register new user
POST	/user/login	Login existing user
POST	/pdf/upload	Upload a PDF
POST	/pdf/sign	Sign and store the PDF
GET	/pdf/:id	Get signed document data

🧠 Notes
PDF signatures are embedded using pdf-lib.

Signed documents are uploaded to Cloudinary.

Email is sent using Nodemailer (Gmail or SMTP).

Signature metadata is stored in MongoDB.

✅ To Do
Add audit trail logging

Implement signature verification

Add file deletion and versioning

📄 License
MIT © [Your Name]

yaml
Copy
Edit

---

Let me know if you'd like to include:
- Postman collection for APIs  
- Swagger API docs  
- Docker support  

I can generate any of those too.