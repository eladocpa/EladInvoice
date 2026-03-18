import { Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function tenantMiddleware(req: Request, res: Response, next: NextFunction): Promise<void> {
  if (!req.user?.businessId) {
    res.status(401).json({ error: 'נדרשת הזדהות' });
    return;
  }

  const business = await prisma.business.findUnique({
    where: { id: req.user.businessId },
  });

  if (!business) {
    res.status(404).json({ error: 'עסק לא נמצא' });
    return;
  }

  next();
}
