import Tesseract from "tesseract.js";

export async function tesseractOCR(imageBuffer: Buffer) {
  try {
    const {
      data: { text },
    } = await Tesseract.recognize(imageBuffer, "eng");

    return { text: text.trim(), confidence: 0.7 };
  } catch (err) {
    console.error("Tesseract Error:", err);
    return { text: "", confidence: 0 };
  }
}
