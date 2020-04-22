module.exports=(sequelize,DaTaTypes)=>{
    const Comment = sequelize.define(
        'comment',{
            content:{
                type:DaTaTypes.STRING(200),
                allowNull:false
            },
        },{
            charset:'utf8mb4',
            collate:'utf8mb4_general_ci'
        }
       )
       Comment.associate = (db)=>{
           db.Comment.belongsTo(db.Post);
           db.Comment.belongsTo(db.User);
           
       }
       return Comment;
}