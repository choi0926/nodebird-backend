import express from "express";
import db from "../models";
import sequelize from "sequelize";
const Op = sequelize.Op;
const router = express.Router();

router.get("/", async (req, res, next) => {
  try {
    const posts = await db.Post.findAll({
      include: [
        {
          model: db.User,
          attributes: ["id", "nickname", "email"],
        },
        {
          model: db.Image,
        },
        {
          model: db.User,
          through: "Like",
          as: "Likers",
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
      order: [["createdAt", "DESC"]],
      limit: parseInt(req.query.limit, 10),
      offset: parseInt(req.query.offset, 10),
    });
    return res.json({
      success: true,
      message: "Successfully loaded posts",
      data: { posts },
    });
  } catch (err) {
    console.error(err);
    return next(err);
  }
});

router.get("/:searchWord", async (req, res, next) => {
  try {
    const searchPost = await db.Post.findAll({
      where: {
        [Op.or]: [
          {
            content: {
              [Op.like]: "%" + decodeURIComponent(req.params.searchWord) + "%",
            },
          },
          {
            subject: {
              [Op.like]: "%" + decodeURIComponent(req.params.searchWord) + "%",
            },
          },
        ],
      },
      include: [
        {
          model: db.User,
          attributes: ["id", "nickname", "email"],
        },
        {
          model: db.Image,
        },
        {
          model: db.User,
          through: "Like",
          as: "Likers",
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
      order: [["createdAt", "DESC"]],
      limit: parseInt(req.query.limit, 10),
      offset: parseInt(req.query.offset, 10),
    });

    res.json({ success: true, message: "Successfully search posts", data: searchPost });
  } catch (err) {
    console.error(err);
    return next(err);
  }
});

module.exports = router;
