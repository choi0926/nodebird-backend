exports.isLoggendIn = (req,res,next)=>{
    if(req.user){
        next();
    }else{
        res.status(401).send('로그인이 필요합니다.');
    }
}

exports.isNotLoggendIn = (req,res,next)=>{
    if(!req.user){
        next();
    }else{
        res.status(401).send('로그인한 사용자는 접근할 수 없습니다.');
    }
}