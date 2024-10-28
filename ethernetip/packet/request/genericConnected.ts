import { encodeUint } from "../../encode.ts";
import { logs } from "../../../log.ts";
const { eip: log } = logs;
import { buildRequestPath } from "../../util.ts";
import {
  buildRequest as baseBuildRequest,
  type BuildRequestArgs,
  sendRequest,
} from "./request.ts";
import { parseReply } from "../response/response.ts";

type GenericMessageBuildRequestArgs = {
  sequence: number;
  service: Uint8Array;
  classCode: Uint8Array;
  instance: Uint8Array;
  attribute: Uint8Array;
  requestData: Uint8Array;
};

export const buildRequest = (
  { sequence, service, classCode, instance, attribute, requestData, ...args }:
    & GenericMessageBuildRequestArgs
    & BuildRequestArgs,
) => {
  return baseBuildRequest({
    ...args,
    message: [
      ...(args.message || []),
      encodeUint(sequence, 2),
      service,
      buildRequestPath(classCode, instance, attribute),
      requestData,
    ],
  });
};

export const genericConnectedSend = async (
  socket: Deno.TcpConn,
  args: GenericMessageBuildRequestArgs & BuildRequestArgs,
) => {
  log.info(`Generic connected send initiated`);
  const response = await sendRequest(socket, buildRequest, [args]);
  const session = parseReply(response);
  log.info(`Received register session response: ${session}`);
  return session;
};
