import express, { Request, Response } from "express";
import { db } from "../../db";
import { contacts } from "../../db/schema.js";
import { eq, or } from "drizzle-orm";

const router = express.Router();
router.use(express.json());
router.use(express.urlencoded({ extended: true }));

interface IdentifyRequest {
    email?: string;
    phoneNumber?: string;
}

interface ContactResponse {
    primaryContactId: number;
    emails: string[];
    phoneNumbers: string[];
    secondaryContactIds: number[];
}

router.get("/", (req, res) => {
    res.send("TANMYA VISHVAKARMA BITESPEED BACKED DEV SUBMISSION")
})

router.post('/identify', async (req: Request<{}, {}, IdentifyRequest>, res: Response) => {
    const { email, phoneNumber } = req.body;

    const existingContacts = await db.select().from(contacts)
        .where(or(eq(contacts.email, email), eq(contacts.phoneNumber, phoneNumber))).limit(1);

    if (existingContacts.length === 0) {
        const newContact = await db.insert(contacts)
            .values({
                email,
                phoneNumber,
                linkPrecedence: 'primary',
            })
            .returning()
        console.log({ newContact })
        res.json({
            contact: {
                primaryContactId: newContact[0].id,
                emails: [newContact[0].email],
                phoneNumbers: [newContact[0].phoneNumber],
                secondaryContactIds: [],
            },
        });
    } else {
        const primaryContact = existingContacts.find(c => c.linkPrecedence === 'primary');
        const secondaryContactIds = existingContacts.filter(c => c.linkPrecedence === 'secondary').map(c => c.id);

        const emails = existingContacts.map(c => c.email).filter(Boolean) as string[];
        const phoneNumbers = existingContacts.map(c => c.phoneNumber).filter(Boolean) as string[];

        const shouldCreateSecondaryContact =
            (email && !emails.includes(email)) || (phoneNumber && !phoneNumbers.includes(phoneNumber));

        if (shouldCreateSecondaryContact) {
            const newSecondaryContact = await db.insert(contacts)
                .values({
                    email,
                    phoneNumber,
                    linkedId: primaryContact!.id,
                    linkPrecedence: 'secondary',
                })
                .returning()
            console.log(newSecondaryContact)
            secondaryContactIds.push(newSecondaryContact[0].id);
            emails.push(newSecondaryContact[0].email);
            phoneNumbers.push(newSecondaryContact[0].phoneNumber);
        } else {
            await db.update(contacts)
                .set({
                    email: emails.includes(email) ? email : contacts.email,
                    phoneNumber: phoneNumbers.includes(phoneNumber) ? phoneNumber : contacts.phoneNumber,
                    updatedAt: new Date().toString(),
                })
                .where(eq(contacts.id, primaryContact!.id))
        }

        const response: ContactResponse = {
            primaryContactId: primaryContact!.id,
            emails,
            phoneNumbers,
            secondaryContactIds,
        };

        res.json({ contact: response });
    }
});

export default router;
