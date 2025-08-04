const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const puppeteer = require('puppeteer');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

// Middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net", "https://cdnjs.cloudflare.com"],
      scriptSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net", "https://cdnjs.cloudflare.com"],
      fontSrc: ["'self'", "https://cdn.jsdelivr.net", "https://cdnjs.cloudflare.com", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https:", "http:"],
      connectSrc: ["'self'"],
      frameSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      formAction: ["'self'", "http:", "https:"]
    }
  },
  crossOriginEmbedderPolicy: false,
  crossOriginOpenerPolicy: false,
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});
app.use(limiter);

// Database setup
const db = new sqlite3.Database('youtube_system.db');

// Initialize database
db.serialize(() => {
  // Create users table
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // Create videos table
  db.run(`CREATE TABLE IF NOT EXISTS videos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    youtube_url TEXT NOT NULL,
    title TEXT,
    duration TEXT,
    status TEXT DEFAULT 'playing',
    created_by INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_played DATETIME,
    play_count INTEGER DEFAULT 0,
    FOREIGN KEY (created_by) REFERENCES users (id)
  )`);

  // Add play_count column if it doesn't exist
  db.run(`ALTER TABLE videos ADD COLUMN play_count INTEGER DEFAULT 0`, (err) => {
    if (err && !err.message.includes('duplicate column name')) {
      console.error('שגיאה בהוספת עמודת play_count:', err);
    }
  });

  // Add title column if it doesn't exist
  db.run(`ALTER TABLE videos ADD COLUMN title TEXT`, (err) => {
    if (err && !err.message.includes('duplicate column name')) {
      console.error('שגיאה בהוספת עמודת title:', err);
    }
  });

  // Create default admin user
  db.run(`INSERT OR IGNORE INTO users (username, password) VALUES (?, ?)`, 
    ['admin', bcrypt.hashSync('admin123', 10)], (err) => {
    if (err) {
      console.error('שגיאה ביצירת משתמש ברירת מחדל:', err);
    } else {
      console.log('משתמש ברירת מחדל: admin / admin123');
      console.log('מערכת נגן וירטואלי מוכנה! 🎬');
    }
  }); 
});

// Authentication middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'נדרש טוקן אימות' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'טוקן לא תקין' });
    }
    req.user = user;
    next();
  });
};

// Browser instances storage
const browserInstances = new Map();

// Routes
app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'נדרש שם משתמש וסיסמה' });
  }

  db.get('SELECT * FROM users WHERE username = ?', [username], async (err, user) => {
    if (err) {
      return res.status(500).json({ error: 'שגיאה בשרת' });
    }

    if (!user) {
      return res.status(401).json({ error: 'שם משתמש או סיסמה שגויים' });
    }

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(401).json({ error: 'שם משתמש או סיסמה שגויים' });
    }

    const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '24h' });
    res.json({ token, user: { id: user.id, username: user.username } });
  });
});

app.post('/api/register', async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'נדרש שם משתמש וסיסמה' });
  }

  if (password.length < 6) {
    return res.status(400).json({ error: 'הסיסמה חייבת להיות לפחות 6 תווים' });
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  db.run('INSERT INTO users (username, password) VALUES (?, ?)', 
    [username, hashedPassword], function(err) {
    if (err) {
      if (err.message.includes('UNIQUE constraint failed')) {
        return res.status(400).json({ error: 'שם המשתמש כבר קיים' });
      }
      return res.status(500).json({ error: 'שגיאה בשרת' });
    }
    res.json({ message: 'משתמש נוצר בהצלחה' });
  });
});

app.post('/api/videos', authenticateToken, async (req, res) => {
  const { youtube_url } = req.body;
  const userId = req.user.id;

  if (!youtube_url) {
    return res.status(400).json({ error: 'נדרש קישור YouTube' });
  }

  // Extract video ID from YouTube URL
  const videoIdMatch = youtube_url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\n?#]+)/);
  if (!videoIdMatch) {
    return res.status(400).json({ error: 'קישור YouTube לא תקין' });
  }

  const videoId = videoIdMatch[1];
  const fullUrl = `https://www.youtube.com/watch?v=${videoId}`;

  try {
    // Extract video title first
    console.log('מחלץ כותרת סרטון...');
    const videoTitle = await extractVideoTitle(fullUrl);
    console.log(`כותרת הסרטון: ${videoTitle}`);

    // Insert video to database with title
    db.run('INSERT INTO videos (youtube_url, title, created_by) VALUES (?, ?, ?)', 
      [fullUrl, videoTitle, userId], function(err) {
      if (err) {
        return res.status(500).json({ error: 'שגיאה בשמירת הסרטון' });
      }

      const videoId = this.lastID;
      
      // Start virtual browser instance
      startVirtualPlayer(videoId, fullUrl);

      res.json({ 
        message: 'סרטון נוסף בהצלחה', 
        videoId: videoId,
        url: fullUrl,
        title: videoTitle
      });
    });
  } catch (error) {
    console.error('שגיאה בהוספת סרטון:', error);
    res.status(500).json({ error: 'שגיאה בשרת' });
  }
});

app.get('/api/videos', authenticateToken, (req, res) => {
  db.all(`
    SELECT v.*, u.username as created_by_username 
    FROM videos v 
    JOIN users u ON v.created_by = u.id 
    ORDER BY v.created_at DESC
  `, (err, videos) => {
    if (err) {
      return res.status(500).json({ error: 'שגיאה בקבלת הסרטונים' });
    }
    res.json(videos);
  });
});

app.get('/api/videos/:id', authenticateToken, (req, res) => {
  const videoId = req.params.id;
  
  db.get(`
    SELECT v.*, u.username as created_by_username 
    FROM videos v 
    JOIN users u ON v.created_by = u.id 
    WHERE v.id = ?
  `, [videoId], (err, video) => {
    if (err) {
      return res.status(500).json({ error: 'שגיאה בקבלת הסרטון' });
    }
    if (!video) {
      return res.status(404).json({ error: 'סרטון לא נמצא' });
    }
    res.json(video);
  });
});

app.delete('/api/videos/:id', authenticateToken, (req, res) => {
  const videoId = req.params.id;
  
  // Stop virtual player if running
  if (browserInstances.has(videoId)) {
    stopVirtualPlayer(videoId);
  }

  db.run('DELETE FROM videos WHERE id = ?', [videoId], function(err) {
    if (err) {
      return res.status(500).json({ error: 'שגיאה במחיקת הסרטון' });
    }
    if (this.changes === 0) {
      return res.status(404).json({ error: 'סרטון לא נמצא' });
    }
    res.json({ message: 'סרטון נמחק בהצלחה' });
  });
});

// Get system status
app.get('/api/status', authenticateToken, (req, res) => {
  const status = {
    activeVideos: browserInstances.size,
    totalVideos: 0,
    totalPlays: 0,
    systemStatus: 'running'
  };
  
  db.get('SELECT COUNT(*) as count, SUM(play_count) as total_plays FROM videos', (err, result) => {
    if (!err && result) {
      status.totalVideos = result.count || 0;
      status.totalPlays = result.total_plays || 0;
    }
    res.json(status);
  });
});

// Get video statistics
app.get('/api/statistics', authenticateToken, (req, res) => {
  db.all(`
    SELECT 
      v.id,
      v.youtube_url,
      v.title,
      v.play_count,
      v.created_at,
      v.last_played,
      u.username as created_by_username
    FROM videos v 
    JOIN users u ON v.created_by = u.id 
    ORDER BY v.play_count DESC, v.created_at DESC
  `, (err, videos) => {
    if (err) {
      return res.status(500).json({ error: 'שגיאה בקבלת סטטיסטיקות' });
    }
    res.json(videos);
  });
});

// Update video titles for existing videos
app.post('/api/update-titles', authenticateToken, async (req, res) => {
  try {
    db.all('SELECT id, youtube_url FROM videos WHERE title IS NULL OR title = ""', async (err, videos) => {
      if (err) {
        return res.status(500).json({ error: 'שגיאה בקבלת סרטונים' });
      }

      let updatedCount = 0;
      for (const video of videos) {
        try {
          const title = await extractVideoTitle(video.youtube_url);
          db.run('UPDATE videos SET title = ? WHERE id = ?', [title, video.id]);
          updatedCount++;
          console.log(`עודכן כותרת לסרטון ${video.id}: ${title}`);
        } catch (error) {
          console.error(`שגיאה בעדכון כותרת לסרטון ${video.id}:`, error);
        }
      }

      res.json({ 
        message: `עודכנו ${updatedCount} כותרות סרטונים`,
        updatedCount 
      });
    });
  } catch (error) {
    res.status(500).json({ error: 'שגיאה בעדכון כותרות' });
  }
});

// Function to extract video title from YouTube
async function extractVideoTitle(youtubeUrl) {
  try {
    const browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu'
      ]
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 720 });
    
    // Navigate to YouTube
    await page.goto(youtubeUrl, { waitUntil: 'networkidle2' });
    
    // Accept cookies if dialog appears
    try {
      await page.waitForSelector('button[aria-label="Accept all"]', { timeout: 5000 });
      await page.click('button[aria-label="Accept all"]');
    } catch (e) {
      // Cookie dialog might not appear
    }

    // Extract video title
    const title = await page.evaluate(() => {
      const titleElement = document.querySelector('h1.ytd-video-primary-info-renderer') || 
                          document.querySelector('h1.title') ||
                          document.querySelector('meta[property="og:title"]');
      
      if (titleElement) {
        return titleElement.textContent || titleElement.getAttribute('content') || '';
      }
      return '';
    });

    await browser.close();
    return title.trim() || 'סרטון ללא כותרת';
  } catch (error) {
    console.error('שגיאה בחילוץ כותרת הסרטון:', error);
    return 'סרטון ללא כותרת';
  }
}

// Virtual player functions
async function startVirtualPlayer(videoId, youtubeUrl) {
  // Check if already running
  if (browserInstances.has(videoId)) {
    console.log(`נגן וירטואלי כבר פועל עבור סרטון ${videoId}`);
    return;
  }
  try {
    console.log(`מתחיל נגן וירטואלי עבור סרטון ${videoId}`);
    
    const browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu'
      ]
    });

    const page = await browser.newPage();
    
    // Set viewport
    await page.setViewport({ width: 1280, height: 720 });
    
    // Navigate to YouTube
    await page.goto(youtubeUrl, { waitUntil: 'networkidle2' });
    
    // Accept cookies if dialog appears
    try {
      await page.waitForSelector('button[aria-label="Accept all"]', { timeout: 5000 });
      await page.click('button[aria-label="Accept all"]');
    } catch (e) {
      // Cookie dialog might not appear
    }

    // Click play button if needed
    try {
      await page.waitForSelector('.ytp-play-button', { timeout: 10000 });
      await page.click('.ytp-play-button');
    } catch (e) {
      console.log('לא ניתן למצוא כפתור נגינה');
    }

    // Store browser instance
    browserInstances.set(videoId, { browser, page });

    // Monitor video completion
    monitorVideoCompletion(videoId, page);

    // Update database status
    db.run('UPDATE videos SET status = ? WHERE id = ?', ['playing', videoId]);
    
    console.log(`נגן וירטואלי התחיל עבור סרטון ${videoId}`);
  } catch (error) {
    console.error(`שגיאה בהתחלת נגן וירטואלי עבור סרטון ${videoId}:`, error);
  }
}

async function stopVirtualPlayer(videoId) {
  const instance = browserInstances.get(videoId);
  if (instance) {
    try {
      await instance.browser.close();
      browserInstances.delete(videoId);
      console.log(`נגן וירטואלי נעצר עבור סרטון ${videoId}`);
    } catch (error) {
      console.error(`שגיאה בעצירת נגן וירטואלי עבור סרטון ${videoId}:`, error);
    }
  }
}

async function monitorVideoCompletion(videoId, page) {
  try {
    console.log(`[${new Date().toLocaleString()}] מתחיל לעקוב אחר סרטון ${videoId}...`);
    
    // Wait for video to actually start playing first
    await page.waitForTimeout(5000); // Wait 5 seconds for video to start
    
    // Wait for video to end (check for replay button or end of video)
    await page.waitForFunction(() => {
      // Check for replay button
      const replayButton = document.querySelector('.ytp-play-button[aria-label="Replay"]');
      if (replayButton) {
        console.log('נמצא כפתור replay');
        return true;
      }
      
      // Check if video ended (progress bar at end)
      const progressBar = document.querySelector('.ytp-play-progress');
      if (progressBar) {
        const progress = progressBar.style.width;
        const progressPercent = parseFloat(progress) || 0;
        if (progressPercent >= 98) { // Changed from 95% to 98% to be more accurate
          console.log(`הסרטון הגיע ל-${progressPercent}% - נחשב כהסתיים`);
          return true;
        }
      }
      
      // Check for "Video ended" message
      const videoEnded = document.querySelector('.ytp-endscreen-content');
      if (videoEnded) {
        console.log('נמצא מסך סיום הסרטון');
        return true;
      }
      
      // Check if video is actually playing (not paused)
      const playButton = document.querySelector('.ytp-play-button[aria-label="Play"]');
      if (playButton) {
        // Video is paused, wait for it to start playing
        return false;
      }
      
      return false;
    }, { timeout: 0 }); // No timeout - wait indefinitely

    console.log(`[${new Date().toLocaleString()}] סרטון ${videoId} הסתיים, מרענן דף...`);
    
    // Update last played time and increment play count
    db.run('UPDATE videos SET last_played = CURRENT_TIMESTAMP, play_count = play_count + 1 WHERE id = ?', [videoId], function(err) {
      if (err) {
        console.error(`[${new Date().toLocaleString()}] שגיאה בעדכון ספירת נגינה עבור סרטון ${videoId}:`, err);
      } else {
        console.log(`[${new Date().toLocaleString()}] סרטון ${videoId} נוגן שוב - ספירה עודכנה (${this.changes} שורות עודכנו)`);
        
        // Get current play count for verification
        db.get('SELECT play_count FROM videos WHERE id = ?', [videoId], (err, result) => {
          if (!err && result) {
            console.log(`[${new Date().toLocaleString()}] ספירת נגינה נוכחית לסרטון ${videoId}: ${result.play_count}`);
          }
        });
      }
    });
    
    // Wait a moment before refreshing
    await page.waitForTimeout(2000);
    
    // Refresh page to restart video
    console.log(`[${new Date().toLocaleString()}] מרענן דף עבור סרטון ${videoId}...`);
    await page.reload({ waitUntil: 'networkidle2' });
    
    // Accept cookies again if needed
    try {
      await page.waitForSelector('button[aria-label="Accept all"]', { timeout: 5000 });
      await page.click('button[aria-label="Accept all"]');
      console.log(`[${new Date().toLocaleString()}] קיבל עוגיות עבור סרטון ${videoId}`);
    } catch (e) {
      // Cookie dialog might not appear
    }
    
    // Click play button again
    try {
      await page.waitForSelector('.ytp-play-button', { timeout: 10000 });
      await page.click('.ytp-play-button');
      console.log(`[${new Date().toLocaleString()}] סרטון ${videoId} התחיל מחדש`);
    } catch (e) {
      console.log(`[${new Date().toLocaleString()}] לא ניתן למצוא כפתור נגינה לאחר רענון, מנסה שוב...`);
      // Try alternative play button selectors
      try {
        await page.waitForSelector('button[aria-label="Play"]', { timeout: 5000 });
        await page.click('button[aria-label="Play"]');
        console.log(`[${new Date().toLocaleString()}] סרטון ${videoId} התחיל מחדש (כפתור חלופי)`);
      } catch (e2) {
        console.log(`[${new Date().toLocaleString()}] לא ניתן למצוא כפתור נגינה חלופי`);
      }
    }
    
    // Continue monitoring
    monitorVideoCompletion(videoId, page);
  } catch (error) {
    console.error(`[${new Date().toLocaleString()}] שגיאה בניטור סרטון ${videoId}:`, error);
    // Try to restart monitoring after error
    setTimeout(() => {
      monitorVideoCompletion(videoId, page);
    }, 5000);
  }
}

// Initialize virtual players for existing videos on startup
db.all('SELECT id, youtube_url FROM videos WHERE status = "playing"', (err, videos) => {
  if (err) {
    console.error('שגיאה בטעינת סרטונים קיימים:', err);
    return;
  }
  
  console.log(`טוען ${videos.length} סרטונים קיימים...`);
  videos.forEach(video => {
    startVirtualPlayer(video.id, video.youtube_url);
  });
});

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('סוגר נגנים וירטואליים...');
  for (const [videoId, instance] of browserInstances) {
    await stopVirtualPlayer(videoId);
  }
  db.close();
  process.exit(0);
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`השרת פועל על פורט ${PORT}`);
  console.log(`נגיש בכתובות:`);
  console.log(`  - http://localhost:${PORT}`);
  console.log(`  - http://127.0.0.1:${PORT}`);
  console.log(`  - http://192.168.1.2:${PORT}`);
  console.log('משתמש ברירת מחדל: admin / admin123');
  console.log('מערכת נגן וירטואלי מוכנה! 🎬');
}); 