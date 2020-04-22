import express from "express";
import db from "../models";
const router = express.Router();

router.post('/', async (req, res,next) => {
  try {
     const hashtags = req.body.content.match(/#[^\s]+/g);
     console.log(hashtags);
    const newPost = await db.Post.create({
      subject: req.body.subject,
      content: req.body.content,
      userId: req.user.id,
    });
   
    if(hashtags){
        const result = await Promise.all(hashtags.map(tag=>db.Hashtag.findOrCreate({
            where:{name:tag.slice(1).toLowerCase()},
        })));
        console.log(result)
        await newPost.addHashtags(result.map(r=>r[0]));
    }

    // console.log(newPost.id)
    const fullPost = await db.Post.findOne({
        where:{id:newPost.id},
        include:[{
            model:db.User,
        }]
    })
    res.json(fullPost);
  } catch (err) {
    console.error(err);
    next(err);
  }
});
router.get('/images', (req, res) => {});

module.exports = router;
