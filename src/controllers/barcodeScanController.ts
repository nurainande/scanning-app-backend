import { BrowserQRCodeReader} from "@zxing/library";

export async function decodeBarcode(imagePath: string) {
  try {
    const reader = new BrowserQRCodeReader();
    const result = await reader.decodeFromImageUrl(`file://${imagePath}`);
    // The 'text' property is private; use getText() method instead
    return result.getText();
  } catch (err) {
    console.log("Barcode not found.");
    return null;
  }
}
