export const isIpv4Address = (address: string) => {
  return /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(address);
};

export const isIpv6Address = (address: string) => {
  return /^\w{1,4}:\w{1,4}:\w{1,4}:\w{1,4}:\w{1,4}:\w{1,4}:\w{1,4}:\w{1,4}$/
    .test(address);
};
