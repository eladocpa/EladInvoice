import { Router, Request, Response } from 'express';
import { prisma } from '../utils/prisma';
import { authenticate } from '../middleware/auth';
import { z } from 'zod';
import { validate } from '../middleware/validation';
import bcrypt from 'bcrypt';

const router = Router();
router.use(authenticate);

// Add team member
const addUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(2),
  role: z.enum(['ACCOUNTANT', 'VIEWER']),
});

router.post('/users', validate(addUserSchema), async (req: Request, res: Response) => {
  try {
    if (req.user!.role !== 'OWNER') {
      res.status(403).json({ error: 'רק בעל העסק יכול להוסיף משתמשים' });
      return;
    }

    const { email, password, name, role } = req.body;

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      res.status(409).json({ error: 'מייל כבר קיים במערכת' });
      return;
    }

    const user = await prisma.user.create({
      data: {
        businessId: req.user!.businessId,
        email,
        passwordHash: await bcrypt.hash(password, 12),
        name,
        role,
      },
    });

    res.status(201).json({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    });
  } catch {
    res.status(500).json({ error: 'שגיאה בהוספת משתמש' });
  }
});

// List team members
router.get('/users', async (req: Request, res: Response) => {
  try {
    const users = await prisma.user.findMany({
      where: { businessId: req.user!.businessId },
      select: { id: true, email: true, name: true, role: true, createdAt: true },
    });
    res.json(users);
  } catch {
    res.status(500).json({ error: 'שגיאה בטעינת משתמשים' });
  }
});

// Change password
const changePasswordSchema = z.object({
  currentPassword: z.string(),
  newPassword: z.string().min(8),
});

router.post('/change-password', validate(changePasswordSchema), async (req: Request, res: Response) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user!.userId } });
    if (!user) {
      res.status(404).json({ error: 'משתמש לא נמצא' });
      return;
    }

    const valid = await bcrypt.compare(req.body.currentPassword, user.passwordHash);
    if (!valid) {
      res.status(401).json({ error: 'סיסמה נוכחית שגויה' });
      return;
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: await bcrypt.hash(req.body.newPassword, 12) },
    });

    res.json({ message: 'סיסמה עודכנה בהצלחה' });
  } catch {
    res.status(500).json({ error: 'שגיאה בעדכון סיסמה' });
  }
});

export default router;
