import Tesseract from "tesseract.js";
import googleVision from "@google-cloud/vision";


 async function tesseractOCR(imageBuffer: Buffer) {
  try {
    const {
      data: { text, confidence },
    } = await Tesseract.recognize(imageBuffer, "eng");

    return { text: text.trim(), confidence: confidence || 0 };
  } catch (err) {
    console.error("Tesseract Error:", err);
    return { text: "", confidence: 0 };
  }
}

async function googleVisionOCR(imageBuffer: Buffer) {
  try {
    const vision = new googleVision.ImageAnnotatorClient();
    const [result] = await vision.textDetection(imageBuffer);
    const detections = result.textAnnotations;

    if (!detections?.length) return { text: "", confidence: 0, engine: "vision" };

    // The first item contains the full text
    const fullText = detections[0]?.description?.trim() || "";

    // Compute a rough average confidence from word-level data
    let confidences: number[] = [];
    if (result.fullTextAnnotation?.pages) {
      for (const page of result.fullTextAnnotation.pages ?? []) {
        for (const block of page.blocks ?? []) {
          for (const paragraph of block.paragraphs ?? []) {
            for (const word of paragraph.words ?? []) {
              if (word.confidence && word.confidence > 0) {
                confidences.push(word.confidence);
              }
            }
          }
        }
      }
    }

    // Calculate average confidence, default to 0.8 if no confidence data
    const avgConfidence = confidences.length > 0
      ? confidences.reduce((a, b) => a + b, 0) / confidences.length
      : 0.8; // Default confidence when no word-level data available

    console.log(`Google Vision OCR - Found ${confidences.length} words with confidence data`);
    console.log(`Average confidence: ${avgConfidence}`);
    console.log(`Text length: ${fullText.length}`);

    return { 
      text: fullText, 
      confidence: avgConfidence, 
      engine: "vision",
      words: detections.slice(1).map(w => ({
        text: w.description,
        boundingBox: w.boundingPoly,
      }))
    };
  } catch (err) {
    console.error("Google Vision Error:", err);
    return { text: "", confidence: 0, engine: "vision" };
  }
}

/**
 * Hybrid OCR: Run Tesseract first, fallback to Vision if weak
 */
async function hybridOCR(imageBuffer: Buffer) {
  let ocrResult = await tesseractOCR(imageBuffer);

  if (ocrResult.confidence < 70 || ocrResult.text.length < 10) {
    console.log("Low confidence — using Google Vision fallback...");
    ocrResult = await googleVisionOCR(imageBuffer) as any;
  }

  return ocrResult;
}



export { hybridOCR, googleVisionOCR, tesseractOCR };