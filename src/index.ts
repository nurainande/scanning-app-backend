import express, { Application } from "express";
import dotenv from 'dotenv';
dotenv.config();
import sharp from "sharp"; 
import multer from "multer"; 
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { connectDB } from './config/db';

import {tesseractOCR} from "./controllers/ocrServiceController";
// import {compareImages} from "./controllers/imageSimilarityController";
// import {decodeBarcode} from "./controllers/barcodeScanController";


import userRoutes from "./routes/userRoute";

const app: Application = express();
const upload = multer({ dest: "uploads/" }); 

app.get('/health', (req, res) => {
  res.status(200).send('Server is healthy');
});

// Middleware
app.use(helmet());
app.use(cors({ origin: `${process.env.CLIENT_URL}`, credentials: true }));
app.use(morgan('combined'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// routes
app.use("/api/users", userRoutes);

// Main processing endpoint
app.post("/scan", upload.single("image"), async (req, res) => { 
  try { 
    // ------added BY me to check for file upload
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }
    res.send("File uploaded successfully");
    console.log("File info:", req.file);
    // ------end of added code

  //   // Resize/compress for faster OCR 
    const processedImage = await sharp(req.file.path).resize(800).toBuffer(); 
    // 1. OCR 
    const ocrResult = await tesseractOCR(processedImage); 
    console.log("OCR Result:", ocrResult);
  //   // 2. Barcode 
  //   // const barcode = await decodeBarcode(req.file.path); 
  //   // 3. Image Similarity (against reference) 
  //   // const referenceImagePath = "reference/ref_label.png"; // placeholder 
  //   // const similarityScore = compareImages(req.file.path, referenceImagePath); 
  //   // Discrepancy detection 
  //   let discrepancyNotes = []; 
  //   if (ocrResult.confidence < 0.8) 
  //   discrepancyNotes.push({ type: "text", message: "Low OCR confidence" }); 
  //   // if (similarityScore < 0.85) 
  //   // discrepancyNotes.push({ type: "image", message: "Image does not match reference" }); 
  //   // if (!barcode) 
  //   // discrepancyNotes.push({ type: "barcode", message: "No barcode detected" }); 

  //   res.json({ 
  //     status: discrepancyNotes.length ? "discrepancy" : "matched", 
  //     ocr_text: ocrResult.text, 
  //     confidence: ocrResult.confidence, 
  //     // barcode: barcode, 
  //     // similarity_score: similarityScore, 
  //     discrepancy_notes: discrepancyNotes 
  // }); 
} catch (err) { 
    console.error(err); 
    res.status(500).json({ error: "Processing failed" }); 
} 
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ success: false, error: 'Route not found' });
});

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  try {
    // Connect to database
    await connectDB();
    
    // Start server
    app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`Health check: http://localhost:${PORT}/health`);
      console.log(`Users API: http://localhost:${PORT}/api/users`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();
