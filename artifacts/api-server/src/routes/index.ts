import { Router, type IRouter } from "express";
import eventRouter from "./event";
import healthRouter from "./health";

const router: IRouter = Router();

router.use(healthRouter);
router.use(eventRouter);

export default router;
