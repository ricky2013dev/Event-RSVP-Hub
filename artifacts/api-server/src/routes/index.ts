import { Router, type IRouter } from "express";
import adminRouter from "./admin";
import eventRouter from "./event";
import healthRouter from "./health";

const router: IRouter = Router();

router.use(healthRouter);
router.use(adminRouter);
router.use(eventRouter);

export default router;
