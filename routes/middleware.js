import passport from 'passport';
import dotenv from 'dotenv';
dotenv.config();

exports.isNotJwtLoggedIn = (req, res, next) => {
  if (!req.headers.authorization) {
    next();
  } else {
    res.status(401).send('로그인한 사용자는 접근할 수 없습니다.');
  }
};
