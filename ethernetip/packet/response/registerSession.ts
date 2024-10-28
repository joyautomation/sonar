import { decodeUint } from "../../encode.ts";

export const parseReply = (raw: Uint8Array) => {
  // const base = baseParseReply(raw); - - - may not be needed
  const session = decodeUint(raw.slice(4, 8));
  return session;
};
