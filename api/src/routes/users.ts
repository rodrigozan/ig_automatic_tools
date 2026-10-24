import { Router } from "express";
import { z } from "zod";
import { requireAuth, currentUser } from "../middleware/auth";
import { parse } from "../lib/errors";
import { timezone, weekdayTimes } from "../lib/validation";
import { publicUser } from "../models/User";
import { clearSessionCookie } from "../lib/session";
import { deleteUserData } from "../services/accountDeletion";

export const usersRouter = Router();

const patchSchema = z
  .object({
    name: z.string().trim().min(1, "Informe o nome.").max(100, "Nome longo demais.").optional(),
    timezone: timezone.optional(),
    defaultSchedule: weekdayTimes.optional(),
  })
  .strict();

usersRouter.patch("/users/me", requireAuth, async (req, res) => {
  const user = currentUser(req);
  const body = parse(patchSchema, req.body);
  if (body.name !== undefined) user.name = body.name;
  if (body.timezone !== undefined) user.timezone = body.timezone;
  if (body.defaultSchedule !== undefined) user.set("defaultSchedule", body.defaultSchedule);
  await user.save();
  res.json(publicUser(user));
});

usersRouter.delete("/users/me", requireAuth, async (req, res) => {
  await deleteUserData(currentUser(req).id);
  clearSessionCookie(res);
  res.sendStatus(204);
});
