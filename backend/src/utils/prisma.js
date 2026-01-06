const { PrismaClient } = require('@prisma/client');
const { Pool } = require('pg');
const { PrismaPg } = require('@prisma/adapter-pg');
const dotenv = require('dotenv');

dotenv.config();

// Ensure we strip sslmode from URL to avoid conflicts with our explicit config
const url = new URL(process.env.DATABASE_URL);
url.searchParams.delete('sslmode');
const connectionString = url.toString();

console.log("Initializing Prisma with SSL bypass...");

const pool = new Pool({
    connectionString,
    ssl: { rejectUnauthorized: false }
});
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

module.exports = prisma;
