import express, { Application } from "express";
import dotenv from 'dotenv';
dotenv.config();
import sharp from "sharp"; 
import multer from "multer"; 
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import cookieParser from "cookie-parser";
import { connectDB, AppDataSource } from './config/db';
import { Product } from './models/Product';
import { Scan } from './models/Scan';
import { TextComparisonService } from './services/textComparisonService';
import { Not, IsNull } from 'typeorm';

import {hybridOCR} from "./controllers/ocrServiceController";
import {compareImages} from "./controllers/imageSimilarityController";
import {decodeBarcode} from "./controllers/barcodeScanController";

import userRoutes from "./routes/userRoute";

import { verifyToken } from "./middleware/verifyToken";
import { requireRole } from "./middleware/requireRole";

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
app.use(cookieParser());              

// routes
app.use("/api/auth", userRoutes);      // <-- auth endpoints

// ----------Product management endpoints----------
// Create a new product
app.post("/api/products", verifyToken,requireRole('admin'), async (req, res) => {
  try {
    const { name, barcode, expected_verbage, expected_ingredients, reference_image_url } = req.body;
    
    if (!name) {
      return res.status(400).json({ error: "Product name is required" });
    }
    
    const productRepository = AppDataSource.getRepository(Product);
    const product = new Product();
    product.name = name;
    product.barcode = barcode;
    product.expected_verbage = expected_verbage;
    product.expected_ingredients = expected_ingredients;
    product.reference_image_url = reference_image_url;
    
    const savedProduct = await productRepository.save(product);
    
    res.status(201).json({
      success: true,
      product: savedProduct
    });
  } catch (err) {
    console.error("Error creating product:", err);
    res.status(500).json({ 
      error: "Failed to create product",
      details: err instanceof Error ? err.message : "Unknown error"
    });
  }
});

// Get all products
app.get("/api/products",verifyToken,requireRole('admin'), async (req, res) => {
  try {
    const productRepository = AppDataSource.getRepository(Product);
    const products = await productRepository.find();
    
    res.json({
      success: true,
      products
    });
  } catch (err) {
    console.error("Error fetching products:", err);
    res.status(500).json({ 
      error: "Failed to fetch products",
      details: err instanceof Error ? err.message : "Unknown error"
    });
  }
});

// Search products by ingredients (for testing ingredient matching)
app.post("/api/products/search-by-ingredients", async (req, res) => {
  try {
    const { ocr_text } = req.body;
    
    if (!ocr_text) {
      return res.status(400).json({ error: "OCR text is required" });
    }
    
    const productRepository = AppDataSource.getRepository(Product);
    const allProducts = await productRepository.find({
      where: { expected_ingredients: Not(IsNull()) }
    });
    
    const matches = TextComparisonService.findMatchingProductsByIngredients(
      ocr_text, 
      allProducts
    );
    
    res.json({
      success: true,
      matches: matches.map(match => ({
        product: {
          id: match.product.id,
          name: match.product.name,
          barcode: match.product.barcode,
          expected_ingredients: match.product.expected_ingredients
        },
        match_score: match.matchScore,
        matched_ingredients: match.matchedIngredients,
        missing_ingredients: match.missingIngredients
      }))
    });
  } catch (err) {
    console.error("Error searching products by ingredients:", err);
    res.status(500).json({ 
      error: "Failed to search products",
      details: err instanceof Error ? err.message : "Unknown error"
    });
  }
});

// ----------Scan endpoints----------

// Scan for verbage/label text
app.post("/api/scan/verbage", upload.single("image"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    console.log("Processing verbage scan for file:", req.file.filename);

    // Process image for OCR
    const processedImage = await sharp(req.file.path).resize(800).toBuffer();
    
    // Perform OCR
    const ocrResult = await hybridOCR(processedImage);
    console.log("OCR Result:", ocrResult);
    
    // Look up product by barcode first (if available)
    const barcode = await decodeBarcode(req.file.path);
    let product: Product | null = null;
    let verbageComparison = null;
    let discrepancyNotes: any[] = [];
    
    const productRepository = AppDataSource.getRepository(Product);
    
    if (barcode) {
      product = await productRepository.findOne({ 
        where: { barcode: barcode } 
      });
    }
    
    // If product found, compare verbage
    if (product && product.expected_verbage) {
      verbageComparison = TextComparisonService.compareVerbage(
        ocrResult.text, 
        product.expected_verbage
      );
      console.log("Verbage comparison:", verbageComparison);
      
      if (!verbageComparison.matches) {
        discrepancyNotes.push({
          type: "verbage",
          message: "Text does not match expected verbage",
          details: verbageComparison.discrepancies
        });
      }
    } else if (barcode) {
      discrepancyNotes.push({
        type: "product",
        message: "Product not found in database for barcode"
      });
    } else {
      discrepancyNotes.push({
        type: "barcode",
        message: "No barcode detected"
      });
    }
    
    // Quality checks
    if (ocrResult.confidence < 0.8) {
      discrepancyNotes.push({ 
        type: "ocr_quality", 
        message: "Low OCR confidence",
        confidence: ocrResult.confidence
      });
    }
    
    // Save scan results
    const scanRepository = AppDataSource.getRepository(Scan);
    const scan = new Scan();
    scan.product_id = product?.id;
    scan.scan_image_url = req.file.path;
    scan.ocr_text = ocrResult.text;
    scan.barcode_scanned = barcode || undefined;
    scan.discrepancy_notes = discrepancyNotes;
    
    const savedScan = await scanRepository.save(scan);
    
    const status = discrepancyNotes.length === 0 ? "matched" : "discrepancy";
    
    res.json({
      status,
      scan_id: savedScan.id,
      product: product ? {
        id: product.id,
        name: product.name,
        barcode: product.barcode
      } : null,
      ocr_text: ocrResult.text,
      ocr_confidence: ocrResult.confidence,
      barcode: barcode,
      verbage_comparison: verbageComparison,
      discrepancy_notes: discrepancyNotes,
      timestamp: savedScan.created_at
    });
    
  } catch (err) {
    console.error("Verbage scan processing error:", err);
    res.status(500).json({
      error: "Verbage scan processing failed",
      details: err instanceof Error ? err.message : "Unknown error"
    });
  }
});

// Scan for barcode (client-side detected)
app.post("/api/scan/barcode-data", async (req, res) => {
  try {
    const { barcode } = req.body;
    
    if (!barcode) {
      return res.status(400).json({ error: "Barcode data is required" });
    }

    console.log("Processing barcode data:", barcode);
    
    let product: Product | null = null;
    let discrepancyNotes: any[] = [];
    
    const productRepository = AppDataSource.getRepository(Product);
    product = await productRepository.findOne({ 
      where: { barcode: barcode } 
    });
    
    if (!product) {
      discrepancyNotes.push({
        type: "product",
        message: "Product not found in database for barcode"
      });
    }
    
    // Save scan results
    const scanRepository = AppDataSource.getRepository(Scan);
    const scan = new Scan();
    scan.product_id = product?.id;
    scan.barcode_scanned = barcode;
    scan.discrepancy_notes = discrepancyNotes;
    
    const savedScan = await scanRepository.save(scan);
    
    const status = discrepancyNotes.length === 0 ? "matched" : "discrepancy";
    
    res.json({
      status,
      scan_id: savedScan.id,
      product: product ? {
        id: product.id,
        name: product.name,
        barcode: product.barcode
      } : null,
      barcode: barcode,
      discrepancy_notes: discrepancyNotes,
      timestamp: savedScan.created_at
    });
    
  } catch (err) {
    console.error("Barcode data processing error:", err);
    res.status(500).json({
      error: "Barcode data processing failed",
      details: err instanceof Error ? err.message : "Unknown error"
    });
  }
});

// Scan for barcode (server-side detection)
app.post("/api/scan/barcode", upload.single("image"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    console.log("Processing barcode scan for file:", req.file.filename);

    // Decode barcode
    const barcode = await decodeBarcode(req.file.path);
    console.log("Barcode:", barcode);
    
    let product: Product | null = null;
    let discrepancyNotes: any[] = [];
    
    if (barcode) {
      const productRepository = AppDataSource.getRepository(Product);
      product = await productRepository.findOne({ 
        where: { barcode: barcode } 
      });
      
      if (!product) {
        discrepancyNotes.push({
          type: "product",
          message: "Product not found in database for barcode"
        });
      }
    } else {
      discrepancyNotes.push({
        type: "barcode",
        message: "No barcode detected"
      });
    }
    
    // Save scan results
    const scanRepository = AppDataSource.getRepository(Scan);
    const scan = new Scan();
    scan.product_id = product?.id;
    scan.scan_image_url = req.file.path;
    scan.barcode_scanned = barcode || undefined;
    scan.discrepancy_notes = discrepancyNotes;
    
    const savedScan = await scanRepository.save(scan);
    
    const status = discrepancyNotes.length === 0 ? "matched" : "discrepancy";
    
    res.json({
      status,
      scan_id: savedScan.id,
      product: product ? {
        id: product.id,
        name: product.name,
        barcode: product.barcode
      } : null,
      barcode: barcode,
      discrepancy_notes: discrepancyNotes,
      timestamp: savedScan.created_at
    });
    
  } catch (err) {
    console.error("Barcode scan processing error:", err);
    res.status(500).json({
      error: "Barcode scan processing failed",
      details: err instanceof Error ? err.message : "Unknown error"
    });
  }
});

// Scan for ingredients list
app.post("/api/scan/ingredients", upload.single("image"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    console.log("Processing ingredients scan for file:", req.file.filename);

    // Process image for OCR
    const processedImage = await sharp(req.file.path).resize(800).toBuffer();
    
    // Perform OCR
    const ocrResult = await hybridOCR(processedImage);
    console.log("OCR Result:", ocrResult);
    
    // Find products by ingredients
    const productRepository = AppDataSource.getRepository(Product);
    const allProducts = await productRepository.find({
      where: { expected_ingredients: Not(IsNull()) }
    });
    
    const ingredientMatches = TextComparisonService.findMatchingProductsByIngredients(
      ocrResult.text, 
      allProducts
    );
    
    let product: Product | null = null;
    let ingredientsComparison = null;
    let discrepancyNotes: any[] = [];
    
    if (ingredientMatches.length > 0) {
      product = ingredientMatches[0].product;
      ingredientsComparison = TextComparisonService.compareIngredients(
        ocrResult.text, 
        product!.expected_ingredients
      );
      console.log("Ingredients comparison:", ingredientsComparison);
      
      if (!ingredientsComparison.matches) {
        discrepancyNotes.push({
          type: "ingredients",
          message: "Ingredients do not match expected ingredients",
          details: ingredientsComparison.discrepancies
        });
      }
    } else {
      discrepancyNotes.push({
        type: "product",
        message: "No products match the scanned ingredients"
      });
    }
    
    // Quality checks
    if (ocrResult.confidence < 0.8) {
      discrepancyNotes.push({ 
        type: "ocr_quality", 
        message: "Low OCR confidence",
        confidence: ocrResult.confidence
      });
    }
    
    // Save scan results
    const scanRepository = AppDataSource.getRepository(Scan);
    const scan = new Scan();
    scan.product_id = product?.id;
    scan.scan_image_url = req.file.path;
    scan.ocr_text = ocrResult.text;
    scan.discrepancy_notes = discrepancyNotes;
    
    const savedScan = await scanRepository.save(scan);
    
    const status = discrepancyNotes.length === 0 ? "matched" : "discrepancy";
    
    res.json({
      status,
      scan_id: savedScan.id,
      product: product ? {
        id: product.id,
        name: product.name,
        barcode: product.barcode
      } : null,
      alternative_matches: ingredientMatches.length > 1 ? 
        ingredientMatches.slice(1, 4).map(match => ({
          product: {
            id: match.product.id,
            name: match.product.name,
            barcode: match.product.barcode
          },
          match_score: match.matchScore,
          matched_ingredients: match.matchedIngredients,
          missing_ingredients: match.missingIngredients
        })) : [],
      ocr_text: ocrResult.text,
      ocr_confidence: ocrResult.confidence,
      ingredients_comparison: ingredientsComparison,
      discrepancy_notes: discrepancyNotes,
      timestamp: savedScan.created_at
    });
    
  } catch (err) {
    console.error("Ingredients scan processing error:", err);
    res.status(500).json({
      error: "Ingredients scan processing failed",
      details: err instanceof Error ? err.message : "Unknown error"
    });
  }
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ success: false, error: 'Route not found' });
});

const PORT = process.env.PORT || 3010;

const startServer = async () => {
  try {
    // Connect to database
    await connectDB();
  
    
    // Start server
    app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`Health check: http://localhost:${PORT}/health`);
      console.log(`Users API: http://localhost:${PORT}/api/auth`);
      console.log(`Products API: http://localhost:${PORT}/api/products`);
      console.log(`Search by ingredients: http://localhost:${PORT}/api/products/search-by-ingredients`);
      console.log(`Scan endpoints:`);
      console.log(`  - Verbage scan: http://localhost:${PORT}/api/scan/verbage`);
      console.log(`  - Barcode scan (server): http://localhost:${PORT}/api/scan/barcode`);
      console.log(`  - Barcode scan (client): http://localhost:${PORT}/api/scan/barcode-data`);
      console.log(`  - Ingredients scan: http://localhost:${PORT}/api/scan/ingredients`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();
