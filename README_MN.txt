ONI & KISHIN — PREMIUM PRODUCTION READY V19

GitHub Pages:
- index.html -> root
- admin.html -> root

Firebase:
- Project: oni-kishin-f59b4
- Firestore Rules: firestore.rules
- Storage Rules: storage.rules

Admin:
- Firebase Authentication with an `oni_role` custom claim
- See SECURITY.md for role provisioning; do not hard-code administrator emails

Core collections:
- members
- applications
- garage
- products
- gallery
- orders
- orderTracking
- site

Production features:
- 23 requested service line-items
- Anime/Clean/Drift/Rare car marketplace
- Search + category filters
- Product detail + model/style/livery/build/price/stock/status
- 3-step checkout
- Atomic stock transaction
- Realtime customer order tracking using a non-sensitive tracking collection
- Admin product/gallery/order CRUD
- Firebase Storage image upload + WebP optimization
- Gallery -> Shop build linking via productId
- Payment workflow through admin status; no QPay required
- No account passwords stored by the site
