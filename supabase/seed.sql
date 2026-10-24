-- ============================================================
-- Starter content for the Rugistan store.
-- Catalogue, CMS pages and store settings only.
-- No orders, customers, reviews or revenue are fabricated.
-- ============================================================

-- ---------- store settings ----------
insert into public.settings (key, value) values
('store', jsonb_build_object(
   'name','Rugistan',
   'tagline','HANDMADE RUGS',
   'email','',
   'phone','',
   'whatsapp','',
   'location','',
   'currency','USD',
   'currency_symbol','$',
   'timezone','Asia/Karachi',
   'logo_url','',
   'favicon_url','',
   'announcement', jsonb_build_array('Free Shipping on All Rugs','Handmade  |  Natural Materials  |  Timeless Designs','Customer Care'),
   'social', jsonb_build_object('instagram','','pinterest','','facebook',''))),
('payments', jsonb_build_object(
   'offline_methods', jsonb_build_array(
     jsonb_build_object('id','cod','label','Cash on Delivery','enabled',true,
       'marks_as','unpaid',
       'instructions','Pay the courier in cash when your rug is delivered.'),
     jsonb_build_object('id','bank_transfer','label','Bank Transfer','enabled',false,
       'marks_as','awaiting_confirmation',
       'instructions','Bank account details will be emailed with your order confirmation.')),
   'gateways', jsonb_build_array())),
('contact_page', jsonb_build_object(
   'email_note','Contact information to be configured',
   'phone_note','Business number to be configured',
   'location_note','Showroom information to be confirmed'))
on conflict (key) do nothing;

-- ---------- delivery ----------
insert into public.shipping_methods (name, description, amount, is_active, sort_order) values
('Standard Delivery','Delivered within 5–8 working days.', 0,  true, 1),
('Express Delivery','Delivered within 2–3 working days where available.', 35, true, 2)
on conflict do nothing;

-- ---------- categories ----------
insert into public.categories (name, slug, description, image_url, sort_order) values
('Traditional Rugs','traditional-rugs','Traditional patterns and rich heritage','/assets/rug_lifestyle_1.jpg',1),
('Modern Rugs','modern-rugs','Sculptural texture for modern homes','/assets/rug_lifestyle_3.jpg',2),
('Solid & Minimal','solid-minimal','Clean calm and understated luxury','/assets/rug_lifestyle_2.jpg',3),
('Custom Rugs','custom-rugs','Created for your unique space','/assets/rug_lifestyle_4.jpg',4)
on conflict (slug) do nothing;

-- ---------- products ----------
with c as (select slug, id from public.categories)
insert into public.products
  (name, slug, sku, short_description, description, category_id, price, stock_quantity,
   material, dimensions, weave_technique, color, colors, room, style, status, is_featured)
values
('Turquoise Heritage Rug','turquoise-heritage-rug','RG-101',
 'An exquisite handwoven rug with a vibrant turquoise palette and a timeless artisan motif.',
 'A richly patterned heritage rug, hand-knotted in natural wool. The turquoise field is framed by a traditional border, giving the piece depth and presence in both classic and contemporary rooms.',
 (select id from c where slug='traditional-rugs'), 299.00, 12,
 'Natural Wool','5 × 8 ft','Hand-knotted','Turquoise Blue',
 '[{"name":"Turquoise","hex":"#528c9b"},{"name":"Sand","hex":"#e2d4bf"},{"name":"Stone","hex":"#a8a299"}]'::jsonb,
 'Living Room','Traditional','published', true),

('Skyline Wool Rug','skyline-wool-rug','RG-102',
 'A modern handmade wool rug with quiet linear textures and soft blue tones.',
 'Clean linear texture and a dusty blue palette make this a calm centrepiece for considered living spaces. Hand-woven from natural wool with a dense, soft pile.',
 (select id from c where slug='modern-rugs'), 249.00, 9,
 'Natural Wool','5 × 8 ft','Handwoven','Dusty Blue',
 '[{"name":"Dusty Blue","hex":"#528c9b"},{"name":"Ivory","hex":"#e2d4bf"},{"name":"Ash","hex":"#a8a299"}]'::jsonb,
 'Living Room','Modern','published', true),

('Sand Textured Rug','sand-textured-rug','RG-103',
 'Understated texture in warm neutral tones for calm, minimal interiors.',
 'A quietly luxurious flat-weave in warm sand tones. The subtle tonal variation comes from undyed natural fibres, so no two rugs are identical.',
 (select id from c where slug='solid-minimal'), 279.00, 7,
 'Wool & Cotton','6 × 9 ft','Flat-weave','Warm Sand',
 '[{"name":"Sand","hex":"#e2d4bf"},{"name":"Stone","hex":"#a8a299"}]'::jsonb,
 'Bedroom','Solid','published', true),

('Classic Pattern Rug','classic-pattern-rug','RG-104',
 'A generous classic motif rendered in soft, liveable colour.',
 'An heirloom-style medallion pattern, hand-knotted and finished by hand. Built for busy rooms with a dense wool pile that holds its shape.',
 (select id from c where slug='traditional-rugs'), 329.00, 5,
 'Natural Wool','8 × 10 ft','Hand-knotted','Terracotta',
 '[{"name":"Terracotta","hex":"#a8745a"},{"name":"Sand","hex":"#e2d4bf"}]'::jsonb,
 'Dining Room','Traditional','published', true),

('Artisan Blue Rug','artisan-blue-rug','RG-105',
 'Expressive blue tones and visible handwork in a statement piece.',
 'The deep indigo field is broken by hand-drawn motifs, each knotted individually. A statement rug for rooms that can carry colour.',
 (select id from c where slug='modern-rugs'), 349.00, 2,
 'Natural Wool','6 × 9 ft','Hand-knotted','Indigo',
 '[{"name":"Indigo","hex":"#3f5f78"},{"name":"Stone","hex":"#a8a299"}]'::jsonb,
 'Living Room','Geometric','published', true),

('Custom Handwoven Rug','custom-handwoven-rug','RG-106',
 'Commission a rug made to your room, your palette and your pattern.',
 'Tell us the dimensions, colours and feel you are after and our weavers will produce a one-off piece. Lead times and pricing are confirmed by our team before any order is placed.',
 (select id from c where slug='custom-rugs'), 399.00, 4,
 'Natural Wool','Made to measure','Handwoven','Made to order',
 '[{"name":"Your palette","hex":"#b78655"}]'::jsonb,
 'Living Room','Vintage','published', false),

('Ocean Weave Rug','ocean-weave-rug','RG-107',
 'Cool tonal bands inspired by shoreline light.',
 'Soft gradient bands in sea blues and greys, flat-woven for a low profile that suits hallways and under furniture.',
 (select id from c where slug='modern-rugs'), 289.00, 8,
 'Wool & Jute','5 × 8 ft','Flat-weave','Sea Blue',
 '[{"name":"Sea Blue","hex":"#668d98"},{"name":"Ash","hex":"#a8a299"}]'::jsonb,
 'Hallway','Modern','published', false),

('Natural Wool Rug','natural-wool-rug','RG-108',
 'Undyed wool in its own colour — the quietest rug we make.',
 'Completely undyed natural wool, hand-woven in a simple basket texture. A calm foundation for rooms built on texture rather than pattern.',
 (select id from c where slug='solid-minimal'), 269.00, 11,
 'Natural Wool','6 × 9 ft','Handwoven','Undyed Cream',
 '[{"name":"Cream","hex":"#e2d4bf"}]'::jsonb,
 'Bedroom','Solid','published', false)
on conflict (slug) do nothing;

-- ---------- product images ----------
insert into public.product_images (product_id, url, alt, sort_order)
select p.id, v.url, p.name, v.ord
from public.products p
join (values
  ('turquoise-heritage-rug','/assets/rug_lifestyle_1.jpg',0),
  ('turquoise-heritage-rug','/assets/rug_handmade_blue.jpg',1),
  ('turquoise-heritage-rug','/assets/blue_rug_interior.jpg',2),
  ('skyline-wool-rug','/assets/blue_rug_interior.jpg',0),
  ('skyline-wool-rug','/assets/rug_lifestyle_3.jpg',1),
  ('skyline-wool-rug','/assets/rug_handmade_blue.jpg',2),
  ('skyline-wool-rug','/assets/rug_lifestyle_2.jpg',3),
  ('sand-textured-rug','/assets/rug_lifestyle_2.jpg',0),
  ('sand-textured-rug','/assets/rug_lifestyle_4.jpg',1),
  ('classic-pattern-rug','/assets/rug_lifestyle_4.jpg',0),
  ('classic-pattern-rug','/assets/rug_lifestyle_1.jpg',1),
  ('artisan-blue-rug','/assets/blue_rug_interior.jpg',0),
  ('artisan-blue-rug','/assets/rug_handmade_blue.jpg',1),
  ('custom-handwoven-rug','/assets/rug_handmade_blue.jpg',0),
  ('custom-handwoven-rug','/assets/rug_lifestyle_3.jpg',1),
  ('ocean-weave-rug','/assets/rug_lifestyle_3.jpg',0),
  ('ocean-weave-rug','/assets/blue_rug_interior.jpg',1),
  ('natural-wool-rug','/assets/rug_lifestyle_2.jpg',0),
  ('natural-wool-rug','/assets/rug_lifestyle_1.jpg',1)
) as v(slug,url,ord) on v.slug = p.slug;

-- ---------- size variants ----------
insert into public.product_variants (product_id, label, price_delta, stock_quantity, sort_order)
select p.id, v.label, v.delta, greatest(p.stock_quantity / 4, 1), v.ord
from public.products p
cross join (values
  ('5′ × 8′',   0.00, 1),
  ('6′ × 9′',  60.00, 2),
  ('8′ × 10′',140.00, 3),
  ('9′ × 12′',240.00, 4)
) as v(label,delta,ord)
where p.slug <> 'custom-handwoven-rug';

insert into public.product_variants (product_id, label, price_delta, stock_quantity, sort_order)
select id, 'Custom Size', 0, stock_quantity, 1 from public.products where slug = 'custom-handwoven-rug';

-- keep the product-level stock figure equal to the sum of its size variants
update public.products p
   set stock_quantity = coalesce((select sum(v.stock_quantity) from public.product_variants v where v.product_id = p.id), p.stock_quantity);

-- ---------- homepage banners ----------
insert into public.banners (title, subtitle, eyebrow, placement, image_url, link_url, cta_label, sort_order) values
('Tradition Woven Into Every Thread.',
 'Discover timeless handmade rugs, thoughtfully crafted to bring warmth, beauty, and character into your home.',
 'Handmade Rugs for a Brighter Home','home_hero','/assets/rug_lifestyle_1.jpg','/shop','Shop Collection',1),
('Rugs for Every Space',
 'Discover timeless handmade rugs, thoughtfully crafted to bring warmth, beauty, and character into your home.',
 'EXPLORE ROOM BY ROOM','home_lifestyle','/assets/rug_handmade_blue.jpg','/shop','Shop by Room',2),
('A Story of People, Tradition & Craft',
 'Every Rugistan piece celebrates handmade textures and the artistry that turns natural fibers into treasured pieces.',
 'OUR CRAFTSMANSHIP','home_story','/assets/blue_rug_interior.jpg','/our-story','Discover Our Story',3),
('Beautiful Rugs, Beautiful Homes',
 'Find your perfect centrepiece.','','shop_lifestyle','/assets/rug_lifestyle_1.jpg','/collections','Explore Collections',4)
on conflict do nothing;

-- ---------- CMS pages ----------
insert into public.pages (title, slug, hero_heading, meta_title, meta_description, hero_image_url, content, status, is_system) values
('Our Story','our-story','A Story Woven by Hand','Our Story — Rugistan Handmade Rugs',
 'Rooted in heritage, made for modern homes. Discover the craftsmanship behind Rugistan.',
 '/assets/rug_handmade_blue.jpg',
 E'<h2>Rooted in Heritage, Made for Modern Homes</h2>\n<p>Rugistan brings together authentic textures, expressive patterns, and natural materials in pieces that enrich everyday life. Every rug has its own character and a story to share.</p>\n<h2>Every Knot Matters</h2>\n<p>Thoughtful material selection, careful weaving and hand finishing define the character of each rug.</p>',
 'published', true),
('Rug Care','rug-care','Rug Care','Rug Care — Rugistan Handmade Rugs',
 'Simple everyday care for a longer and more beautiful rug life.',
 '/assets/blue_rug_interior.jpg',
 E'<p>Thoughtful habits help preserve natural textures and artisan details. The guidance below applies to most handmade wool rugs; always check the care note supplied with your piece.</p>',
 'published', true),
('Contact','contact','Contact Us','Contact — Rugistan Handmade Rugs',
 'Questions about rugs, sizing, or custom orders? Our team would love to hear from you.',
 '/assets/rug_lifestyle_1.jpg','', 'published', true),
('Shipping & Returns','shipping-and-returns','Shipping & Returns','Shipping & Returns — Rugistan',
 'Delivery timeframes and our returns process.','/assets/rug_lifestyle_2.jpg',
 E'<h2>Delivery</h2>\n<p>Delivery options and charges are shown at checkout and depend on your address.</p>\n<h2>Returns</h2>\n<p>Contact our team within 14 days of delivery to arrange a return. Custom-made rugs are produced to your specification and cannot be returned.</p>',
 'published', false),
('Size Guide','size-guide','Choosing a Rug Size','Rug Size Guide — Rugistan',
 'How to choose the right rug size for your room.','/assets/rug_lifestyle_4.jpg',
 E'<h2>Living rooms</h2>\n<p>Aim for the front legs of all seating to sit on the rug. An 8 × 10 ft rug suits most standard living rooms.</p>\n<h2>Bedrooms</h2>\n<p>A 6 × 9 ft rug placed two thirds of the way under the bed leaves a soft border on three sides.</p>\n<h2>Dining rooms</h2>\n<p>Allow at least 60 cm beyond the table edge on every side so chairs stay on the rug when pulled out.</p>',
 'published', false),
('FAQs','faqs','Frequently Asked Questions','FAQs — Rugistan Handmade Rugs',
 'Answers to common questions about our handmade rugs.','/assets/rug_lifestyle_3.jpg',
 E'<h2>Are the rugs really handmade?</h2>\n<p>Yes. Every rug is hand-knotted or hand-woven by our artisan partners.</p>\n<h2>Can I order a custom size?</h2>\n<p>Yes — start a custom enquiry from the Custom Rugs collection and our team will confirm pricing and lead time before any order is placed.</p>',
 'published', false),
('Privacy Policy','privacy-policy','Privacy Policy','Privacy Policy — Rugistan',
 'How Rugistan handles your personal information.', null,
 E'<p>This policy is being prepared and must be reviewed before the store goes live.</p>',
 'draft', false)
on conflict (slug) do nothing;

-- ---------- rug care content blocks ----------
insert into public.settings (key, value) values
('rug_care', jsonb_build_object(
  'tips', jsonb_build_array(
    jsonb_build_object('title','Regular Cleaning','body','Vacuum gently and follow your rug''s fiber-specific recommendations.','image','/assets/rug_lifestyle_1.jpg'),
    jsonb_build_object('title','Handle Spills Quickly','body','Blot with a dry, clean cloth; avoid scrubbing or harsh chemicals.','image','/assets/rug_lifestyle_3.jpg'),
    jsonb_build_object('title','Rotate Occasionally','body','Rotate to balance natural light exposure and foot traffic.','image','/assets/rug_lifestyle_2.jpg'),
    jsonb_build_object('title','Thoughtful Storage','body','Clean and dry before loosely rolling in breathable wrapping.','image','/assets/rug_lifestyle_4.jpg'),
    jsonb_build_object('title','Preserve Natural Fibers','body','Avoid excessive moisture and prolonged strong sunlight.','image','/assets/blue_rug_interior.jpg'),
    jsonb_build_object('title','Professional Care','body','Seek an experienced rug cleaner for specialist treatment.','image','/assets/rug_handmade_blue.jpg')),
  'faqs', jsonb_build_array(
    jsonb_build_object('q','How often should I vacuum?','a','Once a week for busy rooms is a good rhythm. Use suction only and avoid a rotating beater bar, which can pull at the pile.'),
    jsonb_build_object('q','What should I do after a spill?','a','Blot immediately with a dry, clean cloth working from the outside in. Do not rub, and avoid household detergents on wool.'),
    jsonb_build_object('q','Can rugs be used in busy areas?','a','Yes. Hand-knotted wool is well suited to hallways and living rooms; rotate the rug twice a year to even out wear.'),
    jsonb_build_object('q','Should I use a steam cleaner?','a','We do not recommend steam cleaning handmade wool rugs. Excess moisture can affect the foundation and natural dyes.'),
    jsonb_build_object('q','How do I store a wool rug?','a','Clean and fully dry the rug, then roll it pile-side in with a breathable cotton wrap. Avoid plastic and damp spaces.'),
    jsonb_build_object('q','How often is professional cleaning needed?','a','Every two to three years for most homes, or sooner if the rug sits in a high-traffic area.'))))
on conflict (key) do nothing;
