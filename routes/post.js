import express from "express";
import db from "../models";
import path from "path";
import multer from "multer";
import multerS3 from "multer-s3";
import AWS from "aws-sdk";
import { isAuth } from "./middleware";
const router = express.Router();

AWS.config.update({
  region: "ap-northeast-2",
  accessKeyId: process.env.S3_ACCESS_KEY_ID,
  secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
});

const upload = multer({
  storage: multerS3({
    s3: new AWS.S3(),
    bucket: "title-academy",
    key(req, file, cb) {
      cb(null, `original/${+new Date()}${path.basename(file.originalname)}`);
    },
  }),
  limits: { fileSize: 20 * 1024 * 1024 }, //업로드 용량
});
router.post("/", upload.none(), isAuth, async (req, res, next) => {
  try {
    const hashtags = req.body.content.match(/#[^\s]+/g);
    console.log(hashtags);
    const newPost = await db.Post.create({
      subject: req.body.subject,
      content: req.body.content,
      userId: req.user.id,
    });

    if (hashtags) {
      const result = await Promise.all(
        hashtags.map((tag) =>
          db.Hashtag.findOrCreate({
            where: { name: tag.slice(1).toLowerCase() },
          })
        )
      );
      await newPost.addHashtags(result.map((r) => r[0]));
    }
    if (req.body.image) {
      if (Array.isArray(req.body.image)) {
        const images = await Promise.all(
          req.body.image.map((image) => {
            return db.Image.create({ src: image, UserId: req.user.id });
          })
        );
        await newPost.addImages(images);
      } else {
        const image = await db.Image.create({
          src: req.body.image,
          UserId: req.user.id,
        });
        await newPost.addImage(image);
      }
    }
    const fullPost = await db.Post.findOne({
      where: { id: newPost.id },
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
      message: "Successful writing of bulletin post",
      data: { fullPost },
    });
  } catch (err) {
    console.error(err);
    return next(err);
  }
});

router.post("/images", upload.array("image"), (req, res) => {
  res.json(req.files.map((v) => v.location));
});

router.get("/:id", async (req, res, next) => {
  try {
    const post = await db.Post.findOne({
      where: { id: req.params.id },
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
      message: "Successfully loaded post information",
      data: { post },
    });
  } catch (err) {
    console.error(err);
    return next(err);
  }
});
router.get("/:id/comments", async (req, res, next) => {
  try {
    const post = await db.Post.findOne({
      where: { id: req.params.id },
    });
    if (!post) {
      return res
        .status(404)
        .json({
          success: false,
          message: "This post does not exist",
          data: {},
        });
    }
    const comments = await db.Comment.findAll({
      where: { postId: post.id },
      order: [["createdAt", "DESC"]], // 최근순부터
      include: [
        {
          model: db.User,
          attributes: ["id", "nickname", "email"],
        },
      ],
    });
    return res.json({
      success: true,
      message: "Successfully loaded all comments on the post",
      data: { comments },
    });
  } catch (err) {
    console.error(err);
    return next(err);
  }
});

router.post("/:id/comment", isAuth, async (req, res, next) => {
  try {
    const post = await db.Post.findOne({
      where: { id: req.params.id },
    });
    if (!post) {
      return res
        .status(404)
        .json({
          success: false,
          message: "This post does not exist",
          data: {},
        });
    }
    const newComment = await db.Comment.create({
      content: req.body.content,
      postId: post.id,
      userId: req.user.id,
    });
    await post.addComment(newComment.id);
    const comment = await db.Comment.findOne({
      where: { id: newComment.id },
      include: [
        {
          model: db.User,
          attributes: ["id", "nickname", "email"],
        },
      ],
    });
    return res.json({
      success: true,
      message: "Successfully completed commenting on the post",
      data: { comment },
    });
  } catch (err) {
    console.error(err);
    return next(err);
  }
});

router.post("/:id/like", isAuth, async (req, res, next) => {
  try {
    const post = await db.Post.findOne({ where: { id: req.params.id } });
    if (!post) {
      return res
        .status(404)
        .json({
          success: false,
          message: "This post does not exist",
          data: {},
        });
    }
    await post.addLiker(req.user.id);
    return res.json({
      success: true,
      message: "Successfully liked the post",
      data: { userId: req.user.id },
    });
  } catch (err) {
    console.error(err);
    return next(err);
  }
});

router.delete("/:id/like", isAuth, async (req, res, next) => {
  try {
    const post = await db.Post.findOne({ where: { id: req.params.id } });
    if (!post) {
      return res
        .status(404)
        .json({
          success: false,
          message: "This post does not exist",
          data: {},
        });
    }
    await post.removeLiker(req.user.id);
    return res.json({
      success: true,
      message: "Successfully canceled the liked post",
      data: { userId: req.user.id },
    });
  } catch (err) {
    console.error(err);
    return next(err);
  }
});

router.post("/:id/retweet", isAuth, async (req, res, next) => {
  try {
    const post = await db.Post.findOne({
      where: { id: req.params.id },
      include: [
        {
          model: db.Post,
          as: "Retweet",
        },
      ],
    });
    if (!post) {
      return res
        .status(404)
        .json({
          success: false,
          message: "This post does not exist",
          data: {},
        });
    }
    if (
      req.user.id === post.userId ||
      (post.Retweet && post.Retweet.userId === req.user.id)
    ) {
      //게시물 작성자 또는 리트윗한 게시물 작성자
      return res.status(404).json({
        success: false,
        message: "You cannot retweet your own posts",
        data: {},
      });
    }
    const retweetTagetId = post.RetweetId || post.id; //게시물을 리트윗하거나 리트윗한 게시물을 다시 리트윗 할 경우
    const exPost = await db.Post.findOne({
      where: {
        userId: req.user.id,
        RetweetId: retweetTagetId,
      },
    });
    if (exPost) {
      return res.status(404).json({
        success: false,
        message: "This is already a retweet post",
        data: {},
      });
    }
    const retweet = await db.Post.create({
      userId: req.user.id,
      RetweetId: retweetTagetId,
      subject: "retweet",
      content: "retweet",
    });
    const retweetWithPrevPost = await db.Post.findOne({
      where: { id: retweet.id },
      include: [
        {
          model: db.User,
          attributes: ["id", "nickname", "email"],
        },
        {
          model: db.Post,
          as: "Retweet",
          include: [
            {
              model: db.User,
              attributes: ["id", "nickname", "email"],
            },
            {
              model: db.Image,
            },
          ],
        },
      ],
    });

    return res.json({
      success: true,
      message: "Retweet the post successfully",
      data: { retweetWithPrevPost },
    });
  } catch (err) {
    console.error(err);
    return next(err);
  }
});

router.delete("/:id", isAuth, async (req, res, next) => {
  try {
    const post = await db.Post.findOne({ where: { id: req.params.id } });
    if (!post) {
      return res
        .status(404)
        .json({
          success: false,
          message: "This post does not exist",
          data: {},
        });
    }
    const userPost = await db.Post.findOne({
      where: { id: req.params.id, UserId: req.user.id },
    });
    if (!userPost) {
      return res
        .status(404)
        .json({
          success: false,
          message: "Only your own posts can be deleted.",
          data: {},
        });
    }
    await db.Post.destroy({ where: { id: post.id } });
    return res.json({
      success: true,
      message: "Delete bulletin post successfully",
      data: { postId: req.params.id },
    });
  } catch (err) {
    console.error(err);
    return next(err);
  }
});

router.patch("/:id", isAuth, async (req, res, next) => {
  try {
    const post = await db.Post.findOne({ where: { id: req.params.id } });
    if (!post) {
      return res
        .status(404)
        .json({
          success: false,
          message: "This post does not exist",
          data: {},
        });
    }

    const userPost = await db.Post.findOne({
      where: { id: req.params.id, UserId: req.user.id },
    });
    if (!userPost) {
      return res
        .status(404)
        .json({
          success: false,
          message: "Only your own posts can be modifed.",
          data: {},
        });
    }
    await db.Post.update(
      { subject: req.body.subject, content: req.body.content },
      { where: { id: post.id } }
    );
    return res.json({
      success: true,
      message: "Modify bulletin post successfully",
      data: { postId: req.params.id },
    });
  } catch (err) {
    console.error(err);
    return next(err);
  }
});

module.exports = router;
