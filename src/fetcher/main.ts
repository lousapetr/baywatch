import { greeting } from '../shared/hello.ts';

console.log(`${new Date().toISOString()} ${greeting('fetcher placeholder')}`);
