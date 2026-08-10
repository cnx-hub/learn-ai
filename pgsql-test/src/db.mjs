import { Pool } from 'pg';
import 'dotenv/config';

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
})

async function query(text, params) {
    return pool.query(text, params);
}

export {
    pool,
    query
}