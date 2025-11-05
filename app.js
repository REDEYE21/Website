require('dotenv').config();
const express = require('express');
const session = require('express-session');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.urlencoded({ extended: false }));
app.use(express.json());
app.use(session({
  secret: 'change-this-secret',
  resave: false,
  saveUninitialized: false
}));
app.use(express.static('public'));

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const USER = process.env.GITHUB_USER;
const REPO = process.env.GITHUB_REPO;
const FILE_PATH = process.env.COUNTER_PATH;

// ------------------------
// Helper: Get counter from GitHub
// ------------------------
async function getCounter() {
  const url = `https://api.github.com/repos/${USER}/${REPO}/contents/${FILE_PATH}?ref=main`;
  const res = await fetch(url, {
    headers: { Authorization: `token ${GITHUB_TOKEN}` }
  });
  const data = await res.json();

  if (!res.ok) {
    console.error('GitHub API error:', data);
    throw new Error(data.message || 'GitHub API error');
  }

  const content = Buffer.from(data.content, 'base64').toString();
  const json = JSON.parse(content);
  return { counter: json.counter, sha: data.sha };
}

// ------------------------
// Helper: Update counter on GitHub (always fetches fresh sha)
// ------------------------
async function updateCounterOnGitHub(newValue) {
  // Get the latest SHA before updating
  const getUrl = `https://api.github.com/repos/${USER}/${REPO}/contents/${FILE_PATH}?ref=main`;
  const getRes = await fetch(getUrl, {
    headers: { Authorization: `token ${GITHUB_TOKEN}` }
  });
  const getData = await getRes.json();

  if (!getRes.ok) {
    console.error('GitHub GET error:', getData);
    throw new Error(getData.message || 'Failed to fetch latest SHA');
  }

  const sha = getData.sha;

  // Update the file with the new value
  const putUrl = `https://api.github.com/repos/${USER}/${REPO}/contents/${FILE_PATH}`;
  const body = {
    message: `Update counter to ${newValue}`,
    content: Buffer.from(JSON.stringify({ counter: newValue }, null, 2)).toString('base64'),
    sha,
    branch: 'main'
  };

  const putRes = await fetch(putUrl, {
    method: 'PUT',
    headers: {
      Authorization: `token ${GITHUB_TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });

  const putData = await putRes.json();
  if (!putRes.ok) {
    console.error('GitHub PUT error:', putData);
    throw new Error(putData.message || 'GitHub update failed');
  }

  return putData;
}

// ------------------------
// Auth routes
// ------------------------
app.post('/login', (req, res) => {
  const { password } = req.body;
  if (password === process.env.PASSWORD) {
    req.session.authenticated = true;
    return res.redirect('/dashboard.html');
  }
  res.status(401).send('Incorrect password');
});

app.post('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/'));
});

app.use('/dashboard.html', (req, res, next) => {
  if (req.session && req.session.authenticated) return next();
  res.redirect('/');
});

// ------------------------
// Counter routes (no login required)
// ------------------------
app.get('/counter', async (req, res) => {
  try {
    const data = await getCounter();
    res.json({ counter: data.counter });
  } catch (err) {
    console.error(err);
    res.status(500).send('Error fetching counter');
  }
});

app.post('/counter', async (req, res) => {
  try {
    const { action } = req.body;
    const data = await getCounter();
    let counter = data.counter;

    if (action === 'increment') counter++;
    else if (action === 'decrement' && counter > 0) counter--;

    await updateCounterOnGitHub(counter);
    res.json({ counter });
  } catch (err) {
    console.error(err);
    res.status(500).send('Error updating counter');
  }
});

// ------------------------
// Root route
// ------------------------
app.get('/', (req, res) => res.sendFile(__dirname + '/public/index.html'));

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
