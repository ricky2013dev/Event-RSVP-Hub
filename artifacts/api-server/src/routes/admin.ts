import { Router, type IRouter } from "express";
import { AdminLoginBody, AdminLoginResponse } from "@workspace/api-zod";
import { checkPassword, isAdminConfigured, issueToken } from "../lib/admin-auth";

const router: IRouter = Router();

router.post("/admin/login", async (req, res): Promise<void> => {
  const parsed = AdminLoginBody.safeParse(req.body);
  if (!isAdminConfigured()) {
    req.log.error("ADMIN_PASSWORD is not set");
    res.status(503).json({ error: "Admin password is not configured" });
    return;
  }
  if (!parsed.success || !checkPassword(parsed.data.password)) {
    // Slow down password guessing.
    await new Promise((resolve) => setTimeout(resolve, 800));
    res.status(401).json({ error: "Wrong password" });
    return;
  }

  const session = issueToken();
  res.json(AdminLoginResponse.parse({ token: session.token, expiresAt: session.expiresAt.toISOString() }));
});

export default router;
