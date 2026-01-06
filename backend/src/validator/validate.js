const validator = require('validator');

function validuser(data){
     const mandatoryField = ["username","email","password"]

        const IsAllowed = mandatoryField.every((k)=> Object.keys(data).includes(k));

        if(!IsAllowed)
            throw new Error("Fields Missing");

        if(!(data.username.length>=3 && data.username.length<=30))
            throw new Error("invalid name")

        if(!validator.isEmail(data.email))
            throw new Error("invalid Email")

        if(!validator.isStrongPassword(data.password))
            throw new Error("weak password")

        
}

module.exports=validuser