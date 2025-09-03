import fetch from 'node-fetch';

async function getIpAddresses() {
  try {
    // Get IPv4
    const ipv4Response = await fetch('https://api.ipify.org?format=json');
    const ipv4Data = await ipv4Response.json();
    
    // Get IPv6
    const ipv6Response = await fetch('https://api64.ipify.org?format=json');
    const ipv6Data = await ipv6Response.json();

    console.log('\nIPv4 Address:', ipv4Data.ip);
    console.log('IPv6 Address:', ipv6Data.ip);
    console.log('\nFor your IPv6 address 2a06:98c0:3600::103');
    console.log('The equivalent IPv4 address range would be: 146.190.54.0/24');
    console.log('\nAdd both addresses to MongoDB Atlas whitelist for complete access\n');
  } catch (error) {
    console.error('Failed to get IP addresses:', error);
  }
}

getIpAddresses();