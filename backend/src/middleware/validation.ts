import { Request, Response, NextFunction } from 'express';
import { ZodSchema } from 'zod';

const defaultMessages: Record<string, string> = {
  'Required': 'שדה חובה',
  'Expected string, received null': 'שדה חובה',
  'Expected string, received undefined': 'שדה חובה',
  'Expected number, received null': 'יש להזין מספר',
  'Expected number, received string': 'יש להזין מספר',
  'Expected number, received undefined': 'יש להזין מספר',
  'Invalid input': 'ערך לא תקין',
  'Invalid enum value': 'ערך לא תקין',
};

function hebrewMessage(msg: string): string {
  if (defaultMessages[msg]) return defaultMessages[msg];
  // Catch Zod default patterns
  if (msg.startsWith('Expected ') || msg.startsWith('Invalid ') || msg.startsWith('String must') || msg.startsWith('Number must')) {
    return 'ערך לא תקין';
  }
  return msg;
}

export function validate(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      res.status(400).json({
        error: 'נתונים לא תקינים',
        details: result.error.errors.map(e => ({
          field: e.path.join('.'),
          message: hebrewMessage(e.message),
        })),
      });
      return;
    }
    req.body = result.data;
    next();
  };
}
