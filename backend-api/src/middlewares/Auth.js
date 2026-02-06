const jwt = require('jsonwebtoken');
const redisclient = require('../database/redis');
const dotenv = require('dotenv').config();
const prisma = require('../utils/prisma');

const Auth = async (req, res, next) => {
  try {
    const { token } = req.cookies;

    console.log('[Auth] Token present:', !!token);

    if (!token) {
      throw new Error("it is invalid token")
    }

    const payload = jwt.verify(token, process.env.private_key)
    console.log('[Auth] Payload:', payload);

    const { id } = payload;
    if (!id) {
      throw new Error("it is not id")
    }

    let result;
    try {
      result = await prisma.user.findUnique({
        where: { id },
      });
    } catch (dbError) {
      console.error('[Auth] Database Error:', dbError);
      throw new Error("Database operation failed: " + dbError.message);
    }
    console.log('[Auth] DB Result found:', !!result);

    if (!(result)) {
      throw new Error("find the error in the result")
    }

    const Isblocked = await redisclient.exists(`token:${token}`)
    if (Isblocked) {
      throw new Error("invalid token (blocked)")
    }

    req.user = result
    next();
  }
  catch (err) {
    res.status(401).send("Auth Error: " + err.message)
  }

}
module.exports = Auth