import { bufferToHex, joinBytes } from "./bits.ts";
import { PRIORITY, TIMEOUT_TICKS } from "./constants.ts";
import { encodeEpath } from "./dataTypes.ts";
import { createLogicalSegment } from "./dataTypes.ts";
import { encodeUint } from "./encode.ts";
import { classCode } from "./objectLibrary.ts";
import { connectionManager } from "./services.ts";

export const wrapUnconnectedSend = (
  message: Uint8Array,
  routePath: Uint8Array,
) => {
  const requestPath = buildRequestPath(
    classCode.connectionManager,
    new Uint8Array([0x01]),
  );
  return joinBytes([
    connectionManager.unconnectedSend,
    requestPath,
    PRIORITY,
    TIMEOUT_TICKS,
    encodeUint(message.length, 2),
    message,
    message.length % 2 ? new Uint8Array([0x00]) : new Uint8Array([]),
    routePath,
  ]);
};

export const buildRequestPath = (
  classCode: Uint8Array,
  instance: Uint8Array,
  attribute?: Uint8Array,
) => {
  const segments = [
    createLogicalSegment(classCode, "classId"),
    createLogicalSegment(instance, "instanceId"),
  ];
  if (attribute && attribute.length > 0) {
    segments.push(createLogicalSegment(attribute, "attributeId"));
  }
  return encodeEpath(segments, true);
};
