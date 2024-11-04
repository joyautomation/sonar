import { bytesToFloat } from "../bits.ts";
import { createCip, destroyCip } from "../cip.ts";
import { encodeUint } from "../encode.ts";
import { service } from "../index.ts";
import { classCode } from "../objectLibrary.ts";
import { sendRequest } from "../request.ts";
import { createLogger, LogLevel } from "@joyautomation/coral";

const log = createLogger("sonar eip example", LogLevel.debug);

const cip = await createCip("10.3.37.143", 44818);
const response = await sendRequest(cip, "genericConnectedRequest", {
  service: service.get_attribute_single,
  classCode: classCode.assembly,
  instance: encodeUint(101, 2),
  attribute: new Uint8Array([0x03]),
});
log.info(`Attribute Value: ${bytesToFloat(response.data)}`);
await destroyCip(cip);
