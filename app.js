require('dotenv').config();
const express = require('express');
const path = require('path');
const fs = require('fs');
const session = require('express-session');

const app = express();
const PORT = process.env.PORT || 3000;

// --------------------
// Middleware
// --------------------
app.use(express.urlencoded({ extended: false }));
app.use(express.json()); // Needed for JSON requests (like POST /counter)

app.use(session({
  secret: process.env.SESSION_SECRET || 'change-this-secret',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: false, // set true only if using HTTPS + proxy trust
    maxAge: 24 * 60 * 60 * 1000 // 1 day
  }
}));

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// --------------------
// Counter logic
// --------------------
let counter = parseInt(process.env.COUNTER || 0);

app.get('/counter', (req, res) => {
  if (!req.session.authenticated) return res.status(401).send('Not authorized');
  res.json({ counter });
});

app.post('/counter', (req, res) => {
  if (!req.session.authenticated) return res.status(401).send('Not authorized');

  const { action } = req.body;

  if (action === 'increment') counter++;
  else if (action === 'decrement') counter--;

  process.env.COUNTER = counter.toString();

  // Safely update the .env file
  const envPath = path.join(__dirname, '.env');
  let envContent = fs.readFileSync(envPath, 'utf8');
  if (envContent.includes('COUNTER=')) {
    envContent = envContent.replace(/COUNTER=.*/, `COUNTER=${counter}`);
  } else {
    envContent += `\nCOUNTER=${counter}`;
  }
  fs.writeFileSync(envPath, envContent);

  res.json({ counter });
});

// --------------------
// Auth + dashboard
// --------------------
app.get('/', (req, res) => {
  if (req.session && req.session.authenticated)
    return res.redirect('/dashboard.html');
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.use('/dashboard.html', (req, res, next) => {
  if (req.session && req.session.authenticated) return next();
  res.redirect('/');
});

app.post('/login', async (req, res) => {
  const { password, 'g-recaptcha-response': recaptchaResponse } = req.body;

  if (!recaptchaResponse)
    return res.status(400).send('Please complete the reCAPTCHA.');

  // reCAPTCHA verification
  const verifyURL = `https://www.google.com/recaptcha/api/siteverify?secret=${process.env.RECAPTCHA_SECRET}&response=${recaptchaResponse}`;
  const response = await fetch(verifyURL, { method: 'POST' });
  const data = await response.json();

  if (!data.success)
    return res.status(400).send('Failed reCAPTCHA verification.');

  if (password === process.env.PASSWORD) {
    req.session.authenticated = true;
    return res.redirect('/dashboard.html');
  }

  res.status(401).send('Incorrect password.');
});

app.post('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/'));
});

// --------------------
// Start server
// --------------------
app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));
