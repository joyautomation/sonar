export function cycle(stop: number, start: number = 0) {
  let val = start;
  return {
    current: () => val,
    next: () => {
      const current = val;
      val = val > stop ? start : val + 1;
      return current;
    },
  };
}
