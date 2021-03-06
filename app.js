//jshint esversion:6
require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const ejs = require('ejs');
const mongoose = require('mongoose');
const session = require('express-session');
const passport = require('passport');
const passportLocalMongoose = require('passport-local-mongoose');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const FacebookStrategy = require('passport-facebook').Strategy;
const findOrCreate = require('mongoose-findorcreate');

// const bcrypt = require('bcrypt');
// const saltRounds = 10;
// const encrypt = require('mongoose-encryption');
// const md5 = require('md5');

const app = express();
let current_User;

app.use(express.static("public"));
app.set('view engine', 'ejs');
app.use(bodyParser.urlencoded({extended: true}));

app.use(session({
    secret: process.env.KEY,
    resave: false,
    saveUninitialized: false
}));

app.use(passport.initialize());
app.use(passport.session());
mongoose.connect("mongodb://localhost:27017/userDB");

const userSchema = new mongoose.Schema({
    email: String,
    password: String, 
    googleId: String,
    facebookId: String,
    username: {
        sparse: true,
        type: String
    },
    secret: String
});

userSchema.plugin(passportLocalMongoose);
userSchema.plugin(findOrCreate);

// userSchema.plugin(encrypt, {secret: process.env.KEY, encryptedFields: ['password']});

const User = mongoose.model("User", userSchema);

passport.use(User.createStrategy());

passport.serializeUser(function(user, done) {
    done(null, user.id);
  });
  
  passport.deserializeUser(function(id, done) {
    User.findById(id, function(err, user) {
      done(err, user);
    });
  });

passport.use(new GoogleStrategy({
    clientID: process.env.CLIENT_ID,
    clientSecret: process.env.CLIENT_SECRET,
    callbackURL: "http://localhost:3000/auth/google/secrets"
  },
  function(accessToken, refreshToken, profile, cb) {
    User.findOrCreate({ googleId: profile.id, username: profile.displayName }, function (err, user) {
      return cb(err, user);
    });
  }
));

passport.use(new FacebookStrategy({
    clientID: process.env.FACEBOOK_APP_ID,
    clientSecret: process.env.FACEBOOK_APP_SECRET,
    callbackURL: "http://localhost:3000/auth/facebook/secrets"
  },
  function(accessToken, refreshToken, profile, cb) {
    User.findOrCreate({ facebookId: profile.id, username: profile.displayName }, function (err, user) {
      return cb(err, user);
    });
  }
));


//GET REQUESTS
app.get('/', (req, res)=>{
    if(req.isAuthenticated()){
        res.redirect('/secrets');
    }else{
        res.render('home');
    }
});

app.get('/auth/google', passport.authenticate('google', {scope: ['profile']}));

app.get('/auth/google/secrets', 
  passport.authenticate('google', { failureRedirect: '/login' }),
  function(req, res) {
    // Successful authentication, redirect home.
    res.redirect('/secrets');
  });

app.get('/auth/facebook',
  passport.authenticate('facebook'));

app.get('/auth/facebook/secrets',
  passport.authenticate('facebook', { failureRedirect: '/login' }),
  function(req, res) {
    // Successful authentication, redirect home.
    res.redirect('/secrets');
  });

app.get('/submit', (req, res)=>{
    if(req.isAuthenticated()){
        res.render('submit');
    }else{
        res.render('home');
    }
});

app.get('/register', (req, res)=>{
    res.render('register');
});

app.get('/login', (req, res)=>{
    res.render('login');
});

app.get('/secrets', (req, res)=>{
    if(req.isAuthenticated()){
        User.find({"secret":{$ne:null}}, (err, foundUser)=>{
            if(err){
                console.log(err);
            }else{
                if(foundUser){
                    res.render('secrets', {username: req.user.username, usersWithSecrets: foundUser});
                }
            }
        });
    }else{
        res.redirect('/login');
    }
});

app.get('/logout',(req,res)=>{
    req.logout();
    res.redirect('/');
});

//POST REQUESTS
app.post('/submit', (req, res)=>{
    const submittedSecret = req.body.secret;
    User.findById(req.user.id, (err, foundUser)=>{
        if(err){
            console.log(err);
        }else{
            if(foundUser){
                foundUser.secret = submittedSecret;
                foundUser.save();
                res.redirect('/secrets');
            }
        }
    });
});

app.post('/register', (req, res)=>{
    User.register({username: req.body.username}, req.body.password, (err, user)=>{
        if(err){
            console.log(err);
            res.redirect('/register');
        }else{
            passport.authenticate('local')(req, res, ()=>{
                res.redirect('/secrets');
            });
        }
    });
});

app.post('/login', (req, res)=>{
    const user = new User({
        username: req.body.username,
        password: req.body.password
    });

    req.login(user, (err)=>{
        if(err){
            console.log(err);
        }else{
            passport.authenticate('local')(req, res, ()=>{
                res.redirect('/secrets');
            });
        }
    })

});


app.listen(3000, ()=>{
    console.log("Server started on port 3000");
});
