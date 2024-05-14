import express, { Request, Response } from "express";
import { db } from "../../db";
import { contacts } from "../../db/schema.js";
import { eq, or, asc } from "drizzle-orm";

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

const formatDate = (date) => {
    const formattedDate = date.toISOString().slice(0, 19).replace('T', ' ');
    return formattedDate;
}

router.get("/", (req, res) => {
    res.send("TANMYA VISHVAKARMA BITESPEED BACKED DEV SUBMISSION");
});

router.post('/identify', async (req: Request<{}, {}, IdentifyRequest>, res: Response) => {
    try {
        let { email, phoneNumber } = req.body;
        phoneNumber = phoneNumber || null;
        email = email || null;

        let existingContacts = await db.select().from(contacts)
            .where(or(eq(contacts.email, email), eq(contacts.phoneNumber, phoneNumber)))
            .orderBy(asc(contacts.createdAt));

        if (existingContacts.length === 0) {
            const newContact = await db.insert(contacts)
                .values({
                    email,
                    phoneNumber,
                    linkPrecedence: 'primary',
                })
                .returning();

            res.json({
                contact: {
                    primaryContactId: newContact[0].id,
                    emails: [newContact[0].email],
                    phoneNumbers: [newContact[0].phoneNumber],
                    secondaryContactIds: [],
                },
            });
        } else {
            let primaryContacts = existingContacts.filter(c => c.linkPrecedence === 'primary');
            let primaryContact = primaryContacts[0];

            if (primaryContacts.length > 1) {

                let primaryContactIds = primaryContacts.map(c => c.id);
                primaryContactIds = primaryContactIds.slice(1);

                for (let id of primaryContactIds) {
                    await db.update(contacts)
                        .set({
                            linkPrecedence: "secondary",
                            linkedId: primaryContact?.id,
                            updatedAt: formatDate(new Date())
                        })
                        .where(eq(contacts.id, id))
                        .execute();
                }

                existingContacts = await db.select().from(contacts)
                    .where(or(eq(contacts.email, email), eq(contacts.phoneNumber, phoneNumber)))
                    .orderBy(asc(contacts.createdAt));
            }

            let secondaryContactIds = existingContacts
                .filter(c => c.linkPrecedence === 'secondary')
                .map(c => c.id);
            let emails = new Set(existingContacts.map(c => c.email).filter(Boolean) as string[]);
            let phoneNumbers = new Set(existingContacts.map(c => c.phoneNumber).filter(Boolean) as string[]);


            const shouldCreateSecondaryContact =
                (email && !emails.has(email)) || (phoneNumber && !phoneNumbers.has(phoneNumber));
        
            if (shouldCreateSecondaryContact) {
                const newSecondaryContact = await db.insert(contacts)
                    .values({
                        email,
                        phoneNumber,
                        linkedId: primaryContact?.id,
                        linkPrecedence: 'secondary',
                    })
                    .returning();

                secondaryContactIds.push(newSecondaryContact[0].id);
                emails.add(newSecondaryContact[0].email);
                phoneNumbers.add(newSecondaryContact[0].phoneNumber);
            }

            const response: ContactResponse = {
                primaryContactId: primaryContact?.id,
                emails: Array.from(emails),
                phoneNumbers: Array.from(phoneNumbers),
                secondaryContactIds,
            };

            res.json({ contact: response });
        }
    } catch (error) {
        console.error("Error:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

export default router;