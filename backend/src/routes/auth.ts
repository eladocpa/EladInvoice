import { Router, Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { prisma } from '../utils/prisma';
import { validate } from '../middleware/validation';
import { authenticate, AuthPayload } from '../middleware/auth';

const router = Router();

const registerSchema = z.object({
  email: z.string().email('כתובת מייל לא תקינה'),
  password: z.string().min(8, 'סיסמה חייבת להכיל לפחות 8 תווים'),
  name: z.string().min(2, 'שם חייב להכיל לפחות 2 תווים'),
  businessName: z.string().min(2, 'שם העסק חייב להכיל לפחות 2 תווים'),
  businessType: z.enum(['OSEK_PATUR', 'OSEK_MURSHE']),
  taxId: z.string().min(5, 'מספר ח.פ./ת.ז. לא תקין'),
  vatNumber: z.string().optional(),
  phone: z.string().optional(),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

function generateTokens(payload: AuthPayload) {
  const accessToken = jwt.sign(payload, process.env.JWT_SECRET!, { expiresIn: '15m' });
  const refreshToken = jwt.sign(payload, process.env.JWT_REFRESH_SECRET!, { expiresIn: '30d' });
  return { accessToken, refreshToken };
}

// Register
router.post('/register', validate(registerSchema), async (req: Request, res: Response) => {
  try {
    const { email, password, name, businessName, businessType, taxId, vatNumber, phone } = req.body;

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      res.status(409).json({ error: 'כתובת מייל כבר קיימת במערכת' });
      return;
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const result = await prisma.$transaction(async (tx) => {
      const business = await tx.business.create({
        data: {
          name: businessName,
          businessType,
          taxId,
          vatNumber: businessType === 'OSEK_MURSHE' ? vatNumber : null,
          phone,
          email,
        },
      });

      const user = await tx.user.create({
        data: {
          businessId: business.id,
          email,
          passwordHash,
          name,
          role: 'OWNER',
        },
      });

      return { business, user };
    });

    const payload: AuthPayload = {
      userId: result.user.id,
      businessId: result.business.id,
      role: result.user.role,
    };

    const tokens = generateTokens(payload);

    await prisma.user.update({
      where: { id: result.user.id },
      data: { refreshToken: tokens.refreshToken },
    });

    res.cookie('refreshToken', tokens.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 30 * 24 * 60 * 60 * 1000,
    });

    res.status(201).json({
      accessToken: tokens.accessToken,
      user: {
        id: result.user.id,
        name: result.user.name,
        email: result.user.email,
        role: result.user.role,
      },
      business: {
        id: result.business.id,
        name: result.business.name,
        businessType: result.business.businessType,
      },
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'שגיאה בהרשמה' });
  }
});

// Login
router.post('/login', validate(loginSchema), async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    const user = await prisma.user.findUnique({
      where: { email },
      include: { business: true },
    });

    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      res.status(401).json({ error: 'מייל או סיסמה שגויים' });
      return;
    }

    const payload: AuthPayload = {
      userId: user.id,
      businessId: user.businessId,
      role: user.role,
    };

    const tokens = generateTokens(payload);

    await prisma.user.update({
      where: { id: user.id },
      data: { refreshToken: tokens.refreshToken },
    });

    res.cookie('refreshToken', tokens.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 30 * 24 * 60 * 60 * 1000,
    });

    res.json({
      accessToken: tokens.accessToken,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
      business: {
        id: user.business.id,
        name: user.business.name,
        businessType: user.business.businessType,
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'שגיאה בהתחברות' });
  }
});

// Refresh token
router.post('/refresh', async (req: Request, res: Response) => {
  try {
    const token = req.cookies?.refreshToken;
    if (!token) {
      res.status(401).json({ error: 'נדרשת הזדהות מחדש' });
      return;
    }

    const decoded = jwt.verify(token, process.env.JWT_REFRESH_SECRET!) as AuthPayload;

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      include: { business: true },
    });

    if (!user || user.refreshToken !== token) {
      res.status(401).json({ error: 'טוקן לא תקין' });
      return;
    }

    const payload: AuthPayload = {
      userId: user.id,
      businessId: user.businessId,
      role: user.role,
    };

    const tokens = generateTokens(payload);

    await prisma.user.update({
      where: { id: user.id },
      data: { refreshToken: tokens.refreshToken },
    });

    res.cookie('refreshToken', tokens.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 30 * 24 * 60 * 60 * 1000,
    });

    res.json({
      accessToken: tokens.accessToken,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
      business: {
        id: user.business.id,
        name: user.business.name,
        businessType: user.business.businessType,
      },
    });
  } catch {
    res.status(401).json({ error: 'נדרשת הזדהות מחדש' });
  }
});

// Logout
router.post('/logout', authenticate, async (req: Request, res: Response) => {
  try {
    await prisma.user.update({
      where: { id: req.user!.userId },
      data: { refreshToken: null },
    });

    res.clearCookie('refreshToken');
    res.json({ message: 'התנתקת בהצלחה' });
  } catch {
    res.status(500).json({ error: 'שגיאה בהתנתקות' });
  }
});

// Get current user
router.get('/me', authenticate, async (req: Request, res: Response) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      include: { business: true },
    });

    if (!user) {
      res.status(404).json({ error: 'משתמש לא נמצא' });
      return;
    }

    res.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
      business: {
        id: user.business.id,
        name: user.business.name,
        businessType: user.business.businessType,
        taxId: user.business.taxId,
        vatNumber: user.business.vatNumber,
        address: user.business.address,
        city: user.business.city,
        phone: user.business.phone,
        email: user.business.email,
        logoUrl: user.business.logoUrl,
        primaryColor: user.business.primaryColor,
        secondaryColor: user.business.secondaryColor,
        bankName: user.business.bankName,
        bankBranch: user.business.bankBranch,
        bankAccount: user.business.bankAccount,
        chavonitClientId: user.business.chavonitClientId,
        chavonitClientSecret: user.business.chavonitClientSecret ? '••••••••' : null,
      },
    });
  } catch {
    res.status(500).json({ error: 'שגיאה בטעינת נתוני המשתמש' });
  }
});

export default router;
