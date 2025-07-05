// Creating Token and  store Cookie

const sendToken = (user,statuCode,res)=>{
    const token = user.getJWTToken();

    //option for cookie

    const options = {
        expire:new Date(
            Date.now + process.env.COOKIE_EXPIRE*24*60*60*1000
        ),
        httpOnly:true,
    }

    res.status(statuCode).cookie("token",token,options).json({
        success:true,
        user,
        token,
    });
};

module.exports = sendToken;