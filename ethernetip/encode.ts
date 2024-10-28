export const encodeString = (str: string): Uint8Array => {
  const encoder = new TextEncoder();
  return encoder.encode(str);
};

export const decodeString = (value: Uint8Array) => {
  const decoder = new TextDecoder();
  return decoder.decode(value);
};

export const encodeUint = (value: number, size: number) => {
  const buffer = new ArrayBuffer(size);
  const view = new DataView(buffer);
  switch (size) {
    case 1:
      view.setUint8(0, value);
      break;
    case 2:
      view.setUint16(0, value, true);
      break;
    case 4:
      view.setUint32(0, value, true);
      break;
    default:
      throw new Error(`Unsupported size: ${size}`);
  }
  return new Uint8Array(buffer);
};

export const decodeUint = (value: Uint8Array) => {
  const decoder = new DataView(value.buffer);
  switch (value.length) {
    case 1:
      return decoder.getUint8(0);
    case 2:
      return decoder.getUint16(0, true);
    case 4:
      return decoder.getUint32(0, true);
    default:
      throw new Error(`Unsupported size: ${value.length}`);
  }
};
