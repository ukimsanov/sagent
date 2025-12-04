-- Demo Business Seed Data
-- Run with: wrangler d1 execute whatsapp-ai-agent-db --local --file=./src/db/seed.sql

-- Demo clothing store
INSERT OR REPLACE INTO businesses (
  id, name, whatsapp_phone_id, system_prompt, working_hours, timezone, language,
  brand_tone, greeting_template, escalation_keywords, after_hours_message,
  handoff_email, handoff_phone, auto_handoff_threshold
)
VALUES (
  'demo-store-001',
  'StyleHub Fashion',
  'DEMO_PHONE_ID',
  'You are a friendly sales assistant for StyleHub Fashion, an online clothing store. You help customers find the perfect clothes, check availability, and answer questions about our products. Be helpful, concise, and personable. If a customer seems ready to buy, guide them to complete the purchase. If they have complex issues or complaints, flag for human follow-up.',
  '{"mon": "9-21", "tue": "9-21", "wed": "9-21", "thu": "9-21", "fri": "9-21", "sat": "10-20", "sun": "10-18"}',
  'UTC',
  'en',
  'friendly',
  NULL, -- Use default greeting
  '["lawyer", "sue", "refund", "scam", "fraud", "police", "report"]',
  'Hey! Thanks for reaching out. Our team is currently offline but we''ll get back to you first thing in the morning. Feel free to browse our catalog in the meantime!',
  'support@stylehub.demo',
  NULL,
  3
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

-- ============================================
-- Sample Leads for Dashboard Testing
-- ============================================

-- Add sample leads with varied scores and statuses
INSERT OR REPLACE INTO leads (id, business_id, whatsapp_number, name, email, score, status, first_contact, last_contact, message_count)
VALUES
  ('lead-demo-001', 'demo-store-001', '15551234567', 'John Doe', NULL, 85, 'hot', strftime('%s', 'now') - 259200, strftime('%s', 'now') - 120, 12),
  ('lead-demo-002', 'demo-store-001', '15559876543', 'Jane Smith', NULL, 72, 'warm', strftime('%s', 'now') - 172800, strftime('%s', 'now') - 7200, 8),
  ('lead-demo-003', 'demo-store-001', '15558765432', 'Mike Johnson', NULL, 45, 'engaged', strftime('%s', 'now') - 259200, strftime('%s', 'now') - 1800, 6),
  ('lead-demo-004', 'demo-store-001', '15557654321', NULL, NULL, 92, 'hot', strftime('%s', 'now') - 86400, strftime('%s', 'now') - 300, 18),
  ('lead-demo-005', 'demo-store-001', '15556543210', 'Emily Davis', NULL, 15, 'new', strftime('%s', 'now') - 18000, strftime('%s', 'now') - 18000, 2),
  ('lead-demo-006', 'demo-store-001', '15555432109', 'Chris Brown', 'chris@email.com', 68, 'warm', strftime('%s', 'now') - 432000, strftime('%s', 'now') - 14400, 12),
  ('lead-demo-007', 'demo-store-001', '15554321098', 'Sarah Wilson', NULL, 25, 'engaged', strftime('%s', 'now') - 604800, strftime('%s', 'now') - 86400, 4),
  ('lead-demo-008', 'demo-store-001', '15553210987', NULL, NULL, 55, 'warm', strftime('%s', 'now') - 345600, strftime('%s', 'now') - 43200, 7);

-- ============================================
-- Sample Message Events for Dashboard Testing
-- ============================================

-- Events for lead-demo-001 (John Doe - hot lead, hoodie interest)
INSERT OR REPLACE INTO message_events (id, business_id, lead_id, timestamp, action, intent_type, user_message, agent_response, search_query, products_shown, flagged_for_human, clarification_count, processing_time_ms)
VALUES
  ('evt-001', 'demo-store-001', 'lead-demo-001', strftime('%s', 'now') * 1000 - 7200000, 'greet', 'greeting', 'Hey, do you have any hoodies?', 'Hey! Yes, we have got some great hoodies in stock! Are you looking for something specific - like a particular color, style, or size range?', NULL, NULL, 0, 0, 245),
  ('evt-002', 'demo-store-001', 'lead-demo-001', strftime('%s', 'now') * 1000 - 6900000, 'show_products', 'product_search', 'Something in black, size L', 'Perfect choice! Here are our black hoodies in size L:\n\n1. Classic Black Hoodie - $49\n2. Premium Zip-Up - $65\n3. Oversized Fit - $55\n\nWhich one catches your eye?', 'black hoodie L', '["Essential Pullover Hoodie", "Zip-Up Hoodie", "Oversized Hoodie"]', 0, 0, 890),
  ('evt-003', 'demo-store-001', 'lead-demo-001', strftime('%s', 'now') * 1000 - 5400000, 'answer_question', 'product_info', 'The classic one looks good. What is the material?', 'Great pick! The Essential Pullover Hoodie is 80% cotton, 20% polyester - super soft but also durable. Most customers say it runs true to size.', NULL, NULL, 0, 0, 320),
  ('evt-004', 'demo-store-001', 'lead-demo-001', strftime('%s', 'now') * 1000 - 3600000, 'answer_question', 'pricing_question', 'Yes please, and how long is shipping?', 'Just checked - we have L in black! For shipping: Standard (3-5 days) is free over $50, Express (1-2 days) is $8.', NULL, NULL, 0, 0, 425);

-- Events for lead-demo-002 (Jane Smith - warm lead, dress interest)
INSERT OR REPLACE INTO message_events (id, business_id, lead_id, timestamp, action, intent_type, user_message, agent_response, search_query, products_shown, flagged_for_human, clarification_count, processing_time_ms)
VALUES
  ('evt-005', 'demo-store-001', 'lead-demo-002', strftime('%s', 'now') * 1000 - 172800000, 'greet', 'greeting', 'Hi there!', 'Hello! Welcome to StyleHub Fashion. How can I help you today?', NULL, NULL, 0, 0, 180),
  ('evt-006', 'demo-store-001', 'lead-demo-002', strftime('%s', 'now') * 1000 - 169200000, 'show_products', 'product_search', 'I am looking for summer outfits', 'Great choice for the season! Here are some popular options:\n\n1. Classic Cotton T-Shirt - $29.99\n2. Slim Fit Jeans - $79.99\n3. Canvas Belt - $24.99\n\nWould you like to see any of these in detail?', 'summer outfits', '["Classic Cotton T-Shirt", "Slim Fit Jeans", "Canvas Belt"]', 0, 0, 750),
  ('evt-007', 'demo-store-001', 'lead-demo-002', strftime('%s', 'now') * 1000 - 86400000, 'ask_clarification', 'product_search', 'Show me more options', 'Of course! What style are you leaning toward - more casual daytime looks, or something that could work for evening events too?', NULL, NULL, 0, 1, 280),
  ('evt-008', 'demo-store-001', 'lead-demo-002', strftime('%s', 'now') * 1000 - 7200000, 'show_products', 'product_search', 'Something casual for daytime', 'Here are our best casual daytime options:\n\n1. Premium V-Neck Tee - $39.99\n2. Relaxed Fit Jeans - $69.99\n3. Baseball Cap - $19.99\n\nAll super comfy and easy to style!', 'casual daytime', '["Premium V-Neck Tee", "Relaxed Fit Jeans", "Baseball Cap"]', 0, 0, 680);

-- Events for lead-demo-003 (Mike Johnson - engaged, jeans interest)
INSERT OR REPLACE INTO message_events (id, business_id, lead_id, timestamp, action, intent_type, user_message, agent_response, search_query, products_shown, flagged_for_human, clarification_count, processing_time_ms)
VALUES
  ('evt-009', 'demo-store-001', 'lead-demo-003', strftime('%s', 'now') * 1000 - 259200000, 'greet', 'greeting', 'Hello', 'Hey there! Welcome to StyleHub. What can I help you find today?', NULL, NULL, 0, 0, 195),
  ('evt-010', 'demo-store-001', 'lead-demo-003', strftime('%s', 'now') * 1000 - 255600000, 'answer_question', 'pricing_question', 'What is the price range for jeans?', 'Our jeans range from $69.99 to $89.99 depending on the style. Our bestsellers are the Slim Fit Jeans at $79.99. Looking for any particular fit?', NULL, NULL, 0, 0, 310),
  ('evt-011', 'demo-store-001', 'lead-demo-003', strftime('%s', 'now') * 1000 - 1800000, 'show_products', 'product_search', 'Show me slim fit jeans', 'Here are our jeans options:\n\n1. Slim Fit Jeans - $79.99 (our bestseller!)\n2. Relaxed Fit Jeans - $69.99\n3. High-Rise Skinny Jeans - $89.99\n\nAll available in multiple washes!', 'slim fit jeans', '["Slim Fit Jeans", "Relaxed Fit Jeans", "High-Rise Skinny Jeans"]', 0, 0, 720);

-- Events for lead-demo-004 (Anonymous hot lead - checkout ready)
INSERT OR REPLACE INTO message_events (id, business_id, lead_id, timestamp, action, intent_type, user_message, agent_response, search_query, products_shown, flagged_for_human, clarification_count, processing_time_ms)
VALUES
  ('evt-012', 'demo-store-001', 'lead-demo-004', strftime('%s', 'now') * 1000 - 86400000, 'greet', 'greeting', 'hi', 'Hey! How can I help you today?', NULL, NULL, 0, 0, 165),
  ('evt-013', 'demo-store-001', 'lead-demo-004', strftime('%s', 'now') * 1000 - 82800000, 'show_products', 'product_search', 'I need a complete outfit', 'Great! Let me help you put together a complete look. Here is a stylish outfit:\n\n- Premium V-Neck Tee - $39.99\n- Slim Fit Jeans - $79.99\n- Canvas Belt - $24.99\n\nTotal: $144.97\n\nWant me to add these to cart?', 'complete outfit', '["Premium V-Neck Tee", "Slim Fit Jeans", "Canvas Belt"]', 0, 0, 950),
  ('evt-014', 'demo-store-001', 'lead-demo-004', strftime('%s', 'now') * 1000 - 79200000, 'answer_question', 'sizing_help', 'What size should I get? I am 6 feet, 180 lbs', 'Based on your measurements, I would recommend:\n- Tee: Large\n- Jeans: 32 or 33\n- Belt: One size fits all\n\nOur clothes run true to size. Want to proceed with these sizes?', NULL, NULL, 0, 0, 380),
  ('evt-015', 'demo-store-001', 'lead-demo-004', strftime('%s', 'now') * 1000 - 300000, 'answer_question', 'checkout', 'Yes, let us do it', 'Awesome! Here is your cart:\n\n- Premium V-Neck Tee (L) - $39.99\n- Slim Fit Jeans (32) - $79.99\n- Canvas Belt - $24.99\n\nSubtotal: $144.97\nShipping: FREE (over $50)\n\nI will send you the checkout link now!', NULL, NULL, 0, 0, 290);

-- Events for lead-demo-005 (Emily Davis - new lead with complaint, flagged)
INSERT OR REPLACE INTO message_events (id, business_id, lead_id, timestamp, action, intent_type, user_message, agent_response, search_query, products_shown, flagged_for_human, clarification_count, processing_time_ms)
VALUES
  ('evt-016', 'demo-store-001', 'lead-demo-005', strftime('%s', 'now') * 1000 - 18000000, 'greet', 'greeting', 'I have a problem with my order', 'I am sorry to hear that! Can you tell me more about what happened with your order? I want to make sure we get this resolved for you.', NULL, NULL, 0, 0, 210),
  ('evt-017', 'demo-store-001', 'lead-demo-005', strftime('%s', 'now') * 1000 - 17940000, 'empathize', 'complaint', 'THIS IS RIDICULOUS I ORDERED 2 WEEKS AGO AND STILL NOTHING', 'I completely understand your frustration - waiting 2 weeks is not acceptable. Let me flag this for our customer service team right away so they can personally look into your order and get back to you within the hour. I am truly sorry for this experience.', NULL, NULL, 1, 0, 340);

-- Events for lead-demo-006 (Chris Brown - warm, browsing)
INSERT OR REPLACE INTO message_events (id, business_id, lead_id, timestamp, action, intent_type, user_message, agent_response, search_query, products_shown, flagged_for_human, clarification_count, processing_time_ms)
VALUES
  ('evt-018', 'demo-store-001', 'lead-demo-006', strftime('%s', 'now') * 1000 - 432000000, 'greet', 'greeting', 'What brands do you carry?', 'Hi! All our products are StyleHub originals - we design and source everything ourselves for quality and affordability. What kind of items are you interested in?', NULL, NULL, 0, 0, 220),
  ('evt-019', 'demo-store-001', 'lead-demo-006', strftime('%s', 'now') * 1000 - 345600000, 'show_products', 'product_search', 'Looking for graphic tees', 'We have some awesome graphic tees! Our Graphic Print Tee at $34.99 comes in limited edition designs:\n\n- Urban Art\n- Nature\n- Abstract\n\nAvailable in White and Black. Want to see them?', 'graphic tees', '["Graphic Print Tee"]', 0, 0, 580),
  ('evt-020', 'demo-store-001', 'lead-demo-006', strftime('%s', 'now') * 1000 - 14400000, 'answer_question', 'product_info', 'Do you have any sales coming up?', 'Great timing to ask! We usually have sales during major holidays. Sign up for our newsletter and you will be first to know. In the meantime, shipping is free on orders over $50!', NULL, NULL, 0, 0, 260);

-- Events for lead-demo-007 (Sarah Wilson - engaged, asking questions)
INSERT OR REPLACE INTO message_events (id, business_id, lead_id, timestamp, action, intent_type, user_message, agent_response, search_query, products_shown, flagged_for_human, clarification_count, processing_time_ms)
VALUES
  ('evt-021', 'demo-store-001', 'lead-demo-007', strftime('%s', 'now') * 1000 - 604800000, 'greet', 'greeting', 'Hi, first time here', 'Welcome to StyleHub Fashion! Great to have you here. We have everything from basics to statement pieces. What brings you in today?', NULL, NULL, 0, 0, 190),
  ('evt-022', 'demo-store-001', 'lead-demo-007', strftime('%s', 'now') * 1000 - 518400000, 'answer_question', 'comparison', 'How does your quality compare to other brands?', 'We pride ourselves on quality! Our cotton is sourced from premium suppliers, and we use reinforced stitching on all items. Most customers say our basics outlast similar brands. We also have a 30-day return policy if you are not satisfied!', NULL, NULL, 0, 0, 350),
  ('evt-023', 'demo-store-001', 'lead-demo-007', strftime('%s', 'now') * 1000 - 86400000, 'ask_clarification', 'product_search', 'What do you recommend?', 'I would love to help! Are you looking for something specific like work clothes, casual weekend wear, or athleisure?', NULL, NULL, 0, 1, 240);

-- Events for lead-demo-008 (Anonymous warm lead)
INSERT OR REPLACE INTO message_events (id, business_id, lead_id, timestamp, action, intent_type, user_message, agent_response, search_query, products_shown, flagged_for_human, clarification_count, processing_time_ms)
VALUES
  ('evt-024', 'demo-store-001', 'lead-demo-008', strftime('%s', 'now') * 1000 - 345600000, 'greet', 'greeting', 'hey', 'Hey! What can I help you find today?', NULL, NULL, 0, 0, 155),
  ('evt-025', 'demo-store-001', 'lead-demo-008', strftime('%s', 'now') * 1000 - 259200000, 'show_products', 'product_search', 'accessories', 'Here are our accessories:\n\n1. Canvas Belt - $24.99\n2. Baseball Cap - $19.99\n3. Tote Bag - $29.99\n\nAll great quality at affordable prices!', 'accessories', '["Canvas Belt", "Baseball Cap", "Tote Bag"]', 0, 0, 620),
  ('evt-026', 'demo-store-001', 'lead-demo-008', strftime('%s', 'now') * 1000 - 43200000, 'answer_question', 'product_info', 'Is the tote bag big enough for a laptop?', 'Yes! The Tote Bag dimensions are 15" x 16" x 4" - it will fit most 15-inch laptops with room to spare. The heavy-duty canvas is sturdy enough to handle the weight too!', NULL, NULL, 0, 0, 290);

-- ============================================
-- Conversation Summaries
-- ============================================

INSERT OR REPLACE INTO conversation_summaries (id, lead_id, summary, key_interests, objections, next_steps, updated_at)
VALUES
  ('sum-001', 'lead-demo-001', 'Customer interested in black Essential Pullover Hoodie size L. Asked about material and shipping. Close to purchase.', '["hoodies", "black", "size L"]', NULL, 'Follow up on purchase decision', strftime('%s', 'now') * 1000),
  ('sum-002', 'lead-demo-002', 'Looking for casual summer outfits. Shown multiple options across categories. Still browsing and comparing.', '["casual wear", "summer", "t-shirts"]', NULL, 'Follow up with personalized recommendations', strftime('%s', 'now') * 1000),
  ('sum-003', 'lead-demo-003', 'Interested in jeans, specifically slim fit. Asked about pricing. Good engagement level.', '["jeans", "slim fit"]', NULL, 'Send size guide if they return', strftime('%s', 'now') * 1000),
  ('sum-004', 'lead-demo-004', 'Ready to checkout with complete outfit: V-Neck Tee, Slim Fit Jeans, Canvas Belt. Total $144.97. Provided sizing recommendations.', '["complete outfit", "v-neck tee", "jeans", "belt"]', NULL, 'Send checkout link', strftime('%s', 'now') * 1000),
  ('sum-005', 'lead-demo-005', 'Customer frustrated about delayed order. Complaint escalated to human support. High priority for resolution.', '[]', '["order delay", "shipping issue"]', 'Human follow-up required ASAP', strftime('%s', 'now') * 1000),
  ('sum-006', 'lead-demo-006', 'Interested in graphic tees and sales. Casual browser, signed up for newsletter interest.', '["graphic tees", "sales"]', NULL, 'Notify when sale starts', strftime('%s', 'now') * 1000)
