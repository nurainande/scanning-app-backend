export interface Scan {
  id: number;
  product_id?: number;
  scan_image_url?: string;
  ocr_text?: string;
  barcode_scanned?: string;
  similarity_score?: number;
  discrepancy_notes?: any; // JSONB type
  created_at: Date;
}