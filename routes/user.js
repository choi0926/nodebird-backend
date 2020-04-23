import express from "express";
import db from "../models";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { isLoggedIn, isNotLoggedIn } from "./middleware";
import passport from "passport";
const router = express.Router();

router.get("/", isLoggedIn, (req, res) => {
  const user = Object.assign({}, req.user.toJSON());
  delete user.password;
  return res.json(user);
});
router.post("/signup", isNotLoggedIn, async (req, res, next) => {
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
    const hashPassword = await bcrypt.hash(req.body.password, 10);

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
router.post("/login", async (req, res, next) => {
  //로그인
  passport.authenticate("local", (err, user, info) => {
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

router.get("/:id/posts", async (req, res, next) => {
  try {
    const posts = await db.Post.findAll({
      where: {
        userId: parseInt(req.params.id)||(req.user && req.user.id)||0,
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
    res.json(posts);
  } catch (err) {
    console.error(err);
    next(err);
  }
});
router.get("/:id", async (req, res, next) => {
  // 남의 정보 가져오는 것 ex) /api/user/123
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
    res.json(jsonUser);
  } catch (e) {
    console.error(e);
    next(e);
  }
});

router.post("/:id/follow", isLoggedIn, async (req, res, next) => {
  try {
    const me = await db.User.findOne({
      where: {
        id: req.user.id,
      },
    });
    
    await me.addFollowing(req.params.id);
    res.json(req.params.id);
  } catch (err) {
    console.error(err);
    next(err);
  }
});

router.delete("/:id/follow", isLoggedIn, async (req, res, next) => {
  try {
    const me = await db.User.findOne({
      where: {
        id: req.user.id,
      },
    });
    await me.removeFollowing(req.params.id);
    res.json(req.params.id);
  } catch (err) {
    console.error(err);
    next(err);
  }
});
router.get('/:id/followings', isLoggedIn, async (req, res, next) => {//팔로우한 사용자 목록 불러오기
  try {
    const user = await db.User.findOne({
      where:{
        id:parseInt(req.params.id,10)||(req.user && req.user.id)||0,
      }//req.params.id 는 문자열, parseInt 숫자로 변환. 문자열일 경우 뒤에 문장( || 이후 문장이 실행이안됨.) 
    })

    const followers = await user.getFollowings({
      attributes:['id','nickname','email'],
      limit:parseInt(req.query.limit,10),
      offset:parseInt(req.query.offset,10),
    })
    res.json(followers);
  } catch (err) {
    console.error(err);
    next(err);
}});

router.get('/:id/followers', isLoggedIn, async (req, res, next) => {//팔로우한 사용자 목록 불러오기
  try {
    const user = await db.User.findOne({
      where:{
        id:parseInt(req.params.id,10)||(req.user && req.user.id)||0,
      }
    })
    const followings = await user.getFollowers({attributes:['id','nickname','email'],
    limit:parseInt(req.query.limit,10),
    offset:parseInt(req.query.offset,10),
})
    res.json(followings);
  } catch (err) {
    console.error(err);
    next(err);
  }
  
});

router.delete('/:id/follower', isLoggedIn, async (req, res, next) => {//팔로우한 사용자 삭제
  try {
    const me = await db.User.findOne({
      where:{id:req.user.id}
    })
    await me.removeFollower(req.params.id);
    res.send(req.params.id);
  } catch (err) {
    console.error(err);
    next(err);
  }
}); 

router.patch('/info', isLoggedIn, async (req, res, next) => {
  try {
    if(req.body.password){
    const hashPassword = await bcrypt.hash(req.body.password,10);
    await db.User.update({nickname:req.body.nickname,password:hashPassword},{where:{id:req.user.id}})
    return res.json(req.user.id);
    }
    await db.User.update({nickname:req.body.nickname},{where:{id:req.user.id}})
    return res.json(req.user.id);
  } catch (err) {
    console.error(err);
    next(err);
  }
})

module.exports = router;
