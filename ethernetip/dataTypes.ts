import { decodeUint, encodeUint } from "./encode.ts";
import { bufferToHex, joinBytes } from "./bits.ts";

export type DataType = {
  encode: (value: any) => Uint8Array;
  decode?: (value: Uint8Array) => any;
};

export type Segment = DataType & {
  segmentType: number;
};

export type ElementaryDataType = DataType & {
  code: number;
  padded: boolean;
};

export type CIPSegment = DataType & {
  segmentType: number;
};

export type LogicalSegment = CIPSegment & {
  segmentType: 0b00100000;
  logicalType: keyof typeof logicalTypes;
  logicalValue: Uint8Array;
};

const logicalTypes = {
  classId: 0b00000000,
  instanceId: 0b00000100,
  memberId: 0b00001000,
  connectionPoint: 0b00001100,
  attributeId: 0b00010000,
  special: 0b00010100,
  serviceId: 0b00011000,
};

const logicalFormat = {
  1: 0b00000000, // 8-bit
  2: 0b00000001, // 16-bit
  4: 0b00000011, // 32-bit
};

export const encodeLogicalSegment = (
  segment: LogicalSegment,
  padded: boolean = false,
) => {
  const logicalType = logicalTypes[segment.logicalType];
  const logicalValue = segment.logicalValue[0];
  const { segmentType } = segment;
  const size = logicalValue <= 0xFF ? 1 : logicalValue <= 0xFFFF ? 2 : 4;
  const format = logicalFormat[size];
  const logicalSegment = new Uint8Array([segmentType | logicalType | format]);
  if (padded && (logicalSegment.length + size) % 2 !== 0) {
    const result = new Uint8Array(logicalSegment.length + size + 1);
    result.set(logicalSegment);
    result.set(encodeUint(logicalValue, size), logicalSegment.length);
    result[result.length - 1] = 0;
    return result;
  } else {
    const result = new Uint8Array(logicalSegment.length + size);
    result.set(logicalSegment);
    result.set(encodeUint(logicalValue, size), logicalSegment.length);
    return result;
  }
};

export const createLogicalSegment = (
  logicalValue: Uint8Array,
  logicalType: keyof typeof logicalTypes,
): LogicalSegment => ({
  segmentType: 0b00100000,
  logicalValue: logicalValue,
  logicalType,
  encode(padded: boolean) {
    return encodeLogicalSegment(this, padded);
  },
});

export type PortSegment = CIPSegment & {
  segmentType: 0b00000000;
  extendedLink: 0b0001000;
  port: number | keyof typeof portSegments;
  linkAddress: string | number;
  name: string;
};

const portSegments = {
  backplane: 0b00000001,
  bp: 0b00000001,
  enet: 0b00000010,
  dhrioa: 0b00000010,
  dhriob: 0b00000011,
  dnet: 0b00000010,
  cnet: 0b00000010,
  dh485a: 0b00000010,
  dh485b: 0b00000011,
};

export const encodePortSegment = (segment: PortSegment) => {
  const port = typeof segment.port === "string"
    ? portSegments[segment.port]
    : segment.port;
  let link: Uint8Array;
  if (typeof segment.linkAddress === "string") {
    if (/^\d+$/.test(segment.linkAddress)) {
      link = encodeUint(parseInt(segment.linkAddress, 10), 1);
    } else {
      // Assuming you have a function to validate IP addresses
      // validateIpAddress(segment.linkAddress);
      link = new TextEncoder().encode(segment.linkAddress);
    }
  } else if (typeof segment.linkAddress === "number") {
    link = encodeUint(segment.linkAddress, 1);
  } else {
    link = segment.linkAddress;
  }
  return new Uint8Array();
};

export const createPortSegment = (
  port: number | keyof typeof portSegments,
  linkAddress: string,
  name: string = "",
): PortSegment => ({
  segmentType: 0b00000000,
  extendedLink: 0b0001000,
  port,
  linkAddress,
  name,
  encode() {
    return encodePortSegment(this);
  },
});

export const encodeEpath = (
  segments: (CIPSegment | Uint8Array)[],
  length: boolean = false,
  padLength: boolean = false,
): Uint8Array => {
  const path = segments.reduce((acc: Uint8Array, segment) => {
    if (segment instanceof Uint8Array) {
      return joinBytes([acc, segment]);
    } else {
      return joinBytes([acc, segment.encode(false)]);
    }
  }, new Uint8Array());

  if (length) {
    const lenBytes = encodeUint(Math.floor(path.length / 2), 1);
    const lenArray = padLength ? new Uint8Array([...lenBytes, 0]) : lenBytes;
    return new Uint8Array([...lenArray, ...path]);
  }

  return path;
};
