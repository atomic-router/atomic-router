export const paramsEqual = (a: Record<string, any>, b: Record<string, any>) => {
  if (Object.keys(a).length !== Object.keys(b).length) {
    return false;
  }
  for (const k in a) {
    // NOTE: Parsed URI always returns string parameters
    // so we force string comparison here
    // in order to avoid extra updates
    // whenever user passes numeric params
    if (`${a[k]}` !== `${b[k]}`) {
      return false;
    }
  }
  return true;
};
