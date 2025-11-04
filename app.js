require('dotenv').config();
const express = require('express');
const path = require('path');
const bodyParser = require('body-parser');
const session = require('express-session');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(bodyParser.urlencoded({ extended: false }));
app.use(express.static(path.join(__dirname, 'public')));
app.use(session({
  secret: process.env.SESSION_SECRET || 'change-this-secret',
  resave: false,
  saveUninitialized: false
}));

app.get('/', (req, res) => {
  if (req.session && req.session.authenticated) return res.redirect('/dashboard.html');
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.post('/login', async (req, res) => {
  const { password, 'g-recaptcha-response': recaptchaResponse } = req.body;

  if (!recaptchaResponse) return res.status(400).send('Please complete the reCAPTCHA.');

  // Verify reCAPTCHA with Google
  const verifyURL = `https://www.google.com/recaptcha/api/siteverify?secret=${process.env.RECAPTCHA_SECRET}&response=${recaptchaResponse}`;
  const response = await fetch(verifyURL, { method: 'POST' });
  const data = await response.json();

  if (!data.success) return res.status(400).send('Failed reCAPTCHA verification.');

  if (password === process.env.PASSWORD) {
    req.session.authenticated = true;
    return res.redirect('/dashboard.html');
  }

  res.status(401).send('Incorrect password.');
});

app.post('/logout', (req, res) => {
  req.session.destroy(() => {
    res.redirect('/');
  });
});

app.use('/dashboard.html', (req, res, next) => {
  if (req.session && req.session.authenticated) return next();
  res.redirect('/');
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
