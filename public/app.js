// Global variables
let currentUser = null;
let authToken = null;

// Check if user is already logged in
document.addEventListener('DOMContentLoaded', function() {
    const savedToken = localStorage.getItem('authToken');
    const savedUser = localStorage.getItem('currentUser');
    
    if (savedToken && savedUser) {
        authToken = savedToken;
        currentUser = JSON.parse(savedUser);
        showDashboard();
        loadVideos();
    } else {
        showLogin();
    }
});

// Authentication functions
async function login(username, password) {
    try {
        const response = await fetch('/api/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ username, password })
        });

        const data = await response.json();

        if (response.ok) {
            authToken = data.token;
            currentUser = data.user;
            
            // Save to localStorage
            localStorage.setItem('authToken', authToken);
            localStorage.setItem('currentUser', JSON.stringify(currentUser));
            
            showDashboard();
            loadVideos();
            return { success: true };
        } else {
            return { success: false, error: data.error };
        }
    } catch (error) {
        return { success: false, error: 'שגיאה בחיבור לשרת' };
    }
}

async function register(username, password) {
    try {
        const response = await fetch('/api/register', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ username, password })
        });

        const data = await response.json();

        if (response.ok) {
            return { success: true, message: data.message };
        } else {
            return { success: false, error: data.error };
        }
    } catch (error) {
        return { success: false, error: 'שגיאה בחיבור לשרת' };
    }
}

function logout() {
    authToken = null;
    currentUser = null;
    localStorage.removeItem('authToken');
    localStorage.removeItem('currentUser');
    showLogin();
}

// UI functions
function showLogin() {
    document.getElementById('loginSection').style.display = 'block';
    document.getElementById('registerSection').style.display = 'none';
    document.getElementById('dashboardSection').style.display = 'none';
}

function showRegister() {
    document.getElementById('loginSection').style.display = 'none';
    document.getElementById('registerSection').style.display = 'block';
    document.getElementById('dashboardSection').style.display = 'none';
}

function showDashboard() {
    document.getElementById('loginSection').style.display = 'none';
    document.getElementById('registerSection').style.display = 'none';
    document.getElementById('dashboardSection').style.display = 'block';
    
    if (currentUser) {
        document.getElementById('userDisplay').textContent = currentUser.username;
    }
}

function showLoading(button, isLoading) {
    const loadingSpan = button.querySelector('.loading');
    const normalSpan = button.querySelector('.normal');
    
    if (isLoading) {
        loadingSpan.style.display = 'inline';
        normalSpan.style.display = 'none';
        button.disabled = true;
    } else {
        loadingSpan.style.display = 'none';
        normalSpan.style.display = 'inline';
        button.disabled = false;
    }
}

function showAlert(elementId, message, type = 'danger') {
    const alertElement = document.getElementById(elementId);
    alertElement.textContent = message;
    alertElement.className = `alert alert-${type}`;
    alertElement.style.display = 'block';
    
    setTimeout(() => {
        alertElement.style.display = 'none';
    }, 5000);
}

// Video management functions
async function loadVideos() {
    try {
        const response = await fetch('/api/videos', {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });

        if (response.ok) {
            const videos = await response.json();
            displayVideos(videos);
        } else {
            console.error('שגיאה בטעינת סרטונים');
        }
    } catch (error) {
        console.error('שגיאה בטעינת סרטונים:', error);
    }
}

function displayVideos(videos) {
    const videosList = document.getElementById('videosList');
    
    if (videos.length === 0) {
        videosList.innerHTML = `
            <div class="col-12 text-center">
                <div class="alert alert-info">
                    <i class="fas fa-info-circle me-2"></i>
                    אין סרטונים פעילים כרגע. הוסף סרטון חדש כדי להתחיל.
                </div>
            </div>
        `;
        return;
    }

    videosList.innerHTML = videos.map(video => `
        <div class="col-md-6 col-lg-4 mb-3">
            <div class="card video-card h-100">
                <div class="card-body">
                                         <div class="d-flex justify-content-between align-items-start mb-2">
                         <h6 class="card-title mb-0">
                             <i class="fab fa-youtube me-2"></i>
                             ${video.title || `סרטון ${video.id}`}
                         </h6>
                         <span class="status-playing">
                             <i class="fas fa-play me-1"></i>
                             מתנגן
                         </span>
                     </div>
                    
                    <p class="card-text small mb-2">
                        <strong>נוצר על ידי:</strong> ${video.created_by_username}
                    </p>
                    
                                         <p class="card-text small mb-2">
                         <strong>נוצר ב:</strong> ${formatDate(video.created_at)}
                     </p>
                     
                     <p class="card-text small mb-2">
                         <strong>מספר נגינות:</strong> 
                         <span class="badge bg-success">${video.play_count || 0}</span>
                     </p>
                     
                     ${video.last_played ? `
                         <p class="card-text small mb-3">
                             <strong>נגן לאחרונה:</strong> ${formatDate(video.last_played)}
                         </p>
                     ` : ''}
                    
                    <div class="d-flex justify-content-between">
                        <a href="${video.youtube_url}" target="_blank" class="btn btn-light btn-sm">
                            <i class="fas fa-external-link-alt me-1"></i>
                            צפה ב-YouTube
                        </a>
                        <button onclick="deleteVideo(${video.id})" class="btn btn-danger btn-sm">
                            <i class="fas fa-trash me-1"></i>
                            מחק
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `).join('');
}

async function addVideo(youtubeUrl) {
    try {
        const response = await fetch('/api/videos', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({ youtube_url: youtubeUrl })
        });

        const data = await response.json();

        if (response.ok) {
            showAlert('addVideoAlert', 'סרטון נוסף בהצלחה!', 'success');
            document.getElementById('youtubeUrl').value = '';
            loadVideos();
            return { success: true };
        } else {
            return { success: false, error: data.error };
        }
    } catch (error) {
        return { success: false, error: 'שגיאה בחיבור לשרת' };
    }
}

async function deleteVideo(videoId) {
    if (!confirm('האם אתה בטוח שברצונך למחוק סרטון זה?')) {
        return;
    }

    try {
        const response = await fetch(`/api/videos/${videoId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });

        if (response.ok) {
            showAlert('deleteVideoAlert', 'סרטון נמחק בהצלחה!', 'success');
            loadVideos();
        } else {
            const data = await response.json();
            showAlert('deleteVideoAlert', data.error, 'danger');
        }
    } catch (error) {
        showAlert('deleteVideoAlert', 'שגיאה במחיקת הסרטון', 'danger');
    }
}

function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleString('he-IL', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    });
}

// Event listeners
document.getElementById('loginForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const button = this.querySelector('button[type="submit"]');
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    
    showLoading(button, true);
    
    const result = await login(username, password);
    
    if (result.success) {
        showAlert('loginAlert', 'התחברת בהצלחה!', 'success');
    } else {
        showAlert('loginAlert', result.error, 'danger');
    }
    
    showLoading(button, false);
});

document.getElementById('registerForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const button = this.querySelector('button[type="submit"]');
    const username = document.getElementById('regUsername').value;
    const password = document.getElementById('regPassword').value;
    
    showLoading(button, true);
    
    const result = await register(username, password);
    
    if (result.success) {
        showAlert('registerAlert', result.message, 'success');
        setTimeout(() => {
            showLogin();
        }, 2000);
    } else {
        showAlert('registerAlert', result.error, 'danger');
    }
    
    showLoading(button, false);
});

document.getElementById('addVideoForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const button = this.querySelector('button[type="submit"]');
    const youtubeUrl = document.getElementById('youtubeUrl').value;
    
    showLoading(button, true);
    
    const result = await addVideo(youtubeUrl);
    
    if (result.success) {
        showAlert('addVideoAlert', 'סרטון נוסף בהצלחה!', 'success');
    } else {
        showAlert('addVideoAlert', result.error, 'danger');
    }
    
    showLoading(button, false);
});

// Load system status
async function loadSystemStatus() {
  try {
    const response = await fetch('/api/status', {
      headers: {
        'Authorization': `Bearer ${authToken}`
      }
    });

    if (response.ok) {
      const status = await response.json();
      const statusElement = document.getElementById('systemStatus');
             statusElement.innerHTML = `
         <span class="text-success">✓ פועל</span> | 
         סרטונים פעילים: ${status.activeVideos} | 
         סה"כ סרטונים: ${status.totalVideos} | 
         סה"כ נגינות: ${status.totalPlays}
       `;
    }
  } catch (error) {
    console.error('שגיאה בטעינת סטטוס מערכת:', error);
  }
}

// Auto-refresh videos list and status every 30 seconds
setInterval(() => {
  if (currentUser && authToken) {
    loadVideos();
    loadSystemStatus();
  }
}, 30000);

// Also refresh when page becomes visible (user returns to tab)
document.addEventListener('visibilitychange', () => {
  if (!document.hidden && currentUser && authToken) {
    loadVideos();
    loadSystemStatus();
  }
});

// Load status on dashboard show
function showDashboard() {
  document.getElementById('loginSection').style.display = 'none';
  document.getElementById('registerSection').style.display = 'none';
  document.getElementById('dashboardSection').style.display = 'block';
  
  if (currentUser) {
    document.getElementById('userDisplay').textContent = currentUser.username;
    loadSystemStatus(); // Load status when dashboard is shown
  }
}

// Show statistics
async function showStatistics() {
  try {
    const response = await fetch('/api/statistics', {
      headers: {
        'Authorization': `Bearer ${authToken}`
      }
    });

    if (response.ok) {
      const statistics = await response.json();
      displayStatistics(statistics);
    } else {
      console.error('שגיאה בטעינת סטטיסטיקות');
    }
  } catch (error) {
    console.error('שגיאה בטעינת סטטיסטיקות:', error);
  }
}

// Update video titles
async function updateTitles() {
  if (!confirm('האם אתה בטוח שברצונך לעדכן את כותרות הסרטונים? זה עשוי לקחת כמה דקות.')) {
    return;
  }

  try {
    const button = document.querySelector('button[onclick="updateTitles()"]');
    const originalText = button.innerHTML;
    button.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i>מעדכן...';
    button.disabled = true;

    const response = await fetch('/api/update-titles', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authToken}`
      }
    });

    if (response.ok) {
      const result = await response.json();
      showAlert('updateTitlesAlert', result.message, 'success');
      loadVideos(); // Refresh the list
    } else {
      const data = await response.json();
      showAlert('updateTitlesAlert', data.error, 'danger');
    }
  } catch (error) {
    showAlert('updateTitlesAlert', 'שגיאה בעדכון כותרות', 'danger');
  } finally {
    const button = document.querySelector('button[onclick="updateTitles()"]');
    button.innerHTML = '<i class="fas fa-sync-alt me-2"></i>עדכן כותרות';
    button.disabled = false;
  }
}

// Display statistics
function displayStatistics(statistics) {
  const videosList = document.getElementById('videosList');
  
  if (statistics.length === 0) {
    videosList.innerHTML = `
      <div class="col-12 text-center">
        <div class="alert alert-info">
          <i class="fas fa-info-circle me-2"></i>
          אין נתונים להצגה.
        </div>
      </div>
    `;
    return;
  }

  videosList.innerHTML = `
    <div class="col-12 mb-3">
      <div class="alert alert-success">
        <h6><i class="fas fa-chart-bar me-2"></i>סטטיסטיקות נגינה</h6>
        <p class="mb-0">סה"כ ${statistics.length} סרטונים, ${statistics.reduce((sum, v) => sum + (v.play_count || 0), 0)} נגינות</p>
      </div>
    </div>
  ` + statistics.map(video => `
    <div class="col-md-6 col-lg-4 mb-3">
      <div class="card video-card h-100">
        <div class="card-body">
                     <div class="d-flex justify-content-between align-items-start mb-2">
             <h6 class="card-title mb-0">
               <i class="fab fa-youtube me-2"></i>
               ${video.title || `סרטון ${video.id}`}
             </h6>
             <span class="badge bg-primary fs-6">
               ${video.play_count || 0} נגינות
             </span>
           </div>
          
          <p class="card-text small mb-2">
            <strong>נוצר על ידי:</strong> ${video.created_by_username}
          </p>
          
          <p class="card-text small mb-2">
            <strong>נוצר ב:</strong> ${formatDate(video.created_at)}
          </p>
          
          ${video.last_played ? `
            <p class="card-text small mb-3">
              <strong>נגן לאחרונה:</strong> ${formatDate(video.last_played)}
            </p>
          ` : ''}
          
          <div class="d-flex justify-content-between">
            <a href="${video.youtube_url}" target="_blank" class="btn btn-light btn-sm">
              <i class="fas fa-external-link-alt me-1"></i>
              צפה ב-YouTube
            </a>
            <button onclick="loadVideos()" class="btn btn-secondary btn-sm">
              <i class="fas fa-arrow-left me-1"></i>
              חזור לרשימה
            </button>
          </div>
        </div>
      </div>
    </div>
  `).join('');
} 