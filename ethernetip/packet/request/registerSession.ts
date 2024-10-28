import { logs } from "../../../log.ts";
const { eip: log } = logs;
import { pipe } from "../../../utils/pipe.ts";
import { PROTOCOL_VERSION } from "../../constants.ts";
import { encodeString } from "../../encode.ts";
import { encapsulation } from "../../services.ts";
import { parseReply } from "../response/registerSession.ts";
import {
  appendPacket,
  buildHeader,
  buildMessage,
  prependPacket,
  sendRequest,
} from "./request.ts";

const buildCommonPacketFormat = (
  message: Uint8Array,
) => message;

export const buildRequest = (
  command: Uint8Array,
  option: number = 0,
  sessionId: number = 0,
  context: Uint8Array = encodeString("_sonar__"),
  message: Uint8Array[] = [PROTOCOL_VERSION, new Uint8Array([0x00, 0x00])],
  added: Uint8Array[] = [],
) =>
  pipe(
    new Uint8Array(),
    appendPacket(
      buildCommonPacketFormat,
      buildMessage({ message, added }),
    ),
    (input: Uint8Array) =>
      prependPacket(
        buildHeader,
        {
          command,
          session,
          context,
          option,
          length: input.length,
        },
      )(input),
  );

export const registerSession = async (socket: Deno.TcpConn) => {
  const request = buildRequest(encapsulation.registerSession);
  log.info(`Requested register session`);
  const response = await sendRequest(socket, request);
  const session = parseReply(response);
  log.info(`Received register session response: ${session}`);
  return session;
};
