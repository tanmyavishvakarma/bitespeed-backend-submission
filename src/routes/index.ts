import express, { Request, Response } from "express";
import { db } from "../../db";
import { contacts } from "../../db/schema.js";
import { eq, inArray, and, or } from "drizzle-orm";

const router = express.Router();

router.use(express.json());
router.use(express.urlencoded({ extended: true }));

router.post('/identify', async (req: Request, res: Response) => {
    const { email, phoneNumber } = req.body;
    console.log(email, phoneNumber)
    res.send("Identify Endpoint")
});

export default router;
