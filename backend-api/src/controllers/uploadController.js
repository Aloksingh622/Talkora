const uploadOnCloudinary = require('../database/cloudinary');

const uploadFile = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: "No file uploaded" });
        }

        // Upload to Cloudinary
        const result = await uploadOnCloudinary(req.file.path);

        if (!result) {
            return res.status(500).json({ message: "File upload failed" });
        }

        const file = req.file;
        let fileType = 'FILE';
        if (file.mimetype.startsWith('image/')) fileType = 'IMAGE';
        else if (file.mimetype.startsWith('video/')) fileType = 'VIDEO';
        else if (file.mimetype === 'application/pdf') fileType = 'PDF';

        res.status(200).json({
            message: "File uploaded successfully",
            fileUrl: result,
            fileName: file.originalname,
            fileType,
            mimeType: file.mimetype
        });

    } catch (err) {
        console.error("Upload error:", err);
        res.status(500).json({ message: "Internal server error" });
    }
};

module.exports = {
    uploadFile
};
