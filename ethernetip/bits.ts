// Add this new function to convert Uint8Array to hex string
export function bufferToHex(buffer: Uint8Array): string {
  return Array.from(buffer)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export const bytesToFloat = (bytes: Uint8Array): number => {
  const buffer = new Uint8Array(bytes).buffer;
  const dataView = new DataView(buffer);
  return dataView.getFloat32(0, true); // true for little-endian
};

export function joinBytes(arrays: Uint8Array[]): Uint8Array {
  const totalLength = arrays.reduce((acc, curr) => acc + curr.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const array of arrays) {
    result.set(array, offset);
    offset += array.length;
  }
  return result;
}
