import passport from 'passport';
import passportJWT from 'passport-jwt';
import {Strategy as JWTStrategy} from 'passport-jwt';
import {ExtractJwt as ExtractJWT} from 'passport-jwt';
import {Strategy as LocalStrategy } from 'passport-local';
import bcrypt from 'bcrypt';
import db from '../models';
import dotenv from 'dotenv';

dotenv.config();
module.exports = () => {
  // Local Strategy
  passport.use(
    new LocalStrategy(
      {
        usernameField: 'email',
        passwordField: 'password',
      },
      async (email, password, done) => {
        try {
          const user = await db.User.findOne({ where: { email } });
          if (!user) {
            return done(null, false, { message: 'User does not exist' });
          }
          const result = await bcrypt.compare(password, user.password);
          if (result) {
            return done(null, user);
          }
          return done(null, false, { message: 'The password is wrong' });
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
            return done(null, false, { message: 'User does not exist' });
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
