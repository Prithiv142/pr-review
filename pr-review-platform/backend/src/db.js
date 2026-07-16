const { PrismaClient } = require("@prisma/client");

// Reuse a single Prisma client across the app instead of creating a new
// one per request — avoids exhausting the DB connection pool.
const prisma = new PrismaClient();

module.exports = prisma;
