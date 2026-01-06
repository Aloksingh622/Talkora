
const bcrypt = require('bcryptjs');
const prisma = require('../utils/prisma');
let jwt = require("jsonwebtoken")
const validate = require("../validator/validate.js")
const otp_generator = require("otp-generator")
const { sendOTPEmail } = require("../emailservice/otp.js")
const redisclient = require("../database/redis.js")




let email_varification = async (req, res) => {

  try {

    const { email } = req.body;
    if (!email) return res.status(400).json({ error: "Missing email_id" });

    let otp = otp_generator.generate(6, {
      upperCaseAlphabets: false,
      lowerCaseAlphabets: false,
      specialChars: false,
      digits: true
    })
    await redisclient.set(`otp:${email}`, otp, {
      EX: 300,
    });


    await sendOTPEmail(email, otp);
    res.send("otp send")
  }
  catch (err) {
    res.status(500).send({ error: err.message || "Something went wrong" });
  }
}

let signup = async (req, res) => {

  try {

    console.log(req.body)
    validate(req.body);

    const { username, email, password, otp } = req.body;

    const real_otp = await redisclient.get(`otp:${email}`)
    console.log(real_otp)

    if (!real_otp) {
      return res.status(400).json({ message: "OTP is expired" });
    }

    if (real_otp !== otp) {
      return res.status(400).json({ message: "Invalid OTP" });
    }



    req.body.password = await bcrypt.hash(password, 10);
    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [{ email }, { username }],
      },
    });

    if (existingUser) {
      throw new Error('User already exists with that email or username');
    }

    const user = await prisma.user.create({
      data: {
        username,
        email,
        password:req.body.password,
        avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${username}`,
      },
    });

    let token = jwt.sign({ id: user.id, email: user.email, name: user.username }, process.env.private_key, { expiresIn: "30d" });

    let reply = {
      id: user.id,
      username: user.username,
      email: user.email,
      avatar: user.avatar,
    }

    res.cookie("token", token, {
      sameSite: 'lax',
      maxAge: 30 * 24 * 60 * 60 * 1000,
      httpOnly: true,
      secure: false,
      overwrite: true
    });
    res.status(201).json({
      user: reply,
      message: "User Register Successfully"
    })
  }
  catch (err) {
    res.status(400).send("Error : " + err)
  }
}

let login = async (req, res) => {

  try {
    let { email, password } = req.body;

    if (!email) {
      throw new Error("Invalid Credentials")
    }
    if (!password) {
      throw new Error("Invalid Credentials")
    }


    const user = await prisma.user.findUnique({
      where: { email },
    });
    console.log(user, password)


    if (!user) {
      throw new Error('Invalid email or password');
    }


    let match = await bcrypt.compare(password,user.password);

    if (!match) {
      throw new Error("Invalid Credentials")
    }

    let token = jwt.sign({ id: user.id, email: user.email, name: user.username }, process.env.private_key, { expiresIn: "30d" });


    res.cookie("token", token, {
      sameSite: 'lax',
      maxAge: 30 * 24 * 60 * 60 * 1000,
      httpOnly: true,
      secure: false,
      overwrite: true
    });

    let setpassword = "password" in user;

    let reply = {
      id: user.id,
      username: user.username,
      email: user.email,
      avatar: user.avatar,
      setpassword
    }

    res.status(200).json({
      user: reply,
      message: "Logged In Successfullyr"
    })


  }
  catch (err) {
    res.status(401).send("Error : " + err)
  }



}

let logout = async (req, res) => {
  try {

    let { token } = req.cookies;

    let payload = jwt.decode(token);

    await redisclient.set(`token:${token}`, "blocked")
    await redisclient.expireAt(`token:${token}`, payload.exp)

    res.cookie("token", null, { expires: new Date(Date.now()) });
    res.status(200).json({
      message: "you logout successfully"
    });
  }
  catch (err) {
    res.status(503).send("Error: " + err);
  }
}


let delete_profile = async (req, res) => {
  try {

    let id = req.user.id;
    await prisma.user.delete({ where: { id } });


    res.status(201).json({
      message: "User Deleted successfully"
    })


  }
  catch (err) {
    res.status(500).send("Internal Server Error ->", err.message)
  }
}


let check_user = async (req, res) => {
  try {
    const user = req.user;
    let setpassword = req.user.password ? true : false;
    const reply = {
      Name: user.username,
      Emailid: user.email,
      id: user.id,
      avatar: user.avatar,
      role: user.role,
      createdAt: user.createdAt,
      setpassword,
      firebase_uid: user.firebase_uid,
    };


    res.status(201).json({
      user: reply,
      message: "valid user"
    })
  }
  catch (err) {
    res.status(500).send("Something went wrong -> " + err.message)
  }

}

const social_login = async (req, res) => {
  try {
    const { idToken } = req.body;
    if (!idToken) {
      return res.status(401).json({ message: "Id token is not present" });
    }

    const decoded_token = await admin.auth().verifyIdToken(idToken);
    const { uid, email, name, picture } = decoded_token;

    let user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {

      user = await prisma.user.create({
        data: {
          username,
          email,
          firebase_uid: uid,
          role: "user",
          avatar: picture,
        },
      });

    }
    if (!user.firebase_uid || !user.avatar) {
      user.firebase_uid = user.firebase_uid || uid;
      user.avatar = picture || user.avatar ;
      await prisma.user.update();
    }

    const token = jwt.sign(
      {
        id: user.id,
        email: user.email,
        name: user.username
      },
      process.env.private_key,
      { expiresIn: "30d" }
    );

    let setpassword = user.password ? true : false;

    const reply = {
      name: user.username,
      email: user.email,
      id: user.id,
      avatar: user.avatar,
      role: user.role,
      createdAt: user.createdAt,
      setpassword,
      firebase_uid: user.firebase_uid,
    };
    res.cookie("token", token, {
      sameSite: 'lax',
      maxAge: 30 * 24 * 60 * 60 * 1000,
      httpOnly: true,
      secure: false,
      overwrite: true
    });

    res.status(200).json({
      user: reply,
      message: "User authenticated successfully"
    });
  } catch (error) {
    console.error("Social login error:", error);
    if (error.code === 'auth/id-token-expired') {
      return res.status(401).json({ message: "Token expired. Please log in again." });
    }
    res.status(500).json({ message: "An internal server error occurred." });
  }
};


let admin_register = async (req, res) => {
    try {
        let { username, email, password, role } = req.body;

        req.body.password = await bcrypt.hash(req.body.password, 10);

        let user = await prisma.user.create({
          data:{
                username,
                email,
                password: req.body.password,
                role: role
            }
    })

        let reply = {
            email: email,
            Password: password,
        }
        res.status(201).json({
            reply,
            message: "share this credential with new admin"

        })

    }
    catch (err) {
        res.status(400).send("Error : " + err)
    }
}

let change_pass = async (req, res) => {
    const { currentPassword, newPassword } = req.body;
    const userId = req.user.id;


    if (!currentPassword || !newPassword) {
        return res.status(400).json({ message: 'Please provide all required fields.' });
    }
    if (newPassword.length < 8) {
        return res.status(400).json({ message: 'New password must be at least 8 characters long.' });
    }

    try {
        const user = await prisma.user.findUnique({
            where: { id: userId }
        });

        if (!user) {
            return res.status(404).json({ message: 'User not found.' });
        }

        const isMatch = await bcrypt.compare(currentPassword, user.password);
        if (!isMatch) {
            return res.status(400).json({ message: 'Incorrect current password.' });
        }

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(newPassword, salt);

        user.password = hashedPassword;
        await prisma.user.update({
            where: { id: userId },
            data: { password: hashedPassword }
        });

        return res.status(200).json({ message: 'Password updated successfully!' });

    } catch (error) {
        console.error('Error during password change:', error);
        return res.status(500).json({ message: 'Server error. Please try again later.' });
    }
}

let set_pass = async (req, res) => {
    const { password } = req.body;
    const userId = req.user.id;
    console.log(userId);



    if (!password) {
        return res.status(400).json({ message: 'Please provide all required fields.' });
    }
    if (password.length < 8) {
        return res.status(400).json({ message: 'New password must be at least 8 characters long.' });
    }

    try {
        const user = await prisma.user.findUnique({
            where: { id: userId }
        });
        if (!user) {
            return res.status(404).json({ message: 'User not found.' });
        }
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        user.password = hashedPassword;
        await prisma.user.update({
            where: { id: userId },
            data: { password: hashedPassword }
        });

        return res.status(200).json({ message: 'Password updated successfully!' });

    } catch (error) {
        console.error('Error during password change:', error);
        return res.status(500).json({ message: 'Server error. Please try again later.' });
    }
}

const get_all_user = async (req, res) => {
    try {
        const users = await prisma.user.findMany({
            select: {
                id: true,
                Name: true,
                Emailid: true,
                role: true
            }
        });

        if (!users || users.length === 0) {
            return res.status(404).json({ message: "No users found." });
        }

        res.status(200).json({
            success: true,
            count: users.length,
            users: users,
        });

    } catch (error) {
        console.error("Error fetching users:", error);
        res.status(500).json({
            success: false,
            message: "Server error while fetching users.",
        });
    }
}


const change_role = async (req, res) => {
    const { userId } = req.params;
    const { role: newRole } = req.body;

    if (!newRole || !['user', 'admin'].includes(newRole)) {
        return res.status(400).json({
            success: false,
            message: "Invalid role specified. Role must be 'user' or 'admin'."
        });
    }



    if (req.user.id === userId) {
        return res.status(403).json({
            success: false,
            message: "Admins cannot change their own role."
        });
    }

    try {
        const userToUpdate = await prisma.user.findUnique({
            where: { id: userId }
        });

        if (!userToUpdate) {
            return res.status(404).json({
                success: false,
                message: "User not found."
            });
        }

        userToUpdate.role = newRole;
        await prisma.user.update({
            where: { id: userId },
            data: { role: newRole }
        });

        res.status(200).json({
            success: true,
            message: `Successfully updated role for ${userToUpdate.Name} to '${newRole}'.`,
            user: {
                id: userToUpdate.id,
                name: userToUpdate.username,
                email: userToUpdate.email,
                role: userToUpdate.role
            }
        });

    } catch (err) {
        console.error("Error updating user role:", err);
        res.status(500).json({
            success: false,
            message: "An internal server error occurred."
        });
    }
};



module.exports = {
  signup,
  login,
  logout,
  social_login,
  delete_profile,
  check_user,
  change_pass,
  set_pass,
  email_varification,
  admin_register,
  get_all_user,
  change_role
};
