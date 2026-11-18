# Silvateralink Admin Backend

Secure admin dashboard and API for Silvateralink Rwanda Ltd.

## Included
- Private admin dashboard at /admin
- First administrator bootstrapped from environment variables; no default password in source control
- Hashed passwords, signed 8-hour HttpOnly cookie sessions, login rate limiting and role checks
- Editable welcome message, homepage copy, slogan, projects introduction and contact information
- Draft and published company activities/projects
- Customer inquiry capture and status management
- Testimonials, overview counts and administrator audit log
- PostgreSQL schema and public content API

## Local setup
1. Install Node.js 20+ and PostgreSQL.
2. Open this directory and run npm install.
3. Copy .env.example to .env.
4. Configure DATABASE_URL, a random JWT_SECRET with at least 32 characters, ADMIN_EMAIL, ADMIN_PASSWORD with at least 12 characters, and SITE_ORIGIN.
5. Run npm start. The database schema is initialized automatically.
6. Open http://localhost:4000/admin.

## Main API routes
- GET /api/health
- POST /api/auth/login, POST /api/auth/logout, GET /api/auth/me, POST /api/auth/change-password
- GET /api/public/content, POST /api/public/inquiries
- Authenticated /api/admin/overview, /content, /activities, /inquiries, /testimonials and /audit

## Production
Deploy the backend directory as a Node web service backed by persistent PostgreSQL. Add all environment variables in the hosting provider; never commit .env or credentials. Use HTTPS and a unique JWT secret. The default HttpOnly session cookie is intended for the admin dashboard and API on the same origin. For a separate public website origin, set the exact website origin in SITE_ORIGIN and configure the API base URL in site-integration.js.

The public website is a static HTML page. site-integration.js reads published content and sends contact-form submissions to this API. It also renders published activities in the Projects section. More static page fields can be made editable by extending that integration file.
