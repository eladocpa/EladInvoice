import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../utils/prisma';
import { authenticate } from '../middleware/auth';
import { validate } from '../middleware/validation';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

const router = Router();
router.use(authenticate);

const storagePath = process.env.STORAGE_PATH || path.join(__dirname, '..', '..', 'uploads');

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => {
      const dir = path.join(storagePath, 'logos');
      fs.mkdirSync(dir, { recursive: true });
      cb(null, dir);
    },
    filename: (req, _file, cb) => {
      const ext = path.extname(_file.originalname);
      cb(null, `${req.user!.businessId}${ext}`);
    },
  }),
  limits: { fileSize: 500 * 1024 }, // 500KB
  fileFilter: (_req, file, cb) => {
    const allowed = ['.png', '.jpg', '.jpeg', '.svg'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('סוג קובץ לא נתמך. יש להעלות PNG, JPG או SVG'));
    }
  },
});

const updateBusinessSchema = z.object({
  name: z.string().min(2).optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email().optional(),
  primaryColor: z.string().optional(),
  secondaryColor: z.string().optional(),
  bankName: z.string().optional(),
  bankBranch: z.string().optional(),
  bankAccount: z.string().optional(),
  chavonitClientId: z.string().optional(),
  chavonitClientSecret: z.string().optional(),
});

// Get business details
router.get('/current', async (req: Request, res: Response) => {
  try {
    const business = await prisma.business.findUnique({
      where: { id: req.user!.businessId },
    });
    if (!business) {
      res.status(404).json({ error: 'עסק לא נמצא' });
      return;
    }
    res.json(business);
  } catch {
    res.status(500).json({ error: 'שגיאה בטעינת פרטי העסק' });
  }
});

// Update business
router.put('/current', validate(updateBusinessSchema), async (req: Request, res: Response) => {
  try {
    const business = await prisma.business.update({
      where: { id: req.user!.businessId },
      data: req.body,
    });

    await prisma.auditLog.create({
      data: {
        userId: req.user!.userId,
        action: 'UPDATE_BUSINESS',
        entityType: 'business',
        entityId: business.id,
        details: JSON.stringify(req.body),
      },
    });

    res.json(business);
  } catch {
    res.status(500).json({ error: 'שגיאה בעדכון פרטי העסק' });
  }
});

// Upload logo
router.post('/current/logo', upload.single('logo'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      res.status(400).json({ error: 'לא נבחר קובץ' });
      return;
    }

    const logoUrl = `/uploads/logos/${req.file.filename}`;

    await prisma.business.update({
      where: { id: req.user!.businessId },
      data: { logoUrl },
    });

    res.json({ logoUrl });
  } catch (error) {
    console.error('Logo upload error:', error);
    res.status(500).json({ error: 'שגיאה בהעלאת הלוגו' });
  }
});

export default router;
