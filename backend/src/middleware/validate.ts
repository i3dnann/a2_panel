import type { NextFunction, Request, Response } from "express";
import type { AnyZodObject, ZodTypeAny } from "zod";
import { HttpError } from "../utils/errors.js";

export function validateBody(schema: AnyZodObject | ZodTypeAny) {
  return function validate(req: Request, _res: Response, next: NextFunction) {
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return next(new HttpError(400, parsed.error.issues.map((issue) => issue.message).join(", "), "validation_error"));
    }
    req.body = parsed.data;
    next();
  };
}
