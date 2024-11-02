import { pipe } from "../utils/pipe.ts";
import { bufferToHex } from "./bits.ts";
import { joinBytes } from "./bits.ts";
import type { Cip } from "./cip.ts";
import { decodeUint, encodeUint } from "./encode.ts";
import { encapsulation } from "./services.ts";
import { buildRequestPath, wrapUnconnectedSend } from "./util.ts";

const readResponse = (socket: Deno.Conn): Promise<Uint8Array> => {
  return new Promise((resolve, reject) => {
    const buffer = new Uint8Array(1024);
    socket.read(buffer).then((bytesRead) => {
      if (bytesRead === null) {
        reject(new Error("Connection closed"));
        return;
      }
      const response = buffer.subarray(0, bytesRead);
      console.log("reply", bufferToHex(response));
      resolve(response);
    }).catch((error) => {
      reject(error);
    });
  });
};

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
  const header = joinBytes([
    command,
    encodeUint(length, 2), //message length
    session,
    new Uint8Array([0x00, 0x00, 0x00, 0x00]),
    context,
    encodeUint(option, 4),
  ]);
  return header;
};

export const buildCommonPacketFormat = ({
  timeout,
  addressType,
  message,
  messageType,
  addressData,
}: BuildCommonPacketFormatArgs) => {
  const result = joinBytes([
    new Uint8Array([0x00, 0x00, 0x00, 0x00]),
    timeout,
    new Uint8Array([0x02, 0x00]), //item count
    addressType || new Uint8Array(),
    addressData
      ? joinBytes([encodeUint(addressData.length, 2), addressData])
      : new Uint8Array([0x00, 0x00]),
    messageType || new Uint8Array(),
    encodeUint(message.length, 2), //message length
    message,
  ]);
  return result;
};

export const buildMessage = ({
  message = [],
  added = [],
}: BuildMessageArgs) => {
  return [
    ...message,
    ...added,
  ];
};

export const parseReply = (raw: Uint8Array): Record<string, any> => {
  const command = raw.subarray(0, 2);
  const commandStatus = decodeUint(raw.subarray(8, 12));
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
    {
      cip,
      message,
      added,
    }: {
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
      // cip.sequence.next();
      const result = [
        ...buildMessage({ message, added }),
        encodeUint(cip.sequence.current(), 2),
      ];
      return result;
    },
    parseReply: (raw: Uint8Array) => {
      const result = {
        ...parseReply(raw),
        service: raw.subarray(46, 47),
        serviceStatus: decodeUint(raw.subarray(48, 49)),
        data: raw.subarray(50),
      };
      return result;
    },
  },
  sendRRData: {
    messageType: dataItem.unconnected,
    addressType: addressItem.uccm,
    encapCommand: encapsulation.sendRRData,
    parseReply: (raw: Uint8Array) => {
      const result = {
        ...parseReply(raw),
        service: raw.subarray(40, 41),
        serviceStatus: decodeUint(raw.subarray(42, 43)),
        data: raw.subarray(44),
      };
      return result;
    },
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
      console.log("parseReply", typeof raw);
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

type EthernetipRequestInstance = Omit<PacketRequest, "buildMessage"> & {
  buildMessage: (args: {
    cip: Cip;
    message: Uint8Array[];
    added: Uint8Array[];
    dataType: Uint8Array;
    classCode: Uint8Array;
    instance: Uint8Array;
    attribute: Uint8Array;
    service: Uint8Array;
    requestData: Uint8Array;
    routePath: Uint8Array;
    unconnectedSend: boolean;
  }) => Uint8Array[];
};

const ethernetipRequestInstances: Record<string, EthernetipRequestInstance> = {
  genericConnectedRequest: {
    ...packetRequest.sendUnitData,
    buildMessage: (
      {
        cip,
        service,
        message,
        added,
        classCode,
        instance,
        attribute = new Uint8Array(),
        requestData = new Uint8Array(),
      },
    ) => {
      const baseMessage = packetRequest.sendUnitData.buildMessage({
        cip,
        message,
        added,
      });
      const requestPath = buildRequestPath(classCode, instance, attribute);
      const parts = [
        ...message,
        ...baseMessage,
        service,
        requestPath,
        requestData,
      ];
      return parts;
    },
  },
  genericUnconnectedRequest: {
    ...packetRequest.sendRRData,
    buildMessage: (
      {
        cip,
        service,
        message,
        added,
        classCode,
        instance,
        attribute = new Uint8Array(),
        requestData = new Uint8Array(),
        routePath = new Uint8Array(),
        unconnectedSend = false,
      },
    ) => {
      const requestPath = buildRequestPath(classCode, instance, attribute);
      const baseMessage = packetRequest.sendRRData.buildMessage({
        cip,
        message,
        added,
      });
      if (unconnectedSend) {
        wrapUnconnectedSend(
          joinBytes([
            service,
            requestPath,
            requestData,
          ]),
          routePath,
        );
      } else {
        return [
          ...message,
          ...baseMessage,
          service,
          requestPath,
          requestData,
          routePath,
        ];
      }
      return [...message, ...added];
    },
  },
};

export const requests: Record<
  string,
  PacketRequest | EthernetipRequestInstance
> = {
  ...packetRequest,
  ...ethernetipRequestInstances,
};

export type BuildHeaderArgs = {
  command: Uint8Array;
  session: Uint8Array;
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
  packetRequest: PacketRequest | EthernetipRequestInstance;
  cip: Cip;
  message?: Uint8Array[];
  added?: Uint8Array[];
  addressData?: Uint8Array;
  dataType?: Uint8Array;
  classCode?: Uint8Array;
  instance?: Uint8Array;
  attribute?: Uint8Array;
  service?: Uint8Array;
  requestData?: Uint8Array;
  routePath?: Uint8Array;
  unconnectedSend?: boolean;
};

export const buildRequest = ({
  cip,
  packetRequest,
  message = [],
  added = [],
  dataType = new Uint8Array(),
  classCode = new Uint8Array(),
  instance = new Uint8Array(),
  attribute = new Uint8Array(),
  service = new Uint8Array(),
  requestData = new Uint8Array(),
  routePath = new Uint8Array(),
  unconnectedSend = false,
}: BuildRequestArgs) =>
  pipe(
    new Uint8Array(),
    (input: Uint8Array) => {
      return appendPacket(
        packetRequest.buildCommonPacketFormat,
        {
          timeout: packetRequest.timeout,
          addressType: packetRequest.addressType,
          message: joinBytes(packetRequest.buildMessage({
            cip,
            message,
            added,
            dataType,
            classCode,
            instance,
            attribute,
            service,
            requestData,
            routePath,
            unconnectedSend,
          })),
          messageType: packetRequest.messageType,
          addressData: cip.targetCid,
        },
      )(input);
    },
    (input: Uint8Array) => {
      const result = prependPacket(
        packetRequest.buildHeader,
        {
          command: packetRequest.encapCommand,
          session: cip.session,
          context: cip.context,
          option: cip.option,
          length: input.length,
        },
      )(input);
      return result;
    },
  );

export const sendRequest = async (
  cip: Cip,
  packetRequestKey: keyof typeof requests,
  options?: Partial<BuildRequestArgs>,
) => {
  const request = buildRequest({
    cip,
    packetRequest: requests[packetRequestKey],
    ...(options || {}),
  });
  cip.socket.write(request);
  const result = readResponse(cip.socket).then((reply) => {
    return requests[packetRequestKey].parseReply(reply);
  });
  return await result;
};
