import express from "express";
import db from "../models";
import bcrypt from "bcrypt";
import { isAuth, isNotAuth, sendMail } from "./middleware";
import passport from "passport";
import redis from "redis";
import JWTR from "jwt-redis";
import dotenv from "dotenv";
import crypto from "crypto";

dotenv.config();
const redisClient = redis.createClient();
const jwtr = new JWTR(redisClient);
const router = express.Router();

router.get("/", isAuth, async (req, res, next) => {
  try {
    const user = await db.User.findOne(
      { where: { id: req.user.id } },
      { attributes: ["id", "email", "nickname"] }
    );
    return res.json({
      success: true,
      message: "Successfully retrieve information",
      data: { user },
    });
  } catch (err) {
    console.error(err);
    return next(err);
  }
});

router.post("/signup", isNotAuth, async (req, res, next) => {
  try {
    const exUser = await db.User.findOne({
      where: {
        email: req.body.email,
      },
    });
    if (exUser) {
      return res.status(403).json({
        success: false,
        message: "This email address is already in use",
        data: {},
      });
    }
    const hashPassword = await bcrypt.hash(req.body.password, 10);

    const newUser = await db.User.create({
      email: req.body.email,
      nickname: req.body.nickname,
      password: hashPassword,
    });
    return res.json({
      success: true,
      message: "Successfully signup",
      data: { newUser },
    });
  } catch (err) {
    console.error(err);
    return next(err);
  }
});

router.post("/login", async (req, res, next) => {
  passport.authenticate("local", { session: false }, (err, user, info) => {
    if (err) {
      console.error(err);
      return next(err);
    }
    if (info) {
      return res
        .status(403)
        .json({ success: false, message: info.message, data: {} });
    }
    return req.login(user, { session: false }, async (loginErr) => {
      if (loginErr) {
        return next(loginErr);
      }
      try {
        const accessToken = await jwtr.sign(
          { email: user.email, id: user.id },
          process.env.ACCESS_TOKEN_SECRET,
          { expiresIn: "15m" }
        );
        const refreshToken = await jwtr.sign(
          { email: user.email, id: user.id },
          process.env.REFRESH_TOKEN_SECRET
        );
        const fullUser = await db.User.findOne({
          where: { id: user.id },
          include: [
            {
              model: db.Post,
              as: "Post",
              attributes: ["id"],
            },
            {
              model: db.User,
              as: "Followers",
              attributes: ["id"],
            },
            {
              model: db.User,
              as: "Followings",
              attributes: ["id"],
            },
          ],
          attributes: ["id", "nickname", "email"],
        });
        await db.User.update({ refreshToken }, { where: { id: user.id } });
        return res.json({
          success: true,
          message: "",
          data: {
            fullUser,
            accessToken: "bearer " + accessToken,
            refreshToken: "bearer " + refreshToken,
          }, //Version 0.4.0 : token :'baerer' + token
        });
      } catch (err) {
        console.error(err);
        return next(err);
      }
    });
  })(req, res, next);
});

router.post("/logout", isAuth, async (req, res, next) => {
  try {
    await jwtr.destroy(req.jti, process.env.ACCESS_TOKEN_SECRET);
    if (req.user.refreshToken) {
      const refreshTokenVerify = await jwtr.verify(
        req.user.refreshToken,
        process.env.REFRESH_TOKEN_SECRET
      );
      await jwtr.destroy(
        refreshTokenVerify.jti,
        process.env.REFRESH_TOKEN_SECRET
      );
      await db.User.update(
        { refreshToken: "" },
        { where: { id: req.user.id } }
      );
    } else {
      return res
        .status(403)
        .json({ success: false, message: "Logout error", data: {} });
    }
    return res.json({
      success: true,
      message: "Successful logout",
      data: {},
    });
  } catch (err) {
    console.error(err);
    return next(err);
  }
});

router.post("/refreshedToken", async (req, res, next) => {
  try {
    if (!req.body.accessToken || !req.body.refreshToken) {
      return res
        .status(403)
        .json({ success: false, message: "not auth token", data: {} });
    }
    const getAccessToken = req.body.accessToken;
    const getRefreshToken = req.body.refreshToken;
    const accessToken = getAccessToken && getAccessToken.split(" ")[1];
    const refreshToken = getRefreshToken && getRefreshToken.split(" ")[1];
    const accessTokenDecoded = await jwtr.decode(accessToken);
    const user = await db.User.findOne({
      where: { email: accessTokenDecoded.email },
    });
    if (!user) {
      return res
        .status(403)
        .json({ success: false, message: "Invalid access token " });
    }
    if (!user.refreshToken === refreshToken) {
      return res
        .status(403)
        .json({ success: false, message: "Invalid refresh token", data: {} });
    }
    const refreshTokenVerify = await jwtr.verify(
      refreshToken,
      process.env.REFRESH_TOKEN_SECRET
    );
    if (!refreshTokenVerify) {
      return res
        .status(403)
        .json({ success: false, message: "Invalid refresh token", data: {} });
    }
    const reissueAccessToken = await jwtr.sign(
      { email: user.email, id: user.id },
      process.env.ACCESS_TOKEN_SECRET
    );
    return res.json({
      success: true,
      message: "Token reissue successfully",
      data: { reissueAccessToken: "bearer " + reissueAccessToken },
    });
  } catch (err) {
    console.error(err);
    return next(err);
  }
});

router.get("/forgotPassword", async (req, res, next) => {
  try {
    const user = await db.User.findOne({
      where: { email: req.body.email },
    });
    if (!user) {
      return res
        .status(403)
        .json({ success: false, message: "This user email does not exist." });
    }

    crypto.randomBytes(64, (err, buf) => {
      crypto.pbkdf2(
        user.email,
        buf + process.env.AUTH_SECRET,
        100000,
        64,
        "sha512",
        async (err, key) => {
          const regExp = /[\{\}\[\]\/?.,;:|\)*~`!^\-_+<>@\#$%&\\\=\(\'\"]/gi;
          const authCode = key.toString("base64").replace(regExp, "");
          await db.User.update({ authCode }, { where: { email: user.email } });
          sendMail(user.email, "Your password reset", authCode);
        }
      );
    });

    return res.json({
      success: true,
      message: "Your mail has been sent successfully.",
      data: {},
    });
  } catch (err) {
    console.error(err);
    return next(err);
  }
});

router.get("/authCode", async (req, res, next) => {
  try {
    const user = await db.User.findOne({
      where: { authCode: req.body.authCode },
    });
    if (!user) {
      return res.json({
        success: true,
        message: "Authentication failed.",
        data: {},
      });
    }
    return res.json({
      success: true,
      message: "Authentication completed.",
      data: { user },
    });
  } catch (err) {
    console.error(err);
    return next(err);
  }
});

router.get("/:id/posts", async (req, res, next) => {
  try {
    const posts = await db.Post.findAll({
      where: {
        userId: parseInt(req.params.id) || (req.user && req.user.id) || 0,
      },
      include: [
        {
          model: db.User,
          attributes: ["id", "nickname", "email"],
        },
        {
          model: db.Image,
        },
      ],
    });
    return res.json({
      success: true,
      message: "Successfully load all posts for this user",
      data: { posts },
    });
  } catch (err) {
    console.error(err);
    return next(err);
  }
});

router.get("/:id", async (req, res, next) => {
  try {
    const user = await db.User.findOne({
      where: { id: parseInt(req.params.id) },
      include: [
        {
          model: db.Post,
          as: "Post",
          attributes: ["id"],
        },
        {
          model: db.User,
          as: "Followings",
          attributes: ["id"],
        },
        {
          model: db.User,
          as: "Followers",
          attributes: ["id"],
        },
      ],
      attributes: ["id", "nickname"],
    });
    const jsonUser = user.toJSON();
    jsonUser.Posts = jsonUser.Posts ? jsonUser.Posts.length : 0;
    jsonUser.Followings = jsonUser.Followings ? jsonUser.Followings.length : 0;
    jsonUser.Followers = jsonUser.Followers ? jsonUser.Followers.length : 0;
    return res.json({
      success: true,
      message: "Successfully retrieve the user information",
      data: { jsonUser },
    });
  } catch (err) {
    console.error(err);
    return next(err);
  }
});

router.post("/:id/follow", isAuth, async (req, res, next) => {
  try {
    const me = await db.User.findOne({
      where: {
        id: req.user.id,
      },
    });
    await me.addFollowing(req.params.id);
    return res.json({
      success: true,
      message: "Successfully followed the user",
      data: { followingId: req.params.id },
    });
  } catch (err) {
    console.error(err);
    next(err);
  }
});

router.delete("/:id/follow", isAuth, async (req, res, next) => {
  try {
    const me = await db.User.findOne({
      where: {
        id: req.user.id,
      },
    });
    await me.removeFollowing(req.params.id);

    return res.json({
      success: true,
      message: "successfully unfollow",
      data: { followedId: req.params.id },
    });
  } catch (err) {
    console.error(err);
    next(err);
  }
});

///
router.get("/:id/followings", isAuth, async (req, res, next) => {
  try {
    const user = await db.User.findOne({
      where: {
        id: parseInt(req.params.id, 10) || (req.user && req.user.id) || 0,
      },
    });

    const followers = await user.getFollowings({
      attributes: ["id", "nickname", "email"],
      limit: parseInt(req.query.limit, 10),
      offset: parseInt(req.query.offset, 10),
    });
    return res.json({
      success: true,
      message: "Retrieve a list of users who have successfully followed",
      data: { followers },
    });
  } catch (err) {
    console.error(err);
    next(err);
  }
});

router.get("/:id/followers", isAuth, async (req, res, next) => {
  try {
    const user = await db.User.findOne({
      where: {
        id: parseInt(req.params.id, 10) || (req.user && req.user.id) || 0,
      },
    });
    const followings = await user.getFollowers({
      attributes: ["id", "nickname", "email"],
    });
    return res.json({
      success: true,
      message: "Retrieve a list of users that have been successfully followed",
      data: { followings },
    });
  } catch (err) {
    console.error(err);
    next(err);
  }
});

router.delete("/:id/follower", isAuth, async (req, res, next) => {
  try {
    const me = await db.User.findOne({
      where: { id: req.user.id },
    });
    await me.removeFollower(req.params.id);

    return res.json({
      success: true,
      message: "Removed users who successfully followed",
      data: { followingId: req.params.id },
    });
  } catch (err) {
    console.error(err);
    next(err);
  }
});

router.patch("/info", isAuth, async (req, res, next) => {
  try {
    if (req.body.password) {
      const hashPassword = await bcrypt.hash(req.body.password, 10);
      await db.User.update(
        { nickname: req.body.nickname, password: hashPassword },
        { where: { id: req.user.id } }
      );
      const user = await db.User.findOne({ where: { id: req.user.id } });
      return res.json({
        success: true,
        message: "information modified successfully",
        data: { user },
      });
    }
    await db.User.update(
      { nickname: req.body.nickname },
      { where: { id: req.user.id } }
    );
    const user = await db.User.findOne({ where: { id: req.user.id } });
    return res.json({
      success: true,
      message: "information modified successfully",
      data: { user },
    });
  } catch (err) {
    console.error(err);
    return next(err);
  }
});

module.exports = router;
