export async function fixUrl(url: string) {
    const hasHtm = url.endsWith('.htm');
    const hasParam = url.includes('0112-0');

    if (!hasHtm) {
        url += '.htm';
    }

    if (!hasParam) {
        url = url.replace('.htm', ';0112-0.htm');
    }

    return url;
}
