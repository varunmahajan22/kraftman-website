const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'kraftman-dev-secret-change-in-production';

function requireAuth(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.admin = decoded;
    next();
  } catch (err) {
    return res.status(403).json({ error: 'Invalid or expired token' });
  }
}

module.exports = { requireAuth, JWT_SECRET };
