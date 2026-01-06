const jwt = require('jsonwebtoken');
const redisclient = require('../database/redis');
const dotenv = require('dotenv').config();
const prisma = require('../utils/prisma');

const Auth = async (req, res, next) => {
  try {

    const { token } = req.cookies;
   
    if (!token) {
      throw new Error("it is invalid token")
    }
    const payload = jwt.verify(token, process.env.private_key)
    console.log(payload);

    const { id } = payload;
    if (!id) {
      throw new Error("it is not id")
    }
    const result = await prisma.user.findUnique({
      where: { id },
    });

    if (!(result)) {
      throw new Error("find the error in the result")
    }

    const Isblocked = await redisclient.exists(`token:${token}`)
    if (Isblocked) {
      throw new Error("invalid token")
    }

    req.user = result
    next();
  }
  catch (err) {
    res.status(400).send("Error s" + err.message)
  }

}
module.exports = Auth