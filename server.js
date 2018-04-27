const express = require('express');
const app = express();
const bodyParser = require("body-parser");
const jwt = require('jsonwebtoken');
const cors = require('cors');
const mongodb = require("mongodb");
const ObjectID = require('mongodb').ObjectID;
const passwordHash = require('password-hash');
const passport = require("passport");
const passportJWT = require("passport-jwt");
const QRCode = require("qrcode");

const ExtractJwt = passportJWT.ExtractJwt;
const JwtStrategy = passportJWT.Strategy;

let db;

const jwtOptions = {};
jwtOptions.jwtFromRequest = ExtractJwt.fromAuthHeaderAsBearerToken();
jwtOptions.secretOrKey = 'tasmanianDevil';

const strategy = new JwtStrategy(jwtOptions, function (jwt_payload, next)
{
    console.log('payload received', jwt_payload);

    const collection = db.collection('users');

    const id = ObjectID.createFromHexString(jwt_payload._id);

    collection.findOne({_id: id}, (err, user) =>
    {
        console.log(user);
        if (user)
        {
            next(null, user);
        }
        else
        {
            next(null, false);
        }
    });

});

passport.use(strategy);

//////////////////////////////

//const url = "mongodb://localhost:27017/project-db";
const url = "mongodb://TomKuper:lkxSQhzkfXmEgS2G@cluster0-shard-00-00-hf8fm.mongodb.net:27017,cluster0-shard-00-01-hf8fm.mongodb.net:27017,cluster0-shard-00-02-hf8fm.mongodb.net:27017/test?ssl=true&replicaSet=Cluster0-shard-0&authSource=admin";
app.set('port', (process.env.PORT || 5000));
app.use(cors({
                 origin     : true,
                 credentials: true
             }));

app.use(passport.initialize());

app.use(bodyParser.urlencoded({extended: true}));

app.use(bodyParser.json());

mongodb.MongoClient.connect(
    process.env.MONGODB_URI || url,
    (err, database) =>
    {
        if (err)
            return console.log(err);

        db = database.db('project-db');
        console.log(`connected`);

    }
);

app.get(
    '/',
    (request, response) =>
    {
        response.send('All right');
    }
);

app.post(
    "/api/buy",
    passport.authenticate('jwt', {session: false}),
    (req, res) =>
    {
        if (req.body.concert)
        {
            const concert = ObjectID(req.body.concert);
            const user = req.user._id;
            const isUsed = false;

            const collection = db.collection('tickets');

            collection.insertOne(
                {
                    'concert': concert,
                    'user'   : user,
                    'isUsed' : false
                })
                      .then(() =>
                            {
                                res.status(200);
                                res.send(
                                    {'message': 'added'});
                            });

        }
    }
);

app.post("/api/login", (req, res) =>
{
    console.log(req.body.login, req.body.password);
    if (req.body.login && req.body.password)
    {
        const login = req.body.login;

        console.log(req.body.login, req.body.password);
        const collection = db.collection('users');

        collection.findOne({login: login}, (err, user) =>
        {
            if (!user)
            {
                res.status(401).json({message: "no such user found"});
                return;
            }
            //console.log(user);

            if (passwordHash.verify(req.body.password, user.hash))
            {
                // from now on we'll identify the user by the id and the id is the only personalized value that goes into our token
                const payload = {_id: user._id};
                console.log(payload);
                const token = jwt.sign(payload, jwtOptions.secretOrKey);
                res.json({message: "ok", token: token});
            }
            else
            {
                res.status(401).json({message: "passwords did not match"});
            }
        })
    }
});

app.post(
    "/api/concert",
    passport.authenticate('jwt', {session: false}),
    (req, res) =>
    {
        if (req.body.name && req.body.image && req.body.date && req.body.description && req.body.price)
        {
            const name = req.body.name;
            const image = req.body.image;
            const date = req.body.date;
            const description = req.body.description;
            const price = req.body.price;

            const collection = db.collection('concerts');

            collection.insertOne({
                                     'name'       : name,
                                     'image'      : image,
                                     'date'       : date,
                                     'description': description,
                                     'price'      : price,
                                     'creator'    : req.user._id
                                 }).then(() =>
                                         {
                                             res.status(200);
                                             res.send({'message': 'added'});
                                         })
        }

    }
);

app.post(
    "/api/register",
    (req, res) =>
    {
        if (req.body.login && req.body.password && req.body.email && req.body.name && req.body.surname)
        {
            const login = req.body.login;
            const hash = passwordHash.generate(req.body.password);
            const email = req.body.email;
            const name = req.body.name;
            const surname = req.body.surname;

            const collection = db.collection('users');

            collection.insertOne({
                                     'name'   : name,
                                     'surname': surname,
                                     'email'  : email,
                                     'login'  : login,
                                     'hash'   : hash
                                 }).then(() =>
                                         {
                                             collection.findOne({login: login}, (err, user) =>
                                             {

                                                 if (user)
                                                 {
                                                     const payload = {_id: user._id};
                                                     console.log(payload);
                                                     const token = jwt.sign(payload, jwtOptions.secretOrKey);
                                                     res.json({message: "ok", token: token});
                                                 }
                                                 else
                                                 {
                                                     res.send(err);
                                                 }
                                             });
                                         });
        }
    }
);

app.get(
    "/api/user",
    passport.authenticate('jwt', {session: false}),
    (req, res) =>
    {
        res.send(req.user);
    }
);

app.post("/api/check", (req, res) =>
{
    ////////////////////////////////
    const collection = db.collection('tickets');
    const qr = req.body.qr;

    collection.updateOne({_id: ObjectID(qr._id)}, {$set: {isUsed: true}}, function (err, doc)
    {
        if (err)
        {
            res.status(400);
            res.send({"message": err});
        }
        else
        {
            res.status(200);
            res.send({"message": "ok"});
        }
    });
});

app.get(
    '/api/concert/:id',
    (request, response) =>
    {
        const collection = db.collection('concerts');
        const id = ObjectID.createFromHexString(request.params.id);

        collection.findOne({_id: id}, (err, document) =>
        {
            response.send(document);
        });

    }
);

app.get(
    '/api/concerts',
    (request, response) =>
    {
        let collection = db.collection('concerts');
        collection.find({}).toArray((err, results) => response.send(results));
    }
);

app.get(
    '/api/tickets/my',
    passport.authenticate('jwt', {session: false}),
    (request, response) =>
    {
        let collection = db.collection('tickets');
        collection.find({user: request.user._id}).toArray((err, results) => response.send(results));
    }
);

app.get(
    '/api/concerts/my',
    passport.authenticate('jwt', {session: false}),
    (request, response) =>
    {
        const user = request.user;
        console.log(typeof(user._id));
        //const id = ObjectID.createFromHexString(user._id);

        let collection = db.collection('concerts');
        collection.find({'creator': user._id}).toArray((err, results) => response.send(results));
    }
);

app.listen(
    app.get('port'),
    () => console.log('Node app is running on port', app.get('port'))
);
