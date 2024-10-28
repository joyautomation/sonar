const DEVICE_IP = "192.168.50.133"; // Replace with your device's IP address
const DEVICE_PORT = 44818; // Standard TCP port for Ethernet/IP communication
const UDP_PORT = 2222; // Standard port for Class 1 I/O messaging
const TARGET_UDP_PORT = 2222; // Target device's UDP port for Class 1 I/O messaging

// Ethernet/IP encapsulation commands
const ENCAP_COMMAND_REGISTER_SESSION = 0x0065;
const ENCAP_COMMAND_UNREGISTER_SESSION = 0x0066;
const ENCAP_COMMAND_FORWARD_OPEN = 0x006F; // Command to open implicit Class 1 communication

// Utility to create an encapsulation header
function createEncapHeader(
  command: number,
  length: number,
  session: number = 0x0000,
  context: Uint8Array = new Uint8Array(8),
): Uint8Array {
  const header = new Uint8Array(24);
  const dataView = new DataView(header.buffer);

  dataView.setUint16(0, command, true); // Command
  dataView.setUint16(2, length, true); // Length
  dataView.setUint32(4, session, true); // Session Handle
  dataView.setUint32(8, 0x00000000, true); // Status (0 for new request)
  header.set(context, 12); // Sender Context (8 bytes)
  dataView.setUint32(20, 0x00000000, true); // Options (0x00000000)

  return header;
}

// CIP Forward Open request
const forwardOpenRequest = new Uint8Array([
  0x54,
  0x00,
  0x00,
  0x00, // Command: ForwardOpen (example, modify as per your assembly)
  // ... rest of the ForwardOpen request to configure I/O communication
]);

async function connectToDevice() {
  const conn = await Deno.connect({ hostname: DEVICE_IP, port: DEVICE_PORT });
  return conn;
}

async function registerSession(conn: Deno.Conn): Promise<number> {
  const registerSessionRequest = new Uint8Array([
    0x01,
    0x00, // Protocol version
    0x00,
    0x00, // Options flag (always 0)
  ]);

  // Send Register Session command
  const header = createEncapHeader(
    ENCAP_COMMAND_REGISTER_SESSION,
    registerSessionRequest.length,
  );
  await conn.write(new Uint8Array([...header, ...registerSessionRequest]));
  console.log("Register session request sent");

  // Receive response
  const response = new Uint8Array(1024);
  const bytesRead = await conn.read(response);
  if (bytesRead === null) {
    throw new Error("No response from device during RegisterSession");
  }

  // Parse session handle from response (bytes 4-7)
  const sessionHandle = new DataView(response.buffer).getUint32(4, true);
  console.log(`Session handle: 0x${sessionHandle.toString(16)}`);
  return sessionHandle;
}

async function forwardOpen(conn: Deno.Conn, sessionHandle: number) {
  // Send Forward Open Request for Class 1 communication
  const header = createEncapHeader(
    ENCAP_COMMAND_FORWARD_OPEN,
    forwardOpenRequest.length,
    sessionHandle,
  );
  await conn.write(new Uint8Array([...header, ...forwardOpenRequest]));
  console.log("Forward Open request sent");

  // Receive response
  const response = new Uint8Array(1024);
  const bytesRead = await conn.read(response);
  if (bytesRead === null) {
    throw new Error("No response from device during ForwardOpen");
  }

  // Parse and display the response (e.g., parse connection ID, status, etc.)
  console.log(
    "Forward Open response:",
    new Uint8Array(response.slice(0, bytesRead)),
  );
}

async function startClass1Communication() {
  // Listen for UDP datagrams (I/O data) on a specific port
  const socket = Deno.listenDatagram({
    port: UDP_PORT,
    transport: "udp",
    hostname: "0.0.0.0",
  });

  console.log(`Listening for Class 1 I/O messages on port ${UDP_PORT}...`);

  for await (const [data, remote] of socket) {
    console.log(`Received data from ${remote.hostname}:${remote.port}`);
    console.log(new Uint8Array(data));
  }
}

async function sendClass1OutputData() {
  // Send cyclic UDP I/O data to the device
  const socket = await Deno.connectDatagram({
    transport: "udp",
    hostname: DEVICE_IP,
    port: TARGET_UDP_PORT,
  });

  const outputData = new Uint8Array([/* cyclic I/O data for the device */]);

  // Send data cyclically to the device
  while (true) {
    await socket.send(outputData);
    console.log("Sent cyclic I/O data");
    await new Promise((resolve) => setTimeout(resolve, 1000)); // 1 second cycle
  }
}

async function unregisterSession(conn: Deno.Conn, sessionHandle: number) {
  // Send Unregister Session command
  const header = createEncapHeader(
    ENCAP_COMMAND_UNREGISTER_SESSION,
    0,
    sessionHandle,
  );
  await conn.write(header);
  console.log("Session unregistered");
}

async function main() {
  const conn = await connectToDevice();
  try {
    // Step 1: Register a session
    const sessionHandle = await registerSession(conn);

    // Step 2: Send a Forward Open request to initiate Class 1 (implicit) communication
    await forwardOpen(conn, sessionHandle);

    // Step 3: Start listening for incoming UDP data from the device (cyclic real-time I/O)
    startClass1Communication();

    // Step 4: Optionally, send output data cyclically to the device
    sendClass1OutputData();

    // Optional: Unregister the session after completing the communication
    // await unregisterSession(conn, sessionHandle);
  } catch (error) {
    console.error("Error:", error);
  } finally {
    conn.close();
  }
}

main();
