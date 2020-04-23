import express from "express";
import db from "../models";
import path from "path";
import multer from "multer";
import { isLoggedIn, isNotLoggedIn } from "./middleware";

const router = express.Router();

const upload = multer({
  storage: multer.diskStorage({
    destination(req, file, done) {
      //추후 S3
      done(null, "uploads");
    },
    filename(req, file, done) {
      const ext = path.extname(file.originalname); //확장자  .jpg
      const basename = path.basename(file.originalname, ext); // 파일이름
      done(null, basename + new Date().valueOf() + ext); //파일이름에 날짜추가
    },
  }),
  limits: { fileSize: 20 * 1024 * 1024 }, //업로드 용량
});
router.post("/", isLoggedIn, upload.none(), async (req, res, next) => {
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
      console.log(result);
      await newPost.addHashtags(result.map((r) => r[0]));
    }
    if (req.body.image) {
      if (Array.isArray(req.body.image)) {
        //이미지가 배열인지
        const images = await Promise.all(
          req.body.image.map((image) => {
            return db.Image.create({ src: image,UserId:req.user.id });
          })
        );
        await newPost.addImages(images);
      } else {
      console.log(req.body.image);

        //이미지 1개 업로드
        const image = await db.Image.create({ src: req.body.image,UserId:req.user.id });
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
    res.json(fullPost);
  } catch (err) {
    console.error(err);
    next(err);
  }
});

router.post("/images", upload.array("image"), (req, res) => {
  res.json(req.files.map((v) => v.filename));
});

router.get("/:id/comments", async (req, res, next) => {
  // 해당 id 게시글에 모든댓글
  try {
    const post = await db.Post.findOne({
      where: { id: req.params.id },
    });
    if (!post) {
      res.status(404).send('존재하지 않는 게시물입니다.')
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
    res.json(comments);
  } catch (err) {
    console.error(err);
    next(err);
  }
});

router.post("/:id/comment", isLoggedIn, async (req, res, next) => {
  //해당 id 게시글에 댓글 달기
  try {
    const post = await db.Post.findOne({
      where: { id: req.params.id },
    });
    if (!post) {
      return res.status(404).send('존재하지 않는 게시물입니다.')
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
    return res.json(comment);
  } catch (err) {
    console.error(err);
    next(err);
  }
});

router.post('/:id/like',isLoggedIn,async(req,res,next)=>{
  try{
    const post = await db.Post.findOne({where:{id:req.params.id}})
    if(!post){
      return res.status(404).send('존재하지 않는 게시물입니다.')
    }
    await post.addLiker(req.user.id);
    return res.json({userId:req.user.id})
  }catch(err){
    console.error(err);
    next(err);
  }
});

router.delete('/:id/like',isLoggedIn,async(req,res,next)=>{
  try{
    const post = await db.Post.findOne({where:{id:req.params.id}})
    if(!post){
      return res.status(404).send('존재하지 않는 게시물입니다.');
    }
    await post.removeLiker(req.user.id);
    return res.json({userId:req.user.id});
  }catch(err){
    console.error(err);
    next(err);
  }
})

router.post('/:id/retweet',isLoggedIn,async(req,res,next)=>{
  try{
    const post = await db.Post.findOne({
      where:{id:req.params.id},
      include:[{
        model:db.Post,
        as:'Retweet',
      }]
    })
    if(!post){
      return res.status(404).send('존재하지 않는 게시물입니다.');
    }
    if(req.user.id === post.userId || post.Retweet &&  post.Retweet.userId === req.user.id){ //게시물 작성자 또는 리트윗한 게시물 작성자
      return res.status(403).send('자신의 게시물은 리트윗할 수 없습니다.');
    }
    const retweetTagetId = post.RetweetId ||post.id;  //게시물을 리트윗하거나 리트윗한 게시물을 다시 리트윗 할 경우
    const exPost = await db.Post.findOne({
      where:{
        userId:req.user.id,
        RetweetId:retweetTagetId
      }
    })
    if(exPost){
      return res.status(403).send('이미 리트윗한 게시물입니다.');
    }
    const retweet = await db.Post.create({
      userId:req.user.id,
      RetweetId:retweetTagetId,
      subject:'retweet',
      content:'retweet'
    })
    const retweetWithPrevPost = await db.Post.findOne({
      where:{id:retweet.id},
      include:[{
        model:db.User,
        attributes:['id','nickname','email'],
      },{
        model:db.Post,
        as:'Retweet',
        include:[{
          model:db.User,
          attributes:['id','nickname','email'],
        },{
          model:db.Image
        }]
      }]
    })
    return res.json(retweetWithPrevPost);
  }catch(err){
    console.error(err);
    next(err);
  }
})


module.exports = router;
