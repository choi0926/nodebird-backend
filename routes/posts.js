import express from 'express';
import db from '../models';
const router = express.Router();

router.get('/', async (req, res, next) => {
  try {
    const posts = await db.Post.findAll({
      include: [
        {
          model: db.User,
          attributes:['id','nickname','email']
        },
        {
          model: db.Image,
        },
        {
          model: db.User,
          through:'Like',
          as:'Likers',
          attributes:['id','nickname','email']
        },{
          model:db.Post,
          as:'Retweet',
          include:[{
            model:db.User,
            attributes:['id','nickname','email']
          },{
            model: db.Image,
          }]
        }
      ],
      order: [['createdAt', 'DESC']],
      limit: parseInt(req.query.limit, 10),
      offset: parseInt(req.query.offset, 10),
    });
    return res.json({
      success: true,
      message: 'Successful writing of bulletin post',
      data: { posts },
    });
  } catch (err) {
    console.error(err);
    return next(err);
  }
});

module.exports = router;
