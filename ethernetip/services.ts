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

const serviceEntries = {
  get_attributes_all: [0x01],
  set_attributes_all: [0x02],
  get_attribute_list: [0x03],
  set_attribute_list: [0x04],
  reset: [0x05],
  start: [0x06],
  stop: [0x07],
  create: [0x08],
  delete: [0x09],
  multiple_service_request: [0x0A],
  apply_attributes: [0x0D],
  get_attribute_single: [0x0E],
  set_attribute_single: [0x10],
  find_next_object_instance: [0x11],
  error_response: [0x14],
  restore: [0x15],
  save: [0x16],
  nop: [0x17],
  get_member: [0x18],
  set_member: [0x19],
  insert_member: [0x1A],
  remove_member: [0x1B],
  group_sync: [0x1C],
  // Rockwell Custom Services
  read_tag: [0x4C],
  read_tag_fragmented: [0x52],
  write_tag: [0x4D],
  write_tag_fragmented: [0x53],
  read_modify_write: [0x4E],
  get_instance_attribute_list: [0x55],
};

export const service = createService(serviceEntries);
