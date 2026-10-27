import argon2 from 'argon2';

const hash = await argon2.hash('admin123', { type: argon2.argon2id });
console.log('New hash:', hash);

const result = await argon2.verify(hash, 'admin123');
console.log('Verification of new hash:', result);