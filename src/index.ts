import express, { Application } from "express";
import dotenv from 'dotenv';
dotenv.config();
import sharp from "sharp"; 
import multer from "multer"; 
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { connectDB, AppDataSource } from './config/db';
import { Product } from './models/Product';
import { Scan } from './models/Scan';
import { TextComparisonService } from './services/textComparisonService';
import { Not, IsNull } from 'typeorm';

import {tesseractOCR} from "./controllers/ocrServiceController";
import {compareImages} from "./controllers/imageSimilarityController";
import {decodeBarcode} from "./controllers/barcodeScanController";

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

// Product management endpoints
app.post("/api/products", async (req, res) => {
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

app.get("/api/products", async (req, res) => {
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

// Main processing endpoint
app.post("/scan", upload.single("image"), async (req, res) => { 
  try { 
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    console.log("Processing scan for file:", req.file.filename);

    // 1. Process image for OCR
    const processedImage = await sharp(req.file.path).resize(800).toBuffer(); 
    
    // 2. Perform OCR
    const ocrResult = await tesseractOCR(processedImage); 
    console.log("OCR Result:", ocrResult);
    
    // 3. Decode barcode
    const barcode = await decodeBarcode(req.file.path); 
    console.log("Barcode:", barcode);
    
    // 4. Look up product by barcode or ingredients
    let product: Product | null = null;
    let productMatchMethod: 'barcode' | 'ingredients' | null = null;
    let ingredientMatches: any[] = [];
    
    const productRepository = AppDataSource.getRepository(Product);
    
    if (barcode) {
      // First try to find by barcode
      product = await productRepository.findOne({ 
        where: { barcode: barcode } 
      });
      if (product) {
        productMatchMethod = 'barcode';
        console.log("Found product by barcode:", product.name);
      }
    }
    
    // If no product found by barcode, try to match by ingredients
    if (!product) {
      const allProducts = await productRepository.find({
        where: { expected_ingredients: Not(IsNull()) } // Only products with ingredients
      });
      
      ingredientMatches = TextComparisonService.findMatchingProductsByIngredients(
        ocrResult.text, 
        allProducts
      );
      
      if (ingredientMatches.length > 0) {
        product = ingredientMatches[0].product;
        productMatchMethod = 'ingredients';
        console.log(`Found product by ingredients: ${product!.name} (${ingredientMatches[0].matchScore.toFixed(2)} match)`);
      }
    }
    
    // 5. Compare OCR text with expected verbage and ingredients
    let verbageComparison = null;
    let ingredientsComparison = null;
    let discrepancyNotes: any[] = [];
    
    if (product) {
      // Compare verbage if available
      if (product.expected_verbage) {
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
      }
      
      // Compare ingredients if available
      if (product.expected_ingredients) {
        ingredientsComparison = TextComparisonService.compareIngredients(
          ocrResult.text, 
          product.expected_ingredients
        );
        console.log("Ingredients comparison:", ingredientsComparison);
        
        if (!ingredientsComparison.matches) {
          discrepancyNotes.push({
            type: "ingredients",
            message: "Ingredients do not match expected ingredients",
            details: ingredientsComparison.discrepancies
          });
        }
      }
    } else {
      if (barcode) {
        discrepancyNotes.push({
          type: "product",
          message: "Product not found in database for barcode"
        });
      } else {
        discrepancyNotes.push({
          type: "product",
          message: "No barcode detected and no products match the scanned ingredients"
        });
      }
    }
    
    // 6. Image similarity check (if reference image exists)
    let similarityScore = null;
    if (product?.reference_image_url) {
      try {
        similarityScore = await compareImages(req.file.path, product.reference_image_url);
        if (similarityScore < 0.85) {
          discrepancyNotes.push({
            type: "image",
            message: "Image does not match reference image",
            score: similarityScore
          });
        }
      } catch (err) {
        console.log("Image similarity check failed:", err);
      }
    }
    
    // 7. Additional quality checks
    if (ocrResult.confidence < 0.8) {
      discrepancyNotes.push({ 
        type: "ocr_quality", 
        message: "Low OCR confidence",
        confidence: ocrResult.confidence
      }); 
    }
    
    if (!barcode) {
      discrepancyNotes.push({ 
        type: "barcode", 
        message: "No barcode detected" 
      }); 
    }
    
    // 8. Save scan results to database
    const scanRepository = AppDataSource.getRepository(Scan);
    const scan = new Scan();
    scan.product_id = product?.id;
    scan.scan_image_url = req.file.path;
    scan.ocr_text = ocrResult.text;
    scan.barcode_scanned = barcode || undefined;
    scan.similarity_score = similarityScore || undefined;
    scan.discrepancy_notes = discrepancyNotes;
    
    const savedScan = await scanRepository.save(scan);
    console.log("Scan saved with ID:", savedScan.id);
    
    // 9. Return comprehensive results
    const status = discrepancyNotes.length === 0 ? "matched" : "discrepancy";
    
    res.json({ 
      status,
      scan_id: savedScan.id,
      product: product ? {
        id: product.id,
        name: product.name,
        barcode: product.barcode
      } : null,
      product_match_method: productMatchMethod,
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
      barcode: barcode, 
      similarity_score: similarityScore,
      verbage_comparison: verbageComparison,
      ingredients_comparison: ingredientsComparison,
      discrepancy_notes: discrepancyNotes,
      timestamp: savedScan.created_at
    }); 
    
  } catch (err) { 
    console.error("Scan processing error:", err); 
    res.status(500).json({ 
      error: "Processing failed", 
      details: err instanceof Error ? err.message : "Unknown error" 
    }); 
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
      console.log(`Products API: http://localhost:${PORT}/api/products`);
      console.log(`Search by ingredients: http://localhost:${PORT}/api/products/search-by-ingredients`);
      console.log(`Scan endpoint: http://localhost:${PORT}/scan`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();
