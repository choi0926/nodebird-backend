import express from 'express';
import db from '../models'
const router = express.Router();

router.get('/',async(req,res,next)=>{
    try {
        const posts = await db.Post.findAll({})
        res.json(posts);
        
    } catch (err) {
        console.error(err);
        next(err);
    }

});

module.exports = router;