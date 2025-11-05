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
  const url = `https://api.github.com/repos/${USER}/${REPO}/contents/${FILE_PATH}`;
  const res = await fetch(url, {
    headers: { Authorization: `token ${GITHUB_TOKEN}` }
  });
  const data = await res.json();
  const content = Buffer.from(data.content, 'base64').toString();
  const json = JSON.parse(content);
  return { counter: json.counter, sha: data.sha };
}

// ------------------------
// Helper: Update counter on GitHub
// ------------------------
async function updateCounterOnGitHub(newValue, sha) {
  const url = `https://api.github.com/repos/${USER}/${REPO}/contents/${FILE_PATH}`;
  const body = {
    message: `Update counter to ${newValue}`,
    content: Buffer.from(JSON.stringify({ counter: newValue }, null, 2)).toString('base64'),
    sha
  };
  const res = await fetch(url, {
    method: 'PUT',
    headers: {
      Authorization: `token ${GITHUB_TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });
  return res.json();
}

// ------------------------
// Counter routes (no auth)
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

    await updateCounterOnGitHub(counter, data.sha);
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
