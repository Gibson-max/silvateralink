require('dotenv').config();
const bcrypt = require('bcryptjs');
const app = require('../src/app');
const { pool, initializeDatabase } = require('../src/db');

let initialization;
async function prepare() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is missing.');
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) throw new Error('JWT_SECRET is missing or too short.');
  await initializeDatabase();
  const existing = await pool.query('SELECT id FROM admin_users LIMIT 1');
  if (!existing.rowCount) {
    const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
    const password = process.env.ADMIN_PASSWORD;
    if (!email || !password || password.length < 12) throw new Error('Initial administrator credentials are not configured.');
    await pool.query('INSERT INTO admin_users(email,password_hash,role) VALUES($1,$2,$3)', [email, await bcrypt.hash(password, 12), 'admin']);
  }
}
module.exports = async function handler(req, res) {
  try {
    initialization ||= prepare();
    await initialization;
    return app(req, res);
  } catch (error) {
    console.error('Silvateralink API initialization failed:', error.message);
    return res.status(503).json({ error: 'The admin service is not configured yet. Contact the website administrator.' });
  }
};
