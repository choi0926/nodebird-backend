module.exports = (sequelize, DataTypes) => {
  const User = sequelize.define(
    "user",
    {
      email: {
        type: DataTypes.STRING(100),
        allowNull: false,
        unique: true,
      },
      nickname: {
        type: DataTypes.STRING(50),
        allowNull: false,
      },
      password: {
        type: DataTypes.STRING(200),
        allowNull: false,
      },
    },
    {
      charset: "utf8",
      collate: "utf8_general_ci",
    }
  );
  User.associate = (db) => {
    db.User.hasMany(db.Post,{as:'Post'});
    db.User.hasMany(db.Comment);
    db.User.belongsToMany(db.Post,{through:'Like',as:'Liked'});
    db.User.belongsToMany(db.User,{through:'Follow', as:'followers', foreignKey:'followingId'});
    db.User.belongsToMany(db.User,{through:'Follow', as:'followings', foreignKey:'followerId'});
  };
  return User;
};
