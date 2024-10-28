import type { CIPSegment, DataType } from "../dataTypes.ts";
import { genericConnectedSend } from "../packet/request/genericConnected.ts";
import { encapsulation } from "../services.ts";

type GenericMessageArgs = {
  socket: Deno.TcpConn;
  service: Uint8Array;
  classCode: Uint8Array;
  instance: Uint8Array;
  sequence: number;
  attribute: Uint8Array;
  requestData: Uint8Array;
  dataType?: DataType | null;
  name?: string;
  connected?: boolean;
  unconnectedSend?: boolean;
  routePath?: CIPSegment[];
};

export const genericMessage = ({
  socket,
  service,
  classCode,
  instance,
  sequence,
  attribute = new Uint8Array(),
  requestData = new Uint8Array(),
  dataType = null,
  name = "generic",
  connected = true,
  unconnectedSend = false,
  routePath = [],
}: GenericMessageArgs) =>
  genericConnectedSend(socket, {
    sequence,
    service,
    classCode,
    instance,
    attribute,
    requestData,
    option: 0,
    command: encapsulation.sendUnitData,
  });
