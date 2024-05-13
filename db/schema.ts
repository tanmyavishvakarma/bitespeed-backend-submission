import { sql } from "drizzle-orm";
import { integer, text, sqliteTable } from "drizzle-orm/sqlite-core";

export const contacts = sqliteTable("Contacts", {
    id: integer("id").primaryKey({ autoIncrement: true }),
    phoneNumber: text("phoneNumber"),
    email: text("email"),
    linkedId: integer("linkedId"),
    linkPrecedence: text("linkPrecedence"),
    createdAt: text("createdAt").default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updatedAt").default(sql`CURRENT_TIMESTAMP`),
    deletedAt: text("deletedAt")
});
