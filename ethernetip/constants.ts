import { createLogicalSegment } from "./dataTypes.ts";
import { encodeString, encodeUint } from "./encode.ts";
import { classCode } from "./objectLibrary.ts";

export const IPV4LENGTH = 32;
export const IPV6LENGTH = 128;

export const MESSAGE_ROUTER_PATH = [
  createLogicalSegment(classCode.messageRouter, "classId"),
  createLogicalSegment(new Uint8Array([0x01]), "instanceId"),
];

export const PRIORITY = new Uint8Array([0x0a]);
export const TIMEOUT_TICKS = new Uint8Array([0x05]);
export const TIMEOUT_MULTIPLIER = new Uint8Array([0x07]);
export const TRANSPORT_CLASS = new Uint8Array([0xa3]);

export const PROTOCOL_VERSION = encodeUint(1, 2);

export const CONTEXT = encodeString("_sonar__");
