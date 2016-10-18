var express = require('express');
var router = express.Router();
var uuid = require('uuid');
var nodemailer = require('nodemailer');
var events = require('events');
var eventEmitter = new events.EventEmitter();
//import models schema
var User = require('../models/user');
var TempUser = require('../models/tempuser');
var RequestNewPassword = require('../models/request');
//config smtp email 
var smtpTransport = nodemailer.createTransport("SMTP", {
    service: "Gmail",
    auth: {
        //gmail for sending the email 
        user: "digitalteamburda@gmail.com",
        pass: "Digital2016@@"
    }
});
var mailOptions, host, link;
router.post('/signup', function (req, res) {
    var tempUser = new TempUser();
    User.findOne({ 'email': req.body.email }, function (err, result) {
        if (err) {
            console.log(err);
        } else {
            if (result == null) {
                console.log('you can use this email');
                User.findOne({ 'username': req.body.username }, function (err, result) {
                    if (err) {
                        console.log(err)
                    } else {
                        if (result == null) {
                            console.log('you can use this username');
                            eventEmitter.emit('Send');
                        } else {
                            res.end('this username is already taken');
                        }
                    }
                })
            } else {
                res.end('this email is already taken');
            }
        }
    });
    eventEmitter.on('Send', function () {
        var rand = uuid.v4();
        host = req.get('host');
        link = "http://" + req.get('host') + "/api/verify?id=" + rand;
        mailOptions = {
            to: req.body.email,
            subject: "Please confirm your email address",
            html: "Hello, <br> Please click on the link below to verify your email.<a href=" + link + ">Click here to verify</a>"
        }
        console.log(mailOptions);
        tempUser.id = rand;
        tempUser.username = req.body.username;
        tempUser.email = req.body.email;
        tempUser.password = req.body.password;
        smtpTransport.sendMail(mailOptions, function (error, response) {
            if (error) {
                console.log(error);
                res.end(err);
            } else {
                tempUser.save(function (err) {
                    if (err) {
                        res.end(err);
                    } else {
                        console.log('Save temp user already');
                        console.log('Wait for verify email');
                        res.end('Wait....');
                    }
                });
                console.log("Message sned: " + response.message);
            }
        });
    })
});
//verify email address from the user
router.get('/verify', function (req, res) {
    console.log(req.protocol + ':/' + req.get('host'));
    var db = User();
    var id;
    if ((req.protocol + "://" + req.get('host')) == ("http://" + host)) {
        console.log("Domain is matched. Information is form Authentic email");
        TempUser.findOne({ 'id': req.query.id }, function (err, result) {
            if (err) {
                console.log(err);
            } else {
                console.log('Found request');
                db['username'] = result.username;
                db['email'] = result.email;
                db['password'] = db.generateHash(result.password);
                id = result.id;
                if (req.query.id == id) {
                    db.save(function (err) {
                        if (err) {
                            console.log(err);
                        } else {
                            console.log('Save successfull');
                        }
                    });
                    TempUser.remove({ 'email': result.email }, function (err) {
                        if (err) {
                            console.log(err);
                        } else {
                            console.log('Remove tempuser already');
                        }
                    });
                    console.log("Email is verified");
                    res.render('verifyPage', { data: result.email });
                    //res.end("Email "+result.email+" is been Successfully verified");
                }
                else {
                    console.log("email is not verified");
                    res.end("<h1>Bad Request</h1>");
                }
            }
        });
    } else {
        res.end("<h1>Request is from unknown source</h1>");
    }
});

/////////////forget password system//////////////////////////////////////
router.post('/forgotPassword', function (req, res) {
    var requestPass = new RequestNewPassword();
    var rand = uuid.v4();
    host = req.get('host');
    link = "http://" + req.get('host') + "/requestNewPassword?id=" + rand;
    mailOptions = {
        to: req.body.email,
        subject: "Reset Password System",
        html: "Hello,<br> Please click this link to go to reset password page.<br><a href=" + link + ">Click here to reset password</a>"
    }
    console.log(mailOptions);
    requestPass.id = rand;
    requestPass.email = req.body.email;
    smtpTransport.sendMail(mailOptions, function (error, response) {
        if (error) {
            console.log(error);
            res.end(error);
        } else {
            requestPass.save(function (err) {
                if (err) {
                    console.log(err);
                    res.end(err);
                }
                else {
                    console.log("Making a new request to request new password");
                    console.log('Wait...... for response from email');
                    res.end('Wait for response');
                }
            });
            console.log("Message sent: " + response.message);
        }
    });
});

//request password 
router.get('/requestNewPassword', function (req, res) {
    console.log(req.protocol + ':/' + req.get('host'));
    if ((req.protocol + "://" + req.get('host')) == ("http://" + host)) {
        //looking for request in database which one is match the id with the link
        RequestNewPassword.findOne({ 'id': req.query.id }, function (err, result) {
            if (err) {
                console.log(err);
            } else {
                if (result.id == req.query.id) {
                    res.render('resetPassword', { 'email': result.email });
                } else {
                    res.end("Already done");
                }
            }
        })
    }
});
//update password 
router.post('/updatePassword', function (req, res) {
    var db = new User();
    console.log(req.body.email);
    var password = db.generateHash(req.body.password); // encode password 
    User.findOne({ 'email': req.body.email }, function (err, result) {
        if (err) {
            console.log(err);
            res.end(err);
        } else {
            //update password and hash password tobe encode
            result.update({
                "password": password // update password
            }, function (err, result) {
                if (err) {
                    console.log(err);
                    res.end(err);
                } else {
                    console.log('Update password successfully');
                    RequestNewPassword.remove({ 'email': req.body.email }, function (req, result) {
                        if (err) {
                            console.log(err);
                        } else {
                            console.log('Remove request')
                        }
                    })
                    res.end('Changed');
                }
            })
        }
    })
    res.render('changePass');
});

//show all users 
router.get('/users', function (req, res) {
    User.find({}, function (err, result) {
        if (err) {
            console.log(err);
        } else {
            res.json(result);
        }
    })
})

module.exports = router;
/*
module.exports = function(app){
    //sign up 
    
    app.post('/signup',function(req,res){
        var tempUser = new TempUser();
        User.findOne({'email':req.body.email},function(err,result){
            if(err){
                console.log(err);
            }else{
                if(result == null){
                    console.log('you can use this email');
                    User.findOne({'username': req.body.username},function(err,result){
                        if(err){
                            console.log(err)
                        }else{
                            if (result == null){
                                console.log('you can use this username');
                                eventEmitter.emit('Send');
                            }else{
                                res.end('this username is already taken');
                            }
                        }
                    })
                }else{
                    res.end('this email is already taken');
                }
            }
        });
        eventEmitter.on('Send',function(){
            var rand = uuid.v4();
            host=req.get('host');
            link = "http://"+req.get('host')+"/verify?id="+rand;
            mailOptions={
                to : req.body.email,
                subject : "Please confirm your email address",
                html: "Hello, <br> Please click on the link below to verify your email.<a href="+link+">Click here to verify</a>" 
            }
            console.log(mailOptions);
            tempUser.id = rand;
            tempUser.username = req.body.username;
            tempUser.email = req.body.email;
            tempUser.password = req.body.password;
            smtpTransport.sendMail(mailOptions,function(error,response){
                if(error){
                    console.log(error);
                    res.end(err);
                }else{
                    tempUser.save(function(err){
                        if(err){
                            res.end(err);
                        }else{
                            console.log('Save temp user already');
                            console.log('Wait for verify email');
                            res.end('Wait....');
                        }
                    });
                    console.log("Message sned: "+ response.message);
                }
            });
        })
    });
    //verify email address from the user
    app.get('/verify',function(req,res){
        console.log(req.protocol+':/'+req.get('host'));
        var db = User();
        var id;
        if((req.protocol+"://"+req.get('host'))==("http://"+host))
        {
            console.log("Domain is matched. Information is form Authentic email");
            TempUser.findOne({'id':req.query.id},function(err,result){
                if(err){
                    console.log(err);
                }else{
                    console.log('Found request');
                    db['username'] = result.username;
                    db['email'] = result.email;
                    db['password'] = db.generateHash(result.password);
                    id = result.id;
                    if(req.query.id == id){
                        db.save(function(err){
                            if(err){
                                console.log(err);
                            }else{
                                console.log('Save successfull');
                            }
                        });
                        TempUser.remove({'email':result.email},function(err){
                            if(err){
                                console.log(err);
                            }else{
                                console.log('Remove tempuser already');
                            }
                        });
                        console.log("Email is verified");
                        res.render('verifyPage',{data:result.email});
                        //res.end("Email "+result.email+" is been Successfully verified");
                    }
                    else{
                        console.log("email is not verified");
                        res.end("<h1>Bad Request</h1>");
                    }
                }
            });
        }else{
           res.end("<h1>Request is from unknown source</h1>");
        }
    });

    /////////////forget password system//////////////////////////////////////
    app.post('/forgotPassword',function(req,res){
        var requestPass = new RequestNewPassword();
        var rand = uuid.v4();
        host=req.get('host');
        link="http://"+req.get('host')+"/requestNewPassword?id="+rand;
        mailOptions={
            to : req.body.email,
            subject : "Reset Password System",
            html : "Hello,<br> Please click this link to go to reset password page.<br><a href="+link+">Click here to reset password</a>" 
        }
        console.log(mailOptions);
        requestPass.id = rand;
        requestPass.email = req.body.email;
        smtpTransport.sendMail(mailOptions,function(error,response){
            if(error){
                console.log(error);
                res.end(error);
            }else{
                requestPass.save(function(err){
                    if(err){
                        console.log(err);
                        res.end(err);
                    }
                    else{
                        console.log("Making a new request to request new password");
                        console.log('Wait...... for response from email');
                        res.end('Wait for response');
                    }
                });
                console.log("Message sent: " + response.message);
            }
        });  
    });

    //request password 
    app.get('/requestNewPassword',function(req,res){
        console.log(req.protocol+':/'+req.get('host'));
        if((req.protocol+"://"+req.get('host'))==("http://"+host)){
            //looking for request in database which one is match the id with the link
            RequestNewPassword.findOne({'id':req.query.id},function(err,result){
            if(err){
                console.log(err);
            }else{
                if(result.id == req.query.id){
                    res.render('resetPassword',{'email':result.email});
                }else{
                    res.end("Already done");
                }
            }
            })
        }
    });
    //update password 
    app.post('/updatePassword',function(req,res){
    var db = new User();
    console.log(req.body.email);
    var password = db.generateHash(req.body.password); // encode password 
    User.findOne({'email':req.body.email},function(err,result){
        if (err){
            console.log(err);
            res.end(err);
        }else{
            //update password and hash password tobe encode
            result.update({
            "password" : password // update password
            },function(err,result){
            if(err){
                console.log(err);
                res.end(err);
            }else{
                console.log('Update password successfully');
                RequestNewPassword.remove({'email':req.body.email},function(req,result){
                if(err){
                    console.log(err);
                }else{
                    console.log('Remove request')
                }
                })
                res.end('Changed');
            }
            })
        }
    })
        res.render('changePass');
    });

    //show all users 
    app.get('/api/users',function(req,res){
        User.find({},function(err,result){
            if(err){
                console.log(err);
            }else{
                res.json(result);
            }
        })
    })


}
*/