let  jwt=require("jsonwebtoken");
let redisclient=require("../database/redis")
let adminmiddleware=async (req,res,next) =>{
    try{
    let {token}=req.cookies;
    
    if(!token){
        throw new Error("Token is not present")
    }

    let payload=jwt.verify(token,process.env.private_key);

    let {id}=payload;

    if(!id){
        throw new Error("token is not present")
    }

    let result =await prisma.user.findUnique({where:{id}})
    if(!result){
        throw new Error("user does't not exist")
    }
    
    if(result.role!="admin"){
        throw new Error("This is only access by Admins")
    }

    const IsBlocked = await redisclient.exists(`token:${token}`);

    if(IsBlocked)
    throw new Error("Invalid Token");
    
    req.user=result;

    next()
}
catch(err){
        res.status(401).send("Error: "+ err.message)
    }
     

    


}
module.exports=adminmiddleware;
