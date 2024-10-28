import { pipe } from "../../../utils/pipe.ts";
import { joinBytes } from "../../bits.ts";
import type { Cip } from "../../cip.ts";
import { CONTEXT } from "../../constants.ts";
import { decodeUint, encodeString, encodeUint } from "../../encode.ts";
import { encapsulation } from "../../services.ts";
import { readResponse } from "../response/response.ts";

const dataItem = {
  connected: new Uint8Array([0xb1, 0x00]),
  unconnected: new Uint8Array([0xb2, 0x00]),
};

const addressItem = {
  connection: new Uint8Array([0xa1, 0x00]),
  null: new Uint8Array([0x00, 0x00]),
  uccm: new Uint8Array([0x00, 0x00]),
};

export type BuildCommonPacketFormatArgs = {
  timeout: Uint8Array;
  addressType: Uint8Array | null;
  message: Uint8Array;
  messageType: Uint8Array | null;
  addressData: Uint8Array | null;
};

export const buildHeader = ({
  command,
  session,
  context,
  option,
  length,
}: BuildHeaderArgs) => {
  return joinBytes([
    command,
    encodeUint(length, 2), //message length
    encodeUint(session, 4),
    new Uint8Array([0x00, 0x00, 0x00, 0x00]),
    context,
    encodeUint(option, 4),
  ]);
};

export const buildCommonPacketFormat = ({
  timeout,
  addressType,
  message,
  messageType,
  addressData,
}: BuildCommonPacketFormatArgs) =>
  joinBytes([
    encodeUint(0, 4),
    timeout,
    encodeUint(2, 2), //item count
    addressType || new Uint8Array(),
    addressData
      ? joinBytes([encodeUint(addressData.length, 2), addressData])
      : new Uint8Array([0x00, 0x00]),
    messageType || new Uint8Array(),
    encodeUint(message.length, 2), //message length
    message,
  ]);

export const buildMessage = ({
  message = [],
  added = [],
}: BuildMessageArgs) => {
  return joinBytes([
    ...message,
    ...added,
  ]);
};

export const parseReply = (raw: Uint8Array): Record<string, Uint8Array> => {
  const command = raw.subarray(0, 2);
  const commandStatus = raw.subarray(8, 12);
  return {
    command,
    commandStatus,
  };
};

type PacketRequestCommon = {
  timeout: Uint8Array;
  buildHeader: typeof buildHeader;
  buildCommonPacketFormat: typeof buildCommonPacketFormat;
  buildMessage: typeof buildMessage;
  parseReply: typeof parseReply;
};

const packetRequestCommon: PacketRequestCommon = {
  timeout: new Uint8Array([0x0a, 0x00]),
  buildHeader,
  buildCommonPacketFormat,
  buildMessage,
  parseReply,
};

type PacketRequestInstance = {
  messageType: Uint8Array | null;
  addressType: Uint8Array | null;
  encapCommand: Uint8Array;
  buildCommonPacketFormat?: typeof buildCommonPacketFormat;
  buildMessage?: (
    { cip, message, added }: {
      cip: Cip;
      message: Uint8Array[];
      added: Uint8Array[];
    },
  ) => Uint8Array[];
  parseReply?: typeof parseReply;
};

const packetRequestInstances: Record<string, PacketRequestInstance> = {
  sendUnitData: {
    messageType: dataItem.connected,
    addressType: addressItem.connection,
    encapCommand: encapsulation.sendUnitData,
    buildMessage: ({ cip, message, added }) => {
      return [
        buildMessage({ message, added }),
        encodeUint(cip.sequence.next().value, 2),
      ];
    },
  },
  sendRRData: {
    messageType: dataItem.unconnected,
    addressType: addressItem.uccm,
    encapCommand: encapsulation.sendRRData,
  },
  registerSession: {
    messageType: null,
    addressType: null,
    encapCommand: encapsulation.registerSession,
    buildCommonPacketFormat: ({ message }) => message,
    buildMessage: ({
      cip,
    }) => [cip.protocolVersion, new Uint8Array([0x00, 0x00])],
    parseReply: (raw: Uint8Array) => {
      // const base = baseParseReply(raw); - - - may not be needed
      const session = raw.slice(4, 8);
      return { session };
    },
  },
  unregisterSession: {
    messageType: null,
    addressType: null,
    encapCommand: encapsulation.unregisterSession,
    buildCommonPacketFormat: () => new Uint8Array(),
  },
  listIdentity: {
    messageType: null,
    addressType: null,
    encapCommand: encapsulation.listIdentity,
    buildCommonPacketFormat: () => new Uint8Array(),
  },
} as const; // Add 'as const' to preserve literal types

// Infer the type from the instances
type PacketRequestType = keyof typeof packetRequestInstances;
type PacketRequest = PacketRequestCommon & PacketRequestInstance;

// Create merged packets with inferred key type
const packetRequest: Record<PacketRequestType, PacketRequest> = Object
  .fromEntries(
    Object.entries(packetRequestInstances).map(([key, instance]) => [
      key,
      { ...packetRequestCommon, ...instance },
    ]),
  ) as Record<PacketRequestType, PacketRequest>;

export type BuildHeaderArgs = {
  command: Uint8Array;
  session: number;
  context: Uint8Array;
  option: number;
  length: number;
};

export type BuildMessageArgs = {
  message: Uint8Array[];
  added: Uint8Array[];
};

export const appendPacket = <T extends (...args: Parameters<T>) => Uint8Array>(
  func: T,
  ...args: Parameters<T>
) =>
(input: Uint8Array) => joinBytes([input, func(...args)]);

export const prependPacket = <T extends (...args: Parameters<T>) => Uint8Array>(
  func: T,
  ...args: Parameters<T>
) =>
(input: Uint8Array) => joinBytes([func(...args), input]);

export type BuildRequestArgs = {
  packetRequest: PacketRequest;
  cip: Cip;
  message?: Uint8Array[];
  added?: Uint8Array[];
  addressData?: Uint8Array;
};

export const buildRequest = ({
  cip,
  packetRequest,
  message = [],
  added = [],
}: BuildRequestArgs) =>
  pipe(
    new Uint8Array(),
    appendPacket(
      packetRequest.buildCommonPacketFormat,
      {
        timeout: packetRequest.timeout,
        addressType: packetRequest.addressType,
        message: joinBytes(packetRequest.buildMessage({ cip, message, added })),
        messageType: packetRequest.messageType,
        addressData: cip.targetCid,
      },
    ),
    (input: Uint8Array) =>
      prependPacket(
        packetRequest.buildHeader,
        {
          command: packetRequest.encapCommand,
          session: cip.session,
          context: cip.context,
          option: cip.option,
          length: input.length,
        },
      )(input),
  );

export const sendRequest = async (
  cip: Cip,
  packetRequestKey: keyof typeof packetRequest,
) => {
  const request = buildRequest({
    cip,
    packetRequest: packetRequest[packetRequestKey],
  });
  cip.socket.write(request);
  return packetRequest[packetRequestKey].parseReply(
    await readResponse(cip.socket),
  );
};
