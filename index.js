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
import helmet from 'helmet';
import hpp from 'hpp';
const prod = process.env.NODE_ENV == 'production';

dotenv.config();
const app = express();
db.sequelize.sync();
passportConfig();

///////미들웨어///
// if(prod){
//   app.use(hpp());
//   app.use(helmet());
//   app.use(morgan('combined'));
//   app.use(cors({
//     origin:'http://domain.com',
//     credentials:true,
//   }));
// }else{
app.use(morgan('dev'));
app.use(
  cors({
    origin: true, 
    credentials: true,
  })
);
// }
app.use('/', express.static('uploads'));
//body-parser를 안쓰고 express에서 지원
app.use(express.json());
app.use(express.urlencoded({ extended: true })); 
app.use(passport.initialize());

app.use('/api/user', userApiRouter);
app.use('/api/post', postApiRouter);
app.use('/api/posts', postsApiRouter);
app.use('/api/hashtag', hashtagApiRouter);
app.listen(4000, () => {
  console.log('server is ruuning on localhost:4000');
});
