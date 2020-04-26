const passport = require("passport");
const passportJWT = require("passport-jwt");
const JWTStrategy = passportJWT.Strategy;
const ExtractJWT = passportJWT.ExtractJwt;
const LocalStrategy = require("passport-local").Strategy;
import bcrypt from "bcrypt";
import db from "../models";
require("dotenv").config();
module.exports = () => {
  // Local Strategy
  passport.use(
    new LocalStrategy(
      {
        usernameField: "email",
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

  //JWT Strategy
  passport.use(
    new JWTStrategy(
      {
        jwtFromRequest: ExtractJWT.fromAuthHeaderAsBearerToken('jwt'),
        secretOrKey: process.env.ACCESS_TOKEN_SECRET,

    },
      async ({id}, done) => {
        try {
          const user = await db.User.findByPk(id);
          if (!user) {
            return done(null, false, { reaseon: "존재하지않는 사용자입니다." });
          }
          console.log(user)
          return done(null, user);
        } catch (err) {
          console.error(err);
          return done(err);
        }
      }
    )
  );
};
