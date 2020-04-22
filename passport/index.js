import passport from "passport";
import db from "../models";
import local from "./local";

module.exports = () => {
  passport.serializeUser((user, done) => {
    //서버쪽에 id, cookie
    return done(null, user.id);
  });
  passport.deserializeUser(async (id, done) => {
    // 요청 보낼때마다 실행되기때문에 "캐싱" 추가해야함.
    try {
      const user = await db.User.findOne({ where: { id } });
      return done(null, user); //user 정보는 req.user에 저장됨
    } catch (err) {
      console.error(err);
      return done(err);
    }
  });

  local();
};
