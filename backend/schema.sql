CREATE TABLE IF NOT EXISTS admin_users (id BIGSERIAL PRIMARY KEY,email TEXT NOT NULL UNIQUE,password_hash TEXT NOT NULL,role TEXT NOT NULL DEFAULT 'admin' CHECK(role IN ('admin','editor')),is_active BOOLEAN NOT NULL DEFAULT TRUE,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
CREATE TABLE IF NOT EXISTS site_content (content_key TEXT PRIMARY KEY,content_value JSONB NOT NULL DEFAULT '{}'::jsonb,updated_by BIGINT REFERENCES admin_users(id) ON DELETE SET NULL,updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
CREATE TABLE IF NOT EXISTS activities (id BIGSERIAL PRIMARY KEY,title TEXT NOT NULL,summary TEXT NOT NULL,body TEXT NOT NULL DEFAULT '',image_url TEXT NOT NULL DEFAULT '',category TEXT NOT NULL DEFAULT 'Company Update',location TEXT NOT NULL DEFAULT '',status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','published')),published_at TIMESTAMPTZ,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
CREATE TABLE IF NOT EXISTS testimonials (id BIGSERIAL PRIMARY KEY,customer_name TEXT NOT NULL,organization TEXT NOT NULL DEFAULT '',quote TEXT NOT NULL,is_published BOOLEAN NOT NULL DEFAULT FALSE,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
CREATE TABLE IF NOT EXISTS inquiries (id BIGSERIAL PRIMARY KEY,full_name TEXT NOT NULL,organization TEXT NOT NULL DEFAULT '',email TEXT NOT NULL,phone TEXT NOT NULL,service TEXT NOT NULL,message TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'new' CHECK(status IN ('new','in_progress','responded','closed')),created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
CREATE TABLE IF NOT EXISTS audit_logs (id BIGSERIAL PRIMARY KEY,admin_id BIGINT REFERENCES admin_users(id) ON DELETE SET NULL,action TEXT NOT NULL,entity_type TEXT NOT NULL,entity_id TEXT,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
CREATE INDEX IF NOT EXISTS idx_activities_status_published ON activities(status,published_at DESC);
CREATE INDEX IF NOT EXISTS idx_inquiries_status_created ON inquiries(status,created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at DESC);
INSERT INTO site_content(content_key,content_value) VALUES
('welcome_message','"Welcome to Silvateralink Rwanda Ltd. Thank you for visiting — let us grow sustainable solutions together."'),
('hero_subtitle','"A Rwandan company providing professional forestry, environmental, agronomy, and sustainable land-management services."'),
('hero_description','"We deliver practical, data-driven solutions that support environmental sustainability, climate resilience, forest restoration, and improved community livelihoods."'),
('company_slogan','"Growing Sustainable Solutions."'),
('project_intro','"Our team brings practical experience from forestry, environmental management, agroforestry, GIS, community engagement and sustainable development projects across Rwanda."'),
('contact','{"phone":"+250 787 103 957","email":"forestgaspard@gmail.com","location":"Rubavu District, Western Province, Rwanda","office_hours":"Monday - Saturday, 8:00 AM - 5:00 PM CAT"}'::jsonb)
ON CONFLICT(content_key) DO NOTHING;