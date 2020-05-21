import db from '../models'
import dotenv from 'dotenv';
import redis from 'redis';
import JWTR from 'jwt-redis';
import nodemailer from 'nodemailer';
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

exports.sendMail = async (to, subject, authCode) => {
  const googleTransport = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 465,
      secure: true,
      auth: {
        type: 'OAuth2',
        user: process.env.GOOLE_USER,
        clientId: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        refreshToken: process.env.GOOGLE_REFRESH_TOKEN,
        accessToken: process.env.GOOGLE_ACCESS_TOKEN,
        expires: 3600,
      },
    }),
    mailOptions = {
      from: `Title Academy ${process.env.GOOLE_USER}`,
      to,
      subject,
      html: `<p>Please click on the following link</p>
       <p><a href="${process.env.FRONT_AUTH_DOMAIN}${authCode}">${process.env.FRONT_AUTH_DOMAIN}${authCode}</a></p>`,
    };

  try {
    await googleTransport.sendMail(mailOptions);

    googleTransport.close();
    console.log(`mail have sent to ${to}`);
  } catch (error) {
    console.error(error);
  }
};
