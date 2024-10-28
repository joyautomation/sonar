import { createLogger, LogLevel } from "@joyautomation/coral";

export const logs = {
  eip: createLogger("sonar eip", LogLevel.debug),
  modbusTcp: createLogger("sonar modbus", LogLevel.debug),
};
