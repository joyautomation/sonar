type Cip = {
  ip: string;
  port: number;
  path: PortSegment[];
  connected: boolean;
  connection: Deno.Conn;
};

type PortSegment = {};

type MessageInput = {
  service: number;
  class_code: number;
  instance: number;
  attribute: number;
};

export const createCip = async (
  ip: string,
  port: number = 44818,
  path: PortSegment[] = [],
): Promise<Cip> => {
  return {
    ip,
    port,
    path,
    connected: true,
    connection,
  };
};

function* cycle(stop: number, start: number = 0): Generator<number> {
  let val: number = start;
  while (true) {
    if (val > stop) {
      val = start;
    }
    yield val;
    val += 1;
  }
}

export const message = (cip: Cip, {
  service,
  class_code,
  instance,
  attribute,
}: MessageInput, connected = true) => {
  const config = {
    context: "_pycomm_",
    protocolVersion: "\x01\x00",
    rpi: 5000,
    port: cip.port || 44818,
    timeout: 10,
    ipaddress: cip.ip,
    cipPath: cip.path,
    option: 0,
    cid: "\x27\x04\x19\x71",
    csn: "\x27\x04",
    vid: "\x09\x10",
    vsn: "\x09\x10\x19\x71",
    extendedForwardOpen: true,
    connectionSize: 4000,
    socketTimeout: 5.0,
  };
};

message(await createCip("192.168.1.100"), {
  service: 0x0E,
  class_code: 4,
  instance: 101,
  attribute: 3,
});
