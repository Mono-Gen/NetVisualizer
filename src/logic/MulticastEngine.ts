/**
 * RFC 1112 compliance for Multicast IP to MAC mapping
 */

export const isMulticastIP = (ip: string): boolean => {
  const firstOctet = parseInt(ip.split('.')[0]);
  return firstOctet >= 224 && firstOctet <= 239;
};

export const isLinkLocalMulticast = (ip: string): boolean => {
  return ip.startsWith('224.0.0.');
};

/**
 * Maps an IPv4 Multicast address to an Ethernet Multicast address.
 * Logic: The low-order 23 bits of the IP address are mapped into the low-order 23 bits 
 * of the Ethernet multicast address 01-00-5E-00-00-00.
 */
export const multicastIPToMAC = (ip: string): string => {
  const parts = ip.split('.').map(Number);
  
  // Calculate the 23 bits from the last 3 octets
  // The second octet contributes 7 bits (0-127)
  const mac2 = parts[1] & 0x7F; 
  const mac3 = parts[2] & 0xFF;
  const mac4 = parts[3] & 0xFF;

  const toHex = (n: number) => n.toString(16).padStart(2, '0').toUpperCase();

  return `01:00:5E:${toHex(mac2)}:${toHex(mac3)}:${toHex(mac4)}`;
};

/**
 * Checks if a MAC address is a multicast MAC (01:00:5E:xx:xx:xx)
 */
export const isMulticastMAC = (mac: string): boolean => {
  return mac.startsWith('01:00:5E');
};
