import express, { Request, Response } from 'express';
import { drizzle } from 'drizzle-orm/sqlite3';
import { migrate } from 'drizzle-orm/sqlite3/migrator';
import { Pool } from 'better-sqlite3';


const app = express();
app.use(express.json());

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

app.post('/identify', async (req: Request<{}, {}, IdentifyRequest>, res: Response) => {
  const { email, phoneNumber } = req.body;

  
  const existingContacts = await drizzle.select().from(contacts)
    .where(drizzle.or(
      drizzle.eq(contacts.email, email),
      drizzle.eq(contacts.phoneNumber, phoneNumber)
    ))
    .all(pool);

  if (existingContacts.length === 0) {
    
    const newContact = await drizzle.insert(contacts)
      .values({
        email,
        phoneNumber,
        linkPrecedence: 'primary',
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning()
      .run(pool);

    res.json({
      contact: {
        primaryContactId: newContact.insertedRecords[0].id,
        emails: [newContact.insertedRecords[0].email],
        phoneNumbers: [newContact.insertedRecords[0].phoneNumber],
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
      const newSecondaryContact = await drizzle.insert(contacts)
        .values({
          email,
          phoneNumber,
          linkedId: primaryContact!.id,
          linkPrecedence: 'secondary',
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .returning()
        .run(pool);

      secondaryContactIds.push(newSecondaryContact.insertedRecords[0].id);
      emails.push(newSecondaryContact.insertedRecords[0].email);
      phoneNumbers.push(newSecondaryContact.insertedRecords[0].phoneNumber);
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

app.listen(3000, () => {
  console.log('Server is running on port 3000');
});