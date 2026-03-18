# EladInvoice — מערכת חשבוניות וקבלות לישראל

מערכת SaaS מקצועית להפקת חשבוניות, קבלות ומסמכים פיננסיים לעוסקים בישראל, בהתאם להוראות ניהול ספרים של רשות המסים.

## תכונות עיקריות

- **חשבוניות מס / חשבוניות עסקה** — תמיכה מלאה בעוסק מורשה ועוסק פטור
- **קבלות, חשבוניות מס קבלה, תעודות משלוח, חשבוניות זיכוי**
- **ספר תקבולים ותשלומים** — רישום אוטומטי לפי הוראות ניהול ספרים
- **מספור סדרתי רציף** — לכל סוג מסמך בנפרד
- **דוחות הכנסות** — חודשי, רבעוני, שנתי, טווח חופשי
- **ייצוא לאקסל ו-PDF**
- **שליחה במייל ובוואטסאפ**
- **Multi-tenant** — כל עסק עם נתונים מבודדים
- **RTL מלא** — ממשק בעברית
- **דשבורד** עם גרפים וKPI
- **חשבונית ישראל** — חיבור לרשות המסים למספרי הקצאה (חובה חוקית מ-01.2026)

## טכנולוגיות

| רכיב | טכנולוגיה |
|-------|-----------|
| Backend | Node.js + Express + TypeScript |
| Frontend | React + Vite + TypeScript |
| Database | PostgreSQL + Prisma ORM |
| PDF | HTML Templates (Puppeteer-ready) |
| Email | Nodemailer + SMTP |
| WhatsApp | Twilio / whapi.cloud / wa.me fallback |
| Charts | Chart.js |
| Deploy | Railway |

## התקנה מקומית

### דרישות מקדימות
- Node.js 18+
- PostgreSQL 14+

### שלבים

```bash
# 1. שכפול
git clone <repo-url>
cd EladInvoice

# 2. הגדרת סביבה
cp .env.example .env
# ערוך את .env עם פרטי ה-DB שלך

# 3. התקנת dependencies
cd backend && npm install
cd ../frontend && npm install

# 4. יצירת DB ומיגרציות
cd ../backend
npx prisma migrate dev --name init
npx prisma generate

# 5. נתוני דוגמה
npm run seed

# 6. הפעלה
# טרמינל 1 - backend:
npm run dev

# טרמינל 2 - frontend:
cd ../frontend && npm run dev
```

### חשבונות דמו
| סוג עוסק | מייל | סיסמה |
|-----------|------|--------|
| עוסק מורשה | demo@digitalplus.co.il | password123 |
| עוסק פטור | demo@osekpatur.co.il | password123 |

## פריסה ב-Railway

### שלב 1: יצירת פרויקט
1. היכנס ל-[railway.app](https://railway.app)
2. צור פרויקט חדש
3. הוסף PostgreSQL plugin

### שלב 2: חיבור הקוד
1. חבר את ה-GitHub repo
2. Railway יזהה אוטומטית את `railway.toml`

### שלב 3: הגדרת Environment Variables
הוסף את כל המשתנים מ-`.env.example`:
- `DATABASE_URL` — יוגדר אוטומטית ע"י Railway
- `JWT_SECRET` — מחרוזת אקראית ארוכה
- `JWT_REFRESH_SECRET` — מחרוזת אקראית נפרדת
- `APP_URL` — כתובת האפליקציה ב-Railway
- `NODE_ENV` — `production`
- שאר המשתנים לפי הצורך

### שלב 4: Deploy
```bash
railway up
```

## Railway Deployment (English)

1. Create a new project on [railway.app](https://railway.app)
2. Add a PostgreSQL plugin
3. Connect your GitHub repository
4. Set environment variables (see `.env.example`)
5. Railway will automatically build and deploy using `railway.toml`
6. Run `npm run seed` via Railway CLI for demo data

## מבנה סוגי מסמכים

### עוסק מורשה
| סוג | תיאור |
|-----|--------|
| חשבונית מס | מסמך מע"מ — חייב כולל 18% |
| קבלה | אישור תשלום בלבד |
| חשבונית מס קבלה | שילוב חשבונית + קבלה |
| תעודת משלוח | לפני החשבונית, ללא מע"מ |
| חשבונית זיכוי | ביטול/זיכוי חשבונית קיימת |

### עוסק פטור
| סוג | תיאור |
|-----|--------|
| חשבונית עסקה | ללא מע"מ, עם הערת פטור |
| קבלה | אישור תשלום |

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | /api/auth/register | הרשמה |
| POST | /api/auth/login | התחברות |
| POST | /api/auth/refresh | רענון טוקן |
| GET | /api/auth/me | פרטי משתמש נוכחי |
| GET/PUT | /api/businesses/current | פרטי עסק |
| POST | /api/businesses/current/logo | העלאת לוגו |
| GET/POST | /api/customers | לקוחות |
| GET/PUT/DELETE | /api/customers/:id | לקוח ספציפי |
| GET/POST | /api/documents | מסמכים |
| GET | /api/documents/:id | מסמך ספציפי |
| POST | /api/documents/:id/finalize | הפקת טיוטה |
| POST | /api/documents/:id/mark-paid | סימון כשולם |
| POST | /api/documents/:id/send-email | שליחה במייל |
| POST | /api/documents/:id/send-whatsapp | שליחה בוואטסאפ |
| GET | /api/documents/:id/pdf | הורדת PDF |
| GET | /api/cashbook | ספר תקבולים |
| GET | /api/reports/income | דוח הכנסות |
| GET | /api/reports/income/excel | ייצוא אקסל |
| GET | /api/reports/dashboard | נתוני דשבורד |

## רישיון

MIT License
