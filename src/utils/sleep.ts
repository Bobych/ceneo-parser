import { DEFAULT_SLEEP_MS } from '@/constants';

export async function sleep(ms?: number) {
    const period = ms ? ms : DEFAULT_SLEEP_MS;
    return new Promise(resolve => setTimeout(resolve, Math.floor(Math.random() * period) + period));
}
