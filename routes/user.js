import express from "express";
import db from "../models";
import bcrpt from "bcrypt";
import jwt from "jsonwebtoken";
import passport from "passport";
const router = express.Router();

router.get('/', (req, res) => {
  if (!req.user) {
    return res.status(401).send("로그인이 필요합니다.");
  }
  const user = Object.assign({}, req.user.toJSON());
  delete user.password;
  return res.json(user);
});
router.post('/signup', async (req, res, next) => {
  //회원가입
  try {
    const exUser = await db.User.findOne({
      where: {
        email: req.body.email,
      },
    });
    if (exUser) {
      return res.status(403).send("이미사용중인 이메일 주소입니다.");
    }
    const hashPassword = await bcrpt.hash(req.body.password, 10);

    const newUser = await db.User.create({
      email: req.body.email,
      nickname: req.body.nickname,
      password: hashPassword,
    });
    return res.json(newUser);
  } catch (err) {
    console.error(err);
    return next(e);
  }
});
router.post('/signin', async (req, res, next) => {
  //로그인

  passport.authenticate('local', (err, user, info) => {
    if (err) {
      console.error(err);
      return next(err);
    }
    if (info) {
      return res.status(401).send(info.reason);
    }
    return req.login(user, async (loginErr) => {
      if (loginErr) {
        return next(loginErr);
      }
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
            as: "followers",
            attributes: ["id"],
          },
          {
            model: db.User,
            as: "followings",
            attributes: ["id"],
          },
        ],
        attributes: ["id", "nickname", "email"],
      });
      return res.json(fullUser);
    });
  })(req, res, next); //done(서버 에러, 성공 user정보 , 로직상 에러)
});

router.post("/logout", (req, res) => {
  //정보수정
  req.logout();
  req.session.destroy();
  res.send("로그아웃 성공");
});

router.get('/:id/posts', async (req, res, next) => {
  try {
    const posts = await db.Post.findAll({
      where: {
        userId: parseInt(req.params.id),
      },
      include: [
        {
          model: db.User,
          as:'User',
          attributes: [id, nickname, email],
        },
      ],
    });
    console.log(posts);
    res.json(posts);
  } catch (err) {
    console.error(err);
    next(err);
  }
});
router.get('/:id', async(req, res, next) => { // 남의 정보 가져오는 것 ex) /api/user/123
    try {
      const user = await db.User.findOne({
        where: { id: parseInt(req.params.id, 10) },
        include: [{
          model: db.Post,
          as: 'Post',
          attributes: ['id'],
        }, {
          model: db.User,
          as: 'followings',
          attributes: ['id'],
        }, {
          model: db.User,
          as: 'followers',
          attributes: ['id'],
        }],
        attributes: ['id', 'nickname'],
      });
      const jsonUser = user.toJSON();
      jsonUser.Posts = jsonUser.Posts ? jsonUser.Posts.length : 0;
      jsonUser.Followings = jsonUser.Followings ? jsonUser.Followings.length : 0;
      jsonUser.Followers = jsonUser.Followers ? jsonUser.Followers.length : 0;
      res.json(jsonUser);
    } catch (e) {
      console.error(e);
      next(e);
    }
  });
module.exports = router;
