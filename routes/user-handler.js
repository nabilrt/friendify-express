const express = require("express");
const upload = require("../middlewares/FileUpload");
const bcrypt = require("bcrypt");
const User = require("../models/User");
const checkLogin = require("../middlewares/Auth");
const cloudinaryConfig = require("../config/cloudinary");
const fs = require("fs");
const jwt = require("jsonwebtoken");
const Conversation = require("../models/Conversations");
const differenceBy = require("lodash.differenceby");
require("dotenv").config();

const userRouter = express.Router();

userRouter.post("/signup", upload, async (req, res) => {
  try {
    const { name, email, password } = req.body;
    const file = req.file;
    if (file) {
      if (!name && !email && !password) {
        return res.status(400).json({
          message: "Fill up all the fields",
        });
      }
      const hashedPassword = await bcrypt.hash(password, 10);

      const image = await cloudinaryConfig.uploader.upload(
        file.path,
        {
          folder: "chat-app",
        },
        (err, result) => {
          if (err) {
            return res.status(500).json({
              message: "Internal Server Error",
            });
          }
        }
      );
      const avatar = image.secure_url;

      const user = new User({
        name,
        email,
        password: hashedPassword,
        avatar,
      });
      await user.save();
      fs.unlinkSync(file.path);

      return res.status(201).json({
        message: "User Created",
      });
    } else {
      if (!name && !email && !password) {
        return res.status(400).json({
          message: "Fill up all the fields",
        });
      }
      const hashedPassword = await bcrypt.hash(password, 10);

      const user = new User({
        name,
        email,
        password: hashedPassword,
        avatar: process.env.DEFAULT_AVATAR_URL,
      });
      await user.save();

      return res.status(201).json({
        message: "User Created",
      });
    }
  } catch (err) {
    console.log(err);
    return res.status(500).json({
      message: "Internal Server Error",
    });
  }
});

userRouter.post("/login", async (req, res) => {
  const { email, password } = req.body;
  try {
    const user = await User.findOne({ email: email });

    if (!user) {
      return res.status(400).json({
        message: "User not found",
      });
    }
    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      return res.status(400).json({
        message: "Wrong Password",
      });
    }
    const token = jwt.sign(
      {
        name: user.name,
        userId: user._id,
      },
      "secret",
      {
        expiresIn: "1h",
      }
    );
    res.status(200).json({
      message: "Auth Successful",
      token: token,
    });
  } catch (err) {
    res.status(500).json({
      message: err.message,
    });
  }
});

userRouter.get("/details", checkLogin, async function (req, res) {
  try {
    const user = await User.findOne({ _id: req.userData.userId });
    res.status(200).json({
      message: "User Details",
      user: user,
    });
  } catch (err) {
    res.status(500).json({
      message: err.message,
    });
  }
});

userRouter.get("/allUsers", checkLogin, async function (req, res) {
  try {
    const users = await User.find();
    let convUsers = [];
    const conversations = await Conversation.find({
      participants: { $in: [req.userData.userId] },
    })
      .populate("participants")
      .exec();

    for (var i = 0; i < conversations.length; i++) {
      for (var j = 0; j < conversations[i].participants.length; j++) {
        if (
          conversations[i].participants[j]._id != req.userData.userId &&
          !convUsers.includes(conversations[i].participants[j]._id)
        ) {
          convUsers.push(conversations[i].participants[j]);
        }
      }
    }

    function findMissingElements(arr1, arr2) {
      const missingElements = arr1.filter((element1) => {
        return !arr2.some((element2) => element2._id.equals(element1._id));
      });

      return missingElements;
    }

    const missingElements = findMissingElements(users, convUsers);
    const updatedUser = missingElements.filter(
      (element) => !element._id.equals(req.userData.userId)
    );

    res.status(200).json({
      message: "All Users",
      users: updatedUser,
    });
  } catch (err) {
    res.status(500).json({
      message: err.message,
    });
  }
});

userRouter.post("/picture", checkLogin, upload, async (req, res) => {
  try {
    const file = req.file;
    const image = await cloudinaryConfig.uploader.upload(
      file.path,
      {
        folder: "chat-app",
      },
      (err, result) => {
        if (err) {
          return res.status(500).json({
            message: "Internal Server Error",
          });
        }
      }
    );
    const avatar = image.secure_url;
    await User.updateOne(
      { _id: req.userData.userId },
      { $set: { avatar: avatar } }
    );
    fs.unlinkSync(file.path);
    res.status(200).json({
      message: "Profile Picture Updated",
    });
  } catch (err) {
    res.status(500).json({
      message: err.message,
    });
  }
});

userRouter.post("/update", checkLogin, async (req, res) => {
  try {
    const { name, password } = req.body;
    if (password === "") {
      await User.updateOne(
        { _id: req.userData.userId },
        { $set: { name: name } }
      );
      res.status(200).json({
        message: "Profile Updated",
      });
    } else {
      const hashedPassword = await bcrypt.hash(password, 10);
      await User.updateOne(
        { _id: req.userData.userId },
        { $set: { name: name, password: hashedPassword } }
      );
      res.status(200).json({
        message: "Profile Updated",
      });
    }
  } catch (err) {
    res.status(500).json({
      message: err.message,
    });
  }
});

module.exports = userRouter;
