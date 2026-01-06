const bcrypt = require('bcryptjs');
const generateToken = require('../utils/token');
const prisma = require('../utils/prisma');
let jwt = require("jsonwebtoken")

const signup = async (username, email, password) => {
  const existingUser = await prisma.user.findFirst({
    where: {
      OR: [{ email }, { username }],
    },
  });

  if (existingUser) {
    throw new Error('User already exists with that email or username');
  }

  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(password, salt);

  const user = await prisma.user.create({
    data: {
      username,
      email,
      password: hashedPassword,
      avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${username}`, // Default avatar
    },
  });

  return {
    id: user.id,
    username: user.username,
    email: user.email,
    avatar: user.avatar,
    token: generateToken(user.id),
  };
};

const login = async (email, password) => {
  const user = await prisma.user.findUnique({
    where: { email },
  });

  if (!user) {
    throw new Error('Invalid email or password');
  }

  const isMatch = await bcrypt.compare(password, user.password);

  if (!isMatch) {
    throw new Error('Invalid email or password');
  }

  return {
    id: user.id,
    username: user.username,
    email: user.email,
    avatar: user.avatar,
    token: generateToken(user.id),
  };
};

module.exports = {
  signup,
  login,
};