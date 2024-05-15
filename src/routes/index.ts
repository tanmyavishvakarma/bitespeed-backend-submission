import express, { Request, Response } from "express";
import { db } from "../../db/index.js";
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

router.get("/", (_, res) => {
    res.send("TANMYA VISHVAKARMA BITESPEED BACKED DEV SUBMISSION");
});


router.post('/identify', async (req: Request<{}, {}, IdentifyRequest>, res: Response) => {
    try {
        let { email, phoneNumber } = req.body;
        phoneNumber = phoneNumber || "";
        email = email || "";
        let restContacts = null 
        let firstContact = await db.select().from(contacts).where(or(eq(contacts.email, email), eq(contacts.phoneNumber, phoneNumber))).orderBy(asc(contacts.createdAt));

        if (firstContact.length > 0) {
            restContacts = await db.select().from(contacts).where(eq(contacts.linkedId, firstContact[0].id)).orderBy(asc(contacts.createdAt));
        }

        if (firstContact.length === 0 && restContacts === null) {
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
            let allContacts = firstContact.concat(restContacts || []);
            let allEmails = new Set(allContacts.map(c => c.email).filter(Boolean) as string[]);
            let allPhoneNumbers = new Set(allContacts.map(c => c.phoneNumber).filter(Boolean) as string[]);

            let primaryContacts = allContacts.filter(c => c.linkPrecedence === 'primary');

            if (primaryContacts.length > 1) {

                let primaryContactIds = primaryContacts.map(c => c.id);
                primaryContactIds = primaryContactIds.slice(1);

                for (let id of primaryContactIds) {
                    await db.update(contacts)
                        .set({
                            linkPrecedence: "secondary",
                            linkedId: primaryContacts[0]?.id,
                            updatedAt: formatDate(new Date())
                        })
                        .where(eq(contacts.id, id))
                        .execute();
                }

                allContacts = await db.select().from(contacts)
                    .where(or(eq(contacts.email, email), eq(contacts.phoneNumber, phoneNumber)))
                    .orderBy(asc(contacts.createdAt));
            }

            let secondaryContactIds = new Set(allContacts
            .filter(c => c.linkPrecedence === 'secondary')
            .map(c => c.id));
        
            const createSecondary = (email && !allEmails.has(email)) || (phoneNumber && !allPhoneNumbers.has(phoneNumber));

            let primaryContactId = firstContact[0].linkPrecedence === "secondary" ? firstContact[0]?.linkedId : firstContact[0]?.id

            if (createSecondary) {
                const newSecondaryContact = await db.insert(contacts)
                    .values({
                        email,
                        phoneNumber,
                        linkedId:primaryContactId,
                        linkPrecedence: 'secondary',
                    })
                    .returning();

                secondaryContactIds.add(newSecondaryContact[0].id);
                allEmails.add(newSecondaryContact[0].email);
                allPhoneNumbers.add(newSecondaryContact[0].phoneNumber);
            }
            
            const response: ContactResponse = {
                primaryContactId: primaryContactId,
                emails: Array.from(allEmails),
                phoneNumbers: Array.from(allPhoneNumbers),
                secondaryContactIds: Array.from(secondaryContactIds),
            };

            res.json({ contact: response });
        }


    } catch (error) {
        console.error("Error:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

export default router;