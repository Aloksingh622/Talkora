const { getPresence } = require('../redis/presence');

const getUserPresence = async (req, res) => {
    try {
        const { userId } = req.params;
        const userIdInt = parseInt(userId);

        if (isNaN(userIdInt)) {
            return res.status(400).json({ message: "Invalid user ID" });
        }

        const presence = await getPresence(userIdInt);

        res.status(200).json(presence);
    } catch (err) {
        console.error("Get presence error:", err);
        res.status(500).json({ message: "Internal server error" });
    }
};

module.exports = {
    getUserPresence,
};
