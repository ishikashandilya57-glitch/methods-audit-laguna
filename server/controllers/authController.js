const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { FACTORY_USER } = require('../config/factoryUser');

const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE || '7d',
  });
};

// @desc    Register new user
// @route   POST /api/auth/register
const register = async (req, res) => {
  try {
    if (process.env.ALLOW_PUBLIC_REGISTRATION !== 'true') {
      return res.status(403).json({ message: 'Public registration is disabled for this app' });
    }

    const { name, email, password, role, department } = req.body;

    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(400).json({ message: 'User already exists with this email' });
    }

    const user = await User.create({ name, email, password, role, department });

    res.status(201).json({
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      department: user.department,
      token: generateToken(user._id),
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Login user
// @route   POST /api/auth/login
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (email === FACTORY_USER.email && password === FACTORY_USER.password) {
      return res.json({
        _id: FACTORY_USER._id,
        name: FACTORY_USER.name,
        email: FACTORY_USER.email,
        role: FACTORY_USER.role,
        department: FACTORY_USER.department,
        token: generateToken(FACTORY_USER._id),
      });
    }

    const user = await User.findOne({ email }).select('+password');
    if (!user || !(await user.matchPassword(password))) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    if (!user.isActive) {
      return res.status(403).json({ message: 'Account is deactivated' });
    }

    res.json({
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      department: user.department,
      token: generateToken(user._id),
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get current logged-in user
// @route   GET /api/auth/me
const getMe = async (req, res) => {
  res.json(req.user);
};

module.exports = { register, login, getMe };
