# Singhaniya Decor — MERN

Full-stack catalogue + admin CMS. React/Vite frontend, Express/Node API, MongoDB/Mongoose, JWT admin auth and local image uploads.

## Quick start
1. Install Node 20+ and MongoDB.
2. Copy `.env.example` to `server/.env` and edit values.
3. `npm install`
4. `npm run install:all`
5. `npm run seed`
6. `npm run dev`
7. Site: http://localhost:5173 — Admin: http://localhost:5173/admin/login

Default seeded admin comes from `ADMIN_EMAIL` / `ADMIN_PASSWORD` in `server/.env`.

## Production
Run `npm run build`, then `npm start`. The Express server serves `client/dist` automatically. Set `CLIENT_URL` and MongoDB URI appropriately.

## Admin features
Products, categories, projects, testimonials and site settings can be added/edited/deleted. Product/project images can be uploaded locally to `server/uploads`.
