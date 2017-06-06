export function objectValues(obj: {[name: string]: any}): any[] {
    return Object.keys(obj).map(i => obj[i]);
}