import { Router } from "express";
import { DateTime } from "luxon";
import { requireAuth, currentUser } from "../middleware/auth";
import { ScheduledPost, publicPost } from "../models/ScheduledPost";
import { InstagramAccount } from "../models/InstagramAccount";
import { Notification } from "../models/Notification";
import { activeAccountsFilter } from "../services/accounts";

export const dashboardRouter = Router();

dashboardRouter.get("/dashboard", requireAuth, async (req, res) => {
  const user = currentUser(req);
  const now = new Date();
  const weekStart = DateTime.fromJSDate(now, { zone: user.timezone }).startOf("week");
  const weekEnd = weekStart.plus({ weeks: 1 });
  const [weekPosts, next24h, failed, accounts, unread, upcoming] = await Promise.all([
    ScheduledPost.countDocuments({
      userId: user._id,
      status: { $in: ["scheduled", "publishing", "published", "failed"] },
      scheduledAt: { $gte: weekStart.toJSDate(), $lt: weekEnd.toJSDate() },
    }),
    ScheduledPost.countDocuments({ userId: user._id, status: "scheduled", scheduledAt: { $gte: now, $lt: new Date(now.getTime() + 86400000) } }),
    ScheduledPost.countDocuments({ userId: user._id, status: "failed" }),
    InstagramAccount.find(activeAccountsFilter(user._id), { status: 1 }),
    Notification.countDocuments({ userId: user._id, readAt: { $exists: false } }),
    ScheduledPost.find({ userId: user._id, status: { $in: ["scheduled", "publishing"] }, scheduledAt: { $gte: new Date(now.getTime() - 3600000) } })
      .sort({ scheduledAt: 1 })
      .limit(8),
  ]);
  res.json({
    stats: {
      weekPosts,
      next24h,
      failed,
      connectedAccounts: accounts.filter((a) => a.status === "connected").length,
      accountsNeedingReconnect: accounts.filter((a) => a.status !== "connected").length,
      unreadNotifications: unread,
    },
    weekStart: weekStart.toISODate(),
    upcoming: upcoming.map(publicPost),
  });
});
