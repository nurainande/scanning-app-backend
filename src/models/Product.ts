export interface Product {
  id: number;
  name: string;
  barcode?: string;
  expected_verbage?: string;
  expected_ingredients?: any; // JSONB type
  reference_image_url?: string;
  created_at: Date;
}