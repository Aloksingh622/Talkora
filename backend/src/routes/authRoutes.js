const express = require('express');
const AuthRouter = express.Router();
const usermiddleware = require('../middlewares/Auth.js')
const adminmiddleware = require('../middlewares/adminmiddleware.js')
const {
    email_varification,
    signup,
    login,
    logout,
    social_login,
    delete_profile,
    check_user,
    change_pass,
    set_pass,
    admin_register,
    get_all_user,
    change_role
} = require('../controllers/authController.js')


AuthRouter.post("/emailVerification", email_varification)
AuthRouter.post("/register", signup)
AuthRouter.post("/login", login)
AuthRouter.post("/logout", usermiddleware, logout)
AuthRouter.post("/socialLogin", social_login)
AuthRouter.delete("/deleteProfile", usermiddleware, delete_profile)
AuthRouter.get("/check", usermiddleware, check_user)
AuthRouter.put("/change-password", usermiddleware, change_pass)
AuthRouter.post("/set-password", usermiddleware, set_pass)
AuthRouter.get("/alluser", adminmiddleware, get_all_user)
AuthRouter.put("/updateRole/:userId", adminmiddleware, change_role)
AuthRouter.post("/adminRegister", adminmiddleware, admin_register)


module.exports = AuthRouter;
