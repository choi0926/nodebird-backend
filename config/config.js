import dotenv from 'dotenv';
dotenv.config();

module.exports ={
  "development": {
    "username": process.env.DB_USERNAME,
    "password": process.env.DB_PASSWORD,
    "database": "restful-server",
    "host":process.env.DB_HOST,
    "dialect": "mysql",
    "operatorsAliases": false
  },
  "test": {
    "username": process.env.DB_USERNAME,
    "password": process.env.DB_PASSWORD,
    "database": "database_test",
    "host": process.env.DB_HOST,
    "dialect": "mysql",
    "operatorsAliases": false
  },
  "production": {
    "username": process.env.DB_USERNAME,
    "password": process.env.DB_PASSWORD,
    "database": "database_production",
    "host": process.env.DB_HOST,
    "dialect": "mysql",
    "operatorsAliases": false
  }
}
