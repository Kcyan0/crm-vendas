import postgres from 'postgres';

const sql = postgres(process.env.DATABASE_URL!, {
    ssl: 'require',
    max: 10,
    connection: {
        options: '--search_path=public',
    },
});

export default sql;
