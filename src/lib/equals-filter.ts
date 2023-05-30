export const equalsFilter = (prev, next) => {
  if (Object.keys(prev).length != Object.keys(next).length) {
    return true;
  }
  if (Object.keys(prev).length === 0) {
    return true;
  }
  for (const k in prev) {
    if (prev[k] != next[k]) {
      return true;
    }
  }
  return false;
};
