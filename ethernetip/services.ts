const createService = <T extends Record<string, number[]>>(
  entries: T,
): { [K in keyof T]: Uint8Array } =>
  Object.fromEntries(
    Object.entries(entries).map(([key, value]) => [key, new Uint8Array(value)]),
  ) as { [K in keyof T]: Uint8Array };

const encapsulationEntries = {
  nop: [0x00, 0x00],
  listTargets: [0x01, 0x00],
  listServices: [0x04, 0x00],
  listIdentity: [0x63, 0x00],
  listInterfaces: [0x64, 0x00],
  registerSession: [0x65, 0x00],
  unregisterSession: [0x66, 0x00],
  sendRRData: [0x6F, 0x00],
  sendUnitData: [0x70, 0x00],
};

export const encapsulation = createService<typeof encapsulationEntries>(
  encapsulationEntries,
);

const connectionManagerEntries = {
  forwardClose: [0x4E],
  unconnectedSend: [0x52],
  forwardOpen: [0x54],
  getConnectionData: [0x56],
  searchConnectionData: [0x57],
  getConnectionOwner: [0x5A],
  largeForwardOpen: [0x5B],
};

export const connectionManager = createService(connectionManagerEntries);
