export function* cycle(stop: number, start: number = 0): Generator<number> {
  let val = start;
  while (true) {
    if (val > stop) {
      val = start;
    }
    yield val;
    val += 1;
  }
}
