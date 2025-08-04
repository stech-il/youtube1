# מערכת ניהול סרטוני YouTube וירטואלית

מערכת Node.js שמאפשרת להפעיל סרטוני YouTube ברקע באופן וירטואלי, גם ללא פתיחת דפדפן. המערכת כוללת מערכת משתמשים מוגנת ומסד נתונים לשמירת המידע.

## תכונות עיקריות

- 🔐 **מערכת משתמשים מוגנת** - התחברות עם שם משתמש וסיסמה
- 🎬 **נגן וירטואלי** - הפעלת סרטונים ברקע ללא דפדפן
- 🔄 **נגינה אוטומטית** - הסרטון מתחיל מחדש אוטומטית כשמסתיים
- 💾 **שמירת נתונים** - כל המידע נשמר במסד נתונים SQLite
- 🌐 **ממשק משתמש מודרני** - ממשק בעברית עם עיצוב יפה
- 📱 **תמיכה במובייל** - ממשק רספונסיבי

## דרישות מערכת

- Node.js (גרסה 14 ומעלה)
- npm או yarn
- חיבור לאינטרנט (לצפייה בסרטונים)

## התקנה

1. **שכפל או הורד את הפרויקט**
   ```bash
   git clone <repository-url>
   cd youtube-virtual-player
   ```

2. **התקן את התלויות**
   ```bash
   npm install
   ```

3. **הפעל את השרת**
   ```bash
   npm start
   ```

   או למצב פיתוח עם רענון אוטומטי:
   ```bash
   npm run dev
   ```

4. **פתח את הדפדפן**
   ```
   http://localhost:3000
   ```

## משתמש ברירת מחדל

- **שם משתמש:** `admin`
- **סיסמה:** `admin123`

## שימוש במערכת

### התחברות
1. פתח את הדפדפן ונווט ל-`http://localhost:3000`
2. התחבר עם המשתמש הקיים או צור חשבון חדש
3. לאחר ההתחברות תועבר לדף הניהול

### הוספת סרטון
1. בדף הניהול, הכנס קישור YouTube בשדה "קישור YouTube"
2. לחץ על "הוסף סרטון"
3. הסרטון יתחיל לנגן ברקע באופן אוטומטי

### ניהול סרטונים
- **צפייה בסרטונים פעילים** - רשימת כל הסרטונים שמופעלים כרגע
- **מחיקת סרטון** - לחץ על כפתור "מחק" כדי להפסיק ולמחוק סרטון
- **צפייה ב-YouTube** - לחץ על "צפה ב-YouTube" כדי לפתוח את הסרטון בדפדפן

## ארכיטקטורה

### קבצים עיקריים
- `server.js` - השרת הראשי עם כל ה-API
- `public/index.html` - דף הבית עם ממשק המשתמש
- `public/app.js` - לוגיקת הממשק בצד הלקוח
- `youtube_system.db` - מסד הנתונים SQLite (נוצר אוטומטית)

### API Endpoints
- `POST /api/login` - התחברות
- `POST /api/register` - הרשמה
- `POST /api/videos` - הוספת סרטון
- `GET /api/videos` - קבלת רשימת סרטונים
- `DELETE /api/videos/:id` - מחיקת סרטון

### טכנולוגיות
- **Backend:** Node.js, Express, SQLite3
- **Frontend:** HTML5, CSS3, JavaScript (ES6+)
- **Browser Automation:** Puppeteer
- **Authentication:** JWT, bcrypt
- **UI Framework:** Bootstrap 5

## אבטחה

- **הצפנת סיסמאות** - סיסמאות מוצפנות עם bcrypt
- **JWT Tokens** - אימות מאובטח עם טוקנים
- **Rate Limiting** - הגבלת בקשות למניעת התקפות
- **Helmet** - אבטחת HTTP headers
- **CORS** - הגדרות אבטחה לחיבור בין דומיינים

## פתרון בעיות

### השרת לא מתחיל
- ודא ש-Node.js מותקן
- בדוק שכל התלויות הותקנו: `npm install`
- בדוק שאין תהליך אחר שרץ על פורט 3000

### סרטונים לא מתחילים לנגן
- ודא שיש חיבור לאינטרנט
- בדוק שהקישור ל-YouTube תקין
- בדוק את הלוגים בקונסול השרת

### בעיות ביצועים
- המערכת משתמשת ב-Puppeteer שיכול לצרוך משאבים
- מומלץ להפעיל על שרת עם לפחות 2GB RAM
- ניתן להגביל את מספר הסרטונים הפעילים במקביל

## פיתוח

### הוספת תכונות חדשות
1. ערוך את `server.js` להוספת API endpoints חדשים
2. עדכן את `public/app.js` להוספת פונקציונליות בממשק
3. עדכן את `public/index.html` להוספת אלמנטים בממשק

### שינוי עיצוב
- ערוך את ה-CSS ב-`public/index.html`
- או צור קובץ CSS נפרד והוסף אותו ל-HTML

## רישיון

MIT License - ניתן לשימוש חופשי

## תמיכה

לשאלות או בעיות, אנא צור קשר או פתח issue בפרויקט. 