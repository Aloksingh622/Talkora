const express = require("express");
const aiRouter = express.Router();
const usermiddleware = require('../middlewares/Auth.js')
const enhanceMessage = require("../controllers/aiController");


aiRouter.post("/enhanceMsg", usermiddleware, enhanceMessage);
module.exports = aiRouter;