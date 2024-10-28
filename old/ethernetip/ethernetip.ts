// Constants for Ethernet/IP (Encapsulation layer)
const ETHERNET_IP_PORT = 44818;
const ENCAPSULATION_HEADER_SIZE = 24;

// Example command codes (simplified)
const CMD_REGISTER_SESSION = 0x0065;
const CMD_UNREGISTER_SESSION = 0x0066;
const CMD_SEND_RR_DATA = 0x006F;

// Ethernet/IP Encapsulation Header structure
interface EncapsulationHeader {
  command: number;
  length: number;
  sessionHandle: number;
  status: number;
  senderContext: Uint8Array;
  options: number;
}

// A simple function to create an encapsulation header
function createEncapsulationHeader(
  command: number,
  length: number,
  sessionHandle: number = 0,
  status: number = 0,
  senderContext: Uint8Array = new Uint8Array(8),
  options: number = 0,
): Uint8Array {
  const buffer = new Uint8Array(ENCAPSULATION_HEADER_SIZE);
  const dataView = new DataView(buffer.buffer);

  dataView.setUint16(0, command, true);
  dataView.setUint16(2, length, true);
  dataView.setUint32(4, sessionHandle, true);
  dataView.setUint32(8, status, true);
  buffer.set(senderContext, 12);
  dataView.setUint32(20, options, true);

  return buffer;
}

// Class 1 Ethernet/IP driver for Deno
class EthernetIPDriver {
  private sessionHandle: number = 0;
  private conn: Deno.Conn | null = null;

  constructor(private host: string, private port: number = ETHERNET_IP_PORT) {}

  // Register session (Establish connection)
  public async registerSession(): Promise<void> {
    try {
      this.conn = await Deno.connect({ hostname: this.host, port: this.port });
      console.log("Connected to Ethernet/IP device.");

      // Create a registration packet
      const header = createEncapsulationHeader(CMD_REGISTER_SESSION, 4);
      const payload = new Uint8Array(4);
      const dataView = new DataView(payload.buffer);
      dataView.setUint16(0, 1, true); // Protocol version 1
      dataView.setUint16(2, 0, true); // Options flag

      // Send the register session request
      const packet = new Uint8Array([...header, ...payload]);

      // Log the encapsulation header and full packet before sending
      console.log("Encapsulation Header:", header);
      console.log("Full Packet Sent:", packet);

      await this.conn.write(packet);

      // Read the response
      const response = new Uint8Array(ENCAPSULATION_HEADER_SIZE);
      await this.conn.read(response);
      const responseDataView = new DataView(response.buffer);
      this.sessionHandle = responseDataView.getUint32(4, true); // Extract session handle from response

      console.log("Session registered with handle:", this.sessionHandle);
    } catch (err) {
      console.error("Error in communication:", err);
      throw err;
    }
  }

  // Send RR Data (Send and receive request/response)
  public async sendRRData(data: Uint8Array): Promise<Uint8Array> {
    if (!this.conn) throw new Error("Not connected to any Ethernet/IP device");

    // Create a packet to send data
    const header = createEncapsulationHeader(
      CMD_SEND_RR_DATA,
      data.length,
      this.sessionHandle,
    );
    const packet = new Uint8Array([...header, ...data]);

    // Send the packet
    await this.conn.write(packet);

    // Read the response (Assuming we know the response size for simplicity)
    const response = new Uint8Array(ENCAPSULATION_HEADER_SIZE + data.length);
    await this.conn.read(response);

    return response;
  }

  // Unregister session (Close connection)
  public async unregisterSession(): Promise<void> {
    if (!this.conn) return;

    const header = createEncapsulationHeader(
      CMD_UNREGISTER_SESSION,
      0,
      this.sessionHandle,
    );
    await this.conn.write(header);
    this.conn.close();
    this.conn = null;
    console.log("Session unregistered.");
  }

  // Add this function to your EthernetIPDriver class
  async sendRRDataWithTimeout(
    data: Uint8Array,
    timeout: number = 5000,
  ): Promise<Uint8Array> {
    return Promise.race([
      this.sendRRData(data),
      new Promise<Uint8Array>((_, reject) =>
        setTimeout(() => reject(new Error("Request timed out")), timeout)
      ),
    ]);
  }
}

function createGetAttributeWithPath(
  classId: number,
  instanceId: number,
  attributeId: number,
  path: number[],
): Uint8Array {
  const serviceRequest = new Uint8Array([
    0x0E,
    classId,
    instanceId,
    attributeId,
  ]);
  const pathBuffer = new Uint8Array(path);
  return new Uint8Array([...serviceRequest, ...pathBuffer]);
}

// Usage in the driver:
async function main() {
  const driver = new EthernetIPDriver("192.168.50.133");

  try {
    await driver.registerSession();

    // Try to read the Product Name from the Identity Object
    const path = [0x20, 0x01, 0x24, 0x01];
    console.log("\nTrying to read Product Name from Identity Object");

    try {
      const requestData = createGetAttributeWithPath(0x01, 1, 7, path);
      const responseData = await driver.sendRRDataWithTimeout(
        requestData,
        5000,
      );

      console.log("Response status:", responseData[0]);
      console.log(
        "Full response:",
        Array.from(responseData).map((b) =>
          "0x" + b.toString(16).padStart(2, "0")
        ).join(", "),
      );

      if (responseData.length >= ENCAPSULATION_HEADER_SIZE + 6) {
        // Attempt to decode the product name as a string
        const dataView = new DataView(
          responseData.buffer,
          ENCAPSULATION_HEADER_SIZE + 2,
        );
        const length = dataView.getUint16(0, true);
        const productName = new TextDecoder().decode(
          new Uint8Array(
            responseData.buffer,
            ENCAPSULATION_HEADER_SIZE + 4,
            length,
          ),
        );
        console.log("Product Name:", productName);
      } else {
        console.log("Response too short to contain a value");
      }
    } catch (error) {
      console.error("Error:", error.message);
    }

    await driver.unregisterSession();
  } catch (error) {
    console.error("Error:", error);
  }
}

main();
