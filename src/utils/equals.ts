export const equals = (a: Record<string, any>, b: Record<string, any>) => {
  if (Object.keys(a).length !== Object.keys(b).length) {
    return false;
  }
  for (const k in a) {
    if (a[k] !== b[k]) {
      return false;
    }
  }
  return true;
};
