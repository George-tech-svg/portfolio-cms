const express = require('express');
const cloudinary = require('cloudinary').v2;
const multer = require('multer');
const cors = require('cors');
const { Pool } = require('pg');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// ============================================
// JWT SECRET – set this in Render environment
// ============================================
const JWT_SECRET = process.env.JWT_SECRET || 'your_super_secret_key_change_this';

// ============================================
// CLOUDINARY CONFIG
// ============================================
cloudinary.config({
    cloud_name: process.env.CLOUD_NAME,
    api_key: process.env.API_KEY,
    api_secret: process.env.API_SECRET
});
console.log('✅ Cloudinary configured');

// ============================================
// DATABASE CONNECTION
// ============================================
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});
pool.connect((err) => {
    if (err) console.error('❌ DB connection failed:', err.stack);
    else console.log('✅ Connected to PostgreSQL');
});

// ============================================
// CORS – explicit allowed origins (FIXED)
// ============================================
const allowedOrigins = [
    'https://ochiengportfolio.netlify.app',
    'http://localhost:5500',
    'http://127.0.0.1:5500',
    'http://localhost:3000',
    'http://localhost:5000'
];

app.use(cors({
    origin: function (origin, callback) {
        // Allow requests with no origin (like mobile apps or curl)
        if (!origin) return callback(null, true);
        if (allowedOrigins.indexOf(origin) !== -1) {
            callback(null, true);
        } else {
            console.warn('❌ CORS blocked origin:', origin);
            callback(new Error('Not allowed by CORS'));
        }
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
    optionsSuccessStatus: 200
}));

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// ============================================
// MULTER
// ============================================
const storage = multer.memoryStorage();
const upload = multer({ storage, limits: { fileSize: 50 * 1024 * 1024 } });

// ============================================
// HELPER: query with error logging
// ============================================
const query = async (text, params) => {
    try {
        const res = await pool.query(text, params);
        return res;
    } catch (err) {
        console.error('❌ SQL Error:', err.message);
        console.error('   Query:', text);
        console.error('   Params:', params);
        throw err;
    }
};

// ============================================
// JWT AUTH MIDDLEWARE (Admin)
// ============================================
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) {
        return res.status(401).json({ error: 'Access denied. No token provided.' });
    }
    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ error: 'Invalid or expired token.' });
        }
        req.user = user;
        next();
    });
}

// ============================================
// JWT AUTH MIDDLEWARE (Visitor)
// ============================================
function authenticateVisitor(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) {
        return res.status(401).json({ error: 'Unauthorized.' });
    }
    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ error: 'Invalid token.' });
        }
        if (user.type !== 'visitor') {
            return res.status(403).json({ error: 'Invalid user type.' });
        }
        req.user = user;
        next();
    });
}

// ============================================
// PUBLIC ROUTES (no auth)
// ============================================

app.get('/', (req, res) => res.json({ message: 'Portfolio API running' }));
app.get('/api/test', (req, res) => res.json({ status: 'OK' }));
app.get('/api/db-test', async (req, res) => {
    try {
        const result = await query('SELECT NOW()');
        res.json({ success: true, time: result.rows[0].now });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// ============================================
// ADMIN AUTH ROUTES (public)
// ============================================

// Register – only allow if no admin users exist yet
app.post('/api/register', async (req, res) => {
    try {
        const { username, password } = req.body;
        if (!username || !password) {
            return res.status(400).json({ error: 'Username and password required.' });
        }
        const existingUsers = await query('SELECT id FROM users LIMIT 1');
        if (existingUsers.rows.length > 0) {
            return res.status(403).json({ error: 'Registration is closed. Only one admin account is allowed.' });
        }
        const existing = await query('SELECT id FROM users WHERE username = $1', [username]);
        if (existing.rows.length > 0) {
            return res.status(409).json({ error: 'Username already taken.' });
        }
        const saltRounds = 10;
        const hashedPassword = await bcrypt.hash(password, saltRounds);
        const result = await query(
            'INSERT INTO users (username, password_hash) VALUES ($1, $2) RETURNING id',
            [username, hashedPassword]
        );
        const token = jwt.sign(
            { id: result.rows[0].id, username },
            JWT_SECRET,
            { expiresIn: '7d' }
        );
        res.status(201).json({
            success: true,
            message: 'User registered successfully.',
            token,
            user: { id: result.rows[0].id, username }
        });
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ error: 'Registration failed.' });
    }
});

// Login (admin)
app.post('/api/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        if (!username || !password) {
            return res.status(400).json({ error: 'Username and password required.' });
        }
        const result = await query('SELECT id, username, password_hash FROM users WHERE username = $1', [username]);
        if (result.rows.length === 0) {
            return res.status(401).json({ error: 'Invalid username or password.' });
        }
        const user = result.rows[0];
        const valid = await bcrypt.compare(password, user.password_hash);
        if (!valid) {
            return res.status(401).json({ error: 'Invalid username or password.' });
        }
        const token = jwt.sign(
            { id: user.id, username: user.username },
            JWT_SECRET,
            { expiresIn: '7d' }
        );
        res.json({
            success: true,
            token,
            user: { id: user.id, username: user.username }
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Login failed.' });
    }
});

// ============================================
// VISITOR AUTH ROUTES (public)
// ============================================

// Visitor Registration
app.post('/api/visitor-register', async (req, res) => {
    try {
        const { username, password } = req.body;
        if (!username || !password) {
            return res.status(400).json({ error: 'Username and password required.' });
        }
        const existing = await query('SELECT id FROM visitors WHERE username = $1', [username]);
        if (existing.rows.length > 0) {
            return res.status(409).json({ error: 'Username already taken.' });
        }
        const hashed = await bcrypt.hash(password, 10);
        const result = await query(
            'INSERT INTO visitors (username, email, password_hash) VALUES ($1, $2, $3) RETURNING id',
            [username, username + '@temp.com', hashed]
        );
        const visitorId = result.rows[0].id;
        await query('INSERT INTO conversations (visitor_id) VALUES ($1)', [visitorId]);
        const token = jwt.sign(
            { id: visitorId, type: 'visitor' },
            JWT_SECRET,
            { expiresIn: '7d' }
        );
        res.json({ success: true, token, username });
    } catch (error) {
        console.error('Visitor register error:', error);
        res.status(500).json({ error: 'Registration failed.' });
    }
});

// Visitor Login
app.post('/api/visitor-login', async (req, res) => {
    try {
        const { username, password } = req.body;
        if (!username || !password) {
            return res.status(400).json({ error: 'Username and password required.' });
        }
        const result = await query('SELECT id, username, password_hash FROM visitors WHERE username = $1', [username]);
        if (result.rows.length === 0) {
            return res.status(401).json({ error: 'Invalid credentials.' });
        }
        const visitor = result.rows[0];
        const valid = await bcrypt.compare(password, visitor.password_hash);
        if (!valid) {
            return res.status(401).json({ error: 'Invalid credentials.' });
        }
        const token = jwt.sign(
            { id: visitor.id, type: 'visitor' },
            JWT_SECRET,
            { expiresIn: '7d' }
        );
        res.json({ success: true, token, username: visitor.username });
    } catch (error) {
        console.error('Visitor login error:', error);
        res.status(500).json({ error: 'Login failed.' });
    }
});

// ============================================
// PUBLIC PORTFOLIO DATA (no auth)
// ============================================

app.get('/api/data', async (req, res) => {
    try {
        const profileRes = await query('SELECT * FROM profile LIMIT 1');
        const profile = profileRes.rows[0] || {};
        const aboutRes = await query('SELECT content FROM about_paragraphs ORDER BY display_order');
        const paragraphs = aboutRes.rows.map(r => r.content);
        const skillsRes = await query('SELECT * FROM skills ORDER BY display_order');
        const skills = [];
        for (const skill of skillsRes.rows) {
            const itemsRes = await query('SELECT name FROM skill_items WHERE skill_id = $1 ORDER BY display_order', [skill.id]);
            skills.push({
                id: skill.id,
                category: skill.category,
                icon: skill.icon,
                items: itemsRes.rows.map(r => r.name)
            });
        }
        const groupsRes = await query('SELECT * FROM project_groups ORDER BY display_order');
        const projectGroups = [];
        for (const group of groupsRes.rows) {
            const projectsRes = await query('SELECT * FROM projects WHERE group_id = $1 ORDER BY display_order', [group.id]);
            const projects = [];
            for (const proj of projectsRes.rows) {
                const imagesRes = await query('SELECT url FROM project_images WHERE project_id = $1 ORDER BY id', [proj.id]);
                const videosRes = await query('SELECT url FROM project_videos WHERE project_id = $1 ORDER BY id', [proj.id]);
                const techRes = await query('SELECT name FROM project_technologies WHERE project_id = $1 ORDER BY id', [proj.id]);
                const filesRes = await query('SELECT name, data, size, type FROM project_files WHERE project_id = $1 ORDER BY id', [proj.id]);
                projects.push({
                    id: proj.id,
                    title: proj.title,
                    description: proj.description,
                    github: proj.github,
                    demo: proj.demo,
                    readme: proj.readme,
                    images: imagesRes.rows.map(r => r.url),
                    videos: videosRes.rows.map(r => r.url),
                    technologies: techRes.rows.map(r => r.name),
                    files: filesRes.rows
                });
            }
            projectGroups.push({
                id: group.id,
                name: group.name,
                icon: group.icon,
                description: group.description,
                projects
            });
        }
        const expRes = await query('SELECT * FROM experience ORDER BY display_order');
        const eduRes = await query('SELECT * FROM education ORDER BY display_order');
        const certRes = await query('SELECT * FROM certifications ORDER BY display_order');
        const socialRes = await query('SELECT platform, url FROM social_links ORDER BY display_order');
        const social = {};
        socialRes.rows.forEach(r => { social[r.platform] = r.url; });
        const vidRes = await query('SELECT url FROM welcome_video LIMIT 1');
        const welcomeVideo = vidRes.rows[0] ? vidRes.rows[0].url : '';

        const result = {
            personal: {
                name: profile.name || '',
                title: profile.title || '',
                badge: profile.badge || '',
                heroSubtitle: profile.hero_subtitle || '',
                welcomeMessage: profile.welcome_message || '',
                email: profile.email || '',
                profileImage: profile.profile_image || '',
                aboutImage: profile.about_image || '',
                resume: profile.resume || ''
            },
            about: { paragraphs },
            skills,
            projectGroups,
            experience: expRes.rows,
            education: eduRes.rows,
            certifications: certRes.rows,
            social,
            videos: { welcome: welcomeVideo },
            footer: profile.footer || ''
        };
        res.json(result);
    } catch (err) {
        console.error('❌ /api/data error:', err);
        res.status(500).json({ error: err.message });
    }
});

// POST messages (public – contact form)
app.post('/api/messages', async (req, res) => {
    try {
        const { name, email, subject, message } = req.body;
        const result = await query(
            'INSERT INTO messages (name, email, subject, message) VALUES ($1, $2, $3, $4) RETURNING id',
            [name, email, subject, message]
        );
        res.json({ success: true, id: result.rows[0].id });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Out Conversation – store contact message with channel
app.post('/api/contact-out', async (req, res) => {
    try {
        const { name, email, message, channel } = req.body;
        if (!name || !email || !message || !channel) {
            return res.status(400).json({ error: 'Missing fields.' });
        }
        await query(
            'INSERT INTO contact_out (name, email, message, channel) VALUES ($1, $2, $3, $4)',
            [name, email, message, channel]
        );
        res.json({ success: true });
    } catch (error) {
        console.error('Out contact error:', error);
        res.status(500).json({ error: 'Failed to send message.' });
    }
});

// ============================================
// CHAT ROUTES (Visitor)
// ============================================

// Get conversation and messages (visitor)
app.get('/api/chat', authenticateVisitor, async (req, res) => {
    try {
        const visitorId = req.user.id;
        let conv = await query('SELECT id FROM conversations WHERE visitor_id = $1', [visitorId]);
        if (conv.rows.length === 0) {
            await query('INSERT INTO conversations (visitor_id) VALUES ($1)', [visitorId]);
            conv = await query('SELECT id FROM conversations WHERE visitor_id = $1', [visitorId]);
        }
        const convId = conv.rows[0].id;
        const messages = await query(
            'SELECT sender_type, message, sent_at FROM chat_messages WHERE conversation_id = $1 ORDER BY sent_at ASC',
            [convId]
        );
        const user = await query('SELECT username FROM visitors WHERE id = $1', [visitorId]);
        res.json({
            success: true,
            conversationId: convId,
            messages: messages.rows,
            username: user.rows[0].username
        });
    } catch (error) {
        console.error('Chat load error:', error);
        res.status(500).json({ error: 'Failed to load chat.' });
    }
});

// Send message (visitor)
app.post('/api/chat/send', authenticateVisitor, async (req, res) => {
    try {
        const visitorId = req.user.id;
        const { message } = req.body;
        if (!message || message.trim() === '') {
            return res.status(400).json({ error: 'Message cannot be empty.' });
        }
        const conv = await query('SELECT id FROM conversations WHERE visitor_id = $1', [visitorId]);
        if (conv.rows.length === 0) {
            return res.status(404).json({ error: 'Conversation not found.' });
        }
        const convId = conv.rows[0].id;
        await query(
            'INSERT INTO chat_messages (conversation_id, sender_type, sender_id, message) VALUES ($1, $2, $3, $4)',
            [convId, 'visitor', visitorId, message.trim()]
        );
        await query('UPDATE conversations SET last_message_at = NOW() WHERE id = $1', [convId]);
        res.json({ success: true });
    } catch (error) {
        console.error('Send message error:', error);
        res.status(500).json({ error: 'Failed to send message.' });
    }
});

// Poll for new messages (visitor)
app.get('/api/chat/messages', authenticateVisitor, async (req, res) => {
    try {
        const visitorId = req.user.id;
        const since = req.query.since ? new Date(parseInt(req.query.since)) : new Date(0);
        const conv = await query('SELECT id FROM conversations WHERE visitor_id = $1', [visitorId]);
        if (conv.rows.length === 0) {
            return res.json({ success: true, messages: [] });
        }
        const convId = conv.rows[0].id;
        const messages = await query(
            'SELECT sender_type, message, sent_at FROM chat_messages WHERE conversation_id = $1 AND sent_at > $2 ORDER BY sent_at ASC',
            [convId, since]
        );
        res.json({ success: true, messages: messages.rows });
    } catch (error) {
        console.error('Poll error:', error);
        res.status(500).json({ error: 'Failed to fetch messages.' });
    }
});

// ============================================
// ADMIN CHAT ENDPOINTS (require admin JWT)
// ============================================

// Get all conversations with messages
app.get('/api/admin/chat/conversations', authenticateToken, async (req, res) => {
    try {
        const convs = await query(`
            SELECT c.id, c.visitor_id, c.last_message_at, v.username,
                   (SELECT json_agg(json_build_object('sender_type', sender_type, 'message', message, 'sent_at', sent_at) ORDER BY sent_at)
                    FROM chat_messages WHERE conversation_id = c.id) as messages
            FROM conversations c
            JOIN visitors v ON c.visitor_id = v.id
            ORDER BY c.last_message_at DESC
        `);
        res.json({ success: true, conversations: convs.rows });
    } catch (error) {
        console.error('Admin chat list error:', error);
        res.status(500).json({ error: 'Failed to load conversations.' });
    }
});

// Admin reply to a conversation
app.post('/api/admin/chat/reply', authenticateToken, async (req, res) => {
    try {
        const { conversationId, message } = req.body;
        if (!conversationId || !message) {
            return res.status(400).json({ error: 'Missing fields.' });
        }
        await query(
            'INSERT INTO chat_messages (conversation_id, sender_type, sender_id, message) VALUES ($1, $2, $3, $4)',
            [conversationId, 'admin', 1, message.trim()]
        );
        await query('UPDATE conversations SET last_message_at = NOW() WHERE id = $1', [conversationId]);
        res.json({ success: true });
    } catch (error) {
        console.error('Admin reply error:', error);
        res.status(500).json({ error: 'Failed to send reply.' });
    }
});

// ============================================
// ADMIN – OUT MESSAGES (contact_out)
// ============================================

app.get('/api/admin/out-messages', authenticateToken, async (req, res) => {
    try {
        const result = await query('SELECT * FROM contact_out ORDER BY sent_at DESC');
        res.json({ success: true, messages: result.rows });
    } catch (error) {
        console.error('Admin out messages error:', error);
        res.status(500).json({ error: 'Failed to fetch out messages.' });
    }
});

// Delete out message
app.delete('/api/admin/out-messages/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        await query('DELETE FROM contact_out WHERE id = $1', [id]);
        res.json({ success: true });
    } catch (error) {
        console.error('Delete out message error:', error);
        res.status(500).json({ error: 'Failed to delete message.' });
    }
});

// ============================================
// ADMIN CRUD ROUTES (all protected)
// ============================================

// Profile
app.put('/api/profile', authenticateToken, async (req, res) => {
    try {
        const { name, title, badge, heroSubtitle, welcomeMessage, email, profileImage, aboutImage, resume, footer } = req.body;
        const check = await query('SELECT id FROM profile LIMIT 1');
        if (check.rowCount === 0) {
            await query(`INSERT INTO profile (name, title, badge, hero_subtitle, welcome_message, email, profile_image, about_image, resume, footer)
                         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
                [name, title, badge, heroSubtitle, welcomeMessage, email, profileImage, aboutImage, resume, footer]);
        } else {
            await query(`UPDATE profile SET name=$1, title=$2, badge=$3, hero_subtitle=$4, welcome_message=$5, email=$6,
                         profile_image=$7, about_image=$8, resume=$9, footer=$10, updated_at=CURRENT_TIMESTAMP WHERE id=1`,
                [name, title, badge, heroSubtitle, welcomeMessage, email, profileImage, aboutImage, resume, footer]);
        }
        res.json({ success: true });
    } catch (err) {
        console.error('❌ /api/profile error:', err);
        res.status(500).json({ error: err.message });
    }
});

// About
app.put('/api/about', authenticateToken, async (req, res) => {
    try {
        const { paragraphs } = req.body;
        await query('DELETE FROM about_paragraphs');
        for (let i = 0; i < (paragraphs || []).length; i++) {
            await query('INSERT INTO about_paragraphs (content, display_order) VALUES ($1, $2)', [paragraphs[i], i + 1]);
        }
        res.json({ success: true });
    } catch (err) {
        console.error('❌ /api/about error:', err);
        res.status(500).json({ error: err.message });
    }
});

// Skills
app.put('/api/skills', authenticateToken, async (req, res) => {
    try {
        const { skills } = req.body;
        await query('DELETE FROM skill_items');
        await query('DELETE FROM skills');
        for (let i = 0; i < (skills || []).length; i++) {
            const skill = skills[i];
            const result = await query('INSERT INTO skills (category, icon, display_order) VALUES ($1,$2,$3) RETURNING id',
                [skill.category, skill.icon || 'fas fa-code', i + 1]);
            const skillId = result.rows[0].id;
            if (skill.items && skill.items.length) {
                for (let j = 0; j < skill.items.length; j++) {
                    await query('INSERT INTO skill_items (skill_id, name, display_order) VALUES ($1,$2,$3)',
                        [skillId, skill.items[j], j + 1]);
                }
            }
        }
        res.json({ success: true });
    } catch (err) {
        console.error('❌ /api/skills error:', err);
        res.status(500).json({ error: err.message });
    }
});

// Groups
app.post('/api/groups', authenticateToken, async (req, res) => {
    try {
        const { name, icon, description } = req.body;
        const result = await query('INSERT INTO project_groups (name, icon, description) VALUES ($1,$2,$3) RETURNING id',
            [name, icon || 'fas fa-folder', description]);
        res.json({ success: true, id: result.rows[0].id });
    } catch (err) { res.status(500).json({ error: err.message }); }
});
app.put('/api/groups/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const { name, icon, description } = req.body;
        await query('UPDATE project_groups SET name=$1, icon=$2, description=$3 WHERE id=$4',
            [name, icon, description, id]);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});
app.delete('/api/groups/:id', authenticateToken, async (req, res) => {
    try {
        await query('DELETE FROM project_groups WHERE id=$1', [req.params.id]);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// Projects
app.post('/api/groups/:groupId/projects', authenticateToken, async (req, res) => {
    try {
        const { groupId } = req.params;
        const { title, description, github, demo, readme, images, videos, technologies, files } = req.body;
        const result = await query(
            'INSERT INTO projects (group_id, title, description, github, demo, readme) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id',
            [groupId, title, description, github, demo, readme]
        );
        const projectId = result.rows[0].id;
        if (images) for (const url of images) await query('INSERT INTO project_images (project_id, url) VALUES ($1,$2)', [projectId, url]);
        if (videos) for (const url of videos) await query('INSERT INTO project_videos (project_id, url) VALUES ($1,$2)', [projectId, url]);
        if (technologies) for (const tech of technologies) await query('INSERT INTO project_technologies (project_id, name) VALUES ($1,$2)', [projectId, tech]);
        if (files) for (const file of files) await query('INSERT INTO project_files (project_id, name, data, size, type) VALUES ($1,$2,$3,$4,$5)',
            [projectId, file.name, file.data, file.size, file.type]);
        res.json({ success: true, id: projectId });
    } catch (err) { res.status(500).json({ error: err.message }); }
});
app.put('/api/projects/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const { title, description, github, demo, readme, images, videos, technologies, files } = req.body;
        await query('UPDATE projects SET title=$1, description=$2, github=$3, demo=$4, readme=$5 WHERE id=$6',
            [title, description, github, demo, readme, id]);
        await query('DELETE FROM project_images WHERE project_id=$1', [id]);
        if (images) for (const url of images) await query('INSERT INTO project_images (project_id, url) VALUES ($1,$2)', [id, url]);
        await query('DELETE FROM project_videos WHERE project_id=$1', [id]);
        if (videos) for (const url of videos) await query('INSERT INTO project_videos (project_id, url) VALUES ($1,$2)', [id, url]);
        await query('DELETE FROM project_technologies WHERE project_id=$1', [id]);
        if (technologies) for (const tech of technologies) await query('INSERT INTO project_technologies (project_id, name) VALUES ($1,$2)', [id, tech]);
        await query('DELETE FROM project_files WHERE project_id=$1', [id]);
        if (files) for (const file of files) await query('INSERT INTO project_files (project_id, name, data, size, type) VALUES ($1,$2,$3,$4,$5)',
            [id, file.name, file.data, file.size, file.type]);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});
app.delete('/api/projects/:id', authenticateToken, async (req, res) => {
    try {
        await query('DELETE FROM projects WHERE id=$1', [req.params.id]);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// Experience
app.post('/api/experience', authenticateToken, async (req, res) => {
    try {
        const { company, role, period, description } = req.body;
        const r = await query('INSERT INTO experience (company, role, period, description) VALUES ($1,$2,$3,$4) RETURNING id', [company, role, period, description]);
        res.json({ success: true, id: r.rows[0].id });
    } catch (err) { res.status(500).json({ error: err.message }); }
});
app.put('/api/experience/:id', authenticateToken, async (req, res) => {
    try {
        const { company, role, period, description } = req.body;
        await query('UPDATE experience SET company=$1, role=$2, period=$3, description=$4 WHERE id=$5', [company, role, period, description, req.params.id]);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});
app.delete('/api/experience/:id', authenticateToken, async (req, res) => {
    try {
        await query('DELETE FROM experience WHERE id=$1', [req.params.id]);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// Education
app.post('/api/education', authenticateToken, async (req, res) => {
    try {
        const { institution, degree, field, period, description } = req.body;
        const r = await query('INSERT INTO education (institution, degree, field, period, description) VALUES ($1,$2,$3,$4,$5) RETURNING id', [institution, degree, field, period, description]);
        res.json({ success: true, id: r.rows[0].id });
    } catch (err) { res.status(500).json({ error: err.message }); }
});
app.put('/api/education/:id', authenticateToken, async (req, res) => {
    try {
        const { institution, degree, field, period, description } = req.body;
        await query('UPDATE education SET institution=$1, degree=$2, field=$3, period=$4, description=$5 WHERE id=$6', [institution, degree, field, period, description, req.params.id]);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});
app.delete('/api/education/:id', authenticateToken, async (req, res) => {
    try {
        await query('DELETE FROM education WHERE id=$1', [req.params.id]);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// Certifications
app.post('/api/certifications', authenticateToken, async (req, res) => {
    try {
        const { name, issuer, date, description, link, file } = req.body;
        const r = await query('INSERT INTO certifications (name, issuer, date, description, link, file) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id', [name, issuer, date, description, link, file]);
        res.json({ success: true, id: r.rows[0].id });
    } catch (err) { res.status(500).json({ error: err.message }); }
});
app.put('/api/certifications/:id', authenticateToken, async (req, res) => {
    try {
        const { name, issuer, date, description, link, file } = req.body;
        await query('UPDATE certifications SET name=$1, issuer=$2, date=$3, description=$4, link=$5, file=$6 WHERE id=$7', [name, issuer, date, description, link, file, req.params.id]);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});
app.delete('/api/certifications/:id', authenticateToken, async (req, res) => {
    try {
        await query('DELETE FROM certifications WHERE id=$1', [req.params.id]);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// Social Links
app.post('/api/social', authenticateToken, async (req, res) => {
    try {
        const { platform, icon, url } = req.body;
        await query('INSERT INTO social_links (platform, icon, url) VALUES ($1,$2,$3) ON CONFLICT (platform) DO UPDATE SET url=$3, icon=$2', [platform, icon, url]);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});
app.delete('/api/social/:platform', authenticateToken, async (req, res) => {
    try {
        await query('DELETE FROM social_links WHERE platform=$1', [req.params.platform]);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// Welcome Video
app.put('/api/welcome-video', authenticateToken, async (req, res) => {
    try {
        const { url } = req.body;
        const check = await query('SELECT id FROM welcome_video LIMIT 1');
        if (check.rowCount === 0) await query('INSERT INTO welcome_video (url) VALUES ($1)', [url]);
        else await query('UPDATE welcome_video SET url=$1 WHERE id=1', [url]);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// Messages (admin)
app.get('/api/messages', authenticateToken, async (req, res) => {
    try {
        const r = await query('SELECT * FROM messages ORDER BY date DESC');
        res.json(r.rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
});
app.delete('/api/m
