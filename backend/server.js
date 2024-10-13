const express = require('express');
const cors = require('cors');
const multer = require('multer');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const app = express();
require('dotenv').config();

// Database setup
const db = new sqlite3.Database(path.join(__dirname, 'db', 'database.sqlite'), sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE, (err) => {
    if (err) {
      console.error(err.message);
    } else {
      console.log('Connected to the SQLite database.');
    }
  });

// CORS setup
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Multer setup for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads/'),
  filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname)
});
const upload = multer({ storage });

// Initialize DB tables if they don't exist
db.run(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    socialMediaHandle TEXT
  )
`);
db.run(`
  CREATE TABLE IF NOT EXISTS images (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    userId INTEGER,
    path TEXT,
    FOREIGN KEY (userId) REFERENCES users(id)
  )
`);

// Routes
app.post('/api/submit', upload.array('images', 10), (req, res) => {
  const { name, socialMediaHandle } = req.body;
  const images = req.files.map(file => file.path);

  const query = `INSERT INTO users (name, socialMediaHandle) VALUES (?, ?)`;
  db.run(query, [name, socialMediaHandle], function(err) {
    if (err) return res.status(500).send(err);
    const userId = this.lastID;

    images.forEach(image => {
      const imgQuery = `INSERT INTO images (userId, path) VALUES (?, ?)`;
      db.run(imgQuery, [userId, image]);
    });

    res.status(201).send('Submission successful');
  });
});

app.get('/api/submissions', (req, res) => {
  const query = `
    SELECT u.id, u.name, u.socialMediaHandle, i.path AS imagePath
    FROM users u
    JOIN images i ON u.id = i.userId
  `;
  db.all(query, [], (err, rows) => {
    if (err) return res.status(500).send(err);

    const users = rows.reduce((acc, row) => {
      let user = acc.find(u => u.id === row.id);
      if (!user) {
        user = { id: row.id, name: row.name, socialMediaHandle: row.socialMediaHandle, images: [] };
        acc.push(user);
      }
      user.images.push(row.imagePath);
      return acc;
    }, []);

    res.json(users);
  });
});

// Server listening
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
