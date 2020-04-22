module.exports=(sequelize,DaTaTypes)=>{
    const Image = sequelize.define(
        'image',{
            src:{
                type:DaTaTypes.STRING(200),
                allowNull:false
            },
            UserId:{
                type:DaTaTypes.INTEGER,
                allowNull:false
            }
        },
        {
            charset: "utf8",
            collate: "utf8_general_ci",
          }
       )
       Image.associate = (db)=>{
           db.Image.belongsTo(db.Post);
       }
       return Image;
}