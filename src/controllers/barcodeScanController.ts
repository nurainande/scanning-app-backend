import { BrowserQRCodeReader } from "@zxing/library";

export async function decodeBarcode(imagePath: string) {
  try {
    const reader = new BrowserQRCodeReader();
    const result = await reader.decodeFromImageUrl(`file://${imagePath}`);
    return result.text;
    // C:\Users\Hp\Downloads\
  } catch (err) {
    console.log("Barcode not found.");
    return null;
  }
}
