import express from "express";
import db from "../models";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { isLoggedIn, isNotJwtLoggedIn } from "./middleware";
import passport from "passport";
import dotenv from "dotenv";
dotenv.config();
const router = express.Router();

router.post("/refreshed", async (req, res, next) => {
  try {
    if (!req.headers.authorization) {
      return res
        .status(403)
        .json({ success: false, message: "not auth token", data: {} });
    }
    const authHeader = req.headers.authorization;
    const refreshToken = authHeader && authHeader.split(" ")[1];
    const compareRefreshToken = await db.User.findOne({
      where: { refreshToken },
    });
    if (!compareRefreshToken) {
      return res
        .status(403)
        .json({ success: false, message: "Invalid refresh token", data: {} });
    }
    const refreshTokenVerify = jwt.verify(
      refreshToken,
      process.env.REFRESH_TOKEN_SECRET
    );
    if (!refreshTokenVerify) {
      return res
        .status(403)
        .json({ success: false, message: "Invalid refresh token", data: {} });
    }
    const accessToken = jwt.sign(
      { email: compareRefreshToken.email, id: compareRefreshToken.id },
      process.env.ACCESS_TOKEN_SECRET
    );
    return res.json({
      success: true,
      message: "Token reissue successfully",
      data: { accessToken: "bearer " + accessToken },
    });
  } catch (err) {
    console.error(err);
    return next(err);
  }
});
//
router.get("/", async (req, res, next) => {
  passport.authenticate("jwt", { session: false }, (err, user, info) => {
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
        const user = await db.User.findOne(
          { where: { id: user.id } },
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
  })(req, res, next); //done(서버 에러, 성공 user정보 , 로직상 에러)
});

router.post("/signup", isNotJwtLoggedIn, async (req, res, next) => {
  try {
    const exUser = await db.User.findOne({
      where: {
        email: req.body.email,
      },
    });
    if (exUser) {
      return res
        .status(403)
        .json({
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
        const accessToken = jwt.sign(
          { email: user.email, id: user.id },
          process.env.ACCESS_TOKEN_SECRET,
          { expiresIn: "15m" }
        );
        const refreshToken = jwt.sign(
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

router.post("/logout", async (req, res, next) => {
  passport.authenticate("jwt", { session: false }, (err, user, info) => {
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
        if(user.refreshToken){
          await db.User.update({ refreshToken:''}, { where: { id: user.id } });
        }else{
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
  })(req, res, next);
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
      data: {posts},
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
      data: {jsonUser},
    });
  } catch (err) {
    console.error(err);
    return next(err);
  }
});

router.post("/:id/follow", async (req, res, next) => {
  passport.authenticate("jwt", { session: false }, (err, user, info) => {
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
        const me = await db.User.findOne({
          where: {
            id: req.user.id,
          },
        });
        await me.addFollowing(req.params.id)
        return res.json({success:true, message:'Successfully followed the user',data:{followingId:req.params.id}});
      } catch (err) {
        console.error(err);
        next(err);
      }
    });
  })(req, res, next);
});


router.delete("/:id/follow", async (req, res, next) => {
  passport.authenticate("jwt", { session: false }, (err, user, info) => {
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
        const me = await db.User.findOne({
          where: {
            id: req.user.id,
          },
        });
        await me.removeFollowing(req.params.id);
        return res.json({success:true, message:'Successfully followed the user',data:{followedId:req.params.id}});
      } catch (err) {
        console.error(err);
        next(err);
      }
    });
  })(req, res, next);
});
 
///
router.get("/:id/followings", async (req, res, next) => {
  //팔로우한 사용자 목록 불러오기
  passport.authenticate("jwt", { session: false }, (err, user, info) => {
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
        const user = await db.User.findOne({
          where: {
            id: parseInt(req.params.id, 10) || (req.user && req.user.id) || 0,
          }, 
        });
    
        const followers = await user.getFollowings({
          attributes: ["id", "nickname", "email"],
          // limit: parseInt(req.query.limit, 10),
          // offset: parseInt(req.query.offset, 10),
        });
        return res.json({success:true, message:'Retrieve a list of users who have successfully followed',data:{followers}});
      } catch (err) {
        console.error(err);
        next(err);
      }
    });
  })(req, res, next);
});
  
router.get("/:id/followers", async (req, res, next) => {
  //팔로우한 사용자 목록 불러오기
  passport.authenticate("jwt", { session: false }, (err, user, info) => {
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
        const user = await db.User.findOne({
          where: {
            id: parseInt(req.params.id, 10) || (req.user && req.user.id) || 0,
          },
        });
        const followings = await user.getFollowers({
          attributes: ["id", "nickname", "email"],
          // limit: parseInt(req.query.limit, 10),
          // offset: parseInt(req.query.offset, 10),
        });
        return res.json({success:true, message:'Retrieve a list of users that have been successfully followed',data:{followings}});
      } catch (err) {
        console.error(err);
        next(err);
      }
    });
  })(req, res, next);
});
 
router.delete("/:id/follower", async (req, res, next) => {
  //팔로우한 사용자 삭제
  passport.authenticate("jwt", { session: false }, (err, user, info) => {
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
        const me = await db.User.findOne({
          where: { id: req.user.id },
        });
        await me.removeFollower(req.params.id);
        return res.json({success:true, message:'Removed users who successfully followed',data:{followingId:req.params.id}});
      } catch (err) {
        console.error(err);
        next(err);
      }
    });
  })(req, res, next);
});

router.patch("/info", async (req, res, next) => {
  passport.authenticate("jwt", { session: false }, (err, user, info) => {
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
        if (req.body.password) {
          const hashPassword = await bcrypt.hash(req.body.password, 10);
          await db.User.update(
            { nickname: req.body.nickname, password: hashPassword },
            { where: { id: req.user.id } }
          );
          return res.json({success:true, message:'information modified successfully',data:{user}});
        }
        await db.User.update(
          { nickname: req.body.nickname },
          { where: { id: req.user.id } }
        );
        return res.json({success:true, message:'information modified successfully',data:{user}});
      } catch (err) {
        console.error(err);
        return next(err);
      }
    });
  })(req, res, next);
});
  
module.exports = router;
