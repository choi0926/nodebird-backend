import express from 'express';
import db from './models';
import morgan from 'morgan';
import userApiRouter from './routes/user';
import postApiRouter from './routes/post';
import postsApiRouter from './routes/posts';
import hashtagApiRouter from './routes/hashtag';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import expressSession from 'express-session';
import dotenv from 'dotenv';
import passport from 'passport';
import passportConfig from './passport';

dotenv.config();
const app = express();
db.sequelize.sync();
passportConfig();

///////미들웨어///
app.use(morgan('dev'));
//body-parser를 안쓰고 express에서 지원
app.use(express.json()); 
app.use(express.urlencoded({extended:true}));// 본문 req.body..  
app.use(cors({
    origin:true, //http://domain.com(클라이언트 주소) 프론트에서도 (axios)해야함
    credentials:true
}));
app.use(cookieParser(process.env.COOKIE_SECRET));
app.use(expressSession({
    resave:false,
    saveUninitialized:false,
    secret:process.env.COOKIE_SECRET,
    cookie:{
        httpOnly:true, //javascript로 쿠키접근불가능
        secure:false,//https사용시 true
    }
}))
app.use(passport.initialize());
app.use(passport.session()); //expressSession 아래에 위치시킴

//라우터
app.use('/api/user',userApiRouter);
app.use('/api/post',postApiRouter);
app.use('/api/posts',postsApiRouter);
app.use('/api/hashtag',hashtagApiRouter);
app.listen(4000,()=>{
    console.log('server is ruuning on localhost:4000');
})