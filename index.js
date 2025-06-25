require('dotenv').config(); // ✅ Load API key from .env
const nodemailer = require('nodemailer');

const express = require('express');
const cors = require('cors');
const mysql = require('mysql2');

const bodyParser = require('body-parser');

// ✅ Dynamic import for fetch
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));

const app = express();
const port = process.env.PORT || 5000;


// ✅ Middleware
app.use(cors({ origin: '*' }));
app.use(bodyParser.json());
app.use(express.json());

// ✅ MySQL connection (Railway)
const db = mysql.createConnection({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT
});


db.connect(err => {
  if (err) {
    console.error('❌ Error connecting to MySQL:', err);
  } else {
    console.log('✅ Connected to MySQL Database');
  }
});

// ✅ Test Route
app.get('/test', (req, res) => {
  res.send('✅ Server is working!');
});

// ✅ Send welcome email function
function sendWelcomeEmail(toEmail, userName) {
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: 'newgenhelpdesk7@gmail.com',
      pass: 'ajlq jbpw sorw gcsl'  // ✅ Use app password here, NOT your main Gmail password
    }
  });

  const mailOptions = {
    from: 'Newgen Helpdesk <newgenhelpdesk7@gmail.com>',
    to: toEmail,
    subject: '🎉 Welcome to Newgen!',
    html: `<h2>Hello ${userName},</h2>
           <p>Thank you for registering at <strong>Newgen</strong>. We’re excited to have you on board!</p>
           <p>Explore your career path with confidence. 🚀</p>
           <br><p>— The Newgen Team</p>`
  };

  transporter.sendMail(mailOptions, (error, info) => {
    if (error) {
      console.error('❌ Error sending email:', error);
    } else {
      console.log('✅ Welcome email sent:', info.response);
    }
  });
}

// ✅ Signup Route
app.post('/signup', (req, res) => {
  const { name, email, password } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ message: 'Missing required fields' });
  }

  db.query('SELECT * FROM users WHERE email = ?', [email], (err, results) => {
    if (err) return res.status(500).json({ message: 'Database error' });

    if (results.length > 0) {
      return res.status(409).json({ message: 'Email already registered' });
    }

    db.query('INSERT INTO users (name, email, password) VALUES (?, ?, ?)', [name, email, password], err => {
      if (err) return res.status(500).json({ message: 'Signup failed' });

      // ✅ Send welcome email after successful signup
      sendWelcomeEmail(email, name);

      res.status(201).json({ message: 'User registered successfully' });
    });
  });
});

// ✅ Login Route
app.post('/login', (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ message: 'Missing username or password' });
  }

  db.query('SELECT * FROM users WHERE name = ? AND password = ?', [username, password], (err, results) => {
    if (err) return res.status(500).json({ message: 'Login failed' });

    if (results.length > 0) {
      const user = results[0]; // Get user data
      res.json({
        message: 'Login successful',
        user: {
          id: user.id,
          name: user.name,
          email: user.email
        }
      });
    } else {
      res.status(401).json({ message: 'Invalid credentials' });
    }
  });
});
// AI route
app.post('/chat', async (req, res) => {
  const { message } = req.body;
  const apiKey = process.env.OPENAI_API_KEY;

  console.log("📩 Message from user:", message);
  console.log("🔑 API Key sent:", apiKey);

  try {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "openai/gpt-4o",
        messages: [
          { role: "system", content: "You are a helpful career advisor for students." },
          { role: "user", content: message }
        ],
        max_tokens: 500 // ✅ Limit token usage for free accounts
      })
    });

    const data = await response.json();
    console.log("🤖 Response from OpenRouter:", data);

    if (data.choices && data.choices[0]) {
      res.json({ reply: data.choices[0].message.content });
    } else {
      res.status(500).send("⚠️ No response from OpenRouter");
    }

  } catch (error) {
    console.error("❌ Error fetching from OpenRouter:", error);
    res.status(500).send("⚠️ AI request failed");
  }
});

// ✅ Profile Route
app.get('/profile/:id', (req, res) => {
  const userId = req.params.id;

  // Step 1: Fetch user info
  const userQuery = 'SELECT id, name, email FROM users WHERE id = ?';
  db.query(userQuery, [userId], (err, userResults) => {
    if (err || userResults.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    const user = userResults[0];

    // Step 2: Fetch test results
    const testQuery = 'SELECT category, score FROM test_results WHERE user_id = ?';
    db.query(testQuery, [userId], (err, testResults) => {
      if (err) {
        return res.status(500).json({ message: 'Error fetching test results' });
      }

      // Step 3: Fetch saved careers
      const careerQuery = 'SELECT career_name FROM saved_careers WHERE user_id = ?';
      db.query(careerQuery, [userId], (err, careerResults) => {
        if (err) {
          return res.status(500).json({ message: 'Error fetching saved careers' });
        }

        // Final Response
        res.json({
          user,
          tests: testResults,
          careers: careerResults
        });
      });
    });
  });
});
// save couses
app.post('/saveCourse', (req, res) => {
  const { userId, careerName } = req.body;

  if (!userId || !careerName) {
    return res.status(400).json({ success: false, message: "Missing fields" });
  }

  const checkQuery = 'SELECT * FROM saved_careers WHERE user_id = ? AND career_name = ?';
  const insertQuery = 'INSERT INTO saved_careers (user_id, career_name) VALUES (?, ?)';

  db.query(checkQuery, [userId, careerName], (err, results) => {
    if (err) return res.status(500).json({ success: false, message: "DB error", error: err });

    if (results.length > 0) {
      return res.status(200).json({ success: false, message: "Already saved" });
    }

    db.query(insertQuery, [userId, careerName], (err, result) => {
      if (err) return res.status(500).json({ success: false, message: "Insert failed", error: err });

      return res.status(201).json({ success: true, message: "Course saved" });
    });
  });
});

// 🔍 Get all saved career names (for debugging mismatches)
app.get('/allSavedCareers', (req, res) => {
  const query = 'SELECT DISTINCT career_name FROM saved_careers';

  db.query(query, (err, results) => {
    if (err) return res.status(500).json({ error: "DB error", err });

    const names = results.map(row => row.career_name);
    res.json({ careers: names });
  });
});



// ✅ Start the server
app.listen(port, () => {
console.log(`✅ Server is live on port ${port}`);
});
