const express = require('express');
const UploadRouter = express.Router();
const usermiddleware = require('../middlewares/Auth.js');
const upload = require('../middlewares/multer.middleware.js');
const { uploadFile } = require('../controllers/uploadController.js');

UploadRouter.post('/', usermiddleware, upload.single('file'), uploadFile);

module.exports = UploadRouter;
