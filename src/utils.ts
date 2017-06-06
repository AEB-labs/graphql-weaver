export function objectValues(obj: {[name: string]: any}): any[] {
    return Object.keys(obj).map(i => obj[i]);
}

export function capitalize(string: string) {
    return string.charAt(0).toUpperCase() + string.slice(1);
}