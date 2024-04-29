// Size of the response packet header:
const HEADER_SIZE = 4; // This may need to be adjusted based on the actual header size, which isn't clear from the code or the image

// Fields that compose the header
let version, messageType;

module.exports = {
  message: "", // Bitstream of the cPTP header

  init: function (ver, msgType, peerTable) {
    // Fill out the default header fields:   
    const noOfPeers = peerTable.table.length;
    version = 9; // As per the new specification, the version is set to 9

    // Fill changing header fields:
    messageType = msgType;

    const senderName = stringToBytes(peerTable.owner.peerName);

    // Build the header bitstream:
    //--------------------------
    // Adjust the buffer size calculation if necessary
    this.message = Buffer.alloc(HEADER_SIZE + senderName.length + noOfPeers * (4 + 2 + 2));

    // Fill out the header array of byte with PTP header fields
    // Version (V)
    storeBitPacket(this.message, version, 0, 4);

    // Message Type (now using 7 bits instead of 8)
    storeBitPacket(this.message, messageType, 4, 7);

    // Number of Peers (using 9 bits instead of 8)
    storeBitPacket(this.message, noOfPeers, 11, 9);

    // Sender Name Size
    storeBitPacket(this.message, senderName.length, 20, 12);
    let byteMarker = HEADER_SIZE; // Adjusted to after the header fields

    // Sender Name
    let j = 0;
    for (let i = byteMarker; i < senderName.length + byteMarker; i++) {
      this.message[i] = senderName[j++];
    }

    // Peer information, if the number of peers is not zero
    if (noOfPeers > 0) {
      // Bit position after the sender name
      let bitMarker = (byteMarker + senderName.length) * 8;

      for (let k = 0; k < noOfPeers; k++) {
        // Extract the octets of the IP address
        const IP = peerTable.table[k].node.peerIP.split('.');
        const port = peerTable.table[k].node.peerPort;

        // Store IP Address octets
        IP.forEach(octet => {
          storeBitPacket(this.message, parseInt(octet), bitMarker, 8);
          bitMarker += 8;
        });

        // Store port number (2 bytes)
        storeBitPacket(this.message, port, bitMarker, 16);
        bitMarker += 16;

        // Placeholder for 2-byte buffer - Assuming it's just zeroed out
        storeBitPacket(this.message, 0, bitMarker, 16);
        bitMarker += 16;
      }
    }
  },

  // getPacket: returns the entire packet
  getPacket: function () {
    return this.message;
  },
};

function stringToBytes(str) {
  let ch, st, re = [];
  for (let i = 0; i < str.length; i++) {
    ch = str.charCodeAt(i); // get char
    st = []; // set up "stack"
    do {
      st.push(ch & 0xff); // push byte to stack
      ch = ch >>> 8; // shift value down by 1 byte
    } while (ch);
    // add stack contents to result
    // done because chars have "wrong" endianness
    re = re.concat(st.reverse());
  }
  // return an array of bytes
  return re;
}

// Store integer value into the packet bit stream
function storeBitPacket(packet, value, offset, length) {
  // let us get the actual byte position of the offset
  let lastBitPosition = offset + length - 1;
  const number = value.toString(2);
  let j = number.length - 1;
  for (let i = 0; i < number.length; i++) {
    const bytePosition = Math.floor(lastBitPosition / 8);
    const bitPosition = 7 - (lastBitPosition % 8);
    if (number.charAt(j--) === "0") {
      packet[bytePosition] &= ~(1 << bitPosition);
    } else {
      packet[bytePosition] |= 1 << bitPosition;
    }
    lastBitPosition--;
  }
}
