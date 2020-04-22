import passport from "passport";
import { Strategy } from "passport-local";
import bcrypt from "bcrypt";
import db from "../models";
module.exports = () => {
  passport.use(
    new Strategy(
      {
        usernameField: "email", //req.body. 속성
        passwordField: "password",
      },
      async (email, password, done) => {
        try {
          const user = await db.User.findOne({ where: { email } });
          if (!user) {
            return done(null, false, { reaseon: "존재하지않는 사용자입니다." });
          }
          const result = await bcrypt.compare(password, user.password);
          if (result) {
            return done(null, user);
          }
          return done(null, false, { reaseon: "비밀번호가 틀렸습니다." });
        } catch (err) {
          console.error(err);
          return done(err);
        }
      }
    )
  );
};
