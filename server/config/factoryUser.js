const FACTORY_USER = {
  _id: 'factory-audit-user',
  name: process.env.FACTORY_USER_NAME || 'IE Department',
  email: process.env.FACTORY_USER_EMAIL || 'ie_dbr@laguna-clothing.com',
  password: process.env.FACTORY_USER_PASSWORD || 'Ie@12345',
  role: process.env.FACTORY_USER_ROLE || 'admin',
  department: process.env.FACTORY_USER_DEPARTMENT || 'Industrial Engineering',
  isActive: true,
};

module.exports = { FACTORY_USER };
