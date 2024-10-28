export const parseReply = (raw: Uint8Array) => {
  const command = raw.subarray(0, 2);
  const commandStatus = raw.subarray(8, 12);
  return {
    command,
    commandStatus,
  };
};

export const readResponse = async (
  socket: Deno.TcpConn,
): Promise<Uint8Array> => {
  const buffer = new Uint8Array(1024); // Adjust buffer size as needed
  const bytesRead = await socket.read(buffer);
  if (bytesRead === null) {
    throw new Error("Connection closed");
  }
  return buffer.slice(0, bytesRead);
};
