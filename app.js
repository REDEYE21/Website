require('dotenv').config();
const express = require('express');
const path = require('path');
const fs = require('fs');
const session = require('express-session');


const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.urlencoded({ extended: false }));
app.use(express.json()); // <-- required for JSON POST
app.use(session({
  secret: process.env.SESSION_SECRET || 'change-this-secret',
  resave: false,
  saveUninitialized: false
}));

// Protect dashboard
app.use('/dashboard.html', (req, res, next) => {
  if (req.session && req.session.authenticated) return next();
  res.redirect('/');
});

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// Routes
app.get('/', (req, res) => {
  if (req.session && req.session.authenticated) return res.redirect('/dashboard.html');
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.post('/login', async (req, res) => {
  const { password, 'g-recaptcha-response': recaptchaResponse } = req.body;

  if (!recaptchaResponse) return res.status(400).send('Please complete the reCAPTCHA.');

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
  req.session.destroy(() => res.redirect('/'));
});

// Counter routes
app.get('/counter', (req, res) => {
  if (!req.session.authenticated) return res.status(401).send('Not authorized');
  res.json({ counter: process.env.COUNTER });
});

app.post('/counter', (req, res) => {
  if (!req.session.authenticated) return res.status(401).send('Not authorized');

  const { action } = req.body;
  let counter = parseInt(process.env.COUNTER || 0);

  if (action === 'increment') counter++;
  else if (action === 'decrement') counter--;

  process.env.COUNTER = counter.toString();

  // Save to .env
  const envPath = path.join(__dirname, '.env');
  const lines = fs.readFileSync(envPath, 'utf8').split('\n');
  const newLines = lines.map(line => line.startsWith('COUNTER=') ? `COUNTER=${counter}` : line);
  fs.writeFileSync(envPath, newLines.join('\n'));

  res.json({ counter });
});

// Start server
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
