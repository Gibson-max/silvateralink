const jwt = require('jsonwebtoken');
function issueToken(admin) {
  return jwt.sign({ sub: String(admin.id), email: admin.email, role: admin.role }, process.env.JWT_SECRET, { expiresIn: '8h', issuer: 'silvateralink-admin' });
}
function requireAuth(req, res, next) {
  const bearer = req.headers.authorization?.startsWith('Bearer ') ? req.headers.authorization.slice(7) : null;
  const token = req.cookies?.sl_admin || bearer;
  if (!token) return res.status(401).json({ error: 'Authentication required.' });
  try { req.admin = jwt.verify(token, process.env.JWT_SECRET, { issuer: 'silvateralink-admin' }); return next(); }
  catch { return res.status(401).json({ error: 'Your session has expired. Please sign in again.' }); }
}
function requireAdmin(req, res, next) {
  if (req.admin?.role !== 'admin') return res.status(403).json({ error: 'Administrator permission required.' });
  return next();
}
module.exports = { issueToken, requireAuth, requireAdmin };