import express from 'express';
import db from '../models'
const router = express.Router();

router.get('/:tag',async(req,res,next)=>{
  try{
      const posts = await db.Post.findAll({
       include:[{
           model:db.Hashtag,
           where:{name:decodeURIComponent(req.params.tag)},
       }]
      });
      res.json(posts);
    
  }catch(err){
      console.error(err);
      next(err);
  }

});

module.exports = router;