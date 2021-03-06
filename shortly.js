var express = require('express');
var util = require('./lib/utility');
var partials = require('express-partials');
var bodyParser = require('body-parser');
var bcrypt = require('bcrypt-nodejs');

var db = require('./app/config');
var Users = require('./app/collections/users');
var User = require('./app/models/user');
var Links = require('./app/collections/links');
var Link = require('./app/models/link');
var Click = require('./app/models/click');
var session = require('client-sessions');

var app = express();

app.set('views', __dirname + '/views');
app.set('view engine', 'ejs');
app.use(partials());
// Parse JSON (uniform resource locators)
app.use(bodyParser.json());
// Parse forms (signup/login)
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(__dirname + '/public'));
app.use(session({
  cookieName: 'session',
  secret: 'sheedoh',
  duration: 30 * 60 * 1000,
  activeDuration: 5 * 60 * 1000
}));

app.use(function(req, res, next) {
  if (req.session && req.session.user) {
    new User({ username: req.session.user }).fetch().then(function(err, user) {
      if (user) {
        req.user = user;
        delete req.user.password; // delete the password from the session
        req.session.user = user;  //refresh the session value
        res.locals.user = user;
      } 
      next();
      // finishing processing the middleware and run the route
    });
  } else {
    next();
  }
});
var requireLogin = function(req, res, next) {
  console.log('calling requireLogin');
  console.log('req.user is', req.user);
  console.log('req.session is', req.session);
  if (!req.session.user) {
    res.redirect('login');
  } else {
    //next();
  }
};
app.get('/',
function(req, res) {
  requireLogin(req, res);
  if (req.session && req.session.user) {
    new User({username: req.session.user}).fetch().then(function(found) {
      if (!found) {
        req.session.reset();
        res.redirect('/login');
      } else {
        console.log('res.locals is', res.locals);
        res.locals.user = found;
        res.render('index');
        // res.end();
      }
    }); 
  } else {
    res.redirect('/login');
  }
});

app.get('/create', 
function(req, res) {
  console.log('ENTERING /create FOR GET');
  res.render('index');
});

app.get('/links', 
function(req, res) {
  console.log('ENTERING /links FOR GET');
  Links.reset().fetch().then(function(links) {
    res.status(200).send(links.models);
  });
});

app.post('/links', 
function(req, res) {
  var uri = req.body.url;
  if (!util.isValidUrl(uri)) {
    console.log('Not a valid url: ', uri);
    return res.sendStatus(404);
  }

  new Link({ url: uri }).fetch().then(function(found) {
    if (found) {
      // console.log('IT IS FOUND!');
      // console.log('FOUND ATTRIBUTE IS', found.attributes);
      res.status(200).send(found.attributes);
    } else {
      // console.log('IT IS NOT FOUND');
      util.getUrlTitle(uri, function(err, title) {
        if (err) {
          // console.log('Error reading URL heading: ', err);
          return res.sendStatus(404);
        }

        Links.create({
          url: uri,
          title: title,
          baseUrl: req.headers.origin
        })
        .then(function(newLink) {
          res.status(200).send(newLink);
        });
      });
    }
  });
});

/************************************************************/
// Write your authentication routes here
/************************************************************/
app.post('/signup',
  function(req, res) {  
    //get hash
    //req.body.password = hash password
    console.log('INSIDEEEE SIGNUP POSTTTTTTTT');
    new User(req.body).save().then(function(user) {
      console.log('INSIDE SIGNUP POST, USER IS', user);
      res.redirect('/');
      res.setHeader('location', '/');
      res.end();
    });
  });

app.get('/signup', 
  function(req, res) {
    res.render('signup');
    res.end();
  });

app.get('/login', function(req, res) {
  res.render('login');
  res.end();
});

app.post('/login', function(req, res) {
  new User({username: req.body.username}).fetch().then(function(user) {
    console.log('USER ISSSSSSSSSSSS', user);
    if (!user) {
      res.setHeader('location', '/login');
      res.redirect('login');
    } else {
      if (bcrypt.compareSync(req.body.password, user.attributes.password)) {
        console.log('ENTERING HERE');
        req.session.user = user;
        res.setHeader('location', '/');
        res.redirect('/');
      } else {
        res.redirect('login');
      }
    }
    res.end();
  });

});

app.get('/logout', function(req, res) {
  req.session.destroy();
  res.redirect('/login');  
});
/************************************************************/
// Handle the wildcard route last - if all other routes fail
// assume the route is a short code and try and handle it here.
// If the short-code doesn't exist, send the user to '/'
/************************************************************/

app.get('/*', function(req, res) {
  new Link({ code: req.params[0] }).fetch().then(function(link) {
    if (!link) {
      res.redirect('/');
    } else {
      var click = new Click({
        linkId: link.get('id')
      });

      click.save().then(function() {
        link.set('visits', link.get('visits') + 1);
        link.save().then(function() {
          return res.redirect(link.get('url'));
        });
      });
    }
  });
});

console.log('Shortly is listening on 4568');
app.listen(4568);
