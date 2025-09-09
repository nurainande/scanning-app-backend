-- Products Table
CREATE TABLE IF NOT EXISTS products (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    barcode VARCHAR(255) UNIQUE,
    expected_verbage TEXT,
    expected_ingredients JSONB,
    reference_image_url TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Scans Table
CREATE TABLE IF NOT EXISTS scans (
    id SERIAL PRIMARY KEY,
    product_id INT REFERENCES products(id),
    scan_image_url TEXT,
    ocr_text TEXT,
    barcode_scanned VARCHAR(255),
    similarity_score FLOAT,
    discrepancy_notes JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Users Table
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    role VARCHAR(50) CHECK(role IN ('attendant','supervisor')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert sample data
-- INSERT INTO products (name, barcode, expected_verbage, expected_ingredients, reference_image_url) VALUES 
--     ('Coca Cola 330ml', '123456789012', 'Coca-Cola Classic', '["Water", "Sugar", "Carbon Dioxide", "Phosphoric Acid"]', 'https://example.com/coke.jpg'),
--     ('Pepsi 500ml', '123456789013', 'Pepsi Cola', '["Water", "Sugar", "Carbon Dioxide", "Citric Acid"]', 'https://example.com/pepsi.jpg')
-- ON CONFLICT (barcode) DO NOTHING;

-- INSERT INTO users (name, role) VALUES 
--     ('John Doe', 'attendant'),
--     ('Jane Smith', 'supervisor'),
--     ('Bob Johnson', 'attendant')
-- ON CONFLICT DO NOTHING;

-- INSERT INTO scans (product_id, scan_image_url, ocr_text, barcode_scanned, similarity_score, discrepancy_notes) VALUES 
--     (1, 'https://example.com/scan1.jpg', 'Coca-Cola Classic 330ml', '123456789012', 0.95, '{"status": "approved"}'),
--     (2, 'https://example.com/scan2.jpg', 'Pepsi Cola 500ml', '123456789013', 0.87, '{"status": "needs_review"}')
-- ON CONFLICT DO NOTHING;