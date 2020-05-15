import db from '../models'
import dotenv from 'dotenv';
import redis from 'redis';
import JWTR from 'jwt-redis';
dotenv.config();
const redisClient = redis.createClient(process.env.REDIS_URL);
const jwtr = new JWTR(redisClient);

exports.isAuth = async(req, res, next) => {
  if(req.headers.authorization){
    const accessToken = req.headers.authorization.split(" ")[1];
    const accessTokenVerify = await jwtr.verify(accessToken,process.env.ACCESS_TOKEN_SECRET);
    const user = await db.User.findOne({where:{email:accessTokenVerify.email}});
    if(!user){
      return res.status(403).json({success:false, message:"Invalid access token "})
    }
    req.jti = accessTokenVerify.jti;
    req.user = user;
    next();
  }else{
    return res.status(401).send('You can use it after logging in.');
  }
};

exports.isNotAuth = (req, res, next) => {
  if (!req.headers.authorization) {
    next();
  } else {
    return res.status(401).send('The logged in user cannot be accessed.');
  }
};
