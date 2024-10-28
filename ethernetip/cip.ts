import { logs } from "../log.ts";
import { cycle } from "../utils/cycle.ts";
import { CONTEXT, PROTOCOL_VERSION } from "./constants.ts";
import { decodeUint } from "./encode.ts";
import { sendRequest } from "./packet/request/request.ts";
const { eip: log } = logs;

export type Cip = {
  socket: Deno.TcpConn;
  targetCid: Uint8Array | null;
  session: number;
  context: Uint8Array;
  option: number;
  sequence: Generator<number>;
  protocolVersion: Uint8Array;
};

const createCip = async (ip: string, port: number) => {
  const socket = await createSocket(ip, port);
  const cip = {
    socket,
    targetCid: null,
    session: 0,
    context: CONTEXT,
    protocolVersion: PROTOCOL_VERSION,
    option: 0,
    sequence: cycle(65535, 1),
  };
  const { session } = await sendRequest(cip, "registerSession");
  log.info(`Received session: ${decodeUint(session)}`);
  return cip;
};

const destroyCip = (cip: Awaited<ReturnType<typeof createCip>>) => {
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

const cip = await createCip("10.3.37.143", 44818);
destroyCip(cip);
