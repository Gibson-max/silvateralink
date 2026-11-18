require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const bcrypt = require('bcryptjs');
const rateLimit = require('express-rate-limit');
const { z } = require('zod');
const { pool } = require('./db');
const { issueToken, requireAuth, requireAdmin } = require('./auth');
const app = express();
const origins = (process.env.SITE_ORIGIN || '').split(',').map(x => x.trim()).filter(Boolean);
app.disable('x-powered-by');
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' }, contentSecurityPolicy: { directives: { defaultSrc: ["'self'"], scriptSrc: ["'self'", "'unsafe-inline'", 'https://cdn.tailwindcss.com'], styleSrc: ["'self'", "'unsafe-inline'"], imgSrc: ["'self'", 'data:', 'https:'], connectSrc: ["'self'"], fontSrc: ["'self'", 'https:', 'data:'] } } }));
app.use(cors({ origin(origin, cb) { if (!origin || !origins.length || origins.includes(origin)) return cb(null, true); cb(new Error('Origin is not allowed by CORS.')); }, credentials: true }));
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());
const loginLimit = rateLimit({ windowMs: 900000, limit: 8, standardHeaders: 'draft-7', legacyHeaders: false });
const inquiryLimit = rateLimit({ windowMs: 3600000, limit: 15, standardHeaders: 'draft-7', legacyHeaders: false });
const asyncRoute = fn => (req,res,next) => Promise.resolve(fn(req,res,next)).catch(next);
const loginSchema = z.object({ email:z.string().email().max(254), password:z.string().min(1).max(200) });
const contentSchema = z.object({ value:z.unknown() });
const activitySchema = z.object({ title:z.string().trim().min(3).max(160), summary:z.string().trim().min(5).max(500), body:z.string().max(12000).optional().default(''), image_url:z.string().url().max(1500).or(z.literal('')).optional().default(''), category:z.string().trim().max(80).optional().default('Company Update'), location:z.string().trim().max(120).optional().default(''), status:z.enum(['draft','published']).optional().default('draft') });
const inquirySchema = z.object({ full_name:z.string().trim().min(2).max(120), organization:z.string().trim().max(160).optional().default(''), email:z.string().trim().email().max(254), phone:z.string().trim().min(7).max(40), service:z.string().trim().min(2).max(120), message:z.string().trim().min(10).max(5000) });
const audit = (id,action,type,entity=null) => pool.query('INSERT INTO audit_logs(admin_id,action,entity_type,entity_id) VALUES($1,$2,$3,$4)',[id,action,type,entity]);

app.get('/api/health',(req,res)=>res.json({status:'ok',service:'Silvateralink Admin API'}));
app.post('/api/auth/login',loginLimit,asyncRoute(async(req,res)=>{
  const p=loginSchema.safeParse(req.body); if(!p.success)return res.status(400).json({error:'Enter a valid email and password.'});
  const q=await pool.query('SELECT id,email,password_hash,role,is_active FROM admin_users WHERE lower(email)=lower($1)',[p.data.email]);
  const u=q.rows[0]; if(!u||!u.is_active||!(await bcrypt.compare(p.data.password,u.password_hash)))return res.status(401).json({error:'Incorrect email or password.'});
  const token=issueToken(u); res.cookie('sl_admin',token,{httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'lax',maxAge:28800000,path:'/'});
  await audit(u.id,'login','session'); res.json({admin:{id:u.id,email:u.email,role:u.role}});
}));
app.post('/api/auth/logout',(req,res)=>{res.clearCookie('sl_admin',{httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'lax',path:'/'});res.json({message:'Signed out.'});});
app.get('/api/auth/me',requireAuth,asyncRoute(async(req,res)=>{const q=await pool.query('SELECT id,email,role FROM admin_users WHERE id=$1 AND is_active=TRUE',[req.admin.sub]);if(!q.rowCount)return res.status(401).json({error:'Administrator account unavailable.'});res.json({admin:q.rows[0]});}));
app.post('/api/auth/change-password',requireAuth,asyncRoute(async(req,res)=>{
  const p=z.object({currentPassword:z.string().min(1),newPassword:z.string().min(12).max(200)}).safeParse(req.body);if(!p.success)return res.status(400).json({error:'New password must contain at least 12 characters.'});
  const q=await pool.query('SELECT password_hash FROM admin_users WHERE id=$1',[req.admin.sub]);if(!q.rowCount||!(await bcrypt.compare(p.data.currentPassword,q.rows[0].password_hash)))return res.status(400).json({error:'Current password is incorrect.'});
  await pool.query('UPDATE admin_users SET password_hash=$1,updated_at=NOW() WHERE id=$2',[await bcrypt.hash(p.data.newPassword,12),req.admin.sub]);await audit(req.admin.sub,'password_changed','admin');
  res.clearCookie('sl_admin',{httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'lax',path:'/'});res.json({message:'Password updated. Sign in again.'});
}));
app.get('/api/public/content',asyncRoute(async(req,res)=>{
  const [c,a,t]=await Promise.all([pool.query('SELECT content_key,content_value FROM site_content'),pool.query("SELECT id,title,summary,body,image_url,category,location,published_at FROM activities WHERE status='published' ORDER BY published_at DESC NULLS LAST,created_at DESC LIMIT 12"),pool.query('SELECT id,customer_name,organization,quote FROM testimonials WHERE is_published=TRUE ORDER BY created_at DESC LIMIT 12')]);
  res.set('Cache-Control','public,max-age=60,stale-while-revalidate=300');res.json({content:Object.fromEntries(c.rows.map(x=>[x.content_key,x.content_value])),activities:a.rows,testimonials:t.rows});
}));
app.post('/api/public/inquiries',inquiryLimit,asyncRoute(async(req,res)=>{
  const p=inquirySchema.safeParse(req.body);if(!p.success)return res.status(400).json({error:'Please complete all required fields correctly.'});const d=p.data;
  const q=await pool.query('INSERT INTO inquiries(full_name,organization,email,phone,service,message) VALUES($1,$2,$3,$4,$5,$6) RETURNING id',[d.full_name,d.organization,d.email,d.phone,d.service,d.message]);
  res.status(201).json({message:'Thank you. Your inquiry has been received.',id:q.rows[0].id});
}));
app.use('/api/admin',requireAuth);
app.get('/api/admin/overview',asyncRoute(async(req,res)=>{
  const [i,a,t,r]=await Promise.all([pool.query("SELECT COUNT(*)::int total,COUNT(*) FILTER(WHERE status='new')::int new FROM inquiries"),pool.query("SELECT COUNT(*)::int total,COUNT(*) FILTER(WHERE status='published')::int published FROM activities"),pool.query('SELECT COUNT(*)::int total FROM testimonials'),pool.query('SELECT id,full_name,email,service,status,created_at FROM inquiries ORDER BY created_at DESC LIMIT 6')]);
  res.json({inquiries:i.rows[0],activities:a.rows[0],testimonials:t.rows[0],recent:r.rows});
}));
app.get('/api/admin/content',asyncRoute(async(req,res)=>{const q=await pool.query('SELECT content_key,content_value,updated_at FROM site_content ORDER BY content_key');res.json({items:q.rows});}));
app.put('/api/admin/content/:key',asyncRoute(async(req,res)=>{
  const key=req.params.key.toLowerCase();if(!/^[a-z0-9_-]{2,80}$/.test(key))return res.status(400).json({error:'Invalid content key.'});const p=contentSchema.safeParse(req.body);if(!p.success)return res.status(400).json({error:'Content value is required.'});
  await pool.query('INSERT INTO site_content(content_key,content_value,updated_by,updated_at) VALUES($1,$2,$3,NOW()) ON CONFLICT(content_key) DO UPDATE SET content_value=EXCLUDED.content_value,updated_by=EXCLUDED.updated_by,updated_at=NOW()',[key,JSON.stringify(p.data.value),req.admin.sub]);await audit(req.admin.sub,'content_updated','site_content',key);res.json({message:'Website content saved.'});
}));
app.get('/api/admin/activities',asyncRoute(async(req,res)=>{const q=await pool.query('SELECT * FROM activities ORDER BY created_at DESC');res.json({items:q.rows});}));
app.post('/api/admin/activities',asyncRoute(async(req,res)=>{
  const p=activitySchema.safeParse(req.body);if(!p.success)return res.status(400).json({error:p.error.issues[0].message});const d=p.data;
  const q=await pool.query("INSERT INTO activities(title,summary,body,image_url,category,location,status,published_at) VALUES($1,$2,$3,$4,$5,$6,$7,CASE WHEN $7='published' THEN NOW() ELSE NULL END) RETURNING *",[d.title,d.summary,d.body,d.image_url,d.category,d.location,d.status]);await audit(req.admin.sub,'activity_created','activity',q.rows[0].id);res.status(201).json({item:q.rows[0]});
}));
app.put('/api/admin/activities/:id',asyncRoute(async(req,res)=>{
  const p=activitySchema.safeParse(req.body);if(!p.success)return res.status(400).json({error:p.error.issues[0].message});const d=p.data;
  const q=await pool.query("UPDATE activities SET title=$1,summary=$2,body=$3,image_url=$4,category=$5,location=$6,status=$7,published_at=CASE WHEN $7='published' THEN COALESCE(published_at,NOW()) ELSE NULL END,updated_at=NOW() WHERE id=$8 RETURNING *",[d.title,d.summary,d.body,d.image_url,d.category,d.location,d.status,req.params.id]);if(!q.rowCount)return res.status(404).json({error:'Activity not found.'});await audit(req.admin.sub,'activity_updated','activity',req.params.id);res.json({item:q.rows[0]});
}));
app.delete('/api/admin/activities/:id',requireAdmin,asyncRoute(async(req,res)=>{await pool.query('DELETE FROM activities WHERE id=$1',[req.params.id]);await audit(req.admin.sub,'activity_deleted','activity',req.params.id);res.json({message:'Activity deleted.'});}));
app.get('/api/admin/inquiries',asyncRoute(async(req,res)=>{const status=req.query.status;const valid=['new','in_progress','responded','closed'];if(status&&!valid.includes(status))return res.status(400).json({error:'Invalid status filter.'});const q=await pool.query('SELECT * FROM inquiries WHERE ($1::text IS NULL OR status=$1) ORDER BY created_at DESC LIMIT 250',[status||null]);res.json({items:q.rows});}));
app.patch('/api/admin/inquiries/:id',asyncRoute(async(req,res)=>{const p=z.object({status:z.enum(['new','in_progress','responded','closed'])}).safeParse(req.body);if(!p.success)return res.status(400).json({error:'Invalid status.'});const q=await pool.query('UPDATE inquiries SET status=$1 WHERE id=$2 RETURNING *',[p.data.status,req.params.id]);if(!q.rowCount)return res.status(404).json({error:'Inquiry not found.'});await audit(req.admin.sub,'inquiry_status_changed','inquiry',req.params.id);res.json({item:q.rows[0]});}));
app.get('/api/admin/testimonials',asyncRoute(async(req,res)=>{const q=await pool.query('SELECT * FROM testimonials ORDER BY created_at DESC');res.json({items:q.rows});}));
app.post('/api/admin/testimonials',asyncRoute(async(req,res)=>{const p=z.object({customer_name:z.string().trim().min(2).max(120),organization:z.string().trim().max(160).optional().default(''),quote:z.string().trim().min(5).max(1200),is_published:z.boolean().optional().default(false)}).safeParse(req.body);if(!p.success)return res.status(400).json({error:'Please provide a name and testimonial.'});const d=p.data;const q=await pool.query('INSERT INTO testimonials(customer_name,organization,quote,is_published) VALUES($1,$2,$3,$4) RETURNING *',[d.customer_name,d.organization,d.quote,d.is_published]);await audit(req.admin.sub,'testimonial_created','testimonial',q.rows[0].id);res.status(201).json({item:q.rows[0]});}));
app.patch('/api/admin/testimonials/:id',asyncRoute(async(req,res)=>{const p=z.object({is_published:z.boolean()}).safeParse(req.body);if(!p.success)return res.status(400).json({error:'Invalid publication setting.'});const q=await pool.query('UPDATE testimonials SET is_published=$1 WHERE id=$2 RETURNING *',[p.data.is_published,req.params.id]);if(!q.rowCount)return res.status(404).json({error:'Testimonial not found.'});await audit(req.admin.sub,'testimonial_visibility_changed','testimonial',req.params.id);res.json({item:q.rows[0]});}));
app.delete('/api/admin/testimonials/:id',requireAdmin,asyncRoute(async(req,res)=>{await pool.query('DELETE FROM testimonials WHERE id=$1',[req.params.id]);await audit(req.admin.sub,'testimonial_deleted','testimonial',req.params.id);res.json({message:'Testimonial deleted.'});}));
app.get('/api/admin/audit',requireAdmin,asyncRoute(async(req,res)=>{const q=await pool.query('SELECT a.id,a.action,a.entity_type,a.entity_id,a.created_at,u.email FROM audit_logs a LEFT JOIN admin_users u ON u.id=a.admin_id ORDER BY a.created_at DESC LIMIT 100');res.json({items:q.rows});}));
app.get(['/admin','/admin/'],(req,res)=>res.sendFile(require('node:path').join(__dirname,'..','admin','index.html')));
app.use((req,res)=>res.status(404).json({error:'Route not found.'}));
app.use((err,req,res,next)=>{console.error(err);if(res.headersSent)return next(err);res.status(err.status||500).json({error:process.env.NODE_ENV==='production'?'Something went wrong. Please try again.':err.message});});
module.exports=app;