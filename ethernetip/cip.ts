import { logs } from "../log.ts";
import { cycle } from "../utils/cycle.ts";
import { bufferToHex, joinBytes } from "./bits.ts";
import {
  CONTEXT,
  MESSAGE_ROUTER_PATH,
  PRIORITY,
  PROTOCOL_VERSION,
  TIMEOUT_MULTIPLIER,
  TIMEOUT_TICKS,
  TRANSPORT_CLASS,
} from "./constants.ts";
import { getRandomBytes } from "./crypto.ts";
import { encodeEpath } from "./dataTypes.ts";
import { decodeUint, encodeUint } from "./encode.ts";
import { classCode, connectionManagerInstances } from "./objectLibrary.ts";
import { sendRequest } from "./request.ts";
import { connectionManager } from "./services.ts";
const { eip: log } = logs;

export type Cip = {
  socket: Deno.TcpConn;
  targetCid: Uint8Array | null;
  targetIsConnected: boolean;
  session: Uint8Array;
  context: Uint8Array;
  option: number;
  sequence: {
    current: () => number;
    next: () => number;
  };
  protocolVersion: Uint8Array;
  extendedForwardOpen: boolean;
  cid: Uint8Array;
  csn: Uint8Array;
  vid: Uint8Array;
  vsn: Uint8Array;
};

const registerSession = (cip: Cip) => sendRequest(cip, "registerSession");
const unregisterSession = (cip: Cip) => sendRequest(cip, "unregisterSession");
const listIdentity = (cip: Cip) => sendRequest(cip, "listIdentity");
const getConnectionSize = (cip: Cip) => cip.extendedForwardOpen ? 4000 : 500;

const forwardOpen = async (cip: Cip) => {
  if (cip.targetIsConnected) return true;
  const initNetParam = 0b0100001000000000;
  const netParams = cip.extendedForwardOpen
    ? encodeUint((getConnectionSize(cip) & 0xFFFF) | initNetParam << 16, 4)
    : encodeUint((getConnectionSize(cip) & 0x01FF) | initNetParam, 2);
  const routePath = encodeEpath(MESSAGE_ROUTER_PATH, true);
  const service = cip.extendedForwardOpen
    ? connectionManager.largeForwardOpen
    : connectionManager.forwardOpen;
  const message = [
    PRIORITY,
    TIMEOUT_TICKS,
    new Uint8Array([0x00, 0x00, 0x00, 0x00]),
    cip.cid,
    cip.csn,
    cip.vid,
    cip.vsn,
    TIMEOUT_MULTIPLIER,
    new Uint8Array([0x00, 0x00, 0x00]),
    new Uint8Array([0x01, 0x40, 0x20, 0x00]),
    netParams,
    new Uint8Array([0x01, 0x40, 0x20, 0x00]),
    netParams,
    TRANSPORT_CLASS,
  ];
  const response = await sendRequest(cip, "genericUnconnectedRequest", {
    service,
    routePath,
    classCode: classCode.connectionManager,
    instance: connectionManagerInstances.open_request,
    requestData: joinBytes(message),
  });
  cip.targetCid = response.data.subarray(0, 4);
  log.info(
    `Received target CID from forward open: ${
      bufferToHex(cip.targetCid || new Uint8Array())
    }`,
  );
  cip.targetIsConnected = true;
  return response;
};

const forwardClose = async (cip: Cip) => {
  const routePath = encodeEpath(MESSAGE_ROUTER_PATH, true);
  const message = [
    PRIORITY,
    TIMEOUT_TICKS,
    cip.csn,
    cip.vid,
    cip.vsn,
  ];
  const response = await sendRequest(cip, "genericUnconnectedRequest", {
    service: connectionManager.forwardClose,
    routePath,
    classCode: classCode.connectionManager,
    instance: connectionManagerInstances.open_request,
    requestData: joinBytes(message),
  });
  log.info(`Forward close completed.`);
  cip.targetIsConnected = false;
  return response;
};

export const createCip = async (ip: string, port: number) => {
  const socket = await createSocket(ip, port);
  const cip = {
    socket,
    targetCid: null,
    targetIsConnected: false,
    session: encodeUint(0, 4),
    context: CONTEXT,
    protocolVersion: PROTOCOL_VERSION,
    option: 0,
    sequence: cycle(65535, 1),
    extendedForwardOpen: true,
    cid: getRandomBytes(4),
    csn: new Uint8Array([0x27, 0x04]),
    vid: new Uint8Array([0x09, 0x10]),
    vsn: getRandomBytes(4),
  };
  const { session } = await registerSession(cip);
  log.info(`Registered session: ${decodeUint(session)}`);
  cip.session = session;
  await forwardOpen(cip);
  const identity = await listIdentity(cip);
  log.info(
    `Partner identified as ${
      Object.entries({
        ...identity,
      }).filter(([k]) =>
        [
          "vendor",
          "productType",
          "productName",
        ].includes(
          k,
        )
      ).map(([k, v]) => `${v}`).join(", ")
    }`,
  );
  return cip;
};

export const destroyCip = async (
  cip: Awaited<ReturnType<typeof createCip>>,
) => {
  await forwardClose(cip);
  await unregisterSession(cip);
  log.info(`Unregistered session: ${decodeUint(cip.session)}`);
  cip.session = new Uint8Array([0x00]);
  closeSocket(cip.socket);
};
const createSocket = async (ip: string, port: number) => {
  return await Deno.connect({
    hostname: ip,
    port,
    transport: "tcp",
  })
    .then((conn) => {
      log.info(`Connected to ${ip}:${port}`);
      return conn;
    });
};

const closeSocket = (socket: Deno.TcpConn) => {
  socket.close();
  log.info(
    `Closed connection to ${socket.remoteAddr.hostname}:${socket.remoteAddr.port}`,
  );
};
