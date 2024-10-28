import { encodeEpath } from "./dataTypes.ts";
import { createLogicalSegment } from "./dataTypes.ts";

export const wrapUnconnectedSend = (message: Uint8Array) => {
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
  if (attribute) {
    segments.push(createLogicalSegment(attribute, "attributeId"));
  }
  return encodeEpath(segments, true);
};
