import { encodeEpath } from "../dataTypes.ts";
import { encodeUint } from "../encode.ts";
import { MESSAGE_ROUTER_PATH } from "../constants.ts";
import { connectionManager } from "../services.ts";
import { PRIORITY } from "../constants.ts";
import { TIMEOUT_TICKS } from "../constants.ts";
import { getRandomBytes } from "../crypto.ts";
import { TIMEOUT_MULTIPLIER } from "../constants.ts";
import { TRANSPORT_CLASS } from "../constants.ts";
import { joinBytes } from "../bits.ts";
import { genericMessage } from "./genericMessage.ts";

type ForwardOpenArgs = {
  socket: Deno.TcpConn;
  session: number;
  cid: Uint8Array;
  csn: Uint8Array;
  vid: Uint8Array;
  vsn: Uint8Array;
  extended: boolean;
};

export const forwardOpen = async (
  {
    socket,
    session,
    cid = getRandomBytes(4),
    csn = new Uint8Array([0x27, 0x04]),
    vid = new Uint8Array([0x09, 0x10]),
    vsn = new Uint8Array([0x00, 0x00, 0x00, 0x00]),
    extended = true,
  }: ForwardOpenArgs,
) => {
  const connectionSize = extended ? 4000 : 500;
  const initNetParams = 0b0100001000000000;
  const netParams = extended
    ? encodeUint(connectionSize & 0xffff | initNetParams << 16, 4)
    : encodeUint(connectionSize & 0x01ff | initNetParams, 2);
  const routePath = encodeEpath(MESSAGE_ROUTER_PATH, true);
  const service = extended
    ? connectionManager.forwardOpen
    : connectionManager.largeForwardOpen;
  const message = joinBytes([
    PRIORITY,
    TIMEOUT_TICKS,
    new Uint8Array([0x00, 0x00, 0x00, 0x00]), // O->T produced connection ID, not needed for us so leave blank
    cid,
    csn,
    vid,
    vsn,
    TIMEOUT_MULTIPLIER,
    new Uint8Array([0x00, 0x00, 0x00]), // reserved
    new Uint8Array([0x01, 0x40, 0x20, 0x00]), // O->T RPI in microseconds, RPIs are not important for us so fixed value is fine
    netParams,
    new Uint8Array([0x01, 0x40, 0x20, 0x00]), // T->O RPI
    netParams,
    TRANSPORT_CLASS,
  ]);
  const response = await genericMessage({
    socket,
    service,
    classCode: new Uint8Array([0x06, 0x00]),
    instance: new Uint8Array([0x00, 0x00]),
    attribute: new Uint8Array(),
    requestData: message,
    sequence: 0,
  });
  console.log(response);
  return response;
};
