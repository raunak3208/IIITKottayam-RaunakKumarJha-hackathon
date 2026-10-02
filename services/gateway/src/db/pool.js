import pg from 'pg';

export const createPool = (url) => new pg.Pool({ connectionString: url });
