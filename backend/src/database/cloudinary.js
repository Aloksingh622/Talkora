const dotenv = require('dotenv')
dotenv.config()
const { v2: cloudinary } = require("cloudinary");
const fs = require("fs");

cloudinary.config({ 
  cloud_name: process.env.CLOUDINARY_NAME, 
  api_key: process.env.CLOUDINARY_API_KEY, 
  api_secret: process.env.CLOUDINARY_API_SECRET
});

const uploadOnCloudinary = async (filePathOrUrl) => {
  if (!filePathOrUrl) return null;

  try {
      const uploadResult = await cloudinary.uploader.upload(filePathOrUrl, {
      resource_type: "auto",
      folder: "DiscordAppUploads",
    });

    if (!filePathOrUrl.startsWith("http")) {
      fs.unlinkSync(filePathOrUrl);
    }

    return uploadResult.secure_url;
  } catch (error) {
    if (!filePathOrUrl.startsWith("http") && fs.existsSync(filePathOrUrl)) {
      fs.unlinkSync(filePathOrUrl);
    }
    console.error("Cloudinary upload failed:", error.message);
    throw error;
  }
};

module.exports = uploadOnCloudinary;
