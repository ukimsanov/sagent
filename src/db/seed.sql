-- Demo Business Seed Data
-- Run with: wrangler d1 execute whatsapp-ai-agent-db --local --file=./src/db/seed.sql

-- Demo clothing store
INSERT OR REPLACE INTO businesses (id, name, whatsapp_phone_id, system_prompt, working_hours, timezone, language)
VALUES (
  'demo-store-001',
  'StyleHub Fashion',
  'DEMO_PHONE_ID',
  'You are a friendly sales assistant for StyleHub Fashion, an online clothing store. You help customers find the perfect clothes, check availability, and answer questions about our products. Be helpful, concise, and personable. If a customer seems ready to buy, guide them to complete the purchase. If they have complex issues or complaints, flag for human follow-up.',
  '{"mon": "9-21", "tue": "9-21", "wed": "9-21", "thu": "9-21", "fri": "9-21", "sat": "10-20", "sun": "10-18"}',
  'UTC',
  'en'
);

-- Demo products - T-Shirts
INSERT OR REPLACE INTO products (id, business_id, name, description, price, currency, category, in_stock, stock_quantity, metadata)
VALUES
  ('prod-001', 'demo-store-001', 'Classic Cotton T-Shirt', 'Comfortable 100% cotton t-shirt, perfect for everyday wear. Soft fabric, durable stitching.', 29.99, 'USD', 'T-Shirts', 1, 150, '{"sizes": ["XS", "S", "M", "L", "XL", "XXL"], "colors": ["White", "Black", "Navy", "Gray", "Red"], "material": "100% Cotton"}'),
  ('prod-002', 'demo-store-001', 'Premium V-Neck Tee', 'Elevated basics with our premium v-neck. Slightly fitted cut, luxurious feel.', 39.99, 'USD', 'T-Shirts', 1, 80, '{"sizes": ["S", "M", "L", "XL"], "colors": ["White", "Black", "Charcoal"], "material": "Pima Cotton"}'),
  ('prod-003', 'demo-store-001', 'Graphic Print Tee', 'Express yourself with our artist-designed graphic tees. Limited edition prints.', 34.99, 'USD', 'T-Shirts', 1, 45, '{"sizes": ["S", "M", "L", "XL"], "colors": ["White", "Black"], "designs": ["Urban Art", "Nature", "Abstract"], "material": "Cotton Blend"}');

-- Demo products - Jeans
INSERT OR REPLACE INTO products (id, business_id, name, description, price, currency, category, in_stock, stock_quantity, metadata)
VALUES
  ('prod-004', 'demo-store-001', 'Slim Fit Jeans', 'Modern slim fit jeans with stretch comfort. Perfect balance of style and comfort.', 79.99, 'USD', 'Jeans', 1, 60, '{"sizes": ["28", "30", "32", "34", "36", "38"], "colors": ["Indigo", "Black", "Light Wash"], "material": "98% Cotton, 2% Elastane"}'),
  ('prod-005', 'demo-store-001', 'Relaxed Fit Jeans', 'Classic relaxed fit for all-day comfort. Timeless style that never goes out of fashion.', 69.99, 'USD', 'Jeans', 1, 40, '{"sizes": ["30", "32", "34", "36", "38", "40"], "colors": ["Medium Wash", "Dark Wash"], "material": "100% Cotton Denim"}'),
  ('prod-006', 'demo-store-001', 'High-Rise Skinny Jeans', 'Flattering high-rise skinny jeans. Sculpting fit with maximum stretch.', 89.99, 'USD', 'Jeans', 1, 35, '{"sizes": ["24", "26", "28", "30", "32"], "colors": ["Black", "Indigo", "White"], "material": "92% Cotton, 6% Polyester, 2% Elastane"}');

-- Demo products - Hoodies
INSERT OR REPLACE INTO products (id, business_id, name, description, price, currency, category, in_stock, stock_quantity, metadata)
VALUES
  ('prod-007', 'demo-store-001', 'Essential Pullover Hoodie', 'Cozy pullover hoodie for layering. Soft fleece interior, kangaroo pocket.', 59.99, 'USD', 'Hoodies', 1, 70, '{"sizes": ["S", "M", "L", "XL", "XXL"], "colors": ["Black", "Gray", "Navy", "Forest Green"], "material": "80% Cotton, 20% Polyester"}'),
  ('prod-008', 'demo-store-001', 'Zip-Up Hoodie', 'Versatile zip-up hoodie. Easy on, easy off. Perfect for transitional weather.', 64.99, 'USD', 'Hoodies', 1, 55, '{"sizes": ["S", "M", "L", "XL"], "colors": ["Black", "Charcoal", "Burgundy"], "material": "French Terry Cotton"}'),
  ('prod-009', 'demo-store-001', 'Oversized Hoodie', 'Trendy oversized fit for maximum comfort. Dropped shoulders, extra length.', 69.99, 'USD', 'Hoodies', 0, 0, '{"sizes": ["S/M", "L/XL"], "colors": ["Cream", "Black", "Sage"], "material": "Heavy Cotton Fleece", "note": "Restocking soon"}');

-- Demo products - Accessories
INSERT OR REPLACE INTO products (id, business_id, name, description, price, currency, category, in_stock, stock_quantity, metadata)
VALUES
  ('prod-010', 'demo-store-001', 'Canvas Belt', 'Durable canvas belt with metal buckle. Adjustable size fits most.', 24.99, 'USD', 'Accessories', 1, 100, '{"colors": ["Black", "Khaki", "Navy"], "material": "Canvas with Metal Buckle"}'),
  ('prod-011', 'demo-store-001', 'Baseball Cap', 'Classic six-panel baseball cap. Adjustable snapback closure.', 19.99, 'USD', 'Accessories', 1, 200, '{"colors": ["Black", "White", "Navy", "Red", "Green"], "material": "Cotton Twill"}'),
  ('prod-012', 'demo-store-001', 'Tote Bag', 'Spacious canvas tote bag. Perfect for shopping or daily essentials.', 29.99, 'USD', 'Accessories', 1, 50, '{"colors": ["Natural", "Black"], "material": "Heavy Duty Canvas", "dimensions": "15\" x 16\" x 4\""}');
